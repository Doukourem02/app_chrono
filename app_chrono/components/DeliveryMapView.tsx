import React, { useMemo, useEffect, useState, useRef } from 'react';
import { StyleSheet, View, Text, Animated, Platform } from 'react-native';
import { MapView, Camera, PointAnnotation, MarkerView, ShapeSource, LineLayer, FillLayer, StyleImport } from '@rnmapbox/maps';
import type { MapRefHandle } from '../hooks/useMapLogic';
import { OnlineDriver } from '../hooks/useOnlineDrivers';
import { useRadarPulse } from '../hooks/useRadarPulse';
import { useAnimatedRoute } from '../hooks/useAnimatedRoute';
import { useAnimatedPosition } from '../hooks/useAnimatedPosition';
import { calculateFullETA } from '../utils/etaCalculator';
import { calculateDriverOffsets } from '../utils/markerOffset';
import { useWeather } from '../hooks/useWeather';
import { calculateBearing } from '../utils/bearingCalculator';
import { AnimatedVehicleMarker } from './AnimatedVehicleMarker';
import { ETABadge } from './ETABadge';

type Coordinates = {
  latitude: number;
  longitude: number;
};

const toLngLat = (c: Coordinates | { lat?: number; lng?: number }): [number, number] => {
  const lng = (c as Coordinates).longitude ?? (c as { lng?: number }).lng ?? 0;
  const lat = (c as Coordinates).latitude ?? (c as { lat?: number }).lat ?? 0;
  return [lng, lat];
};
function toCoords(c: Coordinates | { lat?: number; lng?: number } | null): Coordinates | null {
  if (!c) return null;
  const lat = (c as Coordinates).latitude ?? (c as { lat?: number }).lat;
  const lng = (c as Coordinates).longitude ?? (c as { lng?: number }).lng;
  if (lat == null || lng == null) return null;
  return { latitude: lat, longitude: lng };
}

function createCircleGeoJSON(center: Coordinates, radiusMeters: number, points = 64): GeoJSON.Polygon {
  const coords: [number, number][] = [];
  const latRad = (center.latitude * Math.PI) / 180;
  const mPerDegLat = 111320;
  const mPerDegLng = 111320 * Math.cos(latRad);
  for (let i = 0; i <= points; i++) {
    const angle = (i / points) * 2 * Math.PI;
    const lat = center.latitude + (radiusMeters / mPerDegLat) * Math.cos(angle);
    const lng = center.longitude + (radiusMeters / mPerDegLng) * Math.sin(angle);
    coords.push([lng, lat]);
  }
  return { type: 'Polygon', coordinates: [coords] };
}

function coordsToLineGeoJSON(coords: Coordinates[]): GeoJSON.LineString {
  return {
    type: 'LineString',
    coordinates: coords.map(toLngLat),
  };
}

interface DeliveryMapViewProps {
  mapRef: React.RefObject<MapRefHandle | null>;
  region: { latitude: number; longitude: number; latitudeDelta: number; longitudeDelta: number } | null;
  cameraAnimationDuration?: number;
  pickupCoords: Coordinates | { lat?: number; lng?: number } | null;
  /** Position utilisateur en temps réel (mise à jour par le GPS) */
  userLocationCoords?: Coordinates | null;
  dropoffCoords: Coordinates | { lat?: number; lng?: number } | null;
  displayedRouteCoords: Coordinates[];
  driverCoords: Coordinates | null;
  orderDriverCoords?: Coordinates | null;
  orderStatus?: string | null;
  onlineDrivers: OnlineDriver[];
  isSearchingDriver: boolean;
  destinationPulseAnim: Animated.Value;
  userPulseAnim: Animated.Value;
  durationText: string | null;
  arrivalTimeText?: string | null;
  searchSeconds: number;
  selectedMethod: string;
  availableVehicles: unknown[];
  showMethodSelection: boolean;
  onMapPress?: () => void;
  radarCoords?: Coordinates | null;
  /** Style de la carte : standard (avec numéros), light, dark, streets */
  mapStyle?: 'standard' | 'light' | 'dark' | 'streets';
}

