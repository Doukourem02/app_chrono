import React, { useEffect, useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  ActivityIndicator,
  RefreshControl
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useCommissionStore } from '../../store/useCommissionStore';
import { useDriverStore } from '../../store/useDriverStore';
import { RechargeModal } from '../../components/RechargeModal';

export default function CommissionPage() {
  const router = useRouter();
  const { account, transactions, isLoading, fetchBalance, fetchTransactions } = useCommissionStore();
  const { profile } = useDriverStore();
  const [showRechargeModal, setShowRechargeModal] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (profile?.driver_type === 'partner') {
      fetchBalance();
      fetchTransactions();
    }
  }, [profile?.driver_type, fetchBalance, fetchTransactions]);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchBalance(), fetchTransactions()]);
    setRefreshing(false);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount) + ' FCFA';
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case 'recharge':
        return { name: 'add-circle', color: '#10B981' };
      case 'deduction':
        return { name: 'remove-circle', color: '#EF4444' };
      case 'refund':
        return { name: 'arrow-back-circle', color: '#F59E0B' };
      default:
        return { name: 'ellipse', color: '#6B7280' };
    }
  };

  const getTransactionLabel = (type: string) => {
    switch (type) {
      case 'recharge':
        return 'Recharge';
      case 'deduction':
        return 'Prélèvement commission';
      case 'refund':
        return 'Remboursement';
      default:
        return type;
    }
  };

  if (profile?.driver_type !== 'partner') {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#111827" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Commission</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>
            Cette fonctionnalité est réservée aux livreurs partenaires
          </Text>
        </View>
      </View>
    );
  }

  const balance = account?.balance ?? 0;
  const balanceColor = balance <= 0 ? '#EF4444' : balance < 3000 ? '#F59E0B' : '#10B981';

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Commission</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Carte Solde */}
        <View style={styles.balanceCard}>
          <View style={styles.balanceHeader}>
            <Text style={styles.balanceLabel}>Solde Commission</Text>
            <Ionicons name="wallet" size={24} color={balanceColor} />
          </View>
          <Text style={[styles.balanceAmount, { color: balanceColor }]}>
            {formatCurrency(balance)}
          </Text>
          {account && (
            <Text style={styles.commissionRate}>
              Taux de commission : {account.commission_rate}%
            </Text>
          )}
          {account?.is_suspended && (
            <View style={styles.suspendedBadge}>
              <Ionicons name="alert-circle" size={16} color="#EF4444" />
              <Text style={styles.suspendedText}>Compte suspendu</Text>
            </View>
          )}
          <TouchableOpacity
            style={styles.rechargeButton}
            onPress={() => setShowRechargeModal(true)}
          >
            <Ionicons name="add-circle" size={20} color="#fff" />
            <Text style={styles.rechargeButtonText}>Recharger mon compte</Text>
          </TouchableOpacity>
        </View>

        {/* Statistiques */}
        <View style={styles.statsSection}>
          <Text style={styles.sectionTitle}>Statistiques</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>Recharges totales</Text>
              <Text style={styles.statValue}>
                {formatCurrency(
                  transactions
                    .filter((tx) => tx.type === 'recharge')
                    .reduce((sum, tx) => sum + tx.amount, 0)
                )}
              </Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>Commissions prélevées</Text>
              <Text style={[styles.statValue, { color: '#EF4444' }]}>
                {formatCurrency(
                  transactions
                    .filter((tx) => tx.type === 'deduction')
                    .reduce((sum, tx) => sum + tx.amount, 0)
                )}
              </Text>
            </View>
          </View>
        </View>

        {/* Historique */}
        <View style={styles.historySection}>
          <Text style={styles.sectionTitle}>Historique des transactions</Text>
          {isLoading && transactions.length === 0 ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#8B5CF6" />
            </View>
          ) : transactions.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="receipt-outline" size={48} color="#9CA3AF" />
              <Text style={styles.emptyText}>Aucune transaction</Text>
            </View>
          ) : (
            <View style={styles.transactionsList}>
              {transactions.map((tx) => {
                const icon = getTransactionIcon(tx.type);
                const isPositive = tx.type === 'recharge' || tx.type === 'refund';
                
                return (
                  <View key={tx.id} style={styles.transactionItem}>
                    <View style={[styles.transactionIcon, { backgroundColor: `${icon.color}20` }]}>
                      <Ionicons name={icon.name as any} size={20} color={icon.color} />
                    </View>
                    <View style={styles.transactionContent}>
                      <Text style={styles.transactionType}>
                        {getTransactionLabel(tx.type)}
                      </Text>
                      <Text style={styles.transactionDate}>
                        {formatDate(tx.created_at)}
                      </Text>
                      {tx.order_id && (
                        <Text style={styles.transactionOrder}>
                          Commande: {tx.order_id.slice(0, 8)}...
                        </Text>
                      )}
                    </View>
                    <View style={styles.transactionAmount}>
                      <Text style={[
                        styles.transactionAmountText,
                        { color: isPositive ? '#10B981' : '#EF4444' }
                      ]}>
                        {isPositive ? '+' : '-'}{formatCurrency(tx.amount)}
                      </Text>
                      <Text style={styles.transactionBalance}>
                        Solde: {formatCurrency(tx.balance_after)}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>

      <RechargeModal
        visible={showRechargeModal}
        onClose={() => setShowRechargeModal(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  content: {
    flex: 1,
  },
  balanceCard: {
    backgroundColor: '#fff',
    margin: 16,
    padding: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  balanceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  balanceLabel: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },
  balanceAmount: {
    fontSize: 32,
    fontWeight: '700',
    marginBottom: 8,
  },
  commissionRate: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 12,
  },
  suspendedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    padding: 8,
    backgroundColor: '#FEE2E2',
    borderRadius: 6,
    marginBottom: 12,
  },
  suspendedText: {
    fontSize: 12,
    color: '#DC2626',
    fontWeight: '600',
  },
  rechargeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    backgroundColor: '#8B5CF6',
    borderRadius: 8,
    marginTop: 8,
  },
  rechargeButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  statsSection: {
    marginHorizontal: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 12,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  statLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 8,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  historySection: {
    marginHorizontal: 16,
    marginBottom: 24,
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: '#9CA3AF',
    marginTop: 12,
    textAlign: 'center',
  },
  transactionsList: {
    gap: 12,
  },
  transactionItem: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  transactionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  transactionContent: {
    flex: 1,
  },
  transactionType: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  transactionDate: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 2,
  },
  transactionOrder: {
    fontSize: 11,
    color: '#9CA3AF',
  },
  transactionAmount: {
    alignItems: 'flex-end',
  },
  transactionAmountText: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  transactionBalance: {
    fontSize: 11,
    color: '#6B7280',
  },
});

