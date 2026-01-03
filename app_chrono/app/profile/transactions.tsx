import React, { useState, useEffect, useCallback } from 'react';
import {View,Text,StyleSheet,TouchableOpacity,ScrollView,ActivityIndicator,Alert,Modal,TextInput,} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../store/useAuthStore';
import { paymentApi, Transaction, DisputeType } from '../../services/paymentApi';
import { logger } from '../../utils/logger';

export default function TransactionsPage() {
  const { user } = useAuthStore();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [showDisputeModal, setShowDisputeModal] = useState(false);
  const [disputeType, setDisputeType] = useState<DisputeType>('other');
  const [disputeReason, setDisputeReason] = useState('');
  const [disputeDescription, setDisputeDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [filter, setFilter] = useState<'all' | 'paid' | 'refused' | 'refunded'>('all');

  const loadTransactions = useCallback(async () => {
    if (!user?.id) return;

    setIsLoading(true);
    try {
      const result = await paymentApi.getTransactions({
        limit: 100,
        status: filter === 'all' ? undefined : filter,
      });

      if (result.success && result.data) {
        setTransactions(result.data);
      }
    } catch (error) {
      logger.error('Erreur chargement transactions:', undefined, error);
      Alert.alert('Erreur', 'Impossible de charger vos transactions');
    } finally {
      setIsLoading(false);
    }
  }, [user?.id, filter]);

  useEffect(() => {
    loadTransactions();
  }, [loadTransactions]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid':
        return '#10B981';
      case 'refused':
      case 'cancelled':
        return '#EF4444';
      case 'refunded':
        return '#F59E0B';
      case 'pending':
        return '#6B7280';
      default:
        return '#6B7280';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'paid':
        return 'Payée';
      case 'refused':
        return 'Refusée';
      case 'refunded':
        return 'Remboursée';
      case 'pending':
        return 'En attente';
      case 'cancelled':
        return 'Annulée';
      default:
        return status;
    }
  };

  const getMethodLabel = (type: string) => {
    switch (type) {
      case 'orange_money':
        return 'Orange Money';
      case 'wave':
        return 'Wave';
      case 'cash':
        return 'Espèces';
      case 'deferred':
        return 'Paiement différé';
      default:
        return type;
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatPrice = (amount: number) => {
    return `${amount.toLocaleString('fr-FR')} FCFA`;
  };

  const canDispute = (transaction: Transaction) => {
    return transaction.status === 'paid' && !transaction.refunded_at;
  };

  const handleDispute = (transaction: Transaction) => {
    setSelectedTransaction(transaction);
    setDisputeType('other');
    setDisputeReason('');
    setDisputeDescription('');
    setShowDisputeModal(true);
  };

  const handleSubmitDispute = async () => {
    if (!selectedTransaction) return;

    if (!disputeReason.trim()) {
      Alert.alert('Erreur', 'Veuillez indiquer la raison de votre réclamation');
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await paymentApi.createDispute({
        transactionId: selectedTransaction.id,
        disputeType,
        reason: disputeReason.trim(),
        description: disputeDescription.trim() || undefined,
      });

      if (result.success) {
        Alert.alert(
          'Réclamation créée',
          'Votre réclamation a été enregistrée. Nous allons l\'examiner dans les plus brefs délais.',
          [
            {
              text: 'OK',
              onPress: () => {
                setShowDisputeModal(false);
                setSelectedTransaction(null);
                loadTransactions();
              },
            },
          ]
        );
      } else {
        Alert.alert('Erreur', result.message || 'Impossible de créer la réclamation');
      }
    } catch (error) {
      logger.error('Erreur création dispute:', undefined, error);
      Alert.alert('Erreur', 'Une erreur est survenue. Veuillez réessayer.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getDisputeTypeLabel = (type: DisputeType) => {
    switch (type) {
      case 'refund_request':
        return 'Demande de remboursement';
      case 'payment_issue':
        return 'Problème de paiement';
      case 'service_issue':
        return 'Problème de service';
      case 'other':
        return 'Autre';
      default:
        return type;
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Mes transactions</Text>
      </View>

      {/* Filtres */}
      <View style={styles.filters}>
        <TouchableOpacity
          style={[styles.filterButton, filter === 'all' && styles.filterButtonActive]}
          onPress={() => setFilter('all')}
        >
          <Text style={[styles.filterText, filter === 'all' && styles.filterTextActive]}>
            Toutes
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterButton, filter === 'paid' && styles.filterButtonActive]}
          onPress={() => setFilter('paid')}
        >
          <Text style={[styles.filterText, filter === 'paid' && styles.filterTextActive]}>
            Payées
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterButton, filter === 'refused' && styles.filterButtonActive]}
          onPress={() => setFilter('refused')}
        >
          <Text style={[styles.filterText, filter === 'refused' && styles.filterTextActive]}>
            Refusées
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterButton, filter === 'refunded' && styles.filterButtonActive]}
          onPress={() => setFilter('refunded')}
        >
          <Text style={[styles.filterText, filter === 'refunded' && styles.filterTextActive]}>
            Remboursées
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#8B5CF6" />
          </View>
        ) : transactions.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="receipt-outline" size={64} color="#9CA3AF" />
            <Text style={styles.emptyText}>Aucune transaction trouvée</Text>
          </View>
        ) : (
          transactions.map((transaction) => (
            <View key={transaction.id} style={styles.transactionCard}>
              <View style={styles.transactionHeader}>
                <View style={styles.transactionInfo}>
                  <Text style={styles.transactionId}>
                    Transaction #{transaction.id.slice(0, 8)}
                  </Text>
                  <View
                    style={[
                      styles.statusBadge,
                      { backgroundColor: `${getStatusColor(transaction.status)}20` },
                    ]}
                  >
                    <View
                      style={[styles.statusDot, { backgroundColor: getStatusColor(transaction.status) }]}
                    />
                    <Text
                      style={[
                        styles.statusText,
                        { color: getStatusColor(transaction.status) },
                      ]}
                    >
                      {getStatusLabel(transaction.status)}
                    </Text>
                  </View>
                </View>
                <Text style={styles.transactionAmount}>
                  {formatPrice(transaction.amount)}
                </Text>
              </View>

              <View style={styles.transactionDetails}>
                <View style={styles.detailRow}>
                  <Ionicons name="card-outline" size={16} color="#6B7280" />
                  <Text style={styles.detailText}>
                    {getMethodLabel(transaction.payment_method_type)}
                  </Text>
                </View>
                <View style={styles.detailRow}>
                  <Ionicons name="time-outline" size={16} color="#6B7280" />
                  <Text style={styles.detailText}>
                    {formatDate(transaction.created_at)}
                  </Text>
                </View>
                {transaction.order_id && (
                  <View style={styles.detailRow}>
                    <Ionicons name="cube-outline" size={16} color="#6B7280" />
                    <Text style={styles.detailText}>
                      Commande #{transaction.order_id.slice(0, 8)}
                    </Text>
                  </View>
                )}
              </View>

              {canDispute(transaction) && (
                <TouchableOpacity
                  style={styles.disputeButton}
                  onPress={() => handleDispute(transaction)}
                >
                  <Ionicons name="alert-circle-outline" size={18} color="#EF4444" />
                  <Text style={styles.disputeButtonText}>Contester cette transaction</Text>
                </TouchableOpacity>
              )}
            </View>
          ))
        )}
      </ScrollView>

      {/* Modal de réclamation */}
      <Modal
        visible={showDisputeModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowDisputeModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Contester une transaction</Text>
              <TouchableOpacity
                onPress={() => setShowDisputeModal(false)}
                style={styles.closeButton}
              >
                <Ionicons name="close" size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>

            {selectedTransaction && (
              <View style={styles.modalTransactionInfo}>
                <Text style={styles.modalTransactionText}>
                  Transaction #{selectedTransaction.id.slice(0, 8)}
                </Text>
                <Text style={styles.modalTransactionAmount}>
                  {formatPrice(selectedTransaction.amount)}
                </Text>
              </View>
            )}

            <ScrollView style={styles.modalBody}>
              <View style={styles.formGroup}>
                <Text style={styles.label}>Type de réclamation *</Text>
                {(['refund_request', 'payment_issue', 'service_issue', 'other'] as DisputeType[]).map(
                  (type) => (
                    <TouchableOpacity
                      key={type}
                      style={[
                        styles.radioButton,
                        disputeType === type && styles.radioButtonActive,
                      ]}
                      onPress={() => setDisputeType(type)}
                    >
                      <View
                        style={[
                          styles.radioCircle,
                          disputeType === type && styles.radioCircleActive,
                        ]}
                      >
                        {disputeType === type && <View style={styles.radioInner} />}
                      </View>
                      <Text style={styles.radioLabel}>{getDisputeTypeLabel(type)}</Text>
                    </TouchableOpacity>
                  )
                )}
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Raison *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Expliquez brièvement la raison de votre réclamation"
                  value={disputeReason}
                  onChangeText={setDisputeReason}
                  multiline
                  numberOfLines={3}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Description (optionnel)</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  placeholder="Ajoutez des détails supplémentaires si nécessaire"
                  value={disputeDescription}
                  onChangeText={setDisputeDescription}
                  multiline
                  numberOfLines={5}
                />
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setShowDisputeModal(false)}
                disabled={isSubmitting}
              >
                <Text style={styles.cancelButtonText}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.submitButton]}
                onPress={handleSubmitDispute}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.submitButtonText}>Envoyer la réclamation</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    backgroundColor: '#FFFFFF',
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1F2937',
  },
  filters: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    gap: 8,
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
  },
  filterButtonActive: {
    backgroundColor: '#8B5CF6',
  },
  filterText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6B7280',
  },
  filterTextActive: {
    color: '#FFFFFF',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    color: '#6B7280',
    marginTop: 16,
  },
  transactionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  transactionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  transactionInfo: {
    flex: 1,
  },
  transactionId: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 8,
    fontFamily: 'monospace',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  transactionAmount: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
  },
  transactionDetails: {
    gap: 8,
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  detailText: {
    fontSize: 14,
    color: '#6B7280',
  },
  disputeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FEE2E2',
    gap: 8,
    marginTop: 8,
  },
  disputeButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#EF4444',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
    paddingBottom: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
  },
  closeButton: {
    padding: 4,
  },
  modalTransactionInfo: {
    padding: 20,
    backgroundColor: '#F9FAFB',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  modalTransactionText: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 4,
  },
  modalTransactionAmount: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
  },
  modalBody: {
    padding: 20,
    maxHeight: 400,
  },
  formGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: '#1F2937',
    backgroundColor: '#FFFFFF',
    minHeight: 44,
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  radioButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 8,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  radioButtonActive: {
    backgroundColor: '#F3F0FF',
    borderColor: '#8B5CF6',
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioCircleActive: {
    borderColor: '#8B5CF6',
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#8B5CF6',
  },
  radioLabel: {
    fontSize: 14,
    color: '#1F2937',
    flex: 1,
  },
  modalFooter: {
    flexDirection: 'row',
    padding: 20,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  modalButton: {
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
  submitButton: {
    backgroundColor: '#8B5CF6',
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

