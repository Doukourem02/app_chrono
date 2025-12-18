import { useCallback } from 'react';
import { Alert } from 'react-native';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useAuthStore } from '../store/useAuthStore';
import { userOrderSocketService } from '../services/userOrderSocketService';
import { locationService } from '../services/locationService';
import { logger } from '../utils/logger';

interface UseMapNewOrderProps {
  user: ReturnType<typeof useAuthStore.getState>['user'];
  pickupCoords: { latitude: number; longitude: number } | null;
  dropoffCoords: { latitude: number; longitude: number } | null;
  pickupLocation: string;
  deliveryLocation: string;
  selectedMethod: 'moto' | 'vehicule' | 'cargo';
  region: { latitude: number; longitude: number } | null;
  recipientInfo: {
    userId?: string;
    phone?: string;
    isRegistered?: boolean;
  };
  stopDriverSearch: () => void;
  resetAfterDriverSearch: () => void;
  clearRoute: () => void;
  setPickupCoords: (coords: { latitude: number; longitude: number } | null) => void;
  setDropoffCoords: (coords: { latitude: number; longitude: number } | null) => void;
  setPickupLocation: (location: string) => void;
  setDeliveryLocation: (location: string) => void;
  setSelectedMethod: (method: 'moto' | 'vehicule' | 'cargo') => void;
  setIsCreatingNewOrder: (value: boolean) => void;
  animateToCoordinate: (coords: { latitude: number; longitude: number }, duration?: number) => void;
  scheduleBottomSheetOpen: (delay?: number) => void;
  collapseOrderDetailsSheet: () => void;
  collapseDeliveryMethodSheet: () => void;
  userManuallyClosedRef: React.MutableRefObject<boolean>;
  hasAutoOpenedRef: React.MutableRefObject<boolean>;
  setShowPaymentSheet: (show: boolean) => void;
  setPaymentPayerType: (type: 'client' | 'recipient') => void;
  setSelectedPaymentMethodType: (type: 'orange_money' | 'wave' | 'cash' | 'deferred' | null) => void;
  setRecipientInfo: (info: { userId?: string; phone?: string; isRegistered?: boolean }) => void;
  setPaymentPartialInfo: (info: { isPartial?: boolean; partialAmount?: number }) => void;
}

