import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import {ActivityIndicator,Alert,Modal,ScrollView,StyleSheet,Text,TextInput,TouchableOpacity,View,} from "react-native";
import { DeferredPaymentInfo, paymentApi } from "../../services/paymentApi";
import { logger } from "../../utils/logger";

interface Debt {
  id: string;
  orderId: string;
  amount: number;
  status: string;
  createdAt: string;
  updatedAt: string;
  orderStatus: string;
  pickupAddress?: string;
  dropoffAddress?: string;
  deadline: string;
  isOverdue: boolean;
  daysUntilDeadline: number;
}

export default function DebtsPage() {
  const [deferredInfo, setDeferredInfo] = useState<DeferredPaymentInfo | null>(null);
  const [debts, setDebts] = useState<Debt[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // État du modal de remboursement
  const [repayModal, setRepayModal] = useState<{ visible: boolean; debt: Debt | null }>({ visible: false, debt: null });
  const [repayMethod, setRepayMethod] = useState<'orange_money' | 'wave'>('orange_money');
  const [repayPhone, setRepayPhone] = useState('');
  const [isRepaying, setIsRepaying] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [limitsResult, debtsResult] = await Promise.all([
        paymentApi.getDeferredPaymentLimits(),
        paymentApi.getDeferredDebts(),
      ]);

      if (limitsResult.success && limitsResult.data) {
        setDeferredInfo(limitsResult.data);
      }

      if (debtsResult.success && debtsResult.data) {
        setDebts(debtsResult.data);
      }
    } catch (error) {
      logger.error("Erreur chargement données:", undefined, error);
      Alert.alert(
        "Erreur",
        "Impossible de charger les données. Veuillez réessayer."
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = async () => {
    await loadData();
  };

  const openRepayModal = (debt: Debt) => {
    setRepayPhone('');
    setRepayMethod('orange_money');
    setRepayModal({ visible: true, debt });
  };

  const handleRepay = async () => {
    if (!repayModal.debt) return;
    if (!repayPhone.trim()) {
      Alert.alert('Erreur', 'Veuillez entrer votre numéro de téléphone Mobile Money');
      return;
    }

    setIsRepaying(true);
    try {
      const result = await paymentApi.repayDeferred(repayModal.debt.id, repayMethod, repayPhone.trim());
      if (result.success) {
        setRepayModal({ visible: false, debt: null });
        Alert.alert('Succès', 'Dette remboursée. Le paiement différé est à nouveau disponible.', [
          { text: 'OK', onPress: loadData },
        ]);
      } else {
        Alert.alert('Erreur', result.message || 'Le paiement a échoué. Veuillez réessayer.');
      }
    } catch (error) {
      logger.error('Erreur remboursement dette:', undefined, error);
      Alert.alert('Erreur', 'Une erreur est survenue. Veuillez réessayer.');
    } finally {
      setIsRepaying(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const getStatusColor = (isOverdue: boolean, daysUntilDeadline: number) => {
    if (isOverdue) return "#EF4444";
    if (daysUntilDeadline <= 3) return "#F59E0B";
    return "#10B981";
  };

  const getStatusText = (isOverdue: boolean, daysUntilDeadline: number) => {
    if (isOverdue) return `En retard (${Math.abs(daysUntilDeadline)} jour(s))`;
    if (daysUntilDeadline <= 3)
      return `Échéance proche (${daysUntilDeadline} jour(s))`;
    return `À jour (${daysUntilDeadline} jour(s) restant(s))`;
  };

  if (isLoading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backButton}
          >
            <Ionicons name="arrow-back" size={24} color="#1F2937" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Mes dettes</Text>
          <View style={styles.placeholder} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#8B5CF6" />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={24} color="#1F2937" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Mes dettes</Text>
        <TouchableOpacity onPress={handleRefresh} style={styles.refreshButton}>
          <Ionicons name="refresh" size={24} color="#1F2937" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Tableau de bord */}
        {deferredInfo && (
          <View style={styles.dashboard}>
            <Text style={styles.dashboardTitle}>Tableau de bord</Text>

            <View style={styles.dashboardCard}>
              <View style={styles.dashboardRow}>
                <Text style={styles.dashboardLabel}>
                  Crédit mensuel utilisé
                </Text>
                <Text style={styles.dashboardValue}>
                  {deferredInfo.monthlyUsed.toLocaleString()} /{" "}
                  {deferredInfo.monthlyLimit.toLocaleString()} FCFA
                </Text>
              </View>
              <View style={styles.progressBar}>
                <View
                  style={[
                    styles.progressFill,
                    {
                      width: `${
                        (deferredInfo.monthlyUsed / deferredInfo.monthlyLimit) *
                        100
                      }%`,
                      backgroundColor:
                        deferredInfo.monthlyUsed >= deferredInfo.monthlyLimit
                          ? "#EF4444"
                          : "#8B5CF6",
                    },
                  ]}
                />
              </View>
            </View>

            <View style={styles.dashboardCard}>
              <View style={styles.dashboardRow}>
                <Text style={styles.dashboardLabel}>Utilisations ce mois</Text>
                <Text style={styles.dashboardValue}>
                  {deferredInfo.monthlyUsages} /{" "}
                  {deferredInfo.maxUsagesPerMonth}
                </Text>
              </View>
            </View>

            <View style={styles.dashboardCard}>
              <View style={styles.dashboardRow}>
                <Text style={styles.dashboardLabel}>Crédit annuel utilisé</Text>
                <Text style={styles.dashboardValue}>
                  {deferredInfo.annualUsed.toLocaleString()} /{" "}
                  {deferredInfo.annualLimit.toLocaleString()} FCFA
                </Text>
              </View>
              <View style={styles.progressBar}>
                <View
                  style={[
                    styles.progressFill,
                    {
                      width: `${
                        (deferredInfo.annualUsed / deferredInfo.annualLimit) *
                        100
                      }%`,
                      backgroundColor:
                        deferredInfo.annualUsed >= deferredInfo.annualLimit
                          ? "#EF4444"
                          : "#10B981",
                    },
                  ]}
                />
              </View>
            </View>

            {deferredInfo.cooldownDaysRemaining &&
              deferredInfo.cooldownDaysRemaining > 0 && (
                <View style={[styles.dashboardCard, styles.warningCard]}>
                  <Ionicons name="time-outline" size={20} color="#F59E0B" />
                  <Text style={styles.warningText}>
                    Prochain crédit disponible dans{" "}
                    {deferredInfo.cooldownDaysRemaining} jour(s)
                  </Text>
                </View>
              )}

            {deferredInfo.blocked && (
              <View style={[styles.dashboardCard, styles.errorCard]}>
                <Ionicons name="lock-closed" size={20} color="#EF4444" />
                <Text style={styles.errorText}>
                  Paiement différé bloqué
                  {deferredInfo.blockEndDate
                    ? ` jusqu'au ${formatDate(deferredInfo.blockEndDate)}`
                    : ""}
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Liste des dettes */}
        <View style={styles.debtsSection}>
          <Text style={styles.sectionTitle}>Mes dettes ({debts.length})</Text>

          {debts.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="checkmark-circle" size={64} color="#10B981" />
              <Text style={styles.emptyStateText}>Aucune dette en cours</Text>
              <Text style={styles.emptyStateSubtext}>
                Vous êtes à jour avec vos paiements
              </Text>
            </View>
          ) : (
            debts.map((debt) => (
              <View key={debt.id} style={styles.debtCard}>
                <View style={styles.debtHeader}>
                  <View style={styles.debtAmountContainer}>
                    <Text style={styles.debtAmount}>
                      {debt.amount?.toLocaleString() ?? '0'} FCFA
                    </Text>
                    <Text style={styles.debtOrderId}>
                      Commande #{debt.orderId?.slice(0, 8) ?? '—'}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.statusBadge,
                      {
                        backgroundColor: `${getStatusColor(
                          debt.isOverdue,
                          debt.daysUntilDeadline
                        )}20`,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusText,
                        {
                          color: getStatusColor(
                            debt.isOverdue,
                            debt.daysUntilDeadline
                          ),
                        },
                      ]}
                    >
                      {getStatusText(debt.isOverdue, debt.daysUntilDeadline)}
                    </Text>
                  </View>
                </View>

                {debt.pickupAddress && (
                  <View style={styles.debtInfo}>
                    <Ionicons name="location" size={16} color="#6B7280" />
                    <Text style={styles.debtInfoText} numberOfLines={1}>
                      {debt.pickupAddress} →{" "}
                      {debt.dropoffAddress || "Destination"}
                    </Text>
                  </View>
                )}

                <View style={styles.debtFooter}>
                  <View style={styles.debtDate}>
                    <Ionicons
                      name="calendar-outline"
                      size={14}
                      color="#6B7280"
                    />
                    <Text style={styles.debtDateText}>
                      Échéance: {debt.deadline ? formatDate(debt.deadline) : '—'}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.payButton}
                    onPress={() => openRepayModal(debt)}
                  >
                    <Text style={styles.payButtonText}>Régler</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      {/* Modal de remboursement */}
      <Modal visible={repayModal.visible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>Régler la dette</Text>
            <Text style={styles.modalAmount}>
              {repayModal.debt?.amount.toLocaleString()} FCFA
            </Text>

            {/* Choix de la méthode */}
            <Text style={styles.modalLabel}>Mode de paiement</Text>
            <View style={styles.methodRow}>
              <TouchableOpacity
                style={[styles.methodBtn, repayMethod === 'orange_money' && styles.methodBtnActive]}
                onPress={() => setRepayMethod('orange_money')}
              >
                <Text style={[styles.methodBtnText, repayMethod === 'orange_money' && styles.methodBtnTextActive]}>
                  Orange Money
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.methodBtn, repayMethod === 'wave' && styles.methodBtnActive]}
                onPress={() => setRepayMethod('wave')}
              >
                <Text style={[styles.methodBtnText, repayMethod === 'wave' && styles.methodBtnTextActive]}>
                  Wave
                </Text>
              </TouchableOpacity>
            </View>

            {/* Numéro de téléphone */}
            <Text style={styles.modalLabel}>Numéro de téléphone</Text>
            <TextInput
              style={styles.phoneInput}
              value={repayPhone}
              onChangeText={setRepayPhone}
              placeholder="Ex: 622 00 00 00"
              placeholderTextColor="#9CA3AF"
              keyboardType="phone-pad"
            />

            {/* Actions */}
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setRepayModal({ visible: false, debt: null })}
                disabled={isRepaying}
              >
                <Text style={styles.cancelBtnText}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmBtn, isRepaying && styles.confirmBtnDisabled]}
                onPress={handleRepay}
                disabled={isRepaying}
              >
                {isRepaying ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.confirmBtnText}>Confirmer</Text>
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
    backgroundColor: "#F9FAFB",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 16,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1F2937",
  },
  placeholder: {
    width: 40,
  },
  refreshButton: {
    padding: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  content: {
    flex: 1,
  },
  dashboard: {
    padding: 16,
    backgroundColor: "#FFFFFF",
    marginBottom: 8,
  },
  dashboardTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1F2937",
    marginBottom: 16,
  },
  dashboardCard: {
    backgroundColor: "#F9FAFB",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  dashboardRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  dashboardLabel: {
    fontSize: 14,
    color: "#6B7280",
  },
  dashboardValue: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1F2937",
  },
  progressBar: {
    height: 8,
    backgroundColor: "#E5E7EB",
    borderRadius: 4,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 4,
  },
  warningCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#FEF3C7",
    borderWidth: 1,
    borderColor: "#FCD34D",
  },
  warningText: {
    flex: 1,
    fontSize: 14,
    color: "#92400E",
    fontWeight: "500",
  },
  errorCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#FEE2E2",
    borderWidth: 1,
    borderColor: "#FCA5A5",
  },
  errorText: {
    flex: 1,
    fontSize: 14,
    color: "#991B1B",
    fontWeight: "500",
  },
  debtsSection: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1F2937",
    marginBottom: 16,
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 64,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1F2937",
    marginTop: 16,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: "#6B7280",
    marginTop: 8,
  },
  debtCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  debtHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  debtAmountContainer: {
    flex: 1,
  },
  debtAmount: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1F2937",
  },
  debtOrderId: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 4,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "600",
  },
  debtInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  debtInfoText: {
    flex: 1,
    fontSize: 14,
    color: "#6B7280",
  },
  debtFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
  },
  debtDate: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  debtDateText: {
    fontSize: 12,
    color: "#6B7280",
  },
  payButton: {
    backgroundColor: "#8B5CF6",
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 8,
  },
  payButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 4,
  },
  modalAmount: {
    fontSize: 28,
    fontWeight: '800',
    color: '#8B5CF6',
    marginBottom: 24,
  },
  modalLabel: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 8,
    fontWeight: '500',
  },
  methodRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  methodBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    alignItems: 'center',
  },
  methodBtnActive: {
    borderColor: '#8B5CF6',
    backgroundColor: '#F5F3FF',
  },
  methodBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  methodBtnTextActive: {
    color: '#8B5CF6',
  },
  phoneInput: {
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#1F2937',
    marginBottom: 24,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    alignItems: 'center',
  },
  cancelBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#6B7280',
  },
  confirmBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: '#8B5CF6',
    alignItems: 'center',
  },
  confirmBtnDisabled: {
    backgroundColor: '#C4B5FD',
  },
  confirmBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
