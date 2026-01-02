'use client'

import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import { Search, Filter } from 'lucide-react'
import { GoogleMap, Marker, Polyline, InfoWindow } from '@react-google-maps/api'
import { usePathname } from 'next/navigation'
import DeliveryCard from '@/components/tracking/DeliveryCard'
import { useGoogleMaps } from '@/contexts/GoogleMapsContext'
import { useRealTimeTracking } from '@/hooks/useRealTimeTracking'
import { useAnimatedPosition } from '@/hooks/useAnimatedPosition'
import { calculateFullETA } from '@/utils/etaCalculator'
import { extractTrafficData, type TrafficData } from '@/utils/trafficUtils'
import { fetchWeatherData, type WeatherAdjustment } from '@/utils/weatherUtils'
import { calculateDriverOffsets } from '@/utils/markerOffset'
import { ScreenTransition } from '@/components/animations'
import { SkeletonLoader } from '@/components/animations'
import { GoogleMapsBillingError } from '@/components/error/GoogleMapsBillingError'
import { GoogleMapsDeletedProjectError } from '@/components/error/GoogleMapsDeletedProjectError'
import { logger } from '@/utils/logger'

const DEFAULT_CENTER = { lat: 5.3600, lng: -4.0083 } 
const DELIVERY_ZOOM = 12.8
const OVERVIEW_ZOOM = 13.1

const mapContainerStyle = {
  width: '100%',
  height: '100%',
  borderRadius: '12px',
  overflow: 'hidden',
}

const minimalMapStyle: google.maps.MapTypeStyle[] = [
  {
    elementType: 'geometry',
    stylers: [{ color: '#F7F8FC' }],
  },
  {
    elementType: 'labels.icon',
    stylers: [{ visibility: 'off' }],
  },
  {
    elementType: 'labels.text.fill',
    stylers: [{ color: '#94A3B8' }],
  },
  {
    elementType: 'labels.text.stroke',
    stylers: [{ color: '#FFFFFF' }],
  },
  {
    featureType: 'administrative',
    elementType: 'geometry',
    stylers: [{ visibility: 'off' }],
  },
  {
    featureType: 'poi',
    stylers: [{ visibility: 'off' }],
  },
  {
    featureType: 'road',
    elementType: 'geometry',
    stylers: [{ color: '#E4E7EC' }],
  },
  {
    featureType: 'road',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#A0AEC0' }],
  },
  {
    featureType: 'road.highway',
    elementType: 'geometry',
    stylers: [{ color: '#C7D2FE' }],
  },
  {
    featureType: 'transit',
    stylers: [{ visibility: 'off' }],
  },
  {
    featureType: 'water',
    elementType: 'geometry',
    stylers: [{ color: '#D8E7FB' }],
  },
]

interface Delivery {
  id: string
  shipmentNumber: string
  type: string
  status: string
  createdAt?: string
  pickup: {
    name: string
    address: string
    coordinates?: { lat: number; lng: number } | null
  }
  dropoff: {
    name: string
    address: string
    coordinates?: { lat: number; lng: number } | null
  }
  driverId?: string
  userId?: string
  client?: {
    id: string
    email: string
    full_name?: string
    phone?: string
    avatar_url?: string
  } | null
  driver?: {
    id: string
    email: string
    full_name?: string
    phone?: string
    avatar_url?: string
  } | null
}