export function useMapNewOrder({
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
  setRecipientInfo: setRecipientInfoState,
  setPaymentPartialInfo,
}: UseMapNewOrderProps) {
  const handleOrderDetailsConfirm = useCallback(
    async (
      pickupDetails: any,
      dropoffDetails: any,
      payerType?: 'client' | 'recipient',
      isPartialPayment?: boolean,
      partialAmount?: number,
      paymentMethodType?: 'orange_money' | 'wave' | 'cash' | 'deferred',
      paymentMethodId?: string | null
    ) => {
      // Vérifier l'authentification avant de créer la commande
      if (!user) {
        Alert.alert(
          'Connexion requise',
          'Vous devez vous connecter ou créer un compte pour passer une commande.',
          [
            {
              text: 'Annuler',
              style: 'cancel',
            },
            {
              text: 'Se connecter',
              onPress: () => {
                router.push('/(auth)/register' as any);
              },
            },
          ]
        );
        return;
      }

      if (
        pickupCoords &&
        dropoffCoords &&
        pickupLocation &&
        deliveryLocation &&
        selectedMethod
      ) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        logger.info('📦 Envoi commande avec détails...', 'useMapNewOrder');

        try {
          stopDriverSearch();
          resetAfterDriverSearch();
        } catch {}

        const orderData = {
          pickup: {
            address: pickupLocation,
            coordinates: pickupCoords,
            details: pickupDetails,
          },
          dropoff: {
            address: deliveryLocation,
            coordinates: dropoffCoords,
            details: dropoffDetails,
          },
          deliveryMethod: selectedMethod as 'moto' | 'vehicule' | 'cargo',
          userInfo: {
            name: user.email?.split('@')[0] || 'Client',
            rating: 4.5,
            phone: user.phone,
          },
          recipient: {
            phone: dropoffDetails.phone,
          },
          packageImages: dropoffDetails.photos || [],
          paymentMethodType: paymentMethodType,
          paymentMethodId: paymentMethodId || null,
          paymentPayerType: payerType,
          isPartialPayment: isPartialPayment,
          partialAmount:
            isPartialPayment && partialAmount ? partialAmount : undefined,
          recipientUserId: recipientInfo.userId,
          recipientIsRegistered: recipientInfo.isRegistered,
        };

        // Définir les états de paiement AVANT de créer la commande
        let recipientIsRegistered = false;
        let recipientUserId: string | undefined;

        if (payerType === 'recipient' && dropoffDetails.phone) {
          try {
            recipientIsRegistered = false;
          } catch (error) {
            logger.error('Erreur vérification destinataire:', 'useMapNewOrder', error);
            recipientIsRegistered = false;
          }
        }

        // Réinitialiser le PaymentBottomSheet et définir les nouveaux états AVANT la création
        setShowPaymentSheet(false);
        setPaymentPayerType(payerType || 'client');
        setSelectedPaymentMethodType(paymentMethodType || null);
        setRecipientInfoState({
          phone: dropoffDetails.phone,
          userId: recipientUserId,
          isRegistered: recipientIsRegistered,
        });

        if (isPartialPayment && partialAmount) {
          setPaymentPartialInfo({
            isPartial: true,
            partialAmount: partialAmount,
          });
        } else {
          setPaymentPartialInfo({});
        }

        const success = await userOrderSocketService.createOrder(orderData);
        if (success) {
          collapseOrderDetailsSheet();
          collapseDeliveryMethodSheet();

          setTimeout(() => {
            try {
              clearRoute();
            } catch {}
            setPickupCoords(null);
            setDropoffCoords(null);
            setPickupLocation('');
            setDeliveryLocation('');
            setSelectedMethod('moto');

            setIsCreatingNewOrder(true);

            locationService
              .getCurrentPosition()
              .then((coords) => {
                if (coords && region) {
                  setTimeout(() => {
                    animateToCoordinate(
                      {
                        latitude: coords.latitude,
                        longitude: coords.longitude,
                      },
                      0.01
                    );
                  }, 100);
                } else if (region) {
                  setTimeout(() => {
                    animateToCoordinate(
                      {
                        latitude: region.latitude,
                        longitude: region.longitude,
                      },
                      0.01
                    );
                  }, 100);
                }
              })
              .catch(() => {
                if (region) {
                  setTimeout(() => {
                    animateToCoordinate(
                      {
                        latitude: region.latitude,
                        longitude: region.longitude,
                      },
                      0.01
                    );
                  }, 100);
                }
              });

            setTimeout(() => {
              userManuallyClosedRef.current = false;
              hasAutoOpenedRef.current = false;
              setIsCreatingNewOrder(true);
              scheduleBottomSheetOpen();
            }, 500);
          }, 300);
        } else {
          // L'erreur sera gérée par le socket 'order-error'
          setIsCreatingNewOrder(true);
          collapseOrderDetailsSheet();
          collapseDeliveryMethodSheet();
          setTimeout(() => {
            scheduleBottomSheetOpen();
          }, 300);
        }
      }
    },
    [
      pickupCoords,
      dropoffCoords,
      pickupLocation,
      deliveryLocation,
      user,
      selectedMethod,
      recipientInfo,
      collapseOrderDetailsSheet,
      collapseDeliveryMethodSheet,
      clearRoute,
      setPickupCoords,
      setDropoffCoords,
      setPickupLocation,
      setDeliveryLocation,
      setSelectedMethod,
      setIsCreatingNewOrder,
      animateToCoordinate,
      region,
      scheduleBottomSheetOpen,
      stopDriverSearch,
      resetAfterDriverSearch,
      userManuallyClosedRef,
      hasAutoOpenedRef,
      setShowPaymentSheet,
      setPaymentPayerType,
      setSelectedPaymentMethodType,
      setRecipientInfoState,
      setPaymentPartialInfo,
    ]
  );

  return {
    handleOrderDetailsConfirm,
  };
}