export const DeliveryMapView: React.FC<DeliveryMapViewProps> = ({
  mapRef,
  region,
  cameraAnimationDuration = 0,
  pickupCoords,
  userLocationCoords,
  dropoffCoords,
  displayedRouteCoords,
  orderDriverCoords,
  orderStatus,
  onlineDrivers,
  isSearchingDriver,
  destinationPulseAnim,
  userPulseAnim,
  durationText,
  arrivalTimeText,
  searchSeconds,
  selectedMethod,
  availableVehicles,
  showMethodSelection,
  onMapPress,
  radarCoords,
  mapStyle = 'light',
}) => {
  const cameraRef = useRef<Camera>(null);
  const pickup = toCoords(pickupCoords);
  const dropoff = toCoords(dropoffCoords);
  const userLoc = toCoords(userLocationCoords ?? null);
  const { outerPulse, innerPulse } = useRadarPulse(isSearchingDriver);
  const radarCenter = toCoords(radarCoords ?? null) || pickup || null;
  const [outerRadius, setOuterRadius] = useState(0);
  const [innerRadius, setInnerRadius] = useState(0);
  const previousDriverCoordsRef = useRef<Coordinates | null>(null);

  const destination = useMemo(() => {
    return (orderStatus === 'accepted' || orderStatus === 'pending') ? pickup
      : (orderStatus === 'enroute' || orderStatus === 'picked_up') ? dropoff
      : null;
  }, [orderStatus, pickup, dropoff]);

  const animatedDriverPosition = useAnimatedPosition({
    currentPosition: orderDriverCoords || null,
    previousPosition: previousDriverCoordsRef.current || null,
    animationDuration: 5000,
  });

  useEffect(() => {
    if (orderDriverCoords) previousDriverCoordsRef.current = orderDriverCoords;
  }, [orderDriverCoords]);

  const driverBearing = useMemo(() => {
    if (!animatedDriverPosition) return 0;
    if (!previousDriverCoordsRef.current && destination) {
      return calculateBearing(animatedDriverPosition, destination);
    }
    if (previousDriverCoordsRef.current) {
      return calculateBearing(previousDriverCoordsRef.current, animatedDriverPosition);
    }
    return 0;
  }, [animatedDriverPosition, destination]);

  useEffect(() => {
    if (animatedDriverPosition) previousDriverCoordsRef.current = animatedDriverPosition;
  }, [animatedDriverPosition]);

  const driverToPickupRoute = useAnimatedRoute({
    origin: (orderStatus === 'accepted' || orderStatus === 'pending') && orderDriverCoords ? orderDriverCoords : null,
    destination: (orderStatus === 'accepted' || orderStatus === 'pending') && pickup ? pickup : null,
    enabled: !!(orderStatus === 'accepted' || orderStatus === 'pending') && !!orderDriverCoords && !!pickup,
  });

  const driverToDropoffRoute = useAnimatedRoute({
    origin: (orderStatus === 'enroute' || orderStatus === 'picked_up') && orderDriverCoords ? orderDriverCoords : null,
    destination: (orderStatus === 'enroute' || orderStatus === 'picked_up') && dropoff ? dropoff : null,
    enabled: !!(orderStatus === 'enroute' || orderStatus === 'picked_up') && !!orderDriverCoords && !!dropoff,
  });

  const weatherData = useWeather({
    latitude: animatedDriverPosition?.latitude || destination?.latitude || null,
    longitude: animatedDriverPosition?.longitude || destination?.longitude || null,
    vehicleType: selectedMethod === 'moto' ? 'moto' : selectedMethod === 'vehicule' ? 'vehicule' : selectedMethod === 'cargo' ? 'cargo' : null,
    enabled: !!animatedDriverPosition && !!destination,
  });

  const realTimeETA = useMemo(() => {
    if (!animatedDriverPosition || !destination) return null;
    const activeRoute = (orderStatus === 'accepted' || orderStatus === 'pending') ? driverToPickupRoute : driverToDropoffRoute;
    const trafficData = activeRoute?.trafficData || null;
    return calculateFullETA(
      animatedDriverPosition,
      destination,
      selectedMethod === 'moto' ? 'moto' : selectedMethod === 'vehicule' ? 'vehicule' : selectedMethod === 'cargo' ? 'cargo' : null,
      trafficData,
      weatherData.adjustment || null
    );
  }, [animatedDriverPosition, destination, orderStatus, selectedMethod, driverToPickupRoute, driverToDropoffRoute, weatherData.adjustment]);

  useEffect(() => {
    const outerId = outerPulse.addListener(({ value }) => setOuterRadius(120 + value * 220));
    const innerId = innerPulse.addListener(({ value }) => setInnerRadius(60 + value * 160));
    return () => {
      outerPulse.removeListener(outerId);
      innerPulse.removeListener(innerId);
    };
  }, [outerPulse, innerPulse]);

  useEffect(() => {
    if (!mapRef) return;
    mapRef.current = {
      fitToCoordinates: (coords: Coordinates[], opts: { edgePadding: { top: number; right: number; bottom: number; left: number }; animated: boolean }) => {
        if (coords.length === 0) return;
        if (!cameraRef.current) return;
        const lngs = coords.map((c) => c.longitude);
        const lats = coords.map((c) => c.latitude);
        const ne: [number, number] = [Math.max(...lngs), Math.max(...lats)];
        const sw: [number, number] = [Math.min(...lngs), Math.min(...lats)];
        const padding = opts.edgePadding ? [opts.edgePadding.top, opts.edgePadding.right, opts.edgePadding.bottom, opts.edgePadding.left] : 50;
        cameraRef.current.fitBounds(ne, sw, padding, opts.animated ? 1000 : 0);
      },
      animateToRegion: (reg: { latitude: number; longitude: number; latitudeDelta: number; longitudeDelta: number }, duration: number) => {
        if (!cameraRef.current) return;
        const zoomLevel = Math.round(14 - Math.log2(reg.latitudeDelta * 100));
        cameraRef.current.setCamera({
          centerCoordinate: [reg.longitude, reg.latitude],
          zoomLevel: Math.max(10, Math.min(18, zoomLevel)),
          animationDuration: duration,
        });
      },
    };
    return () => {
      if (mapRef.current) mapRef.current = null;
    };
  }, [mapRef]);

  const filteredOnlineDrivers = useMemo(() => {
    if (!onlineDrivers) return [];
    return onlineDrivers
      .filter((d) => d.is_online === true)
      .filter((d) => {
        if (!orderDriverCoords) return true;
        return Math.abs(d.current_latitude - orderDriverCoords.latitude) > 0.00001 || Math.abs(d.current_longitude - orderDriverCoords.longitude) > 0.00001;
      });
  }, [onlineDrivers, orderDriverCoords]);

  const zoomLevel = region
    ? Math.round(14 - Math.log2((region.latitudeDelta || 0.005) * 100))
    : 14;

  const driverOffsets = useMemo(
    () => calculateDriverOffsets(filteredOnlineDrivers, zoomLevel),
    [filteredOnlineDrivers, zoomLevel]
  );

  // Centre : priorité region (GPS) > pickupCoords (adresse sélectionnée) > Abidjan par défaut
  const centerCoords = region
    ? toLngLat(region)
    : pickup
      ? toLngLat(pickup)
      : [-4.0083, 5.36];
  if (Platform.OS === 'web') {
    return (
      <View style={styles.map}>
        <Text>Mapbox n&apos;est pas disponible sur web. Utilisez un dev build iOS/Android.</Text>
      </View>
    );
  }

  const styleURLs: Record<string, string> = {
    standard: 'mapbox://styles/mapbox/standard',
    light: 'mapbox://styles/mapbox/light-v11',
    dark: 'mapbox://styles/mapbox/dark-v11',
    streets: 'mapbox://styles/mapbox/streets-v12',
  };

  return (
    <MapView
      style={styles.map}
      styleURL={styleURLs[mapStyle]}
      compassEnabled={false}
      scaleBarEnabled={false}
      onPress={onMapPress}
    >
      {mapStyle === 'standard' && (
        <StyleImport
          id="basemap"
          existing
          config={{
            lightPreset: 'day',
            theme: 'default',
            show3dBuildings: 'true',
            showRoadLabels: 'true',
            showPlaceLabels: 'true',
          }}
        />
      )}
      <Camera
        ref={cameraRef}
        centerCoordinate={centerCoords}
        zoomLevel={zoomLevel}
        animationDuration={cameraAnimationDuration}
        animationMode={cameraAnimationDuration > 0 ? 'easeTo' : 'none'}
      />

      {filteredOnlineDrivers.map((driver) => {
        const offset = driverOffsets.get(driver.user_id);
        const pos = offset
          ? [offset.lng, offset.lat] as [number, number]
          : ([driver.current_longitude, driver.current_latitude] as [number, number]);
        return (
          <PointAnnotation
            key={driver.user_id}
            id={`driver-${driver.user_id}`}
            coordinate={pos}
            anchor={{ x: 0.5, y: 0.5 }}
          >
            <View style={styles.driverMarker} />
          </PointAnnotation>
        );
      })}

      {/* Marqueur position utilisateur (temps réel ou pickup par défaut) - masqué si on affiche pickupMarkerWithETA */}
      {(userLoc || pickup) && !(durationText && pickup && dropoff && !(animatedDriverPosition || orderDriverCoords)) && (
        <PointAnnotation
          id="user-loc"
          coordinate={toLngLat(userLoc || pickup!)}
          anchor={{ x: 0.5, y: 0.5 }}
        >
          <View style={styles.userLocationMarker}>
            <View style={styles.userLocationDot} />
          </View>
        </PointAnnotation>
      )}

      {isSearchingDriver && radarCenter && outerRadius > 0 && (
        <>
          <ShapeSource id="radar-outer" shape={createCircleGeoJSON(radarCenter, outerRadius)}>
            <FillLayer id="radar-outer-fill" style={{ fillColor: 'rgba(99,102,241,0.12)', fillOutlineColor: 'rgba(99,102,241,0.35)' }} />
          </ShapeSource>
          <ShapeSource id="radar-inner" shape={createCircleGeoJSON(radarCenter, innerRadius)}>
            <FillLayer id="radar-inner-fill" style={{ fillColor: 'rgba(99,102,241,0.18)', fillOutlineColor: 'rgba(99,102,241,0.45)' }} />
          </ShapeSource>
          <PointAnnotation id="radar-core" coordinate={toLngLat(radarCenter)} anchor={{ x: 0.5, y: 0.5 }}>
            <View style={styles.radarCore}>
              <View style={styles.radarCoreInner} />
            </View>
          </PointAnnotation>
        </>
      )}

      {/* Marqueur destination (dropoff) - badge sur le marqueur, lié au polyline */}
      {!isSearchingDriver && dropoff && orderStatus !== 'completed' && orderStatus !== 'cancelled' && orderStatus !== 'declined' && (
        <MarkerView coordinate={toLngLat(dropoff)} anchor={{ x: 0.5, y: 1 }} allowOverlap>
          <View style={styles.destinationMarkerWithBadge}>
            {arrivalTimeText && (() => {
              const match = arrivalTimeText.match(/arrive à (.+)/i);
              const time = match ? match[1] : arrivalTimeText;
              return <ETABadge value={time} unit="arrive" tailPosition="bottom" />;
            })()}
            <View style={styles.destinationMarker}>
              <View style={styles.destinationPin} />
            </View>
          </View>
        </MarkerView>
      )}

      {!isSearchingDriver && displayedRouteCoords.length > 0 && orderStatus !== 'completed' && orderStatus !== 'cancelled' && orderStatus !== 'declined' && (
        <ShapeSource id="route-main" shape={coordsToLineGeoJSON(displayedRouteCoords)}>
          <LineLayer id="route-main-line-outline" style={{ lineColor: '#FFFFFF', lineWidth: 5, lineJoin: 'round', lineCap: 'round' }} />
          <LineLayer id="route-main-line" style={{ lineColor: '#5B21B6', lineWidth: 3, lineJoin: 'round', lineCap: 'round' }} />
        </ShapeSource>
      )}

      {!isSearchingDriver && (animatedDriverPosition || orderDriverCoords) && orderStatus !== 'completed' && orderStatus !== 'cancelled' && orderStatus !== 'declined' && (
        <>
          <ShapeSource id="driver-circle" shape={createCircleGeoJSON(animatedDriverPosition || orderDriverCoords!, 38)}>
            <FillLayer id="driver-circle-fill" style={{ fillColor: 'rgba(139, 92, 246, 0.15)', fillOutlineColor: '#8B5CF6' }} />
          </ShapeSource>
          <MarkerView
            coordinate={toLngLat(animatedDriverPosition || orderDriverCoords!)}
            anchor={{ x: 0.5, y: 1 }}
            allowOverlap
          >
            <View style={styles.driverMarkerWithETA}>
              {realTimeETA && (() => {
                const isArrived = realTimeETA.formattedETA.toLowerCase().includes('arrivé')
                const isAtDropoff = orderStatus === 'picked_up' || orderStatus === 'delivering'
                const badgeUnit = isArrived && isAtDropoff ? 'Livrer à signer' : isArrived ? 'Arrivé' : 'min'
                const badgeValue = isArrived ? '✓' : realTimeETA.etaMinutes.toString()
                return <ETABadge value={badgeValue} unit={badgeUnit} />
              })()}
              <AnimatedVehicleMarker
                vehicleType={selectedMethod === 'moto' ? 'moto' : selectedMethod === 'cargo' ? 'cargo' : 'vehicule'}
                bearing={driverBearing}
                size={64}
                coordinate={animatedDriverPosition || orderDriverCoords!}
              />
            </View>
          </MarkerView>

          {(orderStatus === 'accepted' || orderStatus === 'pending') && animatedDriverPosition && pickup && driverToPickupRoute.animatedCoordinates.length > 0 && (
            <ShapeSource
              id="route-driver-pickup"
              shape={coordsToLineGeoJSON([animatedDriverPosition, ...driverToPickupRoute.animatedCoordinates.slice(1)])}
            >
              {/* Contour blanc pour contraste sur fond clair */}
              <LineLayer id="route-driver-pickup-line-outline" style={{ lineColor: '#FFFFFF', lineWidth: 5, lineJoin: 'round', lineCap: 'round' }} />
              <LineLayer id="route-driver-pickup-line" style={{ lineColor: '#5B21B6', lineWidth: 3, lineJoin: 'round', lineCap: 'round' }} />
            </ShapeSource>
          )}

          {(orderStatus === 'enroute' || orderStatus === 'picked_up') && animatedDriverPosition && dropoff && driverToDropoffRoute.animatedCoordinates.length > 0 && (
            <ShapeSource
              id="route-driver-dropoff"
              shape={coordsToLineGeoJSON([animatedDriverPosition, ...driverToDropoffRoute.animatedCoordinates.slice(1)])}
            >
              <LineLayer id="route-driver-dropoff-line-outline" style={{ lineColor: '#FFFFFF', lineWidth: 5, lineJoin: 'round', lineCap: 'round' }} />
              <LineLayer id="route-driver-dropoff-line" style={{ lineColor: '#5B21B6', lineWidth: 3, lineJoin: 'round', lineCap: 'round' }} />
            </ShapeSource>
          )}

          {/* Marqueur pickup - lié au polyline (début de route), pas de doublon avec dropoff */}
          {pickup && (
            <PointAnnotation id="pickup" coordinate={toLngLat(pickup)} anchor={{ x: 0.5, y: 0.5 }}>
              <View style={styles.pickupMarker}>
                <View style={styles.pickupPin} />
              </View>
            </PointAnnotation>
          )}
        </>
      )}

      {!isSearchingDriver && durationText && pickup && dropoff && orderStatus !== 'completed' && orderStatus !== 'cancelled' && orderStatus !== 'declined' && !(animatedDriverPosition || orderDriverCoords) && (
        <MarkerView coordinate={toLngLat(pickup)} anchor={{ x: 0.5, y: 1 }} allowOverlap>
          <View style={styles.pickupMarkerWithETA}>
            <ETABadge
              value={durationText.replace(/\s*(min|sec).*$/i, '').trim() || durationText}
              unit={durationText.toLowerCase().includes('sec') ? 'sec' : 'min'}
            />
            <View style={styles.pickupMarker}>
              <View style={styles.pickupPin} />
            </View>
          </View>
        </MarkerView>
      )}
    </MapView>
  );
};

