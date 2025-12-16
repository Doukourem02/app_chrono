/**
 * Service centralisé de localisation
 * Gère le suivi continu de la position avec cache et optimisation de la batterie
 */

import * as Location from 'expo-location';
import { logger } from '../utils/logger';
import { useLocationStore } from '../store/useLocationStore';
import { config } from '../config';

export interface LocationCoords {
  latitude: number;
  longitude: number;
  accuracy?: number;
  timestamp: number;
}

export interface LocationAddress {
  address: string;
  coords: LocationCoords;
}

class LocationService {
  private watchSubscription: Location.LocationSubscription | null = null;
  private lastKnownLocation: LocationCoords | null = null;
  private lastKnownAddress: string | null = null;
  private reverseGeocodeCache: Map<string, { address: string; timestamp: number }> = new Map();
  private listeners: Set<(location: LocationCoords) => void> = new Set();
  private isWatching = false;
  private readonly CACHE_EXPIRY = 30 * 1000; // 30 secondes
  private readonly REVERSE_GEOCODE_CACHE_EXPIRY = 5 * 60 * 1000; // 5 minutes

  /**
   * Vérifie et demande les permissions de localisation
   */
  async requestPermissions(): Promise<boolean> {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      const granted = status === 'granted';
      
      useLocationStore.getState().setLocationPermission(granted ? 'granted' : 'denied');
      
      if (!granted) {
        logger.warn('Location permission denied', 'locationService');
      }
      
      return granted;
    } catch (error) {
      logger.error('Error requesting location permission', 'locationService', error);
      useLocationStore.getState().setLocationPermission('denied');
      return false;
    }
  }

  /**
   * Vérifie si les permissions sont déjà accordées
   */
  async checkPermissions(): Promise<boolean> {
    try {
      const { status } = await Location.getForegroundPermissionsAsync();
      const granted = status === 'granted';
      useLocationStore.getState().setLocationPermission(granted ? 'granted' : 'denied');
      return granted;
    } catch (error) {
      logger.error('Error checking location permission', 'locationService', error);
      return false;
    }
  }

  /**
   * Obtient la position actuelle (avec cache si récente)
   */
  async getCurrentPosition(forceRefresh = false): Promise<LocationCoords | null> {
    try {
      // Vérifier le cache si on ne force pas le rafraîchissement
      if (!forceRefresh && this.lastKnownLocation) {
        const age = Date.now() - this.lastKnownLocation.timestamp;
        if (age < this.CACHE_EXPIRY) {
          logger.debug('Using cached location', 'locationService', { age });
          return this.lastKnownLocation;
        }
      }

      const hasPermission = await this.checkPermissions();
      if (!hasPermission) {
        const granted = await this.requestPermissions();
        if (!granted) {
          return null;
        }
      }

      // Utiliser Balanced au lieu de BestForNavigation pour économiser la batterie
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced, // Équilibre entre précision et consommation
      });

      const coords: LocationCoords = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        accuracy: location.coords.accuracy || undefined,
        timestamp: Date.now(),
      };

      this.lastKnownLocation = coords;
      this.notifyListeners(coords);
      
      // Mettre à jour le store
      useLocationStore.getState().setCurrentLocation({
        latitude: coords.latitude,
        longitude: coords.longitude,
      });

      return coords;
    } catch (error) {
      logger.error('Error getting current position', 'locationService', error);
      return null;
    }
  }

  /**
   * Démarre le suivi continu de la position
   * Optimisé pour économiser la batterie
   */
  async startWatching(options?: {
    accuracy?: Location.Accuracy;
    timeInterval?: number;
    distanceInterval?: number;
  }): Promise<boolean> {
    if (this.isWatching) {
      logger.debug('Already watching location', 'locationService');
      return true;
    }

    try {
      const hasPermission = await this.checkPermissions();
      if (!hasPermission) {
        const granted = await this.requestPermissions();
        if (!granted) {
          return false;
        }
      }

      // Configuration optimisée pour économiser la batterie
      const watchOptions: Location.LocationOptions = {
        accuracy: options?.accuracy || Location.Accuracy.Balanced, // Balanced au lieu de BestForNavigation
        timeInterval: options?.timeInterval || 10000, // Mise à jour toutes les 10 secondes
        distanceInterval: options?.distanceInterval || 50, // Mise à jour tous les 50 mètres
      };

      this.watchSubscription = await Location.watchPositionAsync(
        watchOptions,
        (location) => {
          const coords: LocationCoords = {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
            accuracy: location.coords.accuracy || undefined,
            timestamp: Date.now(),
          };

          this.lastKnownLocation = coords;
          this.notifyListeners(coords);

          // Mettre à jour le store
          useLocationStore.getState().setCurrentLocation({
            latitude: coords.latitude,
            longitude: coords.longitude,
          });
        }
      );

      this.isWatching = true;
      logger.info('Started watching location', 'locationService');
      return true;
    } catch (error) {
      logger.error('Error starting location watch', 'locationService', error);
      this.isWatching = false;
      return false;
    }
  }

  /**
   * Arrête le suivi continu de la position
   */
  stopWatching(): void {
    if (this.watchSubscription) {
      this.watchSubscription.remove();
      this.watchSubscription = null;
      this.isWatching = false;
      logger.info('Stopped watching location', 'locationService');
    }
  }

  /**
   * Géocodage inverse avec Google Geocoding API pour correspondre à Google Maps
   * Utilise l'API Google au lieu d'Expo Location pour garantir la cohérence
   */
  async reverseGeocode(coords: LocationCoords, googleApiKey?: string): Promise<string | null> {
    // Utiliser une clé de cache plus précise (6 décimales au lieu de 4)
    // Cela évite les problèmes de cache pour des positions proches mais différentes
    const cacheKey = `${coords.latitude.toFixed(6)},${coords.longitude.toFixed(6)}`;
    const now = Date.now();

    // Vérifier le cache
    const cached = this.reverseGeocodeCache.get(cacheKey);
    if (cached && now - cached.timestamp < this.REVERSE_GEOCODE_CACHE_EXPIRY) {
      this.lastKnownAddress = cached.address;
      return cached.address;
    }

    // Vérifier si on a une clé Google API
    const apiKey = googleApiKey || config.googleApiKey || process.env.GOOGLE_API_KEY || process.env.EXPO_PUBLIC_GOOGLE_API_KEY;
    
    if (!apiKey || apiKey.startsWith('<')) {
      // Fallback sur Expo Location si pas de clé Google
      try {
        const geocoded = await Location.reverseGeocodeAsync({
          latitude: coords.latitude,
          longitude: coords.longitude,
        });

        if (geocoded && geocoded.length > 0) {
          const place = geocoded[0];
          const addressParts = [
            place.name,
            place.street,
            place.district,
            place.city || place.region,
          ];
          const address = addressParts.filter(Boolean).join(', ');

          if (address) {
            this.lastKnownAddress = address;
            this.reverseGeocodeCache.set(cacheKey, {
              address,
              timestamp: now,
            });

            // Mettre à jour le store
            const store = useLocationStore.getState();
            if (store.currentLocation) {
              store.setCurrentLocation({
                ...store.currentLocation,
                address,
              });
            }

            return address;
          }
        }
      } catch (error) {
        logger.warn('Expo reverse geocoding failed', 'locationService', { error, coords });
      }
      return null;
    }

    // Utiliser Google Geocoding API pour correspondre à Google Maps
    try {
      const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${coords.latitude},${coords.longitude}&key=${apiKey}&language=fr&region=ci`;
      const response = await fetch(url);
      const data = await response.json();

      if (data.status === 'OK' && data.results && data.results.length > 0) {
        // Fonction pour détecter si une adresse contient un Plus Code
        const isPlusCode = (address: string): boolean => {
          // Format Plus Code: généralement "XXXX+XX" ou "XXXX+XX, Lieu"
          const plusCodePattern = /^[A-Z0-9]{4,8}\+[A-Z0-9]{2,6}/i;
          return plusCodePattern.test(address);
        };

        // Fonction pour vérifier si un résultat contient une vraie adresse (pas un Plus Code)
        const hasRealAddress = (result: any): boolean => {
          const address = result.formatted_address || '';
          return !isPlusCode(address) && address.length > 10;
        };

        // Filtrer les résultats pour exclure les Plus Codes et garder seulement les vraies adresses
        const realAddressResults = data.results.filter(hasRealAddress);
        
        // Si aucun résultat valide, essayer de construire une adresse à partir des composants
        let bestAddress = '';
        let bestResult: any = null;
        
        // Priorité 1: street_address (adresse avec numéro de rue) - exclure les Plus Codes
        const streetAddress = realAddressResults.find((result: any) => 
          result.types.includes('street_address') && hasRealAddress(result)
        );
        
        if (streetAddress) {
          bestResult = streetAddress;
        } else {
          // Priorité 2: route (nom de la rue) - exclure les Plus Codes
          const route = realAddressResults.find((result: any) => 
            result.types.includes('route') && hasRealAddress(result)
          );
          
          if (route) {
            bestResult = route;
          } else {
            // Priorité 3: premise (bâtiment) - exclure les Plus Codes
            const premise = realAddressResults.find((result: any) => 
              result.types.includes('premise') && hasRealAddress(result)
            );
            
            if (premise) {
              bestResult = premise;
            } else {
              // Priorité 4: point_of_interest ou establishment - exclure les Plus Codes
              const poi = realAddressResults.find((result: any) => 
                (result.types.includes('point_of_interest') ||
                 result.types.includes('establishment')) && hasRealAddress(result)
              );
              
              if (poi) {
                bestResult = poi;
              } else {
                // Priorité 5: sublocality ou neighborhood (quartier)
                const neighborhood = realAddressResults.find((result: any) => 
                  (result.types.includes('sublocality') ||
                   result.types.includes('neighborhood')) && hasRealAddress(result)
                );
                
                if (neighborhood) {
                  bestResult = neighborhood;
                } else if (realAddressResults.length > 0) {
                  // Priorité 6: Prendre le premier résultat valide (pas un Plus Code)
                  bestResult = realAddressResults[0];
                } else {
                  // Dernier recours: construire une adresse à partir des composants
                  // Chercher un résultat avec des composants d'adresse valides
                  const resultWithComponents = data.results.find((result: any) => {
                    const components = result.address_components || [];
                    const hasStreet = components.some((c: any) => 
                      c.types.includes('route') || c.types.includes('street_number')
                    );
                    const hasLocality = components.some((c: any) => 
                      c.types.includes('locality') || c.types.includes('sublocality')
                    );
                    return hasStreet && hasLocality;
                  });
                  
                  if (resultWithComponents) {
                    const components = resultWithComponents.address_components || [];
                    const streetComponent = components.find((c: any) => 
                      c.types.includes('route')
                    );
                    const localityComponent = components.find((c: any) => 
                      c.types.includes('locality') || c.types.includes('sublocality')
                    );
                    
                    if (streetComponent && localityComponent) {
                      bestAddress = `${streetComponent.long_name}, ${localityComponent.long_name}`;
                    }
                  }
                }
              }
            }
          }
        }

        // Si on a un résultat valide, utiliser son formatted_address
        if (bestResult && !bestAddress) {
          bestAddress = bestResult.formatted_address;
        }
        
        // Nettoyer l'adresse pour la Côte d'Ivoire
        if (bestAddress) {
          bestAddress = bestAddress
            .replace(/, Côte d'Ivoire$/, '') // Supprimer le pays à la fin
            .replace(/,\s*Abidjan,\s*Abidjan/g, ', Abidjan') // Supprimer doublons
            .replace(/^Unnamed Road,?\s*/, '') // Supprimer "Unnamed Road"
            .replace(/^Route sans nom,?\s*/, '') // Supprimer "Route sans nom"
            .replace(/\s*,\s*$/, '') // Supprimer les virgules en fin
            .trim();

          // Vérifier une dernière fois qu'on n'a pas un Plus Code
          if (bestAddress && !isPlusCode(bestAddress) && bestAddress.length > 5) {
            this.lastKnownAddress = bestAddress;
            this.reverseGeocodeCache.set(cacheKey, {
              address: bestAddress,
              timestamp: now,
            });

            // Mettre à jour le store
            const store = useLocationStore.getState();
            if (store.currentLocation) {
              store.setCurrentLocation({
                ...store.currentLocation,
                address: bestAddress,
              });
            }

            logger.debug('Google reverse geocoding success', 'locationService', {
              coords: `${coords.latitude}, ${coords.longitude}`,
              address: bestAddress,
              types: bestResult?.types || [],
            });

            return bestAddress;
          } else {
            logger.warn('Address is Plus Code or too short, skipping', 'locationService', {
              address: bestAddress,
              coords: `${coords.latitude}, ${coords.longitude}`,
            });
          }
        }
      } else {
        // Si l'API n'est pas activée (REQUEST_DENIED), ne pas logger de warning
        // C'est un cas attendu si la facturation n'est pas activée
        const isApiNotEnabled = data.status === 'REQUEST_DENIED' || 
                                data.error_message?.includes('not authorized') ||
                                data.error_message?.includes('not enabled');
        
        if (!isApiNotEnabled) {
          logger.warn('Google Geocoding API failed', 'locationService', {
            status: data.status,
            errorMessage: data.error_message,
            coords: `${coords.latitude}, ${coords.longitude}`,
          });
        } else {
          // Logger en debug seulement pour éviter le spam
          logger.debug('Google Geocoding API not enabled, using fallback', 'locationService', {
            status: data.status,
            coords: `${coords.latitude}, ${coords.longitude}`,
          });
        }
      }

      // Fallback sur Expo Location si Google API échoue
      try {
        const geocoded = await Location.reverseGeocodeAsync({
          latitude: coords.latitude,
          longitude: coords.longitude,
        });

        if (geocoded && geocoded.length > 0) {
          const place = geocoded[0];
          const addressParts = [
            place.name,
            place.street,
            place.district,
            place.city || place.region,
          ];
          const address = addressParts.filter(Boolean).join(', ');

          if (address) {
            this.lastKnownAddress = address;
            this.reverseGeocodeCache.set(cacheKey, {
              address,
              timestamp: now,
            });

            return address;
          }
        }
      } catch (error) {
        logger.warn('Expo reverse geocoding fallback failed', 'locationService', { error });
      }

      return null;
    } catch (error) {
      logger.error('Google Geocoding API request failed', 'locationService', { error, coords });
      return null;
    }
  }

  /**
   * Obtient la dernière position connue
   */
  getLastKnownLocation(): LocationCoords | null {
    return this.lastKnownLocation;
  }

  /**
   * Obtient la dernière adresse connue
   */
  getLastKnownAddress(): string | null {
    return this.lastKnownAddress;
  }

  /**
   * Ajoute un listener pour les mises à jour de position
   */
  addListener(callback: (location: LocationCoords) => void): () => void {
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  }

  /**
   * Notifie tous les listeners d'une nouvelle position
   */
  private notifyListeners(location: LocationCoords): void {
    this.listeners.forEach((callback) => {
      try {
        callback(location);
      } catch (error) {
        logger.error('Error in location listener', 'locationService', error);
      }
    });
  }

  /**
   * Nettoie les ressources
   */
  cleanup(): void {
    this.stopWatching();
    this.listeners.clear();
    this.reverseGeocodeCache.clear();
    this.lastKnownLocation = null;
    this.lastKnownAddress = null;
  }
}

// Export singleton instance
export const locationService = new LocationService();

