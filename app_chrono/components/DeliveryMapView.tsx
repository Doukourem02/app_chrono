import React, { useMemo, useEffect, useState } from 'react';
import { StyleSheet, View, Text, Animated } from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE, Circle } from 'react-native-maps';
import { OnlineDriver } from '../hooks/useOnlineDrivers';
import { useRadarPulse } from '../hooks/useRadarPulse';
import { useAnimatedRoute } from '../hooks/useAnimatedRoute';

type Coordinates = {
  latitude: number;
  longitude: number;
};

interface DeliveryMapViewProps {
  mapRef: React.RefObject<MapView | null>;
  region: any;
  pickupCoords: Coordinates | null;
  dropoffCoords: Coordinates | null;
  displayedRouteCoords: Coordinates[];
  driverCoords: Coordinates | null;
  orderDriverCoords?: Coordinates | null;
  orderStatus?: string | null;
  onlineDrivers: OnlineDriver[]; 
  isSearchingDriver: boolean;
  destinationPulseAnim: Animated.Value;
  userPulseAnim: Animated.Value;
  durationText: string | null;
  searchSeconds: number;
  selectedMethod: string;
  availableVehicles: any[];
  showMethodSelection: boolean;
  onMapPress?: () => void; 
  radarCoords?: Coordinates | null;
}

// Style minimal de la carte (similaire à admin_chrono)
const minimalMapStyle = [
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
];