function TrackingMap({ 
  selectedDelivery, 
  isLoaded, 
  loadError,
  billingError,
  deletedProjectError,
  onlineDrivers,
  adminLocation,
}: { 
  selectedDelivery: Delivery | null
  isLoaded: boolean
  loadError: Error | undefined
  billingError?: boolean
  deletedProjectError?: boolean
  onlineDrivers: Array<{
    userId: string
    is_online: boolean
    is_available: boolean
    current_latitude?: number
    current_longitude?: number
    updated_at?: string
    vehicle_type?: 'moto' | 'vehicule' | 'cargo'
  }>
  adminLocation: { lat: number; lng: number }
}) {
  const [selectedDriverId, setSelectedDriverId] = useState<string | null>(null)
  const [closedDriverInfoIds, setClosedDriverInfoIds] = useState<Set<string>>(new Set())
  
  // Garder une trace de la position précédente pour l'animation fluide (pour le driver assigné)
  const [previousDriverPosition, setPreviousDriverPosition] = useState<{ lat: number; lng: number } | null>(null)
  
  // Garder une trace des positions précédentes de tous les drivers pour calculer le bearing
  const previousDriverPositionsRef = useRef<Map<string, { lat: number; lng: number }>>(new Map())
  
  const routePathFallback = useMemo(() => {
    if (selectedDelivery?.pickup?.coordinates && selectedDelivery?.dropoff?.coordinates) {
      return [
        selectedDelivery.pickup.coordinates,
        selectedDelivery.dropoff.coordinates,
      ]
    }
    return []
  }, [selectedDelivery])

  // Mettre à jour les positions précédentes des drivers pour calculer le bearing
  useEffect(() => {
    // Utiliser les drivers filtrés pour mettre à jour les positions précédentes
    const allDrivers = Array.from(onlineDrivers.values())
    allDrivers.forEach((driver) => {
      if (driver.current_latitude && driver.current_longitude) {
        const currentPosition = {
          lat: driver.current_latitude,
          lng: driver.current_longitude,
        }
        previousDriverPositionsRef.current.set(driver.userId, currentPosition)
      }
    })
  }, [onlineDrivers])

  // Suivre le niveau de zoom actuel de la carte
  const initialZoom = selectedDelivery && routePathFallback.length > 0 ? DELIVERY_ZOOM : OVERVIEW_ZOOM
  const [currentZoom, setCurrentZoom] = useState<number>(initialZoom)
  
  // Calculer les offsets pour séparer les marqueurs qui ont la même position
  // Le rayon s'ajuste automatiquement selon le niveau de zoom
  const driverOffsets = useMemo(() => {
    const validDrivers = onlineDrivers.filter(
      driver => driver.is_online === true && 
      driver.current_latitude && 
      driver.current_longitude
    )
    return calculateDriverOffsets(validDrivers, currentZoom)
  }, [onlineDrivers, currentZoom])
  
  // Données de trafic pour l'ETA
  const [trafficData, setTrafficData] = useState<TrafficData | null>(null)
  
  // Données météo pour l'ETA
  const [weatherAdjustment, setWeatherAdjustment] = useState<{ adjustment: WeatherAdjustment; weather: unknown; isDifficult: boolean } | null>(null)

  // Trouver le livreur assigné à la livraison sélectionnée
  const assignedDriver = useMemo(() => {
    if (!selectedDelivery || !selectedDelivery.driverId) return null
    return onlineDrivers.find(driver => driver.userId === selectedDelivery.driverId) || null
  }, [selectedDelivery, onlineDrivers])

  const mapOptions = useMemo(
    () => ({
      disableDefaultUI: true,
      zoomControl: true,
      styles: minimalMapStyle,
      backgroundColor: '#F7F8FC',
      trafficLayer: true, // Activer l'affichage du trafic
    }),
    []
  )

  const center = useMemo(() => {
    if (selectedDelivery?.pickup?.coordinates) {
      return {
        lat: selectedDelivery.pickup.coordinates.lat,
        lng: selectedDelivery.pickup.coordinates.lng,
      }
    }
    return adminLocation
  }, [selectedDelivery, adminLocation])

  const [fullRoutePath, setFullRoutePath] = useState<Array<{ lat: number; lng: number }>>([])
  const previousDeliveryIdRef = useRef<string | null>(null)

  // Fonction pour décoder le polyline encodé de Google
  const decodePolyline = useCallback((encoded: string): Array<{ lat: number; lng: number }> => {
    const points: Array<{ lat: number; lng: number }> = []
    let index = 0
    const len = encoded.length
    let lat = 0
    let lng = 0

    while (index < len) {
      let b: number
      let shift = 0
      let result = 0

      do {
        b = encoded.charCodeAt(index++) - 63
        result |= (b & 0x1f) << shift
        shift += 5
      } while (b >= 0x20)

      const dlat = ((result & 1) !== 0 ? ~(result >> 1) : (result >> 1))
      lat += dlat

      shift = 0
      result = 0

      do {
        b = encoded.charCodeAt(index++) - 63
        result |= (b & 0x1f) << shift
        shift += 5
      } while (b >= 0x20)

      const dlng = ((result & 1) !== 0 ? ~(result >> 1) : (result >> 1))
      lng += dlng

      points.push({
        lat: lat * 1e-5,
        lng: lng * 1e-5,
      })
    }

    return points
  }, [])

  // Fonction pour simplifier le polyline et éviter les auto-intersections (même logique que app_chrono)
  const simplifyRoute = useCallback((points: Array<{ lat: number; lng: number }>, tolerance = 0.00002): Array<{ lat: number; lng: number }> => {
    if (!points || points.length <= 2) return points

    const sqTolerance = tolerance * tolerance

    const sqDist = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => {
      const dx = a.lat - b.lat
      const dy = a.lng - b.lng
      return dx * dx + dy * dy
    }

    const simplifyRadialDistance = (pts: Array<{ lat: number; lng: number }>, sqTol: number) => {
      const newPoints: Array<{ lat: number; lng: number }> = [pts[0]]
      let prevPoint = pts[0]

      for (let i = 1; i < pts.length; i++) {
        const point = pts[i]
        if (sqDist(point, prevPoint) > sqTol) {
          newPoints.push(point)
          prevPoint = point
        }
      }

      if (prevPoint !== pts[pts.length - 1]) {
        newPoints.push(pts[pts.length - 1])
      }

      return newPoints
    }

    const sqSegDist = (p: { lat: number; lng: number }, a: { lat: number; lng: number }, b: { lat: number; lng: number }) => {
      let x = a.lat
      let y = a.lng
      let dx = b.lat - x
      let dy = b.lng - y

      if (dx !== 0 || dy !== 0) {
        const t = ((p.lat - x) * dx + (p.lng - y) * dy) / (dx * dx + dy * dy)
        if (t > 1) {
          x = b.lat
          y = b.lng
        } else if (t > 0) {
          x += dx * t
          y += dy * t
        }
      }

      dx = p.lat - x
      dy = p.lng - y

      return dx * dx + dy * dy
    }

    const simplifyDouglasPeucker = (pts: Array<{ lat: number; lng: number }>, sqTol: number) => {
      const last = pts.length - 1
      const stack: [number, number][] = [[0, last]]
      const keep: boolean[] = new Array(pts.length).fill(false)
      keep[0] = keep[last] = true

      while (stack.length) {
        const [start, end] = stack.pop()!
        let maxDist = 0
        let index = 0

        for (let i = start + 1; i < end; i++) {
          const dist = sqSegDist(pts[i], pts[start], pts[end])
          if (dist > maxDist) {
            index = i
            maxDist = dist
          }
        }

        if (maxDist > sqTol) {
          keep[index] = true
          stack.push([start, index], [index, end])
        }
      }

      return pts.filter((_, i) => keep[i])
    }

    const radialSimplified = simplifyRadialDistance(points, sqTolerance)
    return simplifyDouglasPeucker(radialSimplified, sqTolerance)
  }, [])

  useEffect(() => {
    if (!selectedDelivery?.pickup?.coordinates || !selectedDelivery?.dropoff?.coordinates || !window.google) {
      return
    }

    const currentDeliveryId = selectedDelivery.id
    const isNewDelivery = previousDeliveryIdRef.current !== currentDeliveryId
    
    if (isNewDelivery) {
      previousDeliveryIdRef.current = currentDeliveryId
      // Réinitialiser le chemin pour éviter d'afficher l'ancienne route pendant le chargement
      requestAnimationFrame(() => {
        setFullRoutePath([])
      })
    }

    const pickupCoords = selectedDelivery.pickup.coordinates
    const dropoffCoords = selectedDelivery.dropoff.coordinates
    
    // Vérifier que les coordonnées sont valides
    if (!pickupCoords || !dropoffCoords) {
      logger.warn('Coordonnées pickup ou dropoff manquantes')
      return
    }

    // Utiliser DirectionsService de Google Maps (déjà chargé) pour éviter les problèmes CORS
    const directionsService = new window.google.maps.DirectionsService()
    
    directionsService.route(
      {
        origin: pickupCoords,
        destination: dropoffCoords,
        travelMode: window.google.maps.TravelMode.DRIVING,
        provideRouteAlternatives: false,
        drivingOptions: {
          departureTime: new Date(), // Utiliser l'heure actuelle pour le trafic
          trafficModel: window.google.maps.TrafficModel.BEST_GUESS, // Modèle de trafic
        },
      },
      (result, status) => {
        // Vérifier que la livraison n'a pas changé pendant le chargement
        if (previousDeliveryIdRef.current !== currentDeliveryId) {
          return // Ignorer le résultat si la livraison a changé
        }

        if (status === window.google.maps.DirectionsStatus.OK && result?.routes?.[0]) {
          const route = result.routes[0]
          const leg = route.legs?.[0]
          
          // Extraire les données de trafic
          if (leg) {
            const traffic = extractTrafficData(leg)
            setTrafficData(traffic)
          }
          
          // Fonction pour s'assurer que le chemin commence et se termine exactement sur pickup et dropoff (même logique que app_chrono)
          const ensureExactEndpoints = (path: Array<{ lat: number; lng: number }>) => {
            if (!path || path.length === 0) return path
            
            const almostEqual = (a: { lat: number; lng: number }, b: { lat: number; lng: number }, eps = 0.0001) => {
              return Math.abs(a.lat - b.lat) < eps && Math.abs(a.lng - b.lng) < eps
            }
            
            let finalPath = [...path]
            
            // S'assurer que le premier point correspond exactement au pickup (ajouter au début si nécessaire)
            if (finalPath.length > 0 && pickupCoords && !almostEqual(finalPath[0], pickupCoords)) {
              finalPath = [{ lat: pickupCoords.lat, lng: pickupCoords.lng }, ...finalPath]
            }
            
            // S'assurer que le dernier point correspond exactement au dropoff (ajouter à la fin si nécessaire)
            if (finalPath.length > 0 && dropoffCoords && !almostEqual(finalPath[finalPath.length - 1], dropoffCoords)) {
              finalPath = [...finalPath, { lat: dropoffCoords.lat, lng: dropoffCoords.lng }]
            }
            
            return finalPath
          }
          
          // Utiliser overview_polyline exactement comme dans app_chrono
          const overviewPolyline = route.overview_polyline
          if (overviewPolyline && typeof overviewPolyline === 'object' && 'points' in overviewPolyline) {
            try {
              const encodedPoints = (overviewPolyline as { points: string }).points
              if (encodedPoints) {
                let points = decodePolyline(encodedPoints)
                // Simplifier exactement comme dans app_chrono (même tolérance 0.00002)
                points = simplifyRoute(points)
                // S'assurer que le chemin commence et se termine exactement sur pickup et dropoff
                const finalPath = ensureExactEndpoints(points)
                setFullRoutePath(finalPath)
                return
              }
            } catch (err) {
              logger.warn('Erreur décodage polyline:', err)
            }
          }
          
          // Fallback: utiliser overview_path si overview_polyline n'est pas disponible
          if (route.overview_path && route.overview_path.length > 1) {
            let overviewPath = route.overview_path.map((point) => ({
              lat: point.lat(),
              lng: point.lng(),
            }))
            // Simplifier exactement comme dans app_chrono (même tolérance 0.00002)
            overviewPath = simplifyRoute(overviewPath)
            // S'assurer que le chemin commence et se termine exactement sur pickup et dropoff
            const finalPath = ensureExactEndpoints(overviewPath)
            setFullRoutePath(finalPath)
            return
          }
        }
        
        // Ne pas utiliser le fallback (ligne droite) - laisser vide si Google Directions échoue
        // Seulement si la livraison n'a pas changé
        if (previousDeliveryIdRef.current === currentDeliveryId) {
          logger.warn('Google Directions API a échoué ou n\'a pas retourné de route valide')
          setFullRoutePath([])
        }
      }
    )
  }, [selectedDelivery, decodePolyline, simplifyRoute])

  // Calculer la position actuelle du véhicule (position réelle du livreur ou milieu de la route)
  // Ne retourner la position que si le livreur est en ligne
  const currentVehiclePosition = useMemo(() => {
    // Si on a un livreur assigné, en ligne, avec des coordonnées GPS, utiliser sa position réelle
    if (assignedDriver?.is_online === true && assignedDriver?.current_latitude && assignedDriver?.current_longitude) {
      return {
        lat: assignedDriver.current_latitude,
        lng: assignedDriver.current_longitude,
      }
    }
    // Ne pas afficher de position si le livreur n'est pas en ligne
    return null
  }, [assignedDriver])
  
  // Animation fluide de la position du driver
  const animatedDriverPosition = useAnimatedPosition({
    currentPosition: currentVehiclePosition,
    previousPosition: previousDriverPosition,
    animationDuration: 5000, // 5 secondes (fréquence GPS)
  })
  
  // Mettre à jour la position précédente quand la position actuelle change
  useEffect(() => {
    if (currentVehiclePosition) {
      requestAnimationFrame(() => {
        setPreviousDriverPosition(currentVehiclePosition)
      })
    }
  }, [currentVehiclePosition])
  
  // Calculer l'ETA en temps réel
  const realTimeETA = useMemo(() => {
    if (!animatedDriverPosition || !selectedDelivery) return null
    
    // Déterminer la destination selon le statut
    const destination = 
      (selectedDelivery.status === 'accepted' || selectedDelivery.status === 'enroute') 
        ? selectedDelivery.pickup?.coordinates 
        : selectedDelivery.status === 'picked_up'
        ? selectedDelivery.dropoff?.coordinates
        : null
    
    if (!destination) return null
    
    // Récupérer le type de véhicule depuis le driver (si disponible)
    const vehicleType = assignedDriver?.vehicle_type as 'moto' | 'vehicule' | 'cargo' | null
    
    return calculateFullETA(
      animatedDriverPosition,
      destination,
      vehicleType,
      trafficData,
      weatherAdjustment?.adjustment || null
    )
  }, [animatedDriverPosition, selectedDelivery, assignedDriver, trafficData, weatherAdjustment])
  
  // Charger les données météo
  useEffect(() => {
    if (!animatedDriverPosition || !selectedDelivery) {
      return
    }
    
    const destination = 
      (selectedDelivery.status === 'accepted' || selectedDelivery.status === 'enroute') 
        ? selectedDelivery.pickup?.coordinates 
        : selectedDelivery.status === 'picked_up'
        ? selectedDelivery.dropoff?.coordinates
        : null
    
    if (!destination) return
    
    const loadWeather = async () => {
      const vehicleType = assignedDriver?.vehicle_type as 'moto' | 'vehicule' | 'cargo' | null
      const data = await fetchWeatherData(destination.lat, destination.lng, vehicleType || null)
      if (data) {
        setWeatherAdjustment(data)
      }
    }
    
    loadWeather()
    
    // Recharger toutes les 10 minutes
    const interval = setInterval(loadWeather, 10 * 60 * 1000)
    return () => clearInterval(interval)
  }, [animatedDriverPosition, selectedDelivery, assignedDriver])



  const mapPlaceholderStyle: React.CSSProperties = {
    width: '100%',
    height: '100%',
    backgroundColor: '#F3F4F6',
    borderRadius: '12px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  }

  const mapPlaceholderTextStyle: React.CSSProperties = {
    fontSize: '14px',
    color: '#6B7280',
  }

      // Créer une clé unique pour forcer le re-render complet quand on change de livraison
      // Inclure aussi le statut pour forcer le refresh quand une commande est terminée
      const mapKey = useMemo(() => {
        if (!selectedDelivery) return 'map-default'
        return `map-${selectedDelivery.id}-${selectedDelivery.status}`
      }, [selectedDelivery])

  // Gérer les états de chargement et d'erreur
  if (loadError) {
    return (
      <div style={mapPlaceholderStyle}>
        {deletedProjectError ? (
          <GoogleMapsDeletedProjectError />
        ) : billingError ? (
          <GoogleMapsBillingError />
        ) : (
          <div style={{ textAlign: 'center', padding: '20px' }}>
        <p style={mapPlaceholderTextStyle}>Erreur de chargement de la carte</p>
            {loadError.message && (
              <p style={{ ...mapPlaceholderTextStyle, fontSize: '12px', marginTop: '8px', color: '#6B7280' }}>
                {loadError.message}
              </p>
          )}
        </div>
        )}
      </div>
    )
  }

  if (!isLoaded) {
    return (
      <div style={mapPlaceholderStyle}>
        <p style={mapPlaceholderTextStyle}>Chargement de la carte...</p>
      </div>
    )
  }

  return (
    <GoogleMap
      key={mapKey}
      mapContainerStyle={mapContainerStyle}
      center={center}
      zoom={selectedDelivery && routePathFallback.length > 0 ? DELIVERY_ZOOM : OVERVIEW_ZOOM}
      options={mapOptions}
      onLoad={(map) => {
        // Écouter les changements de zoom
        if (map && window.google?.maps?.event) {
          // Initialiser le zoom
          const mapZoom = map.getZoom()
          if (mapZoom !== undefined) {
            setCurrentZoom(mapZoom)
          }
          
          // Écouter les changements de zoom
          window.google.maps.event.addListener(map, 'zoom_changed', () => {
            const zoom = map.getZoom()
            if (zoom !== undefined) {
              setCurrentZoom(zoom)
            }
          })
        }
      }}
    >
      {/* Afficher uniquement le polyline et les marqueurs de la livraison sélectionnée */}
      {selectedDelivery && routePathFallback.length >= 2 && (
        <>
          {/* Polyline entre le point de départ et d'arrivée (route complète) - Violet, ligne continue */}
          {/* N'afficher QUE si on a une vraie route de Google Directions (pas de ligne droite) */}
          {fullRoutePath.length >= 2 && (
            <Polyline
              key={`polyline-full-${selectedDelivery.id}`}
              path={fullRoutePath}
              options={{
                strokeColor: '#6366F1',
                strokeWeight: 6,
                strokeOpacity: 1,
                zIndex: 1,
              }}
            />
          )}
          
          {/* Marqueur de départ (vert) */}
          <Marker
            key={`marker-pickup-${selectedDelivery.id}`}
            position={routePathFallback[0]}
            icon={{
              path: window.google?.maps?.SymbolPath?.CIRCLE || 0,
              scale: 10,
              fillColor: '#10B981',
              fillOpacity: 1,
              strokeColor: '#FFFFFF',
              strokeWeight: 2,
            }}
          />
          <InfoWindow position={routePathFallback[0]}>
            <div style={{ padding: '8px 10px', maxWidth: '250px' }}>
              <div style={{ fontWeight: 600, fontSize: '13px', marginBottom: '4px', lineHeight: '1.4' }}>
                {selectedDelivery.pickup?.name || 'Point de départ'}
              </div>
              <div style={{ fontSize: '11px', color: '#6B7280', marginBottom: selectedDelivery.driver ? '6px' : '0', lineHeight: '1.3' }}>
                {selectedDelivery.pickup?.address || ''}
              </div>
              {selectedDelivery.driver && (
                <div style={{ 
                  marginTop: '6px', 
                  paddingTop: '6px', 
                  borderTop: '1px solid #E5E7EB' 
                }}>
                  <div style={{ fontSize: '10px', color: '#9CA3AF', marginBottom: '2px', lineHeight: '1.2' }}>
                    Livreur assigné
                  </div>
                  <div style={{ fontWeight: 600, fontSize: '12px', color: '#111827', lineHeight: '1.3' }}>
                    {selectedDelivery.driver.full_name || 
                     (selectedDelivery.driverId ? `Livreur ${selectedDelivery.driverId.substring(0, 8)}` : 'Livreur')}
                  </div>
                </div>
              )}
            </div>
          </InfoWindow>
          
          {/* Marqueur d'arrivée (violet) */}
          <Marker
            key={`marker-dropoff-${selectedDelivery.id}`}
            position={routePathFallback[1]}
            icon={{
              path: window.google?.maps?.SymbolPath?.CIRCLE || 0,
              scale: 10,
              fillColor: '#8B5CF6',
              fillOpacity: 1,
              strokeColor: '#FFFFFF',
              strokeWeight: 2,
            }}
          />
          <InfoWindow position={routePathFallback[1]}>
            <div style={{ padding: '8px 10px', maxWidth: '250px' }}>
              <div style={{ fontWeight: 600, fontSize: '13px', marginBottom: '4px', lineHeight: '1.4' }}>
                {selectedDelivery.dropoff?.name || 'Point d\'arrivée'}
              </div>
              <div style={{ fontSize: '11px', color: '#6B7280', lineHeight: '1.3' }}>
                {selectedDelivery.dropoff?.address || ''}
              </div>
            </div>
          </InfoWindow>
          
          {/* Position actuelle du livreur (si assigné, en ligne et avec coordonnées GPS) - Animation fluide */}
          {animatedDriverPosition && assignedDriver && assignedDriver.is_online === true && (
            <>
              {/* Cercle pulsant pour la position actuelle du livreur */}
              <Marker
                key={`driver-inner-${selectedDelivery.id}`}
                position={animatedDriverPosition}
                icon={{
                  path: window.google?.maps?.SymbolPath?.CIRCLE || 0,
                  scale: 14,
                  fillColor: '#3B82F6',
                  fillOpacity: 0.8,
                  strokeColor: '#FFFFFF',
                  strokeWeight: 3,
                }}
                onClick={() => {
                  if (selectedDelivery?.id) {
                    setClosedDriverInfoIds(prev => {
                      const newSet = new Set(prev)
                      newSet.delete(selectedDelivery.id)
                      return newSet
                    })
                  }
                }}
              />
              {/* Cercle extérieur pulsant */}
              <Marker
                key={`driver-outer-${selectedDelivery.id}`}
                position={animatedDriverPosition}
                icon={{
                  path: window.google?.maps?.SymbolPath?.CIRCLE || 0,
                  scale: 24,
                  fillColor: '#3B82F6',
                  fillOpacity: 0.2,
                  strokeColor: '#3B82F6',
                  strokeWeight: 2,
                }}
              />
              {/* Affichage ETA en temps réel */}
              {realTimeETA && (
                <InfoWindow position={animatedDriverPosition}>
                  <div style={{ padding: '6px 8px', minWidth: '80px', textAlign: 'center' }}>
                    <div style={{ fontSize: '12px', fontWeight: 700, color: '#10B981' }}>
                      {realTimeETA.formattedETA}
                    </div>
                  </div>
                </InfoWindow>
              )}
              {/* InfoWindow pour le livreur en mouvement - toujours visible comme les autres marqueurs */}
              {!closedDriverInfoIds.has(selectedDelivery.id) && !realTimeETA && (
                <InfoWindow 
                  position={animatedDriverPosition}
                  onCloseClick={() => {
                    if (selectedDelivery?.id) {
                      setClosedDriverInfoIds(prev => new Set(prev).add(selectedDelivery.id))
                    }
                  }}
                >
                  <div style={{ padding: '8px 10px', maxWidth: '200px' }}>
                    <div style={{ fontWeight: 600, fontSize: '13px', marginBottom: '4px', color: '#111827', lineHeight: '1.4' }}>
                      {selectedDelivery.driver?.full_name || 
                       (assignedDriver?.userId ? `Livreur ${assignedDriver.userId.substring(0, 8)}` : 'Livreur')}
                    </div>
                    <div style={{ fontSize: '11px', color: '#6B7280', lineHeight: '1.3' }}>
                      {selectedDelivery.status === 'accepted' || selectedDelivery.status === 'enroute' 
                        ? 'En route vers le point de collecte'
                        : selectedDelivery.status === 'picked_up'
                        ? 'En route vers la destination'
                        : 'En livraison'}
                    </div>
                  </div>
                </InfoWindow>
              )}
            </>
          )}
        </>
      )}

          {/* Afficher tous les drivers connectés sur la carte */}
          {/* Note: onlineDrivers est déjà filtré pour ne contenir que les drivers en ligne avec coordonnées */}
          {(() => {
            if (onlineDrivers.length > 0) {
              if (process.env.NODE_ENV === 'development') {
                logger.debug('[TrackingMap] Tentative d\'affichage de', onlineDrivers.length, 'drivers sur la carte')
              }
            }
            return null
          })()}
          {onlineDrivers.map((driver) => {
            // Vérification de sécurité supplémentaire (normalement déjà filtré dans onlineDriversArray)
            const isOnlineStrict = driver.is_online === true
            const hasCoords = !!(driver.current_latitude && driver.current_longitude)
            
            if (!isOnlineStrict || !hasCoords) {
              if (process.env.NODE_ENV === 'development') {
                logger.warn('[TrackingMap] Driver filtré au dernier moment:', {
                  userId: driver.userId?.substring(0, 8),
                  is_online: driver.is_online,
                  is_online_strict: isOnlineStrict,
                  hasCoords,
                })
              }
              return null
            }
            
            if (process.env.NODE_ENV === 'development') {
              logger.debug('[TrackingMap] Affichage du driver:', {
                userId: driver.userId?.substring(0, 8),
                is_online: driver.is_online,
                coords: `${driver.current_latitude}, ${driver.current_longitude}`,
              })
            }
            
            // Type assertion car on a déjà vérifié que les coordonnées existent
            const originalPosition = {
              lat: driver.current_latitude!,
              lng: driver.current_longitude!,
            }
            
            // Obtenir la position avec offset (pour séparer les marqueurs superposés)
            const offsetData = driverOffsets.get(driver.userId)
            const driverPosition = offsetData 
              ? { lat: offsetData.lat, lng: offsetData.lng }
              : originalPosition
            
            // Créer l'icône personnalisée avec l'image deliveryman.png et rotation
            // Vérifier que Google Maps est chargé
            const deliverymanIcon: google.maps.Icon | null = window.google?.maps ? {
              url: '/assets/deliveryman.png', // Chemin relatif depuis public
              scaledSize: new window.google.maps.Size(64, 64),
              anchor: new window.google.maps.Point(32, 32), // Centrer l'icône
            } : null
            
            return (
              <React.Fragment key={`driver-${driver.userId}`}>
                <Marker
                  position={driverPosition}
                  icon={deliverymanIcon || {
                    path: window.google?.maps?.SymbolPath?.CIRCLE || 0,
                    scale: 8,
                    fillColor: '#3B82F6',
                    fillOpacity: 1,
                    strokeColor: '#FFFFFF',
                    strokeWeight: 2,
                  }}
                  onClick={() => setSelectedDriverId(selectedDriverId === driver.userId ? null : driver.userId)}
                />
                {selectedDriverId === driver.userId && (
                  <InfoWindow 
                    position={offsetData?.originalPosition || originalPosition} 
                    onCloseClick={() => setSelectedDriverId(null)}
                  >
                    <div style={{ padding: '4px' }}>
                      <div style={{ fontWeight: 600, fontSize: '14px', marginBottom: '4px' }}>
                        Driver {driver.userId.substring(0, 8)}
                      </div>
                      <div style={{ fontSize: '12px', color: '#6B7280' }}>
                        {driver.is_available ? 'Disponible' : 'Occupé'}
                      </div>
                      {offsetData && (
                        <div style={{ fontSize: '10px', color: '#9CA3AF', marginTop: '4px', fontStyle: 'italic' }}>
                          Position partagée avec {driverOffsets.size > 1 ? 'd\'autres livreurs' : 'un autre livreur'}
                        </div>
                      )}
                    </div>
                  </InfoWindow>
                )}
              </React.Fragment>
            )
          })}
    </GoogleMap>
  )
}

export default function TrackingPage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedDelivery, setSelectedDelivery] = useState<Delivery | null>(null)
  const [adminLocation, setAdminLocation] = useState<{ lat: number; lng: number }>(DEFAULT_CENTER)
  const pathname = usePathname()
  const hasLoadedRef = useRef(false)

  // Utiliser le contexte Google Maps partagé
  const { isLoaded, loadError, billingError, deletedProjectError } = useGoogleMaps()

  // Utiliser le suivi en temps réel
  const { onlineDrivers, ongoingDeliveries, isLoading, reloadData } = useRealTimeTracking()

  useEffect(() => {
    if (typeof window === 'undefined' || !navigator.geolocation) {
      return
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setAdminLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        })
      },
      (error) => {
        logger.warn('[TrackingPage] Impossible de récupérer la position admin:', error)
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60 * 1000,
      }
    )
  }, [])

  // Recharger les données quand on revient sur la page Tracking
  useEffect(() => {
    // Si c'est la première fois qu'on charge la page, marquer comme chargé
    if (!hasLoadedRef.current) {
      hasLoadedRef.current = true
      return
    }

    // Si on revient sur la page Tracking (pathname change vers /tracking)
    if (pathname === '/tracking') {
      if (process.env.NODE_ENV === 'development') {
        logger.debug('[TrackingPage] Retour sur la page Tracking, rechargement des données...')
      }
      // Recharger les données après un court délai pour s'assurer que le composant est monté
      const timer = setTimeout(() => {
        reloadData()
      }, 500)
      
      return () => clearTimeout(timer)
    }
  }, [pathname, reloadData])

  // Recharger aussi quand la page redevient visible (onglet du navigateur)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && pathname === '/tracking') {
        // Recharger les données quand on revient sur l'onglet
        if (process.env.NODE_ENV === 'development') {
          logger.debug('[TrackingPage] Onglet redevient visible, rechargement des données...')
        }
        reloadData()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [pathname, reloadData])

  // Ne plus charger les livraisons initiales ici - elles sont gérées par useRealTimeTracking
  // Le hook gère déjà le chargement via Socket.IO et l'API en fallback

  // Utiliser les vraies données du suivi en temps réel
  // Filtrer les commandes terminées ou annulées
  const filteredDeliveries = useMemo(() => {
    // Log pour déboguer les changements
    if (process.env.NODE_ENV === 'development') {
      logger.debug('[TrackingPage] filteredDeliveries recalculé:', {
        ongoingDeliveriesLength: ongoingDeliveries.length,
        timestamp: new Date().toISOString(),
        stack: new Error().stack?.split('\n').slice(2, 5).join('\n')
      })
    }
    
    const deliveries = ongoingDeliveries.length > 0 ? ongoingDeliveries : []
    if (!deliveries || deliveries.length === 0) {
      if (process.env.NODE_ENV === 'development') {
        logger.warn('[TrackingPage] Aucune livraison disponible')
      }
      return []
    }
    
    // Filtrer les commandes terminées ou annulées
    const activeDeliveries = deliveries.filter((delivery: Delivery) => 
      delivery.status !== 'completed' && delivery.status !== 'cancelled'
    )
    
    if (!searchQuery) return activeDeliveries
    
    return activeDeliveries.filter((delivery: Delivery) =>
      delivery.shipmentNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      delivery.pickup.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      delivery.dropoff.name.toLowerCase().includes(searchQuery.toLowerCase())
    )
  }, [ongoingDeliveries, searchQuery])

  // Sélectionner la première livraison par défaut
  useEffect(() => {
    if (filteredDeliveries.length > 0 && !selectedDelivery) {
      // Utiliser un setTimeout pour éviter le rendu synchrone
      const timer = setTimeout(() => {
        setSelectedDelivery(filteredDeliveries[0])
      }, 0)
      return () => clearTimeout(timer)
    }
  }, [filteredDeliveries, selectedDelivery])

  // Désélectionner la livraison si elle est terminée ou annulée
  useEffect(() => {
    if (selectedDelivery) {
      const isStillActive = filteredDeliveries.some(
        (delivery: Delivery) => delivery.id === selectedDelivery.id
      )
      
      if (!isStillActive) {
        // La livraison sélectionnée n'est plus dans la liste active
        // Désélectionner et sélectionner la première disponible
        const timer = setTimeout(() => {
          if (filteredDeliveries.length > 0) {
            setSelectedDelivery(filteredDeliveries[0])
          } else {
            setSelectedDelivery(null)
          }
        }, 0)
        return () => clearTimeout(timer)
      }
    }
  }, [filteredDeliveries, selectedDelivery])

  // Convertir les drivers en ligne en array pour l'affichage
  // Filtrer uniquement les drivers qui sont réellement en ligne
  const onlineDriversArray = useMemo(() => {
    const allDrivers = Array.from(onlineDrivers.values())
    
    // Vérifier si un driver est vraiment actif (mis à jour dans les 5 dernières minutes)
    const isDriverReallyActive = (driver: typeof allDrivers[0]): boolean => {
      if (!driver.updated_at) {
        // Si pas de date de mise à jour, considérer comme inactif
        return false
      }
      
      const updatedAt = new Date(driver.updated_at)
      const now = new Date()
      const diffInMinutes = (now.getTime() - updatedAt.getTime()) / (1000 * 60)
      
      // Si la dernière mise à jour date de plus de 5 minutes, considérer comme inactif
      return diffInMinutes <= 5
    }
    
    logger.debug(' [TrackingPage] DEBUG - Analyse des drivers:', {
      totalInMap: allDrivers.length,
      drivers: allDrivers.map((d) => {
        const updatedAt = d.updated_at ? new Date(d.updated_at) : null
        const now = new Date()
        const diffInMinutes = updatedAt ? (now.getTime() - updatedAt.getTime()) / (1000 * 60) : null
        const isActive = isDriverReallyActive(d)
        
        return {
          userId: d.userId?.substring(0, 8) || 'unknown',
          is_online: d.is_online,
          is_online_type: typeof d.is_online,
          is_online_strict: d.is_online === true,
          hasLat: !!d.current_latitude,
          hasLng: !!d.current_longitude,
          updated_at: d.updated_at,
          diffInMinutes: diffInMinutes !== null ? `${diffInMinutes.toFixed(1)} min` : 'N/A',
          isReallyActive: isActive,
        }
      }),
    })
    
    // Filtrer uniquement les drivers qui sont en ligne, ont des coordonnées ET sont actifs
    const filteredDrivers = allDrivers.filter((driver) => {
      // Vérification stricte : is_online doit être exactement true (pas truthy)
      const isOnline = driver.is_online === true
      const hasCoordinates = !!(driver.current_latitude && driver.current_longitude)
      const isActive = isDriverReallyActive(driver)
      const shouldDisplay = isOnline && hasCoordinates && isActive
      
      if (process.env.NODE_ENV === 'development') {
        if (!shouldDisplay) {
          const reasons = []
          if (!isOnline) reasons.push('hors ligne (is_online !== true)')
          if (!hasCoordinates) reasons.push('pas de coordonnées')
          if (!isActive) reasons.push('inactif (>5 min)')
          
          logger.debug(`[TrackingPage] Driver ${driver.userId?.substring(0, 8) || 'unknown'} FILTRÉ:`, {
            is_online: driver.is_online,
            is_online_strict: isOnline,
            hasCoordinates,
            isActive,
            updated_at: driver.updated_at,
            reasons: reasons.join(', '),
          })
        }
      }
      
      return shouldDisplay
    })
    
    logger.debug('[TrackingPage] Drivers après filtrage:', {
      total: allDrivers.length,
      filtered: filteredDrivers.length,
      willBeDisplayed: filteredDrivers.map((d) => d.userId?.substring(0, 8) || 'unknown'),
    })
    
    return filteredDrivers
  }, [onlineDrivers])

  // Fonction pour gérer la sélection d'une livraison
  const handleDeliverySelect = (delivery: Delivery) => {
    setSelectedDelivery(delivery)
  }

  const containerStyle: React.CSSProperties = {
    display: 'flex',
    height: '100vh',
    gap: '24px',
    padding: '24px',
    backgroundColor: '#F5F6FA',
  }

  const leftPanelStyle: React.CSSProperties = {
    width: '420px',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
    overflow: 'hidden',
  }

  const searchContainerStyle: React.CSSProperties = {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
  }

  const searchIconStyle: React.CSSProperties = {
    position: 'absolute',
    left: '16px',
    color: '#6B7280',
    pointerEvents: 'none',
  }

  const searchInputStyle: React.CSSProperties = {
    width: '100%',
    paddingLeft: '48px',
    paddingRight: '48px',
    paddingTop: '12px',
    paddingBottom: '12px',
    backgroundColor: '#FFFFFF',
    borderRadius: '12px',
    border: '1px solid #E5E7EB',
    fontSize: '14px',
    outline: 'none',
  }

  const filterButtonStyle: React.CSSProperties = {
    position: 'absolute',
    right: '12px',
    padding: '8px',
    backgroundColor: 'transparent',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
  }

  const titleStyle: React.CSSProperties = {
    fontSize: '18px',
    fontWeight: 700,
    color: '#111827',
    marginBottom: '16px',
  }

  const deliveriesListStyle: React.CSSProperties = {
    flex: 1,
    overflowY: 'auto',
    paddingRight: '8px',
  }

  const rightPanelStyle: React.CSSProperties = {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: '16px',
    padding: '16px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
    border: '1px solid #F3F4F6',
    overflow: 'hidden',
  }

  const emptyStateStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    color: '#6B7280',
  }

  return (
    <ScreenTransition direction="fade" duration={0.3}>
      <div style={containerStyle}>
      {/* Panneau gauche : Liste des livraisons */}
      <div style={leftPanelStyle}>
        <div style={searchContainerStyle}>
          <Search size={20} style={searchIconStyle} />
          <input
            type="text"
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={searchInputStyle}
          />
          <button
            style={filterButtonStyle}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#F3F4F6'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent'
            }}
          >
            <Filter size={20} style={{ color: '#6B7280' }} />
          </button>
        </div>

        <h2 style={titleStyle}>Ongoing Delivery</h2>

        <div style={deliveriesListStyle}>
          {isLoading ? (
            <div style={emptyStateStyle}>
              <SkeletonLoader width="100%" height={200} borderRadius={16} />
              <SkeletonLoader width="100%" height={200} borderRadius={16} style={{ marginTop: '16px' }} />
              <SkeletonLoader width="100%" height={200} borderRadius={16} style={{ marginTop: '16px' }} />
            </div>
          ) : filteredDeliveries.length === 0 ? (
            <div style={emptyStateStyle}>
              <p>Aucune livraison en cours</p>
            </div>
          ) : (
            filteredDeliveries.map((delivery: Delivery, index: number) => (
              <DeliveryCard
                key={delivery.id}
                delivery={delivery}
                isSelected={selectedDelivery?.id === delivery.id}
                onSelect={() => handleDeliverySelect(delivery)}
                index={index}
              />
            ))
          )}
        </div>
      </div>

      {/* Panneau droit : Carte */}
      <div style={rightPanelStyle}>
        <TrackingMap 
          selectedDelivery={selectedDelivery} 
          isLoaded={isLoaded}
          loadError={loadError}
          billingError={billingError}
          deletedProjectError={deletedProjectError}
          onlineDrivers={onlineDriversArray}
          adminLocation={adminLocation}
        />
      </div>
    </div>
    </ScreenTransition>
  )
}
