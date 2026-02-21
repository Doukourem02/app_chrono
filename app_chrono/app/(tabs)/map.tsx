import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef } from "react";
import {Alert,Animated,Dimensions,StyleSheet,Text,TouchableOpacity,View,} from "react-native";
import type { MapRefHandle } from "../../hooks/useMapLogic";
import { DeliveryBottomSheet } from "../../components/DeliveryBottomSheet";
import { DeliveryMapView } from "../../components/DeliveryMapView";
import { DeliveryMethodBottomSheet } from "../../components/DeliveryMethodBottomSheet";
import { DriverSearchBottomSheet } from "../../components/DriverSearchBottomSheet";
import { OrderDetailsSheet } from "../../components/OrderDetailsSheet";
import PaymentBottomSheet from "../../components/PaymentBottomSheet";
import { PaymentErrorModal } from "../../components/PaymentErrorModal";
import RatingBottomSheet from "../../components/RatingBottomSheet";
import { useBottomSheet } from "../../hooks/useBottomSheet";
import { useDriverSearch } from "../../hooks/useDriverSearch";
import { useMapLogic } from "../../hooks/useMapLogic";
import { useOnlineDrivers } from "../../hooks/useOnlineDrivers";
import { useMapPayment } from "../../hooks/useMapPayment";
import { useMapOrderManagement } from "../../hooks/useMapOrderManagement";
import { useMapUI } from "../../hooks/useMapUI";
import { useMapNewOrder } from "../../hooks/useMapNewOrder";
import { locationService } from "../../services/locationService";
import {calculatePrice,estimateDurationMinutes,formatDurationLabel,getDistanceInKm,} from "../../services/orderApi";
import { userApiService } from "../../services/userApiService";
import { userOrderSocketService } from "../../services/userOrderSocketService";
import { useAuthStore } from "../../store/useAuthStore";
import { useLocationStore } from "../../store/useLocationStore";
import type { OrderStatus } from "../../store/useOrderStore";
import { useOrderStore } from "../../store/useOrderStore";
import { usePaymentErrorStore } from "../../store/usePaymentErrorStore";
import { usePaymentStore } from "../../store/usePaymentStore";
import { useRatingStore } from "../../store/useRatingStore";
import { useShipmentStore } from "../../store/useShipmentStore";
import { logger } from "../../utils/logger";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");
const PENDING_STATUS: OrderStatus = "pending";

type Coordinates = {
  latitude: number;
  longitude: number;
};

const MAP_STYLES = ['standard', 'light', 'dark', 'streets'] as const;
type MapStyleType = (typeof MAP_STYLES)[number];