export const DeliveryMapView: React.FC<DeliveryMapViewProps> = ({
  mapRef,
  region,
  pickupCoords,
  dropoffCoords,
  displayedRouteCoords,
  driverCoords,
  orderDriverCoords,
  orderStatus,
  onlineDrivers,
  isSearchingDriver,
  destinationPulseAnim,
  userPulseAnim,
  durationText,
  searchSeconds,
  selectedMethod,
  availableVehicles,
  showMethodSelection,
  onMapPress,
  radarCoords,
}) => {
  const { outerPulse, innerPulse } = useRadarPulse(isSearchingDriver);
  const radarCenter = radarCoords || pickupCoords || null;
  const [outerRadius, setOuterRadius] = useState(0);
  const [innerRadius, setInnerRadius] = useState(0);

  useEffect(() => {
    const outerListenerId = outerPulse.addListener(({ value }) => {
      setOuterRadius(120 + value * (340 - 120));
    });

    const innerListenerId = innerPulse.addListener(({ value }) => {
      setInnerRadius(60 + value * (220 - 60));
    });

    return () => {
      outerPulse.removeListener(outerListenerId);
      innerPulse.removeListener(innerListenerId);
    };
  }, [outerPulse, innerPulse]);

  const filteredOnlineDrivers = useMemo(() => {
    if (!onlineDrivers) return [];

    return onlineDrivers
      .filter((driver) => driver.is_online === true)
      .filter((driver) => {
        if (!orderDriverCoords) return true;
        const latDiff = Math.abs(driver.current_latitude - orderDriverCoords.latitude);
        const lonDiff = Math.abs(driver.current_longitude - orderDriverCoords.longitude);
        return latDiff > 0.00001 || lonDiff > 0.00001;
      });
  }, [onlineDrivers, orderDriverCoords]);

  // Route animée du livreur vers le pickup (quand commande acceptée/en route)
  const driverToPickupRoute = useAnimatedRoute({
    origin: (orderStatus === 'accepted' || orderStatus === 'pending') && orderDriverCoords ? orderDriverCoords : null,
    destination: (orderStatus === 'accepted' || orderStatus === 'pending') && pickupCoords ? pickupCoords : null,
    enabled: !!(orderStatus === 'accepted' || orderStatus === 'pending') && !!orderDriverCoords && !!pickupCoords,
  });

  // Route animée du livreur vers le dropoff (quand colis récupéré)
  const driverToDropoffRoute = useAnimatedRoute({
    origin: (orderStatus === 'enroute' || orderStatus === 'picked_up') && orderDriverCoords ? orderDriverCoords : null,
    destination: (orderStatus === 'enroute' || orderStatus === 'picked_up') && dropoffCoords ? dropoffCoords : null,
    enabled: !!(orderStatus === 'enroute' || orderStatus === 'picked_up') && !!orderDriverCoords && !!dropoffCoords,
  });

  return (
    <MapView 
      provider={PROVIDER_GOOGLE}
      ref={mapRef} 
      style={styles.map} 
      region={region}
      customMapStyle={minimalMapStyle}
      showsUserLocation={false}
      showsMyLocationButton={false}
      showsCompass={false}
      showsScale={false}
      showsBuildings={false}
      showsTraffic={false}
      showsIndoors={false}
      showsPointsOfInterest={false}
      mapType="standard"
      toolbarEnabled={false}
      rotateEnabled={true}
      pitchEnabled={false}
      scrollEnabled={true}
      zoomEnabled={true}
      onPress={onMapPress} 
    >


      {filteredOnlineDrivers
        .map((driver) => (
          <Marker
            key={driver.user_id}
            coordinate={{
              latitude: driver.current_latitude,
              longitude: driver.current_longitude,
            }}
            title={`${driver.first_name} ${driver.last_name}`}
            description={`${driver.vehicle_type} • Note: ${driver.rating}/5`}
            tracksViewChanges={false}
          >
            <View style={styles.driverMarker} />
          </Marker>
        ))}

      {pickupCoords && (
        <Marker 
          coordinate={pickupCoords} 
          title="Ma position" 
          anchor={{ x: 0.5, y: 0.5 }}
          tracksViewChanges={false}
        >
          <View style={styles.userLocationMarker}>
            <View style={styles.userLocationDot} />
          </View>
        </Marker>
      )}

      
      {isSearchingDriver && radarCenter && (
        <>
          <Circle
            center={radarCenter}
            radius={outerRadius}
            strokeColor="rgba(99,102,241,0.35)"
            fillColor="rgba(99,102,241,0.12)"
            strokeWidth={1}
          />
          <Circle
            center={radarCenter}
            radius={innerRadius}
            strokeColor="rgba(99,102,241,0.45)"
            fillColor="rgba(99,102,241,0.18)"
            strokeWidth={1}
          />
          <Marker
            coordinate={radarCenter}
            anchor={{ x: 0.5, y: 0.5 }}
            tracksViewChanges={false}
          >
            <View style={styles.radarCore}>
              <View style={styles.radarCoreInner} />
            </View>
          </Marker>
        </>
      )}

      {/* Marqueur de destination - toujours visible si disponible */}
      {!isSearchingDriver && 
      dropoffCoords && 
      orderStatus !== 'completed' && 
      orderStatus !== 'cancelled' && 
      orderStatus !== 'declined' && (
        <Marker 
          coordinate={dropoffCoords} 
          title="Destination" 
          anchor={{ x: 0.5, y: 1 }}
          tracksViewChanges={false}
        >
          <View style={styles.destinationMarker}>
            <View style={styles.destinationPin} />
            <View style={styles.destinationShadow} />
          </View>
        </Marker>
      )}

      {/* Route pickup -> dropoff (gris discrète comme admin_chrono) - toujours visible si disponible */}
      {!isSearchingDriver && 
       displayedRouteCoords && 
       displayedRouteCoords.length > 0 && 
       orderStatus !== 'completed' && 
       orderStatus !== 'cancelled' && 
       orderStatus !== 'declined' && (
        <Polyline
          coordinates={displayedRouteCoords}
          strokeColor="rgba(229,231,235,0.7)"
          strokeWidth={3}
          lineJoin="round"
          lineCap="round"
        />
      )}

      {/* Commande active avec livreur assigné */}
      {orderDriverCoords && 
       orderStatus !== 'completed' && 
       orderStatus !== 'cancelled' && 
       orderStatus !== 'declined' && (
        <>
          {/* Marqueur du livreur avec cercle extérieur pulsant comme admin_chrono */}
          <Marker
            coordinate={orderDriverCoords}
            title="Livreur"
            description="Livreur en route"
            anchor={{ x: 0.5, y: 0.5 }}
            tracksViewChanges={false}
          >
            <View style={styles.orderDriverMarkerContainer}>
              <View style={styles.driverPulseOuter} />
              <View style={styles.orderDriverMarker} />
            </View>
          </Marker>

          {/* Route animée du livreur vers le pickup (violet comme admin_chrono) */}
          {(orderStatus === 'accepted' || orderStatus === 'pending') && 
           driverToPickupRoute.animatedCoordinates.length > 0 && (
            <Polyline
              coordinates={driverToPickupRoute.animatedCoordinates}
              strokeColor="#8B5CF6"
              strokeWidth={6}
              lineJoin="round"
              lineCap="round"
            />
          )}

          {/* Route animée du livreur vers le dropoff (violet comme admin_chrono) */}
          {(orderStatus === 'enroute' || orderStatus === 'picked_up') && 
           driverToDropoffRoute.animatedCoordinates.length > 0 && (
            <Polyline
              coordinates={driverToDropoffRoute.animatedCoordinates}
              strokeColor="#8B5CF6"
              strokeWidth={6}
              lineJoin="round"
              lineCap="round"
            />
          )}

          {/* Marqueur pickup (vert) */}
          {pickupCoords && (
            <Marker
              coordinate={pickupCoords}
              title="Point de collecte"
              anchor={{ x: 0.5, y: 0.5 }}
              tracksViewChanges={false}
            >
              <View style={styles.pickupMarker}>
                <View style={styles.pickupPin} />
              </View>
            </Marker>
          )}

          {/* Marqueur dropoff (violet) */}
          {dropoffCoords && (
            <Marker
              coordinate={dropoffCoords}
              title="Destination"
              anchor={{ x: 0.5, y: 0.5 }}
              tracksViewChanges={false}
            >
              <View style={styles.dropoffMarker}>
                <View style={styles.dropoffPin} />
              </View>
            </Marker>
          )}
        </>
      )}

      {/* Badge ETA - toujours visible si disponible */}
      {!isSearchingDriver && 
       durationText && 
       pickupCoords && 
       orderStatus !== 'completed' && 
       orderStatus !== 'cancelled' && 
       orderStatus !== 'declined' && (
        <Marker 
          coordinate={pickupCoords} 
          anchor={{ x: 0.5, y: 0.5 }} 
          tracksViewChanges={false}
        >
          <View style={styles.etaBadge}>
            <Text style={styles.etaBadgeText}>{durationText}</Text>
          </View>
        </Marker>
      )}
    </MapView>
  );
};

