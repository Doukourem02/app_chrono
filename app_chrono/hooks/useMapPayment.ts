import { useEffect, useState } from 'react';
import { useOrderStore } from '../store/useOrderStore';

interface UseMapPaymentProps {
  currentOrder: ReturnType<typeof useOrderStore.getState>['activeOrders'][0] | null;
  pendingOrder: ReturnType<typeof useOrderStore.getState>['activeOrders'][0] | null;
}

export function useMapPayment({ currentOrder, pendingOrder }: UseMapPaymentProps) {
  const [showPaymentSheet, setShowPaymentSheet] = useState(false);
  const [paymentPayerType, setPaymentPayerType] = useState<'client' | 'recipient'>('client');
  const [selectedPaymentMethodType, setSelectedPaymentMethodType] = useState<
    'orange_money' | 'wave' | 'cash' | 'deferred' | null
  >(null);
  const [recipientInfo, setRecipientInfo] = useState<{
    userId?: string;
    phone?: string;
    isRegistered?: boolean;
  }>({});
  const [paymentPartialInfo, setPaymentPartialInfo] = useState<{
    isPartial?: boolean;
    partialAmount?: number;
  }>({});

  // Gérer l'affichage automatique du PaymentBottomSheet
  useEffect(() => {
    const orderStatus = currentOrder?.status || pendingOrder?.status;
    const order = currentOrder || pendingOrder;

    if (__DEV__) {
      console.log('🔍 PaymentBottomSheet useEffect:', {
        orderStatus,
        hasCurrentOrder: !!currentOrder,
        hasPendingOrder: !!pendingOrder,
        paymentPayerType,
        selectedPaymentMethodType,
        showPaymentSheet,
        orderId: order?.id,
        paymentStatus: (order as any)?.payment_status,
      });
    }

    // Ne pas afficher le PaymentBottomSheet si c'est le destinataire qui paie
    if (paymentPayerType === 'recipient') {
      if (__DEV__) {
        console.log('⏭️ PaymentBottomSheet: destinataire paie, on ne l\'affiche pas');
      }
      return;
    }

    // Ne pas afficher si on n'a pas de commande ou si le statut n'est pas 'accepted'
    if (orderStatus !== 'accepted' || !order) {
      if (__DEV__) {
        console.log('⏭️ PaymentBottomSheet: statut pas accepted ou pas de commande', {
          orderStatus,
          hasOrder: !!order,
        });
      }
      return;
    }

    // S'assurer qu'on a bien une commande avec le bon statut
    if (order.status !== 'accepted') {
      if (__DEV__) {
        console.log('⏭️ PaymentBottomSheet: commande pas accepted', {
          orderStatus: order.status,
        });
      }
      return;
    }

    // Ne pas afficher si déjà affiché ou si déjà payé
    if (showPaymentSheet) {
      if (__DEV__) {
        console.log('⏭️ PaymentBottomSheet: déjà affiché');
      }
      return;
    }

    const paymentStatus = (order as any)?.payment_status;
    if (paymentStatus === 'paid') {
      if (__DEV__) {
        console.log('⏭️ PaymentBottomSheet: déjà payé');
      }
      return;
    }

    // Pour les paiements en espèces ou différé, pas besoin d'afficher le PaymentBottomSheet
    if (selectedPaymentMethodType === 'cash' || selectedPaymentMethodType === 'deferred') {
      if (__DEV__) {
        console.log('✅ Paiement en espèces ou différé - pas de paiement électronique requis');
      }
      return;
    }

    // Afficher le PaymentBottomSheet pour Orange Money, Wave, ou si aucune méthode n'est sélectionnée
    if (
      selectedPaymentMethodType === 'orange_money' ||
      selectedPaymentMethodType === 'wave' ||
      !selectedPaymentMethodType
    ) {
      if (__DEV__) {
        console.log('✅ Affichage du PaymentBottomSheet dans 500ms');
      }
      const timer = setTimeout(() => {
        setShowPaymentSheet(true);
        if (__DEV__) {
          console.log('✅ PaymentBottomSheet affiché');
        }
      }, 500);

      return () => clearTimeout(timer);
    }

    if (__DEV__) {
      console.log('⏭️ PaymentBottomSheet: aucune condition remplie pour afficher');
    }
  }, [
    currentOrder?.status,
    pendingOrder?.status,
    showPaymentSheet,
    currentOrder,
    pendingOrder,
    selectedPaymentMethodType,
    paymentPayerType,
  ]);

  return {
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
  };
}

