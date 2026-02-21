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

interface DriverMapViewProps {
  mapRef: React.RefObject<MapRefHandle | null>;
  location: Coordinates | null;
  animatedDriverPosition: Coordinates | null;
  animatedRouteCoords: Coordinates[];
  orderFullRouteCoords: Coordinates[];
  currentPickupCoord: Coordinates | null;
  currentDropoffCoord: Coordinates | null;
  activeOrders: Array<{
    id: string;
    pickup?: unknown;
    dropoff?: unknown;
    status?: string;
    user?: { name?: string };
  }>;
  pendingOrders: Array<{
    id: string;
    pickup?: unknown;
    dropoff?: unknown;
    status?: string;
  }>;
  resolveCoords: (candidate?: unknown) => Coordinates | null;
  calculateDistanceToPickup: (order: unknown) => number | null;
  setSelectedOrder: (orderId: string) => void;
  realTimeETA: { formattedETA: string } | null;
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
  calculateDistanceToPickup,
  setSelectedOrder,
  realTimeETA,
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
        <Text>Mapbox n'est pas disponible sur web. Utilisez un dev build iOS/Android.</Text>
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

      {/* Marqueur driver - collapsable={false} évite l'erreur "max 1 subview" (RN 0.76+ New Arch) */}
      {isOnline && driverPos && (
        <PointAnnotation id="driver" coordinate={toLngLat(driverPos)} anchor={{ x: 0.5, y: 0.5 }}>
          <View style={styles.driverMarkerContainer} collapsable={false}>
            <View style={styles.driverPulseOuter} />
            <View style={styles.driverMarkerInner} />
          </View>
        </PointAnnotation>
      )}

      {/* Badge ETA temps réel */}
      {realTimeETA && driverPos && isOnline && (
        <PointAnnotation id="eta-badge" coordinate={toLngLat(driverPos)} anchor={{ x: 0.5, y: 1.2 }}>
          <View style={styles.realTimeETABadge} collapsable={false}>
            <Text style={styles.realTimeETAText}>{realTimeETA.formattedETA}</Text>
          </View>
        </PointAnnotation>
      )}

      {/* Route complète pickup -> dropoff (ligne grise) */}
      {currentPickupCoord && currentDropoffCoord && orderFullRouteCoords.length >= 2 && (
        <ShapeSource
          id="route-full"
          shape={coordsToLineGeoJSON(orderFullRouteCoords)}
        >
          <LineLayer id="route-full-line" style={{ lineColor: 'rgba(229,231,235,0.9)', lineWidth: 3, lineJoin: 'round', lineCap: 'round' }} />
        </ShapeSource>
      )}

      {/* Route animée active (violet, bien visible) */}
      {isOnline && driverPos && animatedRouteCoords.length >= 2 && (
        <ShapeSource
          id="route-active"
          shape={coordsToLineGeoJSON([driverPos, ...animatedRouteCoords.slice(1)])}
        >
          <LineLayer id="route-active-line-outline" style={{ lineColor: '#FFFFFF', lineWidth: 8, lineJoin: 'round', lineCap: 'round' }} />
          <LineLayer id="route-active-line" style={{ lineColor: '#5B21B6', lineWidth: 6, lineJoin: 'round', lineCap: 'round' }} />
        </ShapeSource>
      )}

      {/* Marqueurs pickup et dropoff pour chaque commande */}
      {[...activeOrders, ...pendingOrders].map((order) => {
        const pickupCoord = resolveCoords(order.pickup);
        const dropoffCoord = resolveCoords(order.dropoff);
        const status = String(order.status || '');
        const isPending = status === 'pending';
        const distance = calculateDistanceToPickup(order);

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
    backgroundColor: '#10B981',
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
  driverMarkerContainer: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  driverPulseOuter: {
    position: 'absolute',
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: '#3B82F6',
    backgroundColor: 'rgba(59,130,246,0.15)',
  },
  driverMarkerInner: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#3B82F6',
    borderWidth: 3,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 6,
    position: 'absolute',
  },
  realTimeETABadge: {
    backgroundColor: '#10B981',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  realTimeETAText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
});