const styles = StyleSheet.create({
  map: {
    flex: 1,
  },

  userLocationMarker: {
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userLocationDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#3B82F6',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },


  pulseContainer: {
    width: 100,
    height: 100,
    alignItems: 'center',
    justifyContent: 'center',
  },


  pulseContainerInvisible: {
    width: 1,
    height: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },



  destinationMarker: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 20,
    height: 20,
  },
  destinationPin: {
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
  destinationShadow: {
    display: 'none',
  },
  // Marqueurs uniformisés comme admin_chrono
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
  // Driver marker avec cercle extérieur comme admin_chrono
  orderDriverMarkerContainer: {
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
    borderColor: '#DC2626',
    backgroundColor: 'rgba(220,38,38,0.15)',
  },


  radarCore: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#6366F1',
    borderWidth: 3,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 6,
  },
  radarCoreInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#4C1D95',
  },
  
  // Badge ETA sur la carte
  etaBadge: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -50,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 6,
  },
  etaBadgeText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#6366F1',
  },

  // 🚗 Styles pour les chauffeurs en ligne (uniformisés comme admin_chrono)
  driverMarker: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#3B82F6',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  driverIcon: {
    display: 'none', // Pas d'icône, juste un cercle comme admin_chrono
  },
  orderDriverMarker: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#DC2626',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 6,
    position: 'absolute',
  },
});
