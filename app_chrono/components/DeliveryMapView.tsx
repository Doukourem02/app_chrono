import React from 'react';
import { StyleSheet, View, Text, Animated } from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';

type Coordinates = {
  latitude: number;
  longitude: number;
};

interface OnlineDriver {
  user_id: string;
  first_name: string;
  last_name: string;
  vehicle_type: string;
  current_latitude: number;
  current_longitude: number;
  is_available: boolean;
  rating: number;
}

interface DeliveryMapViewProps {
  mapRef: React.RefObject<MapView | null>;
  region: any;
  pickupCoords: Coordinates | null;
  dropoffCoords: Coordinates | null;
  displayedRouteCoords: Coordinates[];
  driverCoords: Coordinates | null;
  orderDriverCoords?: Coordinates | null;
  orderStatus?: string | null;
  onlineDrivers: OnlineDriver[]; // 🚗 NOUVEAU
  isSearchingDriver: boolean;
  pulseAnim: Animated.Value;
  destinationPulseAnim: Animated.Value;
  userPulseAnim: Animated.Value;
  durationText: string | null;
  searchSeconds: number;
  selectedMethod: string;
  availableVehicles: any[];
  showMethodSelection: boolean;
  onMapPress?: () => void; // 🆕 Callback pour ouvrir le bottom sheet au clic
}

