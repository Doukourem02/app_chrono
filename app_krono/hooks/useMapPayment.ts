import { useEffect, useState } from 'react';
import { useOrderStore } from '../store/useOrderStore';
import type { PaymentMethodType } from '../services/paymentApi';
import { logger } from '../utils/logger';

interface UseMapPaymentProps {
  currentOrder: ReturnType<typeof useOrderStore.getState>['activeOrders'][0] | null;
  pendingOrder: ReturnType<typeof useOrderStore.getState>['activeOrders'][0] | null;
}

export function useMapPayment({ currentOrder, pendingOrder }: UseMapPaymentProps) {
  const [showPaymentSheet, setShowPaymentSheet] = useState(false);
  const [paymentPayerType, setPaymentPayerType] = useState<'client' | 'recipient'>('client');
  const [selectedPaymentMethodType, setSelectedPaymentMethodType] =
    useState<PaymentMethodType | null>(null);
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
      logger.debug('🔍 PaymentBottomSheet useEffect:', undefined, {
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
        logger.debug('⏭️ PaymentBottomSheet: destinataire paie, on ne l\'affiche pas');
      }
      return;
    }

    // Ne pas afficher si on n'a pas de commande ou si le statut n'est pas 'accepted'
    if (orderStatus !== 'accepted' || !order) {
      if (__DEV__) {
        logger.debug('⏭️ PaymentBottomSheet: statut pas accepted ou pas de commande', undefined, {
          orderStatus,
          hasOrder: !!order,
        });
      }
      return;
    }

    // S'assurer qu'on a bien une commande avec le bon statut
    if (order.status !== 'accepted') {
      if (__DEV__) {
        logger.debug('⏭️ PaymentBottomSheet: commande pas accepted', undefined, {
          orderStatus: order.status,
        });
      }
      return;
    }

    // Ne pas afficher si déjà affiché ou si déjà payé
    if (showPaymentSheet) {
      if (__DEV__) {
        logger.debug('⏭️ PaymentBottomSheet: déjà affiché');
      }
      return;
    }

    const paymentStatus = (order as any)?.payment_status;
    if (paymentStatus === 'paid') {
      if (__DEV__) {
        logger.debug('⏭️ PaymentBottomSheet: déjà payé');
      }
      return;
    }

    // Pour les paiements en espèces ou différé, pas besoin d'afficher le PaymentBottomSheet
    if (selectedPaymentMethodType === 'cash' || selectedPaymentMethodType === 'deferred') {
      if (__DEV__) {
        logger.debug('✅ Paiement en espèces ou différé - pas de paiement électronique requis');
      }
      return;
    }

    // Afficher le PaymentBottomSheet pour mobile money, ou si aucune méthode n'est sélectionnée
    if (
      selectedPaymentMethodType === 'orange_money' ||
      selectedPaymentMethodType === 'wave' ||
      selectedPaymentMethodType === 'mtn_money' ||
      !selectedPaymentMethodType
    ) {
      if (__DEV__) {
        logger.debug('✅ Affichage du PaymentBottomSheet dans 500ms');
      }
      const timer = setTimeout(() => {
        setShowPaymentSheet(true);
        if (__DEV__) {
          logger.debug('✅ PaymentBottomSheet affiché');
        }
      }, 500);

      return () => clearTimeout(timer);
    }

    if (__DEV__) {
      logger.debug('⏭️ PaymentBottomSheet: aucune condition remplie pour afficher');
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

