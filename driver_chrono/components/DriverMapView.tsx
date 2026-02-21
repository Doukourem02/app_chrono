import React, { useEffect, useRef } from 'react';
import { StyleSheet, View, Text, Platform } from 'react-native';
import { MapView, Camera, PointAnnotation, ShapeSource, LineLayer } from '@rnmapbox/maps';
import type { MapRefHandle } from '../hooks/useMapCamera';

type Coordinates = {
  latitude: number;
  longitude: number;
};

const toLngLat = (c: Coordinates): [number, number] => [c.longitude, c.latitude];

function coordsToLineGeoJSON(coords: Coordinates[]): GeoJSON.LineString {
  return {
    type: 'LineString',
    coordinates: coords.map(toLngLat),
  };
}

/** Décale le point de départ de la ligne pour qu'elle s'arrête au bord du cercle (comme image 1) */
const OFFSET_METERS = 55;

function offsetLineStartFromMarker(
  markerPos: Coordinates,
  routeCoords: Coordinates[]
): Coordinates[] {
  if (routeCoords.length < 2) return routeCoords;
  const next = routeCoords[1];
  const R = 6371000;
  const lat1 = (markerPos.latitude * Math.PI) / 180;
  const lat2 = (next.latitude * Math.PI) / 180;
  const dLat = ((next.latitude - markerPos.latitude) * Math.PI) / 180;
  const dLon = ((next.longitude - markerPos.longitude) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const totalDist = R * c;
  if (totalDist < OFFSET_METERS) return routeCoords;
  const f = OFFSET_METERS / totalDist;
  const start: Coordinates = {
    latitude: markerPos.latitude + f * (next.latitude - markerPos.latitude),
    longitude: markerPos.longitude + f * (next.longitude - markerPos.longitude),
  };
  return [start, ...routeCoords.slice(1)];
}

interface DriverMapViewProps {
  mapRef: React.RefObject<MapRefHandle | null>;
  location: Coordinates | null;
  animatedDriverPosition: Coordinates | null;
  animatedRouteCoords: Coordinates[];
  orderFullRouteCoords: Coordinates[];
  currentPickupCoord: Coordinates | null;
  currentDropoffCoord: Coordinates | null;
  activeOrders: {
    id: string;
    pickup?: unknown;
    dropoff?: unknown;
    status?: string;
    user?: { name?: string };
  }[];
  pendingOrders: {
    id: string;
    pickup?: unknown;
    dropoff?: unknown;
    status?: string;
  }[];
  resolveCoords: (candidate?: unknown) => Coordinates | null;
  calculateDistanceToPickup: (order: unknown) => number | null;
  setSelectedOrder: (orderId: string) => void;
  isOnline: boolean;
}

export const DriverMapView: React.FC<DriverMapViewProps> = ({
  mapRef,
  location,
  animatedDriverPosition,
  animatedRouteCoords,
  orderFullRouteCoords,
  currentPickupCoord,
  currentDropoffCoord,
  activeOrders,
  pendingOrders,
  resolveCoords,
  setSelectedOrder,
  isOnline,
}) => {
  const cameraRef = useRef<Camera>(null);

  useEffect(() => {
    if (!cameraRef.current || !mapRef) return;
    mapRef.current = {
      fitToCoordinates: (coords: Coordinates[], opts: { edgePadding: { top: number; right: number; bottom: number; left: number }; animated: boolean }) => {
        if (coords.length === 0) return;
        const lngs = coords.map((c) => c.longitude);
        const lats = coords.map((c) => c.latitude);
        const ne: [number, number] = [Math.max(...lngs), Math.max(...lats)];
        const sw: [number, number] = [Math.min(...lngs), Math.min(...lats)];
        const padding = opts.edgePadding ? [opts.edgePadding.top, opts.edgePadding.right, opts.edgePadding.bottom, opts.edgePadding.left] : 50;
        cameraRef.current?.fitBounds(ne, sw, padding, opts.animated ? 1000 : 0);
      },
      animateToRegion: (reg: { latitude: number; longitude: number; latitudeDelta: number; longitudeDelta: number }, duration: number) => {
        const zoomLevel = Math.round(14 - Math.log2(reg.latitudeDelta * 100));
        cameraRef.current?.setCamera({
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

  const defaultCenter: [number, number] = location
    ? [location.longitude, location.latitude]
    : [-4.024429, 5.345317];
  const defaultZoom = 14;

  if (Platform.OS === 'web') {
    return (
      <View style={styles.map}>
        <Text>Mapbox n&apos;est pas disponible sur web. Utilisez un dev build iOS/Android.</Text>
      </View>
    );
  }

  const driverPos = animatedDriverPosition || location;

  return (
    <MapView
      style={styles.map}
      styleURL="mapbox://styles/mapbox/light-v11"
      compassEnabled={false}
      scaleBarEnabled={false}
    >
      <Camera
        ref={cameraRef}
        centerCoordinate={defaultCenter}
        zoomLevel={defaultZoom}
        animationDuration={0}
      />

      {/* Marqueur driver - simple comme app_chrono (userLocationDot) */}
      {isOnline && driverPos && (
        <PointAnnotation id="driver" coordinate={toLngLat(driverPos)} anchor={{ x: 0.5, y: 0.5 }}>
          <View style={styles.driverMarker} collapsable={false}>
            <View style={styles.driverPin} />
          </View>
        </PointAnnotation>
      )}

      {/* Route complète pickup -> dropoff - uniquement si pas de route-active (évite double ligne) */}
      {currentPickupCoord && currentDropoffCoord && orderFullRouteCoords.length >= 2 &&
       !(isOnline && driverPos && animatedRouteCoords.length >= 2) && (
        <ShapeSource
          id="route-full"
          shape={coordsToLineGeoJSON(offsetLineStartFromMarker(currentPickupCoord, orderFullRouteCoords))}
        >
          <LineLayer id="route-full-line-outline" style={{ lineColor: '#FFFFFF', lineWidth: 5, lineJoin: 'round', lineCap: 'butt' }} />
          <LineLayer id="route-full-line" style={{ lineColor: '#5B21B6', lineWidth: 3, lineJoin: 'round', lineCap: 'butt' }} />
        </ShapeSource>
      )}

      {/* Route animée active (violet) - seule route affichée quand driver a une commande en cours */}
      {isOnline && driverPos && animatedRouteCoords.length >= 2 && (
        <ShapeSource
          id="route-active"
          shape={coordsToLineGeoJSON(
            offsetLineStartFromMarker(driverPos, [driverPos, ...animatedRouteCoords.slice(1)])
          )}
        >
          <LineLayer id="route-active-line-outline" style={{ lineColor: '#FFFFFF', lineWidth: 5, lineJoin: 'round', lineCap: 'butt' }} />
          <LineLayer id="route-active-line" style={{ lineColor: '#5B21B6', lineWidth: 3, lineJoin: 'round', lineCap: 'butt' }} />
        </ShapeSource>
      )}

      {/* Marqueurs pickup et dropoff pour chaque commande */}
      {[...activeOrders, ...pendingOrders].map((order) => {
        const pickupCoord = resolveCoords(order.pickup);
        const dropoffCoord = resolveCoords(order.dropoff);
        const status = String(order.status || '');
        const isPending = status === 'pending';

        return (
          <React.Fragment key={order.id}>
            {pickupCoord && (
              <PointAnnotation
                id={`pickup-${order.id}`}
                coordinate={toLngLat(pickupCoord)}
                anchor={{ x: 0.5, y: 0.5 }}
                onSelected={() => setSelectedOrder(order.id)}
              >
                <View style={styles.pickupMarker} collapsable={false}>
                  <View style={styles.pickupPin} />
                </View>
              </PointAnnotation>
            )}
            {dropoffCoord && !isPending && (
              <PointAnnotation
                id={`dropoff-${order.id}`}
                coordinate={toLngLat(dropoffCoord)}
                anchor={{ x: 0.5, y: 0.5 }}
                onSelected={() => setSelectedOrder(order.id)}
              >
                <View style={styles.dropoffMarker} collapsable={false}>
                  <View style={styles.dropoffPin} />
                </View>
              </PointAnnotation>
            )}
          </React.Fragment>
        );
      })}
    </MapView>
  );
};

const styles = StyleSheet.create({
  map: { flex: 1 },
  pickupMarker: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 20,
    height: 20,
  },
  pickupPin: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#5B21B6',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  dropoffMarker: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 20,
    height: 20,
  },
  dropoffPin: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#8B5CF6',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  driverMarker: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 20,
    height: 20,
  },
  driverPin: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#5B21B6',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
});