export const DeliveryMapView: React.FC<DeliveryMapViewProps> = ({
  mapRef,
  region,
  pickupCoords,
  dropoffCoords,
  displayedRouteCoords,
  driverCoords,
  orderDriverCoords,
  orderStatus,
  onlineDrivers, // 🚗 NOUVEAU
  isSearchingDriver,
  pulseAnim,
  destinationPulseAnim,
  userPulseAnim,
  durationText,
  searchSeconds,
  selectedMethod,
  availableVehicles,
  showMethodSelection,
  onMapPress, // 🆕
}) => {
  // console.log('🗺️ DeliveryMapView render - showMethodSelection:', showMethodSelection);
  
  return (
    <MapView 
      ref={mapRef} 
      style={styles.map} 
      region={region}
      showsUserLocation={false}
      showsMyLocationButton={false}
      showsCompass={false}
      showsScale={false}
      showsBuildings={false}
      showsTraffic={false}
      showsIndoors={false}
      showsPointsOfInterest={false}
      onPress={onMapPress} // 🆕 Ouvrir automatiquement le bottom sheet au clic sur la carte
    >

      {/* 🚗 Chauffeurs en ligne disponibles - Filtrer strictement les chauffeurs online */}
      {onlineDrivers
        ?.filter(driver => driver.is_online === true) // 🔍 Double filtre de sécurité
        .map((driver) => (
          <Marker
            key={driver.user_id}
            coordinate={{
              latitude: driver.current_latitude,
              longitude: driver.current_longitude,
            }}
            title={`${driver.first_name} ${driver.last_name}`}
            description={`${driver.vehicle_type} • Note: ${driver.rating}/5`}
          >
            <View style={styles.driverMarker}>
              <Text style={styles.driverIcon}>🚗</Text>
            </View>
          </Marker>
        ))}

      {/* ✅ Marqueur position - Toujours visible */}
      {pickupCoords && (
        <Marker 
          coordinate={pickupCoords} 
          title="Ma position" 
          anchor={{ x: 0.5, y: 0.5 }}
        >
          <View style={styles.userLocationMarker}>
            <View style={styles.userLocationDot} />
          </View>
        </Marker>
      )}

      {/* Animation pulse uniquement pendant la recherche de chauffeur */}
      {isSearchingDriver && pickupCoords && (
        <Marker 
          coordinate={pickupCoords} 
          anchor={{ x: 0.5, y: 0.5 }} 
          tracksViewChanges={false}
        >
          <View style={styles.searchContainer}>
            <Animated.View
              style={[
                styles.pulseOuter,
                {
                  transform: [
                    {
                      scale: pulseAnim.interpolate({ 
                        inputRange: [0, 1], 
                        outputRange: [0.5, 2.0] 
                      }),
                    },
                  ],
                  opacity: pulseAnim.interpolate({ 
                    inputRange: [0, 1], 
                    outputRange: [0.6, 0] 
                  }),
                },
              ]}
            />
            <Animated.View
              style={[
                styles.pulseInner,
                {
                  transform: [
                    {
                      scale: pulseAnim.interpolate({ 
                        inputRange: [0, 1], 
                        outputRange: [0.7, 1.2] 
                      }),
                    },
                  ],
                  opacity: pulseAnim.interpolate({ 
                    inputRange: [0, 1], 
                    outputRange: [0.8, 0.3] 
                  }),
                },
              ]}
            />
            {/* Plus d'élément central - pulsation pure */}
          </View>
        </Marker>
      )}

      {/* Marqueur de destination - Visible UNIQUEMENT avant qu'une commande soit acceptée */}
      {/* 🆕 Cacher dès que le livreur accepte pour ne montrer que le tracking en direct */}
      {!isSearchingDriver && 
       dropoffCoords && 
       !orderDriverCoords && // Ne pas afficher si une commande est acceptée (tracking actif)
       orderStatus !== 'completed' && 
       orderStatus !== 'cancelled' && 
       orderStatus !== 'declined' && (
        <Marker 
          coordinate={dropoffCoords} 
          title="Destination" 
          anchor={{ x: 0.5, y: 1 }}
        >
          <Animated.View 
            style={[
              styles.destinationMarker,
              displayedRouteCoords.length > 0 && {
                transform: [
                  {
                    scale: destinationPulseAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [1, 2.0]
                    })
                  }
                ],
                opacity: destinationPulseAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.8, 0.3]
                })
              }
            ]}
          >
            <View style={styles.destinationPin} />
            <View style={styles.destinationShadow} />
          </Animated.View>
        </Marker>
      )}

      {/* Polyline violet (route initiale) - Visible UNIQUEMENT avant qu'une commande soit acceptée */}
      {/* 🆕 Cacher dès que le livreur accepte pour ne montrer que le tracking en direct */}
      {!isSearchingDriver && 
       displayedRouteCoords && 
       displayedRouteCoords.length > 0 && 
       !orderDriverCoords && // Ne pas afficher si une commande est acceptée (tracking actif)
       orderStatus !== 'completed' && 
       orderStatus !== 'cancelled' && 
       orderStatus !== 'declined' && (
        <Polyline
          coordinates={displayedRouteCoords}
          strokeColor="#6366F1"
          strokeWidth={5}
          lineJoin="round"
          lineCap="round"
        />
      )}

      {/* Marker + polyline pour la commande en cours (driver -> pickup/dropoff) */}
      {/* 🆕 Ne pas afficher si la commande est terminée/annulée/refusée */}
      {orderDriverCoords && 
       orderStatus !== 'completed' && 
       orderStatus !== 'cancelled' && 
       orderStatus !== 'declined' && (
        <>
          <Marker
            coordinate={orderDriverCoords}
            title={`Livreur`}
            description={/* fallback */ 'Livreur en route'}
          >
            <View style={styles.orderDriverMarker}>
              <Text style={styles.driverIcon}>🚚</Text>
            </View>
          </Marker>

          {/* 🟢 Polyline VERT: livreur -> pickup (quand status est 'accepted' ou 'pending') */}
          {/* Animation fluide avec un draw progressif */}
          {/* S'assurer que orderDriverCoords est disponible avant d'afficher */}
          {((orderStatus === 'accepted' || orderStatus === 'pending') && 
            pickupCoords && 
            orderDriverCoords &&
            orderDriverCoords.latitude && 
            orderDriverCoords.longitude) && (
            <Polyline
              coordinates={[orderDriverCoords, pickupCoords]}
              strokeColor="#10B981"
              strokeWidth={5}
              lineJoin="round"
              lineCap="round"
            />
          )}

          {/* 🔴 Polyline ROUGE: livreur -> dropoff (quand status est 'enroute' ou 'picked_up') */}
          {/* Le polyline vert disparaît automatiquement, seul le rouge est visible */}
          {/* S'assurer que orderDriverCoords est disponible et valide avant d'afficher */}
          {/* Pour "picked_up", on affiche seulement si onroute était déjà affiché ou après un court délai */}
          {(((orderStatus === 'enroute') || (orderStatus === 'picked_up')) && 
            dropoffCoords && 
            orderDriverCoords &&
            orderDriverCoords.latitude && 
            orderDriverCoords.longitude &&
            // Pour picked_up, s'assurer que les coordonnées sont bien à jour (pas null/undefined/0)
            Math.abs(orderDriverCoords.latitude) > 0.0001 &&
            Math.abs(orderDriverCoords.longitude) > 0.0001) && (
            <Polyline
              coordinates={[orderDriverCoords, dropoffCoords]}
              strokeColor="#EF4444"
              strokeWidth={5}
              lineJoin="round"
              lineCap="round"
            />
          )}
        </>
      )}

      {/* Badge ETA - Visible UNIQUEMENT avant qu'une commande soit acceptée */}
      {/* 🆕 Cacher dès que le livreur accepte pour ne montrer que le tracking en direct */}
      {!isSearchingDriver && 
       durationText && 
       pickupCoords && 
       !orderDriverCoords && // Ne pas afficher si une commande est acceptée (tracking actif)
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
  
  // Marqueur position utilisateur - Style moderne
  userLocationMarker: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userLocationDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#6366F1',
    borderWidth: 3,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },

  // Conteneur pour pulse radar pur
  pulseContainer: {
    width: 100,
    height: 100,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Conteneur pour pulse radar COMPLÈTEMENT invisible au centre
  pulseContainerInvisible: {
    width: 1,
    height: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },



  // Marqueur destination - Style pin moderne
  destinationMarker: {
    alignItems: 'center',
    justifyContent: 'flex-end',
    height: 40,
  },
  destinationPin: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#6366F1',
    borderWidth: 3,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  destinationShadow: {
    width: 8,
    height: 4,
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderRadius: 4,
    marginTop: 2,
  },

  // Animation de recherche - Plus subtile
  searchContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 100,
    height: 100,
  },
  pulseOuter: {
    position: 'absolute',
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#6366F1',
  },
  pulseInner: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#6366F1',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
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

  // 🚗 Styles pour les chauffeurs en ligne
  driverMarker: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#4CAF50',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  driverIcon: {
    fontSize: 16,
    color: '#FFFFFF',
  },
  orderDriverMarker: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#111827',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 6,
  },
});
