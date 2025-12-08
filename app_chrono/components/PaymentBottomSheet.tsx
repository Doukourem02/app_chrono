import React, { useState, useEffect } from 'react';
import {View,Text,StyleSheet,TouchableOpacity,ActivityIndicator,Alert,ScrollView,TextInput,Switch} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { paymentApi, PaymentMethodType, DeferredPaymentInfo } from '../services/paymentApi';
import { usePaymentStore } from '../store/usePaymentStore';
import PaymentMethodSelector from './PaymentMethodSelector';
import PriceCalculationCard from './PriceCalculationCard';

interface PaymentBottomSheetProps {
  orderId: string;
  distance: number;
  deliveryMethod: 'moto' | 'vehicule' | 'cargo';
  price: number;
  isUrgent?: boolean;
  visible: boolean;
  onClose: () => void;
  onPaymentSuccess?: (transactionId: string) => void;
  onPaymentError?: (error: string) => void;
  payerType?: 'client' | 'recipient';
  recipientUserId?: string;
  recipientPhone?: string;
  recipientIsRegistered?: boolean;
  initialIsPartial?: boolean;
  initialPartialAmount?: number;
  preselectedPaymentMethod?: PaymentMethodType;
}

export default function PaymentBottomSheet({
  orderId,
  distance,
  deliveryMethod,
  price,
  isUrgent = false,
  visible,
  onClose,
  onPaymentSuccess,
  onPaymentError,
  payerType = 'client',
  recipientUserId,
  recipientPhone,
  recipientIsRegistered = false,
  initialIsPartial = false,
  initialPartialAmount,
    preselectedPaymentMethod, 
}: PaymentBottomSheetProps) {
  const { paymentMethods, selectedPaymentMethod, loadPaymentMethods } = usePaymentStore();
  const [selectedMethodType, setSelectedMethodType] = useState<PaymentMethodType | null>(preselectedPaymentMethod || null);
  const [isProcessing, setIsProcessing] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [phoneNumber, setPhoneNumber] = useState('');
  const [isPartial, setIsPartial] = useState(initialIsPartial);
  const [partialAmount, setPartialAmount] = useState<string>(
    initialPartialAmount ? initialPartialAmount.toString() : ''
  );
  const [deferredInfo, setDeferredInfo] = useState<DeferredPaymentInfo | null>(null);
  const [loadingDeferredInfo, setLoadingDeferredInfo] = useState(false);

  useEffect(() => {
    if (visible) {
      loadPaymentMethods();
      if (preselectedPaymentMethod) {
        setSelectedMethodType(preselectedPaymentMethod);
      } else if (selectedPaymentMethod) {
        setSelectedMethodType(selectedPaymentMethod.method_type);
      } else if (paymentMethods.length > 0) {
        const defaultMethod = paymentMethods.find((m) => m.is_default) || paymentMethods[0];
        setSelectedMethodType(defaultMethod.method_type);
      }

      // Charger les limites de paiement différé si le payer est le client
      if (payerType === 'client') {
        loadDeferredInfo();
      }
    }
  }, [visible, loadPaymentMethods, selectedPaymentMethod, paymentMethods, preselectedPaymentMethod, payerType]);

  const loadDeferredInfo = async () => {
    setLoadingDeferredInfo(true);
    try {
      const result = await paymentApi.getDeferredPaymentLimits();
      if (result.success && result.data) {
        setDeferredInfo(result.data);
      }
    } catch (error) {
      console.error('Erreur chargement limites paiement différé:', error);
    } finally {
      setLoadingDeferredInfo(false);
    }
  };

  const handleSelectMethod = (methodType: PaymentMethodType) => {
    setSelectedMethodType(methodType);
  };

  const handlePay = async () => {
    if (!selectedMethodType) {
      Alert.alert('Erreur', 'Veuillez sélectionner une méthode de paiement');
      return;
    }

    if ((selectedMethodType === 'orange_money' || selectedMethodType === 'wave')) {
      const method = paymentMethods.find((m) => m.method_type === selectedMethodType);
      if (!method?.provider_account && !phoneNumber) {
        Alert.alert('Erreur', 'Veuillez entrer votre numéro de téléphone');
        return;
      }
    }

    if (isPartial && partialAmount) {
      const partial = parseFloat(partialAmount);
      if (isNaN(partial) || partial <= 0 || partial > price) {
        Alert.alert('Erreur', 'Montant partiel invalide');
        return;
      }
    }

    if (payerType === 'recipient' && !recipientIsRegistered && selectedMethodType === 'deferred') {
      Alert.alert(
        'Erreur',
        'Le destinataire non enregistré ne peut pas opter pour le paiement différé. Veuillez choisir une autre méthode.'
      );
      return;
    }

    // Valider les limites de paiement différé si c'est un paiement différé par le client
    if (selectedMethodType === 'deferred' && payerType === 'client') {
      if (!deferredInfo) {
        // Recharger les infos si elles ne sont pas disponibles
        await loadDeferredInfo();
        Alert.alert('Erreur', 'Impossible de vérifier les limites de paiement différé. Veuillez réessayer.');
        return;
      }

      if (!deferredInfo.canUse) {
        Alert.alert(
          'Paiement différé non disponible',
          deferredInfo.reason || 'Vous ne pouvez pas utiliser le paiement différé pour le moment.'
        );
        return;
      }

      // Vérifier que le montant ne dépasse pas le crédit disponible
      const amountToCheck = isPartial && partialAmount ? parseFloat(partialAmount) : price;
      if (amountToCheck > deferredInfo.monthlyRemaining) {
        Alert.alert(
          'Crédit insuffisant',
          `Votre crédit mensuel disponible est de ${deferredInfo.monthlyRemaining.toLocaleString()} FCFA. Le montant demandé est de ${amountToCheck.toLocaleString()} FCFA.`
        );
        return;
      }
    }

    setIsProcessing(true);

    try {
      const result = await paymentApi.initiatePayment({
        orderId,
        paymentMethodId: selectedPaymentMethod?.id,
        paymentMethodType: selectedMethodType,
        phoneNumber: phoneNumber || undefined,
        isPartial: isPartial && partialAmount ? true : false,
        partialAmount: isPartial && partialAmount ? parseFloat(partialAmount) : undefined,
        payerType,
        recipientUserId,
        recipientPhone,
      });

      if (result.success && result.data) {
        usePaymentStore.getState().setCurrentTransaction(result.data.transaction);
        onPaymentSuccess?.(result.data.transaction.id);
        Alert.alert('Succès', 'Paiement initié avec succès', [
          { text: 'OK', onPress: onClose },
        ]);
      } else {
        const errorMsg = result.message || 'Erreur lors de l\'initiation du paiement';
        onPaymentError?.(errorMsg);
        Alert.alert('Erreur', errorMsg);
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Erreur inconnue';
      onPaymentError?.(errorMsg);
      Alert.alert('Erreur', errorMsg);
    } finally {
      setIsProcessing(false);
    }
  };

  if (!visible) {
    return null;
  }

  return (
    <View style={styles.overlay}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Paiement</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color="#000" />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          <PriceCalculationCard
            distance={distance}
            deliveryMethod={deliveryMethod}
            isUrgent={isUrgent}
          />

          <PaymentMethodSelector
            selectedMethod={selectedMethodType}
            onSelect={handleSelectMethod}
            showAddNew={false}
          />

          {(selectedMethodType === 'orange_money' || selectedMethodType === 'wave') && (
            <View style={styles.phoneInputContainer}>
              <Text style={styles.phoneLabel}>Numéro de téléphone</Text>
              <Text style={styles.phoneHint}>
                {selectedPaymentMethod?.provider_account || 'Entrez votre numéro'}
              </Text>
            </View>
          )}

          {payerType === 'client' && (
            <View style={styles.partialPaymentContainer}>
              <View style={styles.partialPaymentHeader}>
                <Text style={styles.partialPaymentLabel}>Paiement partiel</Text>
                <Switch
                  value={isPartial}
                  onValueChange={setIsPartial}
                  trackColor={{ false: '#CCC', true: '#007AFF' }}
                  thumbColor="#FFF"
                />
              </View>
              {isPartial && (
                <View style={styles.partialAmountContainer}>
                  <Text style={styles.partialAmountLabel}>Montant à payer maintenant</Text>
                  <TextInput
                    style={styles.partialAmountInput}
                    value={partialAmount}
                    onChangeText={setPartialAmount}
                    placeholder="0"
                    keyboardType="numeric"
                    placeholderTextColor="#999"
                  />
                  <Text style={styles.partialAmountHint}>
                    Montant restant:{' '}
                    {partialAmount
                      ? (price - parseFloat(partialAmount || '0')).toLocaleString()
                      : price.toLocaleString()}{' '}
                    XOF
                  </Text>
                </View>
              )}
            </View>
          )}

          {payerType === 'recipient' && (
            <View style={styles.payerInfoContainer}>
              <Ionicons name="information-circle" size={20} color="#007AFF" />
              <Text style={styles.payerInfoText}>
                {recipientIsRegistered
                  ? 'Le destinataire peut opter pour le paiement différé'
                  : 'Le destinataire doit payer en un coup (cash ou mobile money immédiat)'}
              </Text>
            </View>
          )}

          <TouchableOpacity
            style={[styles.payButton, (isProcessing || !selectedMethodType) && styles.payButtonDisabled]}
            onPress={handlePay}
            disabled={isProcessing || !selectedMethodType}
          >
            {isProcessing ? (
              <ActivityIndicator size="small" color="#FFF" />
            ) : (
              <>
                <Ionicons name="card" size={20} color="#FFF" />
                <Text style={styles.payButtonText}>
                  {isPartial && partialAmount
                    ? `Payer ${parseFloat(partialAmount || '0').toLocaleString()} XOF`
                    : `Payer ${price.toLocaleString()} XOF`}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
    zIndex: 1000,
  },
  container: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
    paddingBottom: 32,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: '#000',
  },
  closeButton: {
    padding: 4,
  },
  content: {
    padding: 16,
  },
  phoneInputContainer: {
    marginTop: 16,
    marginBottom: 8,
  },
  phoneLabel: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
    color: '#000',
  },
  phoneHint: {
    fontSize: 14,
    color: '#666',
  },
  payButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#007AFF',
    borderRadius: 12,
    padding: 16,
    marginTop: 24,
    gap: 8,
  },
  payButtonDisabled: {
    backgroundColor: '#CCC',
  },
  payButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
  },
  partialPaymentContainer: {
    marginTop: 16,
    marginBottom: 8,
    padding: 16,
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
  },
  partialPaymentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  partialPaymentLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#000',
  },
  partialAmountContainer: {
    marginTop: 8,
  },
  partialAmountLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 8,
  },
  partialAmountInput: {
    backgroundColor: '#FFF',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    marginBottom: 8,
  },
  partialAmountHint: {
    fontSize: 12,
    color: '#666',
  },
  payerInfoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 8,
    padding: 12,
    backgroundColor: '#E3F2FD',
    borderRadius: 8,
    gap: 8,
  },
  payerInfoText: {
    flex: 1,
    fontSize: 12,
    color: '#007AFF',
  },
});

