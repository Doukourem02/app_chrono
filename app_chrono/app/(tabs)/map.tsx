import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import React, { useRef, useEffect, useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View, Alert } from 'react-native';
import MapView from 'react-native-maps';
import { useShipmentStore } from '../../store/useShipmentStore';
import { useMapLogic } from '../../hooks/useMapLogic';
import { useDriverSearch } from '../../hooks/useDriverSearch';
import { useOnlineDrivers } from '../../hooks/useOnlineDrivers';
import { useBottomSheet } from '../../hooks/useBottomSheet';
import { useRequireAuth } from '../../hooks/useRequireAuth';
import { useAuthStore } from '../../store/useAuthStore';
import { DeliveryMapView } from '../../components/DeliveryMapView';
import { DeliveryBottomSheet } from '../../components/DeliveryBottomSheet';
import { userOrderSocketService } from '../../services/userOrderSocketService';
import { useOrderStore } from '../../store/useOrderStore';

type Coordinates = {
  latitude: number;
  longitude: number;
};

export default function MapPage() {
  const { requireAuth } = useRequireAuth();
  const { setSelectedMethod } = useShipmentStore();
  const { user } = useAuthStore();
  
  const mapRef = useRef<MapView | null>(null);

  // Vérifier l'authentification dès l'accès à la page
  useEffect(() => {
    requireAuth(() => {
      // L'utilisateur est connecté, ne rien faire
    });
  }, [requireAuth]);

  // 🔌 Connexion Socket pour les commandes
  useEffect(() => {
    if (user?.id) {
      userOrderSocketService.connect(user.id);
    }

    return () => {
      userOrderSocketService.disconnect();
    };
  }, [user?.id]);
  
  // Hooks personnalisés pour séparer la logique
  const {
    region,
    pickupCoords,
    dropoffCoords,
    displayedRouteCoords,
    durationText,
    pickupLocation,
    deliveryLocation,
    selectedMethod,
    showMethodSelection,
    destinationPulseAnim,
    userPulseAnim,
    setPickupCoords,
    setDropoffCoords,
    setPickupLocation,
    setDeliveryLocation,
    fetchRoute,
    animateToCoordinate,
    startMethodSelection,
    resetAfterDriverSearch,
  } = useMapLogic({ mapRef: mapRef as React.RefObject<MapView> });

  // Hook pour récupérer les chauffeurs online avec position stable
  const stableUserLocation = useMemo(() => {
    if (!region?.latitude || !region?.longitude) return undefined;
    return {
      latitude: Math.round(region.latitude * 10000) / 10000, // 4 décimales max
      longitude: Math.round(region.longitude * 10000) / 10000
    };
  }, [region?.latitude, region?.longitude]);

  const { drivers: onlineDrivers } = useOnlineDrivers({
    userLocation: stableUserLocation,
    autoRefresh: true,
    refreshInterval: 5000 // 5 secondes pendant les tests (plus rapide pour voir les changements)
  });

  const {
    isSearchingDriver,
    searchSeconds,
    driverCoords,
    pulseAnim,
    startDriverSearch,
  } = useDriverSearch(resetAfterDriverSearch);

  const orderDriverCoords = useOrderStore((s) => s.driverCoords);
  const currentOrder = useOrderStore((s) => s.currentOrder);

  const {
    animatedHeight,
    isExpanded,
    panResponder,
    toggle: toggleBottomSheet,
  } = useBottomSheet();

  // NOTE: Bouton de test retiré en production — la création de commande
  // est maintenant déclenchée via le flow utilisateur (handleConfirm)
  const handlePickupSelected = ({ description, coords }: { description: string; coords?: Coordinates }) => {
    setPickupLocation(description);
    if (coords) {
      setPickupCoords(coords);
      if (dropoffCoords) fetchRoute(coords, dropoffCoords);
    }
  };

  const handleDeliverySelected = ({ description, coords }: { description: string; coords?: Coordinates }) => {
    setDeliveryLocation(description);
    if (coords) {
      setDropoffCoords(coords);
      if (pickupCoords) fetchRoute(pickupCoords, coords);
    }
  };

  const handleMethodSelected = (method: 'moto' | 'vehicule' | 'cargo') => {
    Haptics.selectionAsync(); // Feedback haptic léger
    setSelectedMethod(method);
    startMethodSelection(); // Déclencher le pulse violet sur "Ma position"
  };

  const handleConfirm = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); // Feedback haptic confirmation
    
    // 📦 TEST: Envoyer une commande réelle via Socket.IO
    if (pickupCoords && dropoffCoords && pickupLocation && deliveryLocation && user) {
      console.log('📦 Envoi commande test...');
      
      const orderData = {
        pickup: {
          address: pickupLocation,
          coordinates: pickupCoords
        },
        dropoff: {
          address: deliveryLocation,
          coordinates: dropoffCoords
        },
        deliveryMethod: selectedMethod as 'moto' | 'vehicule' | 'cargo',
        userInfo: {
          name: user.email?.split('@')[0] || 'Client',
          rating: 4.5,
          phone: user.phone
        }
      };
      
      const success = userOrderSocketService.createOrder(orderData);
      if (success) {
        // Démarrer la recherche de chauffeur avec animation/pulse (20s)
        // Le radar/pulse sert désormais de feedback visuel pour l'utilisateur
        startDriverSearch();
      } else {
        Alert.alert('❌ Erreur', 'Impossible d\'envoyer la commande');
      }
      // Ne pas return — continuer le flow si nécessaire (caméra/route)
    }
    
    // Si la commande n'a pas été créée (par exemple utilisateur ne fournit
    // pas toutes les infos), continuer le flow normal : préparer la route
    // puis lancer la recherche locale de chauffeurs (pulse)
    try {
      if (pickupCoords && dropoffCoords) {
        await fetchRoute(pickupCoords, dropoffCoords);
      }
    } catch {
      // Ignorer les erreurs de route
    }

    // Animer la caméra vers la position de pickup avant de commencer la recherche
    if (pickupCoords) {
      animateToCoordinate(pickupCoords, 0.01);
    }

    // Démarrer la recherche seulement si on ne l'a pas déjà démarrée via la création de commande
    if (!isSearchingDriver) {
      startDriverSearch();
    }
  };

  if (!region) {
    return (
      <View style={styles.loadingContainer}>
        <Text>Chargement de la carte...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Bouton Retour */}
      <TouchableOpacity 
        style={styles.backButton}
        onPress={() => router.push('/(tabs)')}
      >
        <Ionicons name="arrow-back" size={24} color="#333" />
      </TouchableOpacity>

      {/* Carte */}
              <DeliveryMapView
          mapRef={mapRef}
          region={region}
          pickupCoords={pickupCoords}
          dropoffCoords={dropoffCoords}
          displayedRouteCoords={displayedRouteCoords}
          driverCoords={driverCoords}
          orderDriverCoords={orderDriverCoords}
          orderStatus={currentOrder?.status}
          onlineDrivers={onlineDrivers} // 🚗 NOUVEAU
          isSearchingDriver={isSearchingDriver}
          pulseAnim={pulseAnim}
          destinationPulseAnim={destinationPulseAnim}
          userPulseAnim={userPulseAnim}
          durationText={durationText}
          searchSeconds={searchSeconds}
          selectedMethod={selectedMethod}
          availableVehicles={[]} // Remplacé par une valeur par défaut
          showMethodSelection={showMethodSelection}
        />

      {/* Bouton de test supprimé */}

      {/* Bottom Sheet */}
      <DeliveryBottomSheet
        animatedHeight={animatedHeight}
        panResponder={panResponder}
        isExpanded={isExpanded}
        onToggle={toggleBottomSheet}
        pickupLocation={pickupLocation}
        deliveryLocation={deliveryLocation}
        selectedMethod={selectedMethod}
        onPickupSelected={handlePickupSelected}
        onDeliverySelected={handleDeliverySelected}
        onMethodSelected={handleMethodSelected}
        onConfirm={handleConfirm}
      />
    </View>
  );
}

// --- STYLES ---
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  backButton: {
    position: 'absolute',
    top: 60,
    left: 20,
    width: 50,
    height: 50,
    backgroundColor: '#fff',
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