export default function MapPage() {
  const [isCreatingNewOrder, setIsCreatingNewOrder] = React.useState(true);
  const [mapStyle, setMapStyle] = React.useState<MapStyleType>('light');
  const { setSelectedMethod } = useShipmentStore();
  const { user } = useAuthStore();
  const { loadPaymentMethods } = usePaymentStore();
  // Utiliser des sélecteurs séparés pour éviter les boucles infinies
  const paymentErrorVisible = usePaymentErrorStore((s) => s.visible);
  const paymentErrorTitle = usePaymentErrorStore((s) => s.title);
  const paymentErrorMessage = usePaymentErrorStore((s) => s.message);
  const paymentErrorCode = usePaymentErrorStore((s) => s.errorCode);
  const hidePaymentError = usePaymentErrorStore((s) => s.hideError);
  
  const mapRef = useRef<MapRefHandle | null>(null);

  // Ne plus rediriger automatiquement vers l'authentification
  // L'utilisateur peut explorer la carte en mode invité
  // L'authentification sera demandée seulement lors de la création d'une commande

  useEffect(() => {
    if (user?.id) {
      userOrderSocketService.connect(user.id);
    }

    return () => {
      userOrderSocketService.disconnect();
    };
  }, [user?.id]);

  useEffect(() => {
    if (user?.id) {
      loadPaymentMethods();
    }
  }, [user?.id, loadPaymentMethods]);

  useEffect(() => {
    locationService.startWatching();
    
    return () => {};
  }, []);

  // Position utilisateur en temps réel (pour le marqueur sur la carte)
  const currentLocation = useLocationStore((s) => s.currentLocation);

  // Hooks personnalisés pour séparer la logique de la map
  const {
    region,
    cameraAnimationDuration,
    pickupCoords,
    dropoffCoords,
    displayedRouteCoords,
    durationText,
    arrivalTimeText,
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
    zoomOutToFit,
    startMethodSelection,
    resetAfterDriverSearch,
  } = useMapLogic({ mapRef });

  // Hooks personnalisés pour séparer la logique
  const {
    selectedOrderId,
    driverCoords: orderDriverCoordsMap,
    setSelectedOrder,
  } = useOrderStore();

  const {
    animatedHeight,
    isExpanded,
    panResponder,
    toggle: toggleBottomSheet,
    expand: expandBottomSheet,
    collapse: collapseBottomSheet,
  } = useBottomSheet();

  const hasAutoOpenedRef = useRef(false);
  const userManuallyClosedRef = useRef(false);
  const isProgrammaticCloseRef = useRef(false);
  const previousIsExpandedRef = useRef(isExpanded);
  const autoOpenTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scheduleBottomSheetOpen = useCallback(
    (delay = 0) => {
      if (userManuallyClosedRef.current) {
        return;
      }
      if (autoOpenTimeoutRef.current) {
        clearTimeout(autoOpenTimeoutRef.current);
      }
      autoOpenTimeoutRef.current = setTimeout(() => {
        if (!userManuallyClosedRef.current) {
          expandBottomSheet();
        }
        autoOpenTimeoutRef.current = null;
      }, delay);
    },
    [expandBottomSheet]
  );

  const stableUserLocation = useMemo(() => {
    if (!region?.latitude || !region?.longitude) return undefined;
    return {
      latitude: Math.round(region.latitude * 10000) / 10000,
      longitude: Math.round(region.longitude * 10000) / 10000,
    };
  }, [region?.latitude, region?.longitude]);

  const { drivers: onlineDrivers } = useOnlineDrivers({
    userLocation: stableUserLocation,
    autoRefresh: true,
    refreshInterval: 5000,
  });

  const {
    isSearchingDriver,
    searchSeconds,
    driverCoords: searchDriverCoords,
    startDriverSearch,
    stopDriverSearch,
  } = useDriverSearch(resetAfterDriverSearch);

  // Hook pour la gestion des commandes
  const {
    currentOrder,
    pendingOrder,
  } = useMapOrderManagement({
    isSearchingDriver,
    startDriverSearch,
    stopDriverSearch,
    collapseBottomSheet,
    clearRoute,
    setPickupCoords,
    setDropoffCoords,
    setPickupLocation,
    setDeliveryLocation,
    selectedOrderId,
    orderDriverCoordsMap,
    displayedRouteCoords,
    orderDriverCoords: selectedOrderId
      ? orderDriverCoordsMap.get(selectedOrderId) || null
      : null,
    userManuallyClosedRef,
  });

  const orderDriverCoords = selectedOrderId
    ? orderDriverCoordsMap.get(selectedOrderId) || null
    : null;

  // Déclarer les bottom sheets avant useMapUI
  const {
    animatedHeight: ratingAnimatedHeight,
    isExpanded: ratingIsExpanded,
    panResponder: ratingPanResponder,
    expand: expandRatingBottomSheet,
    collapse: collapseRatingBottomSheet,
    toggle: toggleRatingBottomSheet,
  } = useBottomSheet();

  const {
    showRatingBottomSheet,
    orderId: ratingOrderId,
    driverName: ratingDriverName,
    resetRatingBottomSheet,
  } = useRatingStore();

  const {
    animatedHeight: deliveryMethodAnimatedHeight,
    isExpanded: deliveryMethodIsExpanded,
    panResponder: deliveryMethodPanResponder,
    expand: expandDeliveryMethodSheet,
    collapse: collapseDeliveryMethodSheet,
    toggle: toggleDeliveryMethodSheet,
  } = useBottomSheet();

  const {
    animatedHeight: orderDetailsAnimatedHeight,
    isExpanded: orderDetailsIsExpanded,
    panResponder: orderDetailsPanResponder,
    expand: expandOrderDetailsSheet,
    collapse: collapseOrderDetailsSheet,
    toggle: toggleOrderDetailsSheet,
  } = useBottomSheet();
  
  // Hook pour la gestion de l'UI (focus, bottom sheets, etc.)
  const { isUserTypingRef } = useMapUI({
    isCreatingNewOrder,
    setIsCreatingNewOrder,
    pickupLocation,
    deliveryLocation,
    region,
    clearRoute,
    setPickupCoords,
    setDropoffCoords,
    setPickupLocation,
    setDeliveryLocation,
    setSelectedMethod,
    animateToCoordinate,
    expandBottomSheet,
    scheduleBottomSheetOpen,
    setSelectedOrder,
    currentOrder,
    pendingOrder,
    isExpanded,
    showRatingBottomSheet,
    deliveryMethodIsExpanded,
    orderDetailsIsExpanded,
    hasAutoOpenedRef,
    userManuallyClosedRef,
  });
  
  // Hook pour la gestion du paiement
  const {
    showPaymentSheet,
    setShowPaymentSheet,
    paymentPayerType,
    setPaymentPayerType,
    selectedPaymentMethodType,
    setSelectedPaymentMethodType,
    recipientInfo,
    setRecipientInfo,
    paymentPartialInfo,
    setPaymentPartialInfo,
  } = useMapPayment({
    currentOrder,
    pendingOrder,
  });

  const radarPulseCoords = useMemo(() => {
    if (pickupCoords) {
      return pickupCoords;
    }
    if (pendingOrder?.pickup?.coordinates) {
      const coords = pendingOrder.pickup.coordinates;
      return {
        latitude: coords.latitude,
        longitude: coords.longitude,
      };
    }
    return null;
  }, [pickupCoords, pendingOrder?.pickup?.coordinates]);


  const cleanupOrderState = useCallback(async () => {
    logger.info("🧹 Nettoyage complet de l'état de commande", "map.tsx");
    
    if (isSearchingDriver) {
      stopDriverSearch();
    }
    
    useOrderStore.getState().clear();
    
    // Réinitialiser les états de paiement
    setShowPaymentSheet(false);
    setPaymentPayerType("client");
    setSelectedPaymentMethodType(null);
    setRecipientInfo({});
    setPaymentPartialInfo({});
    
    const ratingStore = useRatingStore.getState();
    if (ratingStore.showRatingBottomSheet) {
      logger.info(
        "🧹 Fermeture RatingBottomSheet lors du nettoyage",
        "map.tsx"
      );
      ratingStore.resetRatingBottomSheet();
      collapseRatingBottomSheet();
    }
    
    try {
      clearRoute();
    } catch {}
    
    setPickupCoords(null);
    setDropoffCoords(null);
    
    setPickupLocation("");
    setDeliveryLocation("");
    
    try {
      const coords = await locationService.getCurrentPosition();
      
      if (coords) {
        const { latitude, longitude } = coords;
        
        setPickupCoords({ latitude, longitude });

        try {
          const refreshedAddress = await locationService.reverseGeocode({
            latitude,
            longitude,
            timestamp: Date.now(),
          });
          
          if (refreshedAddress) {
            setPickupLocation(refreshedAddress);
          } else {
            setPickupLocation(
              `Ma position (${latitude.toFixed(4)}, ${longitude.toFixed(4)})`
            );
          }
        } catch (geoError) {
          logger.warn(
            "Erreur reverse geocode pendant cleanup",
            "map.tsx",
            geoError
          );
          setPickupLocation(
            `Ma position (${latitude.toFixed(4)}, ${longitude.toFixed(4)})`
          );
        }
        
        setTimeout(() => {
          animateToCoordinate({ latitude, longitude }, 0.01);
        }, 100);
      } else {
        if (region) {
          setPickupCoords({
            latitude: region.latitude,
            longitude: region.longitude,
          });
          setPickupLocation("Votre position actuelle");
          setTimeout(() => {
            animateToCoordinate(
              { latitude: region.latitude, longitude: region.longitude },
              0.01
            );
          }, 100);
        }
      }
    } catch (error) {
      logger.warn("Erreur récupération position actuelle", "map.tsx", error);
      if (region) {
        setPickupCoords({
          latitude: region.latitude,
          longitude: region.longitude,
        });
        setPickupLocation("Votre position actuelle");
        setTimeout(() => {
          animateToCoordinate(
            { latitude: region.latitude, longitude: region.longitude },
            0.01
          );
        }, 100);
      }
    }
  }, [
    clearRoute,
    setPickupCoords,
    setDropoffCoords,
    setPickupLocation,
    setDeliveryLocation,
    animateToCoordinate,
    region,
    isSearchingDriver,
    stopDriverSearch,
    collapseRatingBottomSheet,
    setShowPaymentSheet,
    setPaymentPayerType,
    setSelectedPaymentMethodType,
    setRecipientInfo,
    setPaymentPartialInfo,
  ]);

  useEffect(() => {
    const status = currentOrder?.status;
    
    if (status === "cancelled" || status === "declined") {
      logger.info("🧹 Nettoyage commande terminée/annulée/refusée", "map.tsx", {
        status,
      });
      cleanupOrderState();
    } else if (status === "completed") {
      logger.info(
        "Commande complétée - attente du RatingBottomSheet avant nettoyage",
        "map.tsx"
      );
    }
  }, [currentOrder?.status, cleanupOrderState]);

  useEffect(() => {
    if (
      currentOrder &&
      currentOrder.status === "completed" &&
      currentOrder.driverId
    ) {
      if (!showRatingBottomSheet || ratingOrderId !== currentOrder.id) {
        const checkAndShowRating = async () => {
          try {
            const ratingResult = await userApiService.getOrderRating(
              currentOrder.id
            );
            if (!ratingResult.success || !ratingResult.data) {
              const driverId = currentOrder.driverId || currentOrder.driver?.id;
              const driverName = currentOrder.driver?.name || "Votre livreur";
              
              if (driverId) {
                useRatingStore
                  .getState()
                  .setRatingBottomSheet(
                  true,
                  currentOrder.id,
                  driverId,
                  driverName
                );
                logger.info(
                  "Affichage automatique RatingBottomSheet pour commande complétée",
                  "map.tsx",
                  {
                    orderId: currentOrder.id,
                  }
                );
              }
            }
          } catch (error) {
            logger.warn("Erreur vérification rating", "map.tsx", error);
            const driverId = currentOrder.driverId || currentOrder.driver?.id;
            const driverName = currentOrder.driver?.name || "Votre livreur";
            
            if (driverId) {
              useRatingStore
                .getState()
                .setRatingBottomSheet(
                true,
                currentOrder.id,
                driverId,
                driverName
              );
            }
          }
        };
        
        checkAndShowRating();
      }
    }
  }, [currentOrder, showRatingBottomSheet, ratingOrderId]);

  useEffect(() => {
    logger.debug("🔍 RatingBottomSheet state changed", "map.tsx", {
      showRatingBottomSheet, 
      ratingOrderId,
      isExpanded: ratingIsExpanded,
    });
    
    if (showRatingBottomSheet && ratingOrderId) {
      logger.info("Ouverture automatique rating bottom sheet", "map.tsx", {
        orderId: ratingOrderId,
        driverName: ratingDriverName,
      });
      
      setTimeout(() => {
        expandRatingBottomSheet();
        logger.info("RatingBottomSheet ouvert", "map.tsx", {
          orderId: ratingOrderId,
        });
      }, 100);
    } else if (!showRatingBottomSheet) {
      collapseRatingBottomSheet();
      logger.debug("RatingBottomSheet fermé", "map.tsx");
    }
  }, [
    showRatingBottomSheet,
    ratingOrderId,
    ratingDriverName,
    expandRatingBottomSheet,
    collapseRatingBottomSheet,
    ratingIsExpanded,
  ]);

  const handleRatingSubmitted = useCallback(() => {
    logger.info(
      "Évaluation soumise, fermeture rating bottom sheet",
      "map.tsx"
    );
    resetRatingBottomSheet();
    collapseRatingBottomSheet();
    setTimeout(() => {
      cleanupOrderState();
      hasAutoOpenedRef.current = false;
      userManuallyClosedRef.current = false;
      isProgrammaticCloseRef.current = true;
      scheduleBottomSheetOpen(200);
    }, 300);
  }, [
    resetRatingBottomSheet,
    collapseRatingBottomSheet,
    cleanupOrderState,
    scheduleBottomSheetOpen,
  ]);

  const handleRatingClose = useCallback(() => {
    logger.info("Rating bottom sheet fermé", "map.tsx");
    resetRatingBottomSheet();
    collapseRatingBottomSheet();
    setTimeout(() => {
      cleanupOrderState();
      hasAutoOpenedRef.current = false;
      userManuallyClosedRef.current = false;
      isProgrammaticCloseRef.current = true;
      scheduleBottomSheetOpen(200);
    }, 300);
  }, [
    resetRatingBottomSheet,
    collapseRatingBottomSheet,
    cleanupOrderState,
    scheduleBottomSheetOpen,
  ]);

  useEffect(() => {
    if (!currentOrder) return;

    const orderAge = currentOrder.createdAt 
      ? new Date().getTime() - new Date(currentOrder.createdAt).getTime()
      : Infinity;
    
        const MAX_ORDER_AGE = 1000 * 60 * 30;
    
    if (orderAge > MAX_ORDER_AGE) {
      logger.info(
        "🧹 Nettoyage commande trop ancienne (oubli de finalisation)",
        "map.tsx",
        {
        orderId: currentOrder.id, 
        status: currentOrder.status, 
          age: `${Math.round(orderAge / 1000 / 60)} minutes`,
        }
      );
      cleanupOrderState();
    }

    const checkInterval = setInterval(() => {
      if (currentOrder?.createdAt) {
        const age =
          new Date().getTime() - new Date(currentOrder.createdAt).getTime();
        if (age > MAX_ORDER_AGE) {
          logger.info(
            "🧹 Nettoyage périodique commande trop ancienne",
            "map.tsx",
            {
            orderId: currentOrder.id, 
            status: currentOrder.status, 
              age: `${Math.round(age / 1000 / 60)} minutes`,
            }
          );
          cleanupOrderState();
        }
      }
    }, 10000);

    return () => clearInterval(checkInterval);
  }, [currentOrder, cleanupOrderState]);

  useEffect(() => {
    return () => {
      if (autoOpenTimeoutRef.current) {
        clearTimeout(autoOpenTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (
      previousIsExpandedRef.current &&
      !isExpanded &&
      !isProgrammaticCloseRef.current
    ) {
      userManuallyClosedRef.current = true;
      logger.debug(
        "🔒 Bottom sheet fermé manuellement par l'utilisateur",
        "map.tsx"
      );
      if (autoOpenTimeoutRef.current) {
        clearTimeout(autoOpenTimeoutRef.current);
        autoOpenTimeoutRef.current = null;
      }
    }
    previousIsExpandedRef.current = isExpanded;
    isProgrammaticCloseRef.current = false;
  }, [isExpanded]);

  useEffect(() => {
    const store = useOrderStore.getState();
    const currentOrder = store.getCurrentOrder();
    const isActiveOrder =
      currentOrder &&
      currentOrder.status !== "completed" &&
      currentOrder.status !== "cancelled" &&
      currentOrder.status !== "declined";
    const hasOrderInProgress = Boolean(pendingOrder || isActiveOrder);

    const shouldShowCreationForm = !hasOrderInProgress || isCreatingNewOrder;
    
    if (
      shouldShowCreationForm &&
        !isExpanded && 
        !showRatingBottomSheet && 
        !userManuallyClosedRef.current &&
        !deliveryMethodIsExpanded &&
      !orderDetailsIsExpanded
    ) {
      if (!hasAutoOpenedRef.current) {
        hasAutoOpenedRef.current = true;
        scheduleBottomSheetOpen(100);
      }
    }
  }, [
    isExpanded,
    currentOrder,
    showRatingBottomSheet,
    isCreatingNewOrder,
    pendingOrder,
    scheduleBottomSheetOpen,
    deliveryMethodIsExpanded,
    orderDetailsIsExpanded,
  ]);

  useEffect(() => {
    const store = useOrderStore.getState();
    const currentOrder = store.getCurrentOrder();
    const isActiveOrder =
      currentOrder &&
      currentOrder.status !== "completed" &&
      currentOrder.status !== "cancelled" &&
      currentOrder.status !== "declined";
    const hasOrderInProgress = Boolean(pendingOrder || isActiveOrder);
    
    if (
      !hasOrderInProgress &&
      !currentOrder &&
      !isExpanded &&
      !showRatingBottomSheet &&
      !userManuallyClosedRef.current
    ) {
      hasAutoOpenedRef.current = false;
      isProgrammaticCloseRef.current = true;
      scheduleBottomSheetOpen(300);
      const resetTimer = setTimeout(() => {
        isProgrammaticCloseRef.current = false;
        hasAutoOpenedRef.current = true;
      }, 300);

      return () => clearTimeout(resetTimer);
    }
  }, [
    currentOrder,
    pendingOrder,
    isExpanded,
    showRatingBottomSheet,
    scheduleBottomSheetOpen,
  ]);

  const handlePickupSelected = ({
    description,
    coords,
  }: {
    description: string;
    coords?: Coordinates;
  }) => {
    isUserTypingRef.current = true;
    setPickupLocation(description);
    if (coords) {
      setPickupCoords(coords);
      if (dropoffCoords) fetchRoute(coords, dropoffCoords);
    }
    setTimeout(() => {
      isUserTypingRef.current = false;
    }, 2000);
  };

  const handleDeliverySelected = ({
    description,
    coords,
  }: {
    description: string;
    coords?: Coordinates;
  }) => {
    isUserTypingRef.current = true;
    setDeliveryLocation(description);
    if (coords) {
      setDropoffCoords(coords);
      if (pickupCoords) fetchRoute(pickupCoords, coords);
    } 
    setTimeout(() => {
      isUserTypingRef.current = false;
    }, 2000);
  };

  const handleMethodSelected = (method: "moto" | "vehicule" | "cargo") => {
    Haptics.selectionAsync();
    setSelectedMethod(method);
    startMethodSelection();
  };

  const handleShowDeliveryMethod = useCallback(() => {
    collapseBottomSheet();
    setTimeout(() => {
      const MAX_HEIGHT = SCREEN_HEIGHT * 0.85;
      
      Animated.spring(deliveryMethodAnimatedHeight, {
        toValue: MAX_HEIGHT,
        useNativeDriver: false,
        tension: 65,
        friction: 8,
      }).start();
      
      expandDeliveryMethodSheet();
    }, 300);
  }, [
    collapseBottomSheet,
    expandDeliveryMethodSheet,
    deliveryMethodAnimatedHeight,
  ]);

  const handleDeliveryMethodBack = useCallback(() => {
    collapseDeliveryMethodSheet();
    setTimeout(() => {
      expandBottomSheet();
    }, 300);
  }, [collapseDeliveryMethodSheet, expandBottomSheet]);

  const getPriceAndTime = useCallback(() => {
    if (!pickupCoords || !dropoffCoords || !selectedMethod) {
      return { price: 0, estimatedTime: "0 min." };
    }
    const distance = getDistanceInKm(pickupCoords, dropoffCoords);
    const price = calculatePrice(
      distance,
      selectedMethod as "moto" | "vehicule" | "cargo"
    );
    const minutes = estimateDurationMinutes(
      distance,
      selectedMethod as "moto" | "vehicule" | "cargo"
    );
    const estimatedTime = formatDurationLabel(minutes) || `${minutes} min.`;
    return { price, estimatedTime };
  }, [pickupCoords, dropoffCoords, selectedMethod]);

  const handleConfirm = async () => {
    handleShowDeliveryMethod();
  };

  const handleDeliveryMethodConfirm = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    collapseDeliveryMethodSheet();
    setTimeout(() => {
      expandOrderDetailsSheet();
      Animated.spring(orderDetailsAnimatedHeight, {
        toValue: SCREEN_HEIGHT * 0.9,
        useNativeDriver: false,
        tension: 65,
        friction: 8,
      }).start();
    }, 300);
  }, [
    collapseDeliveryMethodSheet,
    expandOrderDetailsSheet,
    orderDetailsAnimatedHeight,
  ]);

  // Hook pour la création de nouvelle commande
  const { handleOrderDetailsConfirm } = useMapNewOrder({
    user,
    pickupCoords,
    dropoffCoords,
    pickupLocation,
    deliveryLocation,
    selectedMethod,
    region,
    recipientInfo,
    stopDriverSearch,
    resetAfterDriverSearch,
    clearRoute,
    setPickupCoords,
    setDropoffCoords,
    setPickupLocation,
    setDeliveryLocation,
    setSelectedMethod,
    setIsCreatingNewOrder,
    animateToCoordinate,
    scheduleBottomSheetOpen,
    collapseOrderDetailsSheet,
    collapseDeliveryMethodSheet,
    userManuallyClosedRef,
    hasAutoOpenedRef,
    setShowPaymentSheet,
    setPaymentPayerType,
    setSelectedPaymentMethodType,
    setRecipientInfo,
    setPaymentPartialInfo,
  });

  const _handleCancelOrder = useCallback(
    async (orderId: string) => {
      const currentOrder = useOrderStore
        .getState()
        .activeOrders.find((o) => o.id === orderId);
      if (
        currentOrder &&
        currentOrder.status !== "pending" &&
        currentOrder.status !== "accepted"
      ) {
      const statusMessages: Record<string, string> = {
          picked_up:
            "Impossible d'annuler une commande dont le colis a déjà été récupéré",
          enroute: "Impossible d'annuler une commande en cours de livraison",
          completed: "Impossible d'annuler une commande déjà terminée",
          cancelled: "Cette commande a déjà été annulée",
          declined: "Cette commande a été refusée",
        };
        Alert.alert(
          "Annulation impossible",
          statusMessages[currentOrder.status] ||
            "Cette commande ne peut pas être annulée"
        );
      return;
    }

    Alert.alert(
        "Annuler la commande",
        "Êtes-vous sûr de vouloir annuler cette commande ?",
      [
          { text: "Non", style: "cancel" },
        {
            text: "Oui",
            style: "destructive",
          onPress: async () => {
            try {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                logger.info("🔄 Annulation commande...", "map.tsx", {
                  orderId,
                });
              
                const result = await userApiService.cancelOrder(
                  orderId,
                  currentOrder?.status
                );
              if (result.success) {
                useOrderStore.getState().clear();
                clearRoute();
                setPickupCoords(null);
                setDropoffCoords(null);
                  setPickupLocation("");
                  setDeliveryLocation("");
                  setSelectedMethod("moto");

                  logger.info("Commande annulée avec succès", "map.tsx", {
                    orderId,
                  });
                  Alert.alert("Succès", "Commande annulée avec succès");
              } else {
                  logger.warn("Erreur annulation commande", "map.tsx", {
                    message: result.message,
                  });
                  Alert.alert(
                    "Erreur",
                    result.message || "Impossible d'annuler la commande"
                  );
              }
            } catch (error) {
                logger.error("Erreur annulation commande", "map.tsx", error);
                Alert.alert("Erreur", "Impossible d'annuler la commande");
            }
          },
        },
      ]
    );
    },
    [
      clearRoute,
      setPickupCoords,
      setDropoffCoords,
      setPickupLocation,
      setDeliveryLocation,
      setSelectedMethod,
    ]
  );

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
        onPress={() => router.push("/(tabs)")}
      >
        <Ionicons name="arrow-back" size={24} color="#333" />
      </TouchableOpacity>

      {/* Bouton "Centrer sur ma position" */}
      {(currentLocation || pickupCoords) && (
        <TouchableOpacity
          style={styles.centerOnMeButton}
          onPress={() => {
            Haptics.selectionAsync();
            const coords = currentLocation || pickupCoords;
            if (coords) {
              animateToCoordinate(
                { latitude: coords.latitude, longitude: coords.longitude },
                0.005
              );
            }
          }}
        >
          <Ionicons name="locate" size={22} color="#8B5CF6" />
        </TouchableOpacity>
      )}

      {/* Bouton "Dézoomer / Vue d'ensemble" */}
      <TouchableOpacity
        style={styles.zoomOutButton}
        onPress={() => {
          Haptics.selectionAsync();
          zoomOutToFit();
        }}
      >
        <Ionicons name="expand-outline" size={22} color="#8B5CF6" />
      </TouchableOpacity>

      {/* Bouton style de carte */}
      <TouchableOpacity
        style={styles.mapStyleButton}
        onPress={() => {
          Haptics.selectionAsync();
          const idx = MAP_STYLES.indexOf(mapStyle);
          setMapStyle(MAP_STYLES[(idx + 1) % MAP_STYLES.length]);
        }}
      >
        <Ionicons
          name={mapStyle === 'dark' ? 'moon' : mapStyle === 'light' ? 'sunny' : 'layers'}
          size={20}
          color="#8B5CF6"
        />
      </TouchableOpacity>

      {/* Carte */}
      <DeliveryMapView
        mapStyle={mapStyle}
        mapRef={mapRef}
        region={region}
        cameraAnimationDuration={cameraAnimationDuration}
        pickupCoords={pickupCoords}
        userLocationCoords={currentLocation ? { latitude: currentLocation.latitude, longitude: currentLocation.longitude } : null}
        dropoffCoords={dropoffCoords}
        displayedRouteCoords={displayedRouteCoords}
        driverCoords={searchDriverCoords}
        orderDriverCoords={orderDriverCoords}
        orderStatus={currentOrder?.status}
        onlineDrivers={onlineDrivers}
        isSearchingDriver={isSearchingDriver}
        destinationPulseAnim={destinationPulseAnim}
        userPulseAnim={userPulseAnim}
        durationText={durationText}
        arrivalTimeText={arrivalTimeText}
        searchSeconds={searchSeconds}
        selectedMethod={selectedMethod}
        availableVehicles={[]}
        showMethodSelection={showMethodSelection}
        radarCoords={radarPulseCoords}
        onMapPress={() => {
          const isActiveOrder =
            currentOrder &&
            currentOrder.status !== "completed" &&
            currentOrder.status !== "cancelled" &&
            currentOrder.status !== "declined";
          
          if (!isActiveOrder) {
            userManuallyClosedRef.current = false;
            setIsCreatingNewOrder(true);
            expandBottomSheet();
          }
        }}
      />

      {/* Bouton retour flottant pour la recherche de livreur ou driver accepté - au-dessus du bottom sheet */}
      {/* Ne pas afficher le bouton retour si on est en train de créer une nouvelle commande */}
      {(isSearchingDriver ||
        (currentOrder?.status === "accepted" && currentOrder?.driver)) &&
        !isCreatingNewOrder && (
        <TouchableOpacity 
          style={styles.driverSearchBackButton}
          onPress={async () => {
              // Permettre la création d'une nouvelle commande sans supprimer les commandes en cours
              logger.info("🆕 Préparation pour nouvelle commande (sans supprimer les commandes en cours)", "map.tsx");
              
              // Arrêter la recherche de livreur pour la commande actuelle
              if (isSearchingDriver) {
                stopDriverSearch();
              }
              
              // Réinitialiser les champs de localisation pour la nouvelle commande
              setPickupLocation("");
              setDeliveryLocation("");
              setPickupCoords(null);
              setDropoffCoords(null);
              clearRoute();
              
              // Permettre la création d'une nouvelle commande
              setSelectedOrder(null);
            setIsCreatingNewOrder(true);
            userManuallyClosedRef.current = false;
              hasAutoOpenedRef.current = false; // Réinitialiser pour permettre l'ouverture automatique
              
              // Ouvrir le bottom sheet immédiatement
            expandBottomSheet();
          }}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={24} color="#111827" />
        </TouchableOpacity>
      )}

      {((showRatingBottomSheet && ratingOrderId) || 
        (currentOrder?.status === "completed" && currentOrder?.driverId)) && (
        <RatingBottomSheet
          orderId={ratingOrderId || currentOrder?.id || null}
          driverName={
            ratingDriverName || currentOrder?.driver?.name || undefined
          }
          panResponder={ratingPanResponder}
          animatedHeight={ratingAnimatedHeight}
          isExpanded={ratingIsExpanded}
          onToggle={toggleRatingBottomSheet}
          onRatingSubmitted={handleRatingSubmitted}
          onClose={handleRatingClose}
        />
      )}

      {!showRatingBottomSheet &&
        (() => {
          const isActiveOrder =
            currentOrder &&
            currentOrder.status !== "completed" &&
            currentOrder.status !== "cancelled" &&
            currentOrder.status !== "declined";

        if (__DEV__) {
            logger.debug("Bottom Sheet Debug", "map.tsx", {
            isActiveOrder,
            currentOrderStatus: currentOrder?.status,
            pendingOrder: !!pendingOrder,
            showRatingBottomSheet,
          });
        }

        return (
          <>
            {/* Afficher le DeliveryBottomSheet UNIQUEMENT quand on crée une nouvelle commande ET qu'il n'y a PAS de livreur assigné */}
            {/* Ne pas afficher si DriverSearchBottomSheet est visible (livreur assigné ou recherche en cours) */}
            {/* Si selectedOrderId est null, on ignore currentOrder pour permettre la création d'une nouvelle commande */}
            {!deliveryMethodIsExpanded && 
             !orderDetailsIsExpanded && 
             isCreatingNewOrder && 
             !isSearchingDriver && 
             !pendingOrder && 
                (selectedOrderId === null ||
                  !(
                    currentOrder?.status === "accepted" && currentOrder?.driver
                  )) && (
              <DeliveryBottomSheet
                animatedHeight={animatedHeight}
                panResponder={panResponder}
                isExpanded={isExpanded}
                onToggle={() => {
                  if (isExpanded) {
                    userManuallyClosedRef.current = true;
                    isProgrammaticCloseRef.current = false;
                  } else {
                    userManuallyClosedRef.current = false;
                  }
                  toggleBottomSheet();
                }}
                pickupLocation={pickupLocation}
                deliveryLocation={deliveryLocation}
                selectedMethod={selectedMethod}
                onPickupSelected={handlePickupSelected}
                onDeliverySelected={handleDeliverySelected}
                onMethodSelected={handleMethodSelected}
                onConfirm={handleConfirm}
              />
            )}

              {deliveryMethodIsExpanded &&
                (() => {
              const { price, estimatedTime } = getPriceAndTime();
              return (
                <DeliveryMethodBottomSheet
                  animatedHeight={deliveryMethodAnimatedHeight}
                  panResponder={deliveryMethodPanResponder}
                  isExpanded={deliveryMethodIsExpanded}
                  onToggle={toggleDeliveryMethodSheet}
                      selectedMethod={selectedMethod || "moto"}
                  pickupLocation={pickupLocation}
                  deliveryLocation={deliveryLocation}
                  price={price}
                  estimatedTime={estimatedTime}
                  pickupCoords={pickupCoords ?? undefined}
                  dropoffCoords={dropoffCoords ?? undefined}
                  onMethodSelected={handleMethodSelected}
                  onConfirm={handleDeliveryMethodConfirm}
                  onBack={handleDeliveryMethodBack}
                />
              );
            })()}

              {orderDetailsIsExpanded &&
                (() => {
              const { price } = getPriceAndTime();
              return (
                <OrderDetailsSheet
                  animatedHeight={orderDetailsAnimatedHeight}
                  panResponder={orderDetailsPanResponder}
                  isExpanded={orderDetailsIsExpanded}
                  onToggle={toggleOrderDetailsSheet}
                  pickupLocation={pickupLocation}
                  deliveryLocation={deliveryLocation}
                      selectedMethod={selectedMethod || "moto"}
                  price={price}
                  onBack={() => {
                    collapseOrderDetailsSheet();
                    expandDeliveryMethodSheet();
                  }}
                  onConfirm={handleOrderDetailsConfirm}
                />
              );
            })()}

            {/* Afficher le PaymentBottomSheet uniquement si c'est le client qui paie */}
              {showPaymentSheet &&
                pendingOrder &&
                paymentPayerType === "client" &&
                (() => {
              const { price } = getPriceAndTime();
                  const distance =
                    pickupCoords && dropoffCoords
                ? getDistanceInKm(pickupCoords, dropoffCoords)
                : 0;
              
              return (
                <PaymentBottomSheet
                  orderId={pendingOrder.id}
                  distance={distance}
                      deliveryMethod={selectedMethod || "moto"}
                  price={pendingOrder.price || price}
                  isUrgent={false}
                  visible={showPaymentSheet}
                  payerType={paymentPayerType}
                  recipientUserId={recipientInfo.userId}
                  recipientPhone={recipientInfo.phone}
                      recipientIsRegistered={
                        recipientInfo.isRegistered || false
                      }
                  initialIsPartial={paymentPartialInfo.isPartial}
                  initialPartialAmount={paymentPartialInfo.partialAmount}
                      preselectedPaymentMethod={
                        selectedPaymentMethodType || undefined
                      }
                  onClose={() => {
                    setShowPaymentSheet(false);
                    Alert.alert(
                          "Paiement requis",
                          "Le paiement est requis pour continuer. Voulez-vous payer maintenant ?",
                      [
                            {
                              text: "Annuler",
                              style: "cancel",
                              onPress: () => {
                          useOrderStore.getState().clear();
                              },
                            },
                            {
                              text: "Payer",
                              onPress: () => setShowPaymentSheet(true),
                            },
                      ]
                    );
                  }}
                  onPaymentSuccess={(transactionId) => {
                        logger.debug("Paiement réussi:", transactionId);
                    setShowPaymentSheet(false);
                  }}
                  onPaymentError={(error) => {
                        logger.error("Erreur paiement:", error);
                        Alert.alert("Erreur de paiement", error);
                  }}
                />
              );
            })()}

            {/* Bottom sheet de recherche de livreur */}
            {/* Afficher si :
                - On recherche un livreur (isSearchingDriver)
                - OU il y a une commande en attente (pendingOrder) et on ne crée pas une nouvelle commande
                - OU la commande sélectionnée/actuelle est acceptée avec un driver
            */}
            {(() => {
              // Déterminer quelle commande afficher : priorité à la commande sélectionnée, sinon la plus récente
              const store = useOrderStore.getState();

                // Si une commande est sélectionnée, l'utiliser
                // Sinon, chercher une commande acceptée avec driver, puis une commande en attente
                let orderToDisplay = selectedOrderId
                  ? store.activeOrders.find((o) => o.id === selectedOrderId)
                  : null;

                if (!orderToDisplay) {
                  // Chercher d'abord une commande acceptée avec driver
                  const acceptedOrder = store.activeOrders.find(
                    (o) => o.status === "accepted" && o.driver
                  );
                  if (acceptedOrder) {
                    orderToDisplay = acceptedOrder;
                  } else {
                    // Sinon, utiliser currentOrder ou pendingOrder
                    orderToDisplay = currentOrder || pendingOrder;
                  }
                }

                const shouldShowSearch =
                  isSearchingDriver || (pendingOrder && !isCreatingNewOrder);
                const shouldShowAccepted =
                  orderToDisplay?.status === "accepted" &&
                  orderToDisplay?.driver &&
                  !showPaymentSheet;

                // Log pour debug
                if (__DEV__ && (shouldShowSearch || shouldShowAccepted)) {
                  logger.debug(
                    "🔍 DriverSearchBottomSheet affichage",
                    "map.tsx",
                    {
                      orderToDisplayId: orderToDisplay?.id,
                      orderToDisplayStatus: orderToDisplay?.status,
                      hasDriver: !!orderToDisplay?.driver,
                      shouldShowSearch,
                      shouldShowAccepted,
                      isSearchingDriver,
                      totalActiveOrders: store.activeOrders.length,
                      selectedOrderId,
                    }
                  );
                }

                if (
                  (shouldShowSearch || shouldShowAccepted) &&
                  !showPaymentSheet
                ) {
                return (
                  <DriverSearchBottomSheet
                      isSearching={
                        isSearchingDriver &&
                        orderToDisplay?.status === PENDING_STATUS
                      }
                    searchSeconds={searchSeconds}
                      driver={
                        orderToDisplay?.status === "accepted" &&
                        orderToDisplay?.driver
                          ? orderToDisplay.driver
                          : null
                      }
                    onCancel={() => {
                      if (orderToDisplay) {
                        _handleCancelOrder(orderToDisplay.id);
                      }
                    }}
                    onDetails={() => {
                      if (orderToDisplay) {
                          router.push(
                            `/order-tracking/${orderToDisplay.id}` as any
                          );
                      }
                    }}
                    onBack={async () => {
                        // Permettre la création d'une nouvelle commande sans supprimer les commandes en cours
                        logger.info("🆕 Préparation pour nouvelle commande (sans supprimer les commandes en cours)", "map.tsx");
                        
                        // Arrêter la recherche de livreur pour la commande actuelle
                        if (isSearchingDriver) {
                          stopDriverSearch();
                        }
                        
                        // Réinitialiser les champs de localisation pour la nouvelle commande
                        setPickupLocation("");
                        setDeliveryLocation("");
                        setPickupCoords(null);
                        setDropoffCoords(null);
                        clearRoute();
                        
                        // Permettre la création d'une nouvelle commande
                        setSelectedOrder(null);
                      setIsCreatingNewOrder(true);
                      userManuallyClosedRef.current = false;
                        hasAutoOpenedRef.current = false; // Réinitialiser pour permettre l'ouverture automatique
                        
                        // Ouvrir le bottom sheet immédiatement
                      expandBottomSheet();
                    }}
                  />
                );
              }
              return null;
            })()}
          </>
        );
      })()}

      {/* Modal d'erreur de paiement différé */}
      <PaymentErrorModal
        visible={paymentErrorVisible}
        title={paymentErrorTitle || undefined}
        message={paymentErrorMessage || ""}
        errorCode={paymentErrorCode || undefined}
        onClose={() => {
          hidePaymentError();
        }}
        onAction={() => {
          // Rediriger vers la page des dettes pour voir les détails
          router.push("/profile/debts");
          hidePaymentError();
        }}
        actionLabel="Voir mes dettes"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  backButton: {
    position: "absolute",
    top: 60,
    left: 20,
    width: 50,
    height: 50,
    backgroundColor: "#fff",
    borderRadius: 25,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
  },
  zoomOutButton: {
    position: "absolute",
    top: 120,
    right: 20,
    width: 50,
    height: 50,
    backgroundColor: "#fff",
    borderRadius: 25,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
  },
  mapStyleButton: {
    position: 'absolute',
    top: 175,
    right: 20,
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
  },
  centerOnMeButton: {
    position: "absolute",
    top: 60,
    right: 20,
    width: 50,
    height: 50,
    backgroundColor: "#fff",
    borderRadius: 25,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
  },
  devButton: {
    position: "absolute",
    right: 20,
    bottom: 40,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#ff6b6b",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1200,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  driverSearchBackButton: {
    position: "absolute",
    bottom: 220, // Positionné au-dessus du bottom sheet de recherche (environ 200px de hauteur + padding)
    left: 20,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
});
