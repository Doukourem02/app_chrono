/**
 * Service centralisé de localisation
 * Gère le suivi continu de la position avec cache et optimisation de la batterie
 * Reverse geocoding : Mapbox (priorité) > Nominatim > Expo - aligné avec admin_chrono
 */

import * as Location from 'expo-location';
import { logger } from '../utils/logger';
import { useLocationStore } from '../store/useLocationStore';
import { config } from '../config';
import { mapboxReverseGeocode } from '../utils/mapboxReverseGeocode';
import { nominatimReverseGeocode } from '../utils/nominatimReverseGeocode';

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
  private foregroundRefreshListeners: Set<(location: LocationCoords) => void> = new Set();
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

  private applyCoordsToStoreAndNotify(coords: LocationCoords): void {
    this.lastKnownLocation = coords;
    this.notifyListeners(coords);
    const prev = useLocationStore.getState().currentLocation;
    useLocationStore.getState().setCurrentLocation({
      latitude: coords.latitude,
      longitude: coords.longitude,
      address: prev?.address,
    });
  }

  /**
   * Dernière position connue du système (souvent immédiate) + raffinement GPS en arrière-plan.
   * Réduit le temps avant la première position exploitable (le header n’affiche plus d’état de chargement).
   */
  private scheduleGpsRefinement(forceHighestAccuracy: boolean): void {
    void Location.getCurrentPositionAsync({
      accuracy: forceHighestAccuracy ? Location.Accuracy.Highest : Location.Accuracy.Balanced,
    })
      .then(async (loc) => {
        const refined: LocationCoords = {
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
          accuracy: loc.coords.accuracy || undefined,
          timestamp: Date.now(),
        };
        this.applyCoordsToStoreAndNotify(refined);
        await this.reverseGeocode(refined);
      })
      .catch((err) => {
        logger.debug('GPS refinement skipped or failed', 'locationService', { err });
      });
  }

  /**
   * Obtient la position actuelle (avec cache si récente)
   */
  async getCurrentPosition(forceRefresh = false): Promise<LocationCoords | null> {
    try {
      // Cache mémoire récent : retour immédiat
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

      // Pas de raccourci « last known OS » si l’utilisateur force un vrai fix
      if (!forceRefresh) {
        try {
          const lk = await Location.getLastKnownPositionAsync({ maxAge: 10 * 60 * 1000 });
          if (lk?.coords) {
            const quick: LocationCoords = {
              latitude: lk.coords.latitude,
              longitude: lk.coords.longitude,
              accuracy: lk.coords.accuracy || undefined,
              timestamp: Date.now(),
            };
            this.applyCoordsToStoreAndNotify(quick);
            this.scheduleGpsRefinement(false);
            logger.debug('Returned OS last-known position; GPS refinement scheduled', 'locationService');
            return quick;
          }
        } catch {
          /* pas de snapshot OS — fix GPS classique */
        }
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: forceRefresh ? Location.Accuracy.Highest : Location.Accuracy.Balanced,
      });

      const coords: LocationCoords = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        accuracy: location.coords.accuracy || undefined,
        timestamp: Date.now(),
      };

      this.applyCoordsToStoreAndNotify(coords);

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

      const watchOptions: Location.LocationOptions = {
        accuracy: options?.accuracy || Location.Accuracy.High,
        timeInterval: options?.timeInterval || 5000,
        distanceInterval: options?.distanceInterval || 10,
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
   * Géocodage inverse : Mapbox (priorité) > Nominatim > Expo
   * Mapbox donne des adresses précises (ex: Rue Panama City, 772) comme admin_chrono
   */
  async reverseGeocode(coords: LocationCoords): Promise<string | null> {
    const cacheKey = `${coords.latitude.toFixed(6)},${coords.longitude.toFixed(6)}`;
    const now = Date.now();

    const persistAddressToStore = (address: string) => {
      this.lastKnownAddress = address;
      const store = useLocationStore.getState();
      const prev = store.currentLocation;
      if (prev) {
        store.setCurrentLocation({ ...prev, address });
      } else {
        store.setCurrentLocation({
          latitude: coords.latitude,
          longitude: coords.longitude,
          address,
        });
      }
    };

    const cached = this.reverseGeocodeCache.get(cacheKey);
    const isVagueNeighborhood = (addr: string) =>
      !/(\d+|rue|avenue|boulevard|route|street|av\.|bd|impasse|allée)/i.test(addr);
    if (cached && now - cached.timestamp < this.REVERSE_GEOCODE_CACHE_EXPIRY) {
      // Ne pas réutiliser un cache de quartier vague (ex: "Cité Colombe")
      if (!isVagueNeighborhood(cached.address)) {
        persistAddressToStore(cached.address);
        return cached.address;
      }
      this.reverseGeocodeCache.delete(cacheKey);
    }

    const saveAndReturn = (address: string): string => {
      this.reverseGeocodeCache.set(cacheKey, { address, timestamp: now });
      persistAddressToStore(address);
      return address;
    };

    // 1. Mapbox en priorité (aligné admin_chrono)
    const mapboxToken = config.mapboxAccessToken || process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN;
    if (mapboxToken && !mapboxToken.startsWith('<')) {
      try {
        const address = await mapboxReverseGeocode(
          coords.latitude,
          coords.longitude,
          mapboxToken,
          { language: 'fr', country: 'ci', types: 'address' }
        );
        // Rejeter les quartiers vagues (ex: "Cité Colombe") sans rue/numéro → laisser Nominatim essayer
        const hasStreetOrNumber = /(\d+|rue|avenue|boulevard|route|street|av\.|bd|impasse|allée)/i.test(address || '');
        if (address && address.length > 5 && !/^Abidjan(,|$)/.test(address) && hasStreetOrNumber) {
          logger.debug('Mapbox reverse geocoding success', 'locationService', { coords: cacheKey, address });
          return saveAndReturn(address);
        }
      } catch (err) {
        logger.warn('Mapbox reverse geocoding failed', 'locationService', { error: err });
      }
    }

    // 2. Nominatim (OSM) - bonne couverture Abidjan, rues précises (Rue Panama City, etc.)
    try {
      const address = await nominatimReverseGeocode(coords.latitude, coords.longitude);
      if (address && address.length > 5) {
        logger.debug('Nominatim reverse geocoding success', 'locationService', { coords: cacheKey, address });
        return saveAndReturn(address);
      }
    } catch (err) {
      logger.warn('Nominatim reverse geocoding failed', 'locationService', { error: err });
    }

    // 3. Fallback Expo Location
    try {
      const geocoded = await Location.reverseGeocodeAsync({
        latitude: coords.latitude,
        longitude: coords.longitude,
      });

      if (geocoded && geocoded.length > 0) {
        const place = geocoded[0];
        const addressParts = [place.name, place.street, place.district, place.city || place.region];
        const address = addressParts.filter(Boolean).join(', ');
        if (address) return saveAndReturn(address);
      }
    } catch (error) {
      logger.warn('Expo reverse geocoding failed', 'locationService', { error, coords });
      return null;
    }

    return null;
  }

  /**
   * Hydrate le cache mémoire depuis le store persisté (AsyncStorage) pour un affichage immédiat
   * tout en forçant un nouveau fix GPS au prochain getCurrentPosition (timestamp volontairement vieux).
   */
  applyPersistedSnapshot(loc: { latitude: number; longitude: number; address?: string }): void {
    if (loc.latitude == null || loc.longitude == null) return;
    if (!Number.isFinite(loc.latitude) || !Number.isFinite(loc.longitude)) return;
    this.lastKnownLocation = {
      latitude: loc.latitude,
      longitude: loc.longitude,
      timestamp: Date.now() - this.CACHE_EXPIRY - 1,
    };
    if (loc.address?.trim()) {
      this.lastKnownAddress = loc.address.trim();
    }
  }

  /**
   * Au retour premier plan : fix GPS frais + géocodage, puis notifie la carte (listeners dédiés).
   */
  async refreshOnForeground(): Promise<void> {
    try {
      const permitted = await this.checkPermissions();
      if (!permitted) {
        return;
      }
      const coords = await this.getCurrentPosition(true);
      if (!coords) {
        return;
      }
      await this.reverseGeocode(coords);
      this.foregroundRefreshListeners.forEach((cb) => {
        try {
          cb(coords);
        } catch (error) {
          logger.error('Error in foregroundRefresh listener', 'locationService', error);
        }
      });
    } catch (error) {
      logger.warn('refreshOnForeground failed', 'locationService', error);
    }
  }

  /** S’abonner aux rafraîchissements « retour app » (carte + prise en charge alignées sur le header). */
  onForegroundRefreshComplete(cb: (location: LocationCoords) => void): () => void {
    this.foregroundRefreshListeners.add(cb);
    return () => {
      this.foregroundRefreshListeners.delete(cb);
    };
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
    this.foregroundRefreshListeners.clear();
    this.reverseGeocodeCache.clear();
    this.lastKnownLocation = null;
    this.lastKnownAddress = null;
  }
}

// Export singleton instance
export const locationService = new LocationService();
