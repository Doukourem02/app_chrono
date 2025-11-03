import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import React, { useRef, useEffect, useMemo, useCallback } from 'react';
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
// Explicit extension to help some editors/resolvers find the file reliably
import TrackingBottomSheet from '../../components/TrackingBottomSheet.tsx';
import { userOrderSocketService } from '../../services/userOrderSocketService';
import { useOrderStore } from '../../store/useOrderStore';
import { logger } from '../../utils/logger';

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

  // Réinitialiser l'état au montage du composant (quand on arrive sur la page)
  // S'assurer que le bottom sheet est toujours visible si aucune commande n'est active
  useEffect(() => {
    // Au montage, nettoyer les commandes bloquées ou terminées
    const store = useOrderStore.getState();
    
    // Si on a un currentOrder terminé/annulé/refusé, le nettoyer immédiatement
    if (store.currentOrder && (
      store.currentOrder.status === 'completed' || 
      store.currentOrder.status === 'cancelled' || 
      store.currentOrder.status === 'declined'
    )) {
      logger.info('🧹 Nettoyage commande terminée/annulée/refusée au montage', 'map.tsx', { status: store.currentOrder.status });
      store.clear();
    }
    
    // Si on a un pendingOrder, vérifier s'il est trop ancien (plus de 10 secondes)
    // et le nettoyer pour permettre une nouvelle commande
    if (store.pendingOrder) {
      const orderAge = store.pendingOrder.createdAt 
        ? new Date().getTime() - new Date(store.pendingOrder.createdAt).getTime()
        : Infinity;
      
      // Nettoyer les pendingOrders anciens (plus de 10 secondes) pour forcer l'affichage du bottom sheet
      if (orderAge > 10000) {
        logger.info('🧹 Nettoyage pendingOrder bloqué au montage', 'map.tsx', { orderId: store.pendingOrder.id, orderAge });
        store.setPendingOrder(null);
        store.setDeliveryStage('idle');
      }
    }
    
    // S'assurer que le deliveryStage est 'idle' si aucune commande active
    if (!store.currentOrder && !store.pendingOrder) {
      store.setDeliveryStage('idle');
    }
  }, []); // Seulement au montage

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
    clearRoute,
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
    stopDriverSearch,
  } = useDriverSearch(resetAfterDriverSearch);

  const orderDriverCoords = useOrderStore((s) => s.driverCoords);
  const currentOrder = useOrderStore((s) => s.currentOrder);
  const pendingOrder = useOrderStore((s) => s.pendingOrder);

  // Réinitialiser l'état si on revient sur la page avec une commande en attente bloquée
  // (par exemple après avoir quitté et réouvert l'app)
  useEffect(() => {
    // Si on a un pendingOrder mais qu'on ne cherche plus de chauffeur et qu'on est sur la page,
    // c'est probablement une commande bloquée qu'on doit nettoyer
    if (pendingOrder && !isSearchingDriver && !currentOrder) {
      // Vérifier si la commande est vraiment en attente depuis trop longtemps (plus de 30 secondes)
      const orderAge = pendingOrder.createdAt
        ? new Date().getTime() - new Date(pendingOrder.createdAt).getTime()
        : Infinity;

      // Si la commande est en attente depuis plus de 30 secondes sans action, la nettoyer
      if (orderAge > 30000) {
        logger.info('🧹 Nettoyage commande bloquée en attente', 'map.tsx', { orderId: pendingOrder.id, orderAge });
        useOrderStore.getState().setPendingOrder(null);
        useOrderStore.getState().setDeliveryStage('idle');
      }
    }
  }, [pendingOrder, isSearchingDriver, currentOrder]);

  // Arrêter la recherche de chauffeur si pendingOrder devient null (aucun chauffeur disponible)
  useEffect(() => {
    if (!pendingOrder && isSearchingDriver) {
      // Si pendingOrder devient null alors qu'on cherche un chauffeur,
      // cela signifie qu'aucun chauffeur n'est disponible
      stopDriverSearch();
      logger.info('🛑 Recherche de chauffeur arrêtée (aucun chauffeur disponible)', 'map.tsx');
    }
  }, [pendingOrder, isSearchingDriver, stopDriverSearch]);

  // 🆕 Nettoyer la route violette dès qu'une commande est acceptée (orderDriverCoords disponible)
  // Pour ne montrer que le tracking en direct (polyline vert/rouge)
  useEffect(() => {
    if (orderDriverCoords && displayedRouteCoords.length > 0) {
      // Nettoyer la route violette pour ne garder que le tracking en direct
      logger.info('🧹 Nettoyage route violette - commande acceptée, affichage tracking direct', 'map.tsx');
      clearRoute();
    }
  }, [orderDriverCoords, displayedRouteCoords.length, clearRoute]);

  // 🧹 Fonction utilitaire pour nettoyer complètement l'état
  const cleanupOrderState = useCallback(() => {
    logger.info('🧹 Nettoyage complet de l\'état de commande', 'map.tsx');
    
    // 🛑 Arrêter la recherche de chauffeur si elle est en cours
    if (isSearchingDriver) {
      stopDriverSearch();
    }
    
    // Nettoyer immédiatement l'état de la commande (inclut driverCoords)
    useOrderStore.getState().clear();
    
    // Nettoyer la route et les coordonnées
    try {
      clearRoute();
    } catch {}
    
    setPickupCoords(null);
    setDropoffCoords(null);
    
    // 🆕 Nettoyer aussi les adresses du formulaire pour un reset complet
    setPickupLocation('');
    setDeliveryLocation('');
    
    // Animer la caméra vers la position de l'utilisateur
    if (region) {
      // Petit délai pour permettre l'animation
      setTimeout(() => {
        animateToCoordinate({ latitude: region.latitude, longitude: region.longitude }, 0.01);
      }, 100);
    }
  }, [clearRoute, setPickupCoords, setDropoffCoords, setPickupLocation, setDeliveryLocation, animateToCoordinate, region, isSearchingDriver, stopDriverSearch]);

  // Détecter quand une commande est terminée/annulée/refusée et nettoyer immédiatement
  useEffect(() => {
    const status = currentOrder?.status;
    
    // Si la commande est terminée, annulée ou refusée, nettoyer immédiatement
    if (status === 'completed' || status === 'cancelled' || status === 'declined') {
      logger.info('🧹 Nettoyage commande terminée/annulée/refusée', 'map.tsx', { status });
      cleanupOrderState();
    }
  }, [currentOrder?.status, cleanupOrderState]);

  // 🆕 Vérifier si une commande est trop ancienne et la nettoyer automatiquement
  // (par exemple, si elle est restée en "accepted" ou "enroute" depuis plus de 30 minutes)
  useEffect(() => {
    if (!currentOrder) return;

    const orderAge = currentOrder.createdAt 
      ? new Date().getTime() - new Date(currentOrder.createdAt).getTime()
      : Infinity;
    
    // Si la commande est trop ancienne (plus de 30 minutes), la nettoyer
    // Cela peut arriver si le livreur oublie de marquer la commande comme "completed"
    const MAX_ORDER_AGE = 1000 * 60 * 30; // 30 minutes
    
    if (orderAge > MAX_ORDER_AGE) {
      logger.info('🧹 Nettoyage commande trop ancienne (oubli de finalisation)', 'map.tsx', { 
        orderId: currentOrder.id, 
        status: currentOrder.status, 
        age: `${Math.round(orderAge / 1000 / 60)} minutes` 
      });
      cleanupOrderState();
    }

    // Vérifier périodiquement toutes les 10 secondes si la commande est trop ancienne
    const checkInterval = setInterval(() => {
      if (currentOrder?.createdAt) {
        const age = new Date().getTime() - new Date(currentOrder.createdAt).getTime();
        if (age > MAX_ORDER_AGE) {
          logger.info('🧹 Nettoyage périodique commande trop ancienne', 'map.tsx', { 
            orderId: currentOrder.id, 
            status: currentOrder.status, 
            age: `${Math.round(age / 1000 / 60)} minutes` 
          });
          cleanupOrderState();
        }
      }
    }, 10000); // Vérifier toutes les 10 secondes

    return () => clearInterval(checkInterval);
  }, [currentOrder, cleanupOrderState]);

  const {
    animatedHeight,
    isExpanded,
    panResponder,
    toggle: toggleBottomSheet,
    expand: expandBottomSheet, // 🆕 Exposer la fonction expand
  } = useBottomSheet();

  const hasAutoOpenedRef = useRef(false);

  // 🆕 Ouvrir automatiquement le bottom sheet à chaque fois qu'on arrive sur la page
  // (si aucune commande active n'est en cours)
  useEffect(() => {
    if (hasAutoOpenedRef.current) {
      return;
    }

    const store = useOrderStore.getState();
    const isActiveOrder = store.currentOrder && 
      store.currentOrder.status !== 'completed' && 
      store.currentOrder.status !== 'cancelled' && 
      store.currentOrder.status !== 'declined';
    
    // Ouvrir automatiquement si pas de commande active et que le bottom sheet n'est pas déjà ouvert
    // Cela se déclenchera à chaque montage du composant (chaque fois qu'on arrive sur la page)
    if (!isActiveOrder && !isExpanded) {
      hasAutoOpenedRef.current = true;
      const timer = setTimeout(() => {
        expandBottomSheet();
      }, 100);

      return () => clearTimeout(timer);
    }

    hasAutoOpenedRef.current = true;
  }, [expandBottomSheet, isExpanded]);

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
      
      const success = await userOrderSocketService.createOrder(orderData);
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
        onMapPress={() => {
          // 🆕 Ouvrir automatiquement le bottom sheet au clic sur la carte avec animation fluide
          // Mais uniquement si on n'a pas de commande active (on affiche le DeliveryBottomSheet)
          const isActiveOrder = currentOrder && 
            currentOrder.status !== 'completed' && 
            currentOrder.status !== 'cancelled' && 
            currentOrder.status !== 'declined';
          
          // Ouvrir immédiatement avec animation, sans délai
          if (!isActiveOrder) {
            expandBottomSheet();
          }
        }}
      />

      {/* Bottom Sheet: render only one at a time depending on delivery stage */}
      {(() => {
        // Logique : 
        // 1. Si on a une commande ACTIVE (en cours, pas terminée/annulée/refusée), afficher le tracking
        // 2. Sinon, TOUJOURS afficher le formulaire de création de commande
        const isActiveOrder = currentOrder && 
          currentOrder.status !== 'completed' && 
          currentOrder.status !== 'cancelled' && 
          currentOrder.status !== 'declined';

        // Debug logs
        if (__DEV__) {
          logger.debug('Bottom Sheet Debug', 'map.tsx', {
            isActiveOrder,
            currentOrderStatus: currentOrder?.status,
            pendingOrder: !!pendingOrder,
          });
        }

        return (
          <>
            {/* Afficher le bottom sheet de création de commande SAUF si on a une commande active */}
            {!isActiveOrder && (
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
            )}

            {/* Afficher le tracking bottom sheet UNIQUEMENT quand on a une commande active */}
            {isActiveOrder && (
              <TrackingBottomSheet
                currentOrder={currentOrder}
                panResponder={panResponder}
                animatedHeight={animatedHeight}
                isExpanded={isExpanded}
                onToggle={toggleBottomSheet}
              />
            )}
          </>
        );
      })()}

      {/* DEV quick test button removed in production-ready flow */}
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
  devButton: {
    position: 'absolute',
    right: 20,
    bottom: 40,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#ff6b6b',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1200,
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
