import React, { useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  Modal, 
  TouchableOpacity, 
  TextInput, 
  ActivityIndicator,
  Alert,
  ScrollView
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useCommissionStore } from '../store/useCommissionStore';
import { useDriverStore } from '../store/useDriverStore';

interface RechargeModalProps {
  visible: boolean;
  onClose: () => void;
}

export const RechargeModal: React.FC<RechargeModalProps> = ({ visible, onClose }) => {
  const { account, recharge, isLoading } = useCommissionStore();
  const { user } = useDriverStore();
  const [amount, setAmount] = useState('');
  const [selectedMethod, setSelectedMethod] = useState<'orange_money' | 'wave' | null>(null);

  const formatCurrency = (value: string) => {
    const numericValue = value.replace(/\D/g, '');
    if (!numericValue) return '';
    const number = parseInt(numericValue, 10);
    return new Intl.NumberFormat('fr-FR', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(number);
  };

  const handleAmountChange = (text: string) => {
    const formatted = formatCurrency(text);
    setAmount(formatted);
  };

  const handleRecharge = async () => {
    if (!amount) {
      Alert.alert('Erreur', 'Veuillez saisir un montant');
      return;
    }

    const numericAmount = parseInt(amount.replace(/\s/g, ''), 10);
    
    if (numericAmount < 10000) {
      Alert.alert('Erreur', 'Le montant minimum de recharge est de 10 000 FCFA');
      return;
    }

    if (!selectedMethod) {
      Alert.alert('Erreur', 'Veuillez sélectionner une méthode de paiement');
      return;
    }

    try {
      const result = await recharge(numericAmount, selectedMethod);
      
      if (result.success) {
        Alert.alert(
          'Recharge initiée',
          'Votre demande de recharge a été envoyée. Vous serez redirigé vers votre application de paiement.',
          [
            {
              text: 'OK',
              onPress: () => {
                setAmount('');
                setSelectedMethod(null);
                onClose();
              }
            }
          ]
        );
      } else {
        Alert.alert('Erreur', result.message || 'Erreur lors de la recharge');
      }
    } catch (error: any) {
      Alert.alert('Erreur', error.message || 'Erreur de connexion');
    }
  };

  const quickAmounts = [10000, 25000, 50000, 100000];

  const currentBalance = account?.balance ?? 0;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          <View style={styles.header}>
            <Text style={styles.title}>Recharger mon compte</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color="#666" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {/* Solde actuel */}
            <View style={styles.balanceSection}>
              <Text style={styles.balanceLabel}>Solde actuel</Text>
              <Text style={styles.balanceAmount}>
                {new Intl.NumberFormat('fr-FR', {
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 0,
                }).format(currentBalance)} FCFA
              </Text>
              <Text style={styles.minimumText}>
                Minimum : 10 000 FCFA
              </Text>
            </View>

            {/* Montant */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Montant à recharger</Text>
              <View style={styles.amountInputContainer}>
                <TextInput
                  style={styles.amountInput}
                  value={amount}
                  onChangeText={handleAmountChange}
                  placeholder="0"
                  keyboardType="numeric"
                  placeholderTextColor="#9CA3AF"
                />
                <Text style={styles.currencyText}>FCFA</Text>
              </View>

              {/* Montants rapides */}
              <View style={styles.quickAmountsContainer}>
                {quickAmounts.map((quickAmount) => (
                  <TouchableOpacity
                    key={quickAmount}
                    style={[
                      styles.quickAmountButton,
                      amount === quickAmount.toString() && styles.quickAmountButtonActive
                    ]}
                    onPress={() => setAmount(quickAmount.toString())}
                  >
                    <Text
                      style={[
                        styles.quickAmountText,
                        amount === quickAmount.toString() && styles.quickAmountTextActive
                      ]}
                    >
                      {new Intl.NumberFormat('fr-FR').format(quickAmount)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Méthode de paiement */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Méthode de paiement</Text>
              
              <TouchableOpacity
                style={[
                  styles.paymentMethodButton,
                  selectedMethod === 'orange_money' && styles.paymentMethodButtonActive
                ]}
                onPress={() => setSelectedMethod('orange_money')}
              >
                <View style={styles.paymentMethodContent}>
                  <View style={[
                    styles.radioButton,
                    selectedMethod === 'orange_money' && styles.radioButtonActive
                  ]}>
                    {selectedMethod === 'orange_money' && (
                      <View style={styles.radioButtonInner} />
                    )}
                  </View>
                  <Text style={styles.paymentMethodText}>Orange Money</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.paymentMethodButton,
                  selectedMethod === 'wave' && styles.paymentMethodButtonActive
                ]}
                onPress={() => setSelectedMethod('wave')}
              >
                <View style={styles.paymentMethodContent}>
                  <View style={[
                    styles.radioButton,
                    selectedMethod === 'wave' && styles.radioButtonActive
                  ]}>
                    {selectedMethod === 'wave' && (
                      <View style={styles.radioButtonInner} />
                    )}
                  </View>
                  <Text style={styles.paymentMethodText}>Wave</Text>
                </View>
              </TouchableOpacity>
            </View>
          </ScrollView>

          {/* Actions */}
          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.button, styles.cancelButton]}
              onPress={onClose}
              disabled={isLoading}
            >
              <Text style={styles.cancelButtonText}>Annuler</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[
                styles.button,
                styles.rechargeButton,
                (!amount || !selectedMethod || isLoading) && styles.rechargeButtonDisabled
              ]}
              onPress={handleRecharge}
              disabled={!amount || !selectedMethod || isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.rechargeButtonText}>Recharger</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
    paddingBottom: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  closeButton: {
    padding: 4,
  },
  content: {
    padding: 20,
  },
  balanceSection: {
    backgroundColor: '#F9FAFB',
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
    alignItems: 'center',
  },
  balanceLabel: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 8,
  },
  balanceAmount: {
    fontSize: 28,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  minimumText: {
    fontSize: 12,
    color: '#6B7280',
    fontSize: 12,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 12,
  },
  amountInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  amountInput: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    paddingVertical: 12,
  },
  currencyText: {
    fontSize: 16,
    color: '#6B7280',
    marginLeft: 8,
  },
  quickAmountsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  quickAmountButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    backgroundColor: '#fff',
  },
  quickAmountButtonActive: {
    borderColor: '#8B5CF6',
    backgroundColor: '#F3F4F6',
  },
  quickAmountText: {
    fontSize: 14,
    color: '#6B7280',
  },
  quickAmountTextActive: {
    color: '#8B5CF6',
    fontWeight: '600',
  },
  paymentMethodButton: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    backgroundColor: '#fff',
  },
  paymentMethodButtonActive: {
    borderColor: '#8B5CF6',
    backgroundColor: '#F9FAFB',
  },
  paymentMethodContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  radioButton: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioButtonActive: {
    borderColor: '#8B5CF6',
  },
  radioButtonInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#8B5CF6',
  },
  paymentMethodText: {
    fontSize: 16,
    color: '#111827',
    fontWeight: '500',
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  button: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    backgroundColor: '#F3F4F6',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6B7280',
  },
  rechargeButton: {
    backgroundColor: '#8B5CF6',
  },
  rechargeButtonDisabled: {
    backgroundColor: '#D1D5DB',
  },
  rechargeButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});