const styles = StyleSheet.create({
  map: { flex: 1 },
  userLocationMarker: { width: 20, height: 20, alignItems: 'center', justifyContent: 'center' },
  userLocationDot: {
    width: 20, height: 20, borderRadius: 10, backgroundColor: '#1F2937', borderWidth: 2, borderColor: '#FFFFFF',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4, elevation: 5,
  },
  destinationMarkerWithBadge: {
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  destinationMarker: { alignItems: 'center', justifyContent: 'center', width: 20, height: 20 },
  destinationPin: {
    width: 20, height: 20, borderRadius: 10, backgroundColor: '#8B5CF6', borderWidth: 2, borderColor: '#FFFFFF',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4, elevation: 5,
  },
  pickupMarker: { alignItems: 'center', justifyContent: 'center', width: 20, height: 20 },
  pickupPin: {
    width: 20, height: 20, borderRadius: 10, backgroundColor: '#1F2937', borderWidth: 2, borderColor: '#FFFFFF',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4, elevation: 5,
  },
  dropoffMarker: { alignItems: 'center', justifyContent: 'center', width: 20, height: 20 },
  dropoffPin: {
    width: 20, height: 20, borderRadius: 10, backgroundColor: '#8B5CF6', borderWidth: 2, borderColor: '#FFFFFF',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4, elevation: 5,
  },
  radarCore: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: '#6366F1', borderWidth: 3, borderColor: '#FFFFFF',
    alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4, elevation: 6,
  },
  radarCoreInner: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#4C1D95' },
  driverMarkerWithETA: {
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  pickupMarkerWithETA: {
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  driverMarker: {
    width: 16, height: 16, borderRadius: 8, backgroundColor: '#8B5CF6', borderWidth: 2, borderColor: '#FFFFFF',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4, elevation: 5,
  },
});
