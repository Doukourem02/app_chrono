import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  FlatList,
} from 'react-native';
import { useDriverStore } from '../../store/useDriverStore';
import { apiService } from '../../services/apiService';

type Period = 'today' | 'week' | 'month' | 'all';

interface RevenuesData {
  period: string;
  totalEarnings: number;
  totalDeliveries: number;
  totalDistance: number;
  averageEarningPerDelivery: number;
  averageDistance: number;
  earningsByMethod: {
    moto: number;
    vehicule: number;
    cargo: number;
  };
  deliveriesByMethod: {
    moto: number;
    vehicule: number;
    cargo: number;
  };
  earningsByDay: Record<string, number>;
  orders: {
    id: string;
    price: number;
    distance: number;
    delivery_method: string;
    completed_at: string;
    created_at: string;
  }[];
}

export default function RevenusPage() {
  const { user } = useDriverStore();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState<Period>('all'); // Commencer par 'all' pour voir toutes les données
  const [revenuesData, setRevenuesData] = useState<RevenuesData | null>(null);

  const loadRevenues = useCallback(async () => {
    if (!user?.id) {
      console.log('⚠️ [Revenus] Pas de user.id, impossible de charger les revenus');
      return;
    }

    try {
      console.log('🔍 [Revenus] Chargement revenus pour userId:', user.id, 'période:', selectedPeriod);
      setLoading(true);
      const result = await apiService.getDriverRevenues(user.id, {
        period: selectedPeriod,
      });

      console.log('📊 [Revenus] Résultat API:', JSON.stringify(result, null, 2));

      if (result.success && result.data) {
        console.log('✅ [Revenus] Données reçues:');
        console.log('   - Livraisons:', result.data.totalDeliveries);
        console.log('   - Gains:', result.data.totalEarnings, 'FCFA');
        console.log('   - Distance:', result.data.totalDistance, 'km');
        console.log('   - Commandes:', result.data.orders?.length || 0);
        setRevenuesData(result.data);
      } else {
        console.warn('⚠️ [Revenus] result.success=false ou pas de data:', result);
        setRevenuesData(null);
      }
    } catch (error) {
      console.error('❌ [Revenus] Erreur chargement revenus:', error);
      setRevenuesData(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id, selectedPeriod]);

  useEffect(() => {
    if (user?.id) {
      loadRevenues();
    }
  }, [user?.id, loadRevenues]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadRevenues();
  }, [loadRevenues]);

  const formatCurrency = (amount: number) => {
    return `${amount.toFixed(0)} FCFA`;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  const getMethodIcon = (method: string) => {
    switch (method) {
      case 'moto':
        return '🚲';
      case 'vehicule':
        return '🚗';
      case 'cargo':
        return '🚚';
      default:
        return '📦';
    }
  };

  const getMethodLabel = (method: string) => {
    switch (method) {
      case 'moto':
        return 'Moto';
      case 'vehicule':
        return 'Véhicule';
      case 'cargo':
        return 'Cargo';
      default:
        return method;
    }
  };

  const periods: { key: Period; label: string }[] = [
    { key: 'today', label: "Aujourd'hui" },
    { key: 'week', label: 'Cette semaine' },
    { key: 'month', label: 'Ce mois' },
    { key: 'all', label: 'Tout' },
  ];

  const methodKeys = revenuesData
    ? (['moto', 'vehicule', 'cargo'] as const).filter((method) => {
        const earnings = revenuesData.earningsByMethod[method] || 0;
        const deliveries = revenuesData.deliveriesByMethod[method] || 0;
        return earnings !== 0 || deliveries !== 0;
      })
    : [];

  const recentOrders = revenuesData ? revenuesData.orders.slice(0, 10) : [];

  const renderPeriodItem = ({ item }: { item: { key: Period; label: string } }) => (
    <TouchableOpacity
      style={[
        styles.periodButton,
        selectedPeriod === item.key && styles.periodButtonActive,
      ]}
      onPress={() => {
        console.log('🔄 [Revenus] Changement période:', item.key);
        setSelectedPeriod(item.key);
      }}
    >
      <Text
        style={[
          styles.periodText,
          selectedPeriod === item.key && styles.periodTextActive,
        ]}
      >
        {item.label}
      </Text>
    </TouchableOpacity>
  );

  // Graphique simple de revenus par jour
  const renderEarningsChart = () => {
    if (!revenuesData || !revenuesData.earningsByDay) return null;

    const days = Object.keys(revenuesData.earningsByDay).sort();
    if (days.length === 0) return null;

    const maxEarning = Math.max(...Object.values(revenuesData.earningsByDay));
    const chartHeight = 150;

    return (
      <View style={styles.chartContainer}>
        <Text style={styles.chartTitle}>Revenus par jour</Text>
        <View style={styles.chart}>
          {days.map((day, index) => {
            const earning = revenuesData.earningsByDay[day];
            const height = maxEarning > 0 ? (earning / maxEarning) * chartHeight : 0;
            const date = new Date(day);
            
            return (
              <View key={day} style={styles.chartBarContainer}>
                <View style={styles.chartBarWrapper}>
                  <View style={[styles.chartBar, { height: Math.max(height, 10) }]} />
                  <Text style={styles.chartBarValue}>{formatCurrency(earning)}</Text>
                </View>
                <Text style={styles.chartBarLabel}>
                  {date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}
                </Text>
              </View>
            );
          })}
        </View>
      </View>
    );
  };

  if (loading && !revenuesData) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#8B5CF6" />
          <Text style={styles.loadingText}>Chargement de vos revenus...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerEyebrow}>Performances</Text>
        <Text style={styles.headerTitle}>Mes Revenus</Text>
        <Text style={styles.headerSubtitle}>
          {revenuesData?.totalDeliveries || 0} livraison{(revenuesData?.totalDeliveries || 0) > 1 ? 's' : ''}
        </Text>
      </View>

      <View style={styles.filtersWrapper}>
        <FlatList
          data={periods}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.periodsContent}
          renderItem={renderPeriodItem}
          keyExtractor={(item) => item.key}
        />
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View style={styles.summaryGrid}>
          <View style={[styles.summaryCard, styles.summaryCardPrimary, styles.summaryCardFull]}>
            <View style={styles.summaryCardHeader}>
              <View style={[styles.summaryIcon, styles.summaryIconPrimary]}>
                <Ionicons name="wallet" size={20} color="#FFFFFF" />
              </View>
              <Text style={[styles.summaryLabel, styles.summaryLabelPrimary]}>Revenus totaux</Text>
            </View>
            <Text style={[styles.summaryValue, styles.summaryValuePrimary]}>
              {formatCurrency(revenuesData?.totalEarnings || 0)}
            </Text>
            <Text style={[styles.summaryHelper, styles.summaryHelperPrimary]}>Période sélectionnée</Text>
          </View>

          <View style={styles.summaryCard}>
            <View style={styles.summaryCardHeader}>
              <View style={[styles.summaryIcon, { backgroundColor: '#EEF2FF' }]}>
                <Ionicons name="cube" size={20} color="#4C1D95" />
              </View>
              <Text style={styles.summaryLabel}>Livraisons</Text>
            </View>
            <Text style={styles.summaryValue}>
              {revenuesData?.totalDeliveries || 0}
            </Text>
            <Text style={styles.summaryHelper}>Courses effectuées</Text>
          </View>

          <View style={styles.summaryCard}>
            <View style={styles.summaryCardHeader}>
              <View style={[styles.summaryIcon, { backgroundColor: '#DBEAFE' }]}>
                <Ionicons name="navigate" size={20} color="#1D4ED8" />
              </View>
              <Text style={styles.summaryLabel}>Distance</Text>
            </View>
            <Text style={styles.summaryValue}>
              {(revenuesData?.totalDistance ?? 0).toFixed(1)} km
            </Text>
            <Text style={styles.summaryHelper}>Parcourus</Text>
          </View>

          <View style={styles.summaryCard}>
            <View style={styles.summaryCardHeader}>
              <View style={[styles.summaryIcon, { backgroundColor: '#DCFCE7' }]}>
                <Ionicons name="trending-up" size={20} color="#047857" />
              </View>
              <Text style={styles.summaryLabel}>Gain moyen</Text>
            </View>
            <Text style={styles.summaryValue}>
              {formatCurrency(revenuesData?.averageEarningPerDelivery || 0)}
            </Text>
            <Text style={styles.summaryHelper}>Par livraison</Text>
          </View>

          <View style={styles.summaryCard}>
            <View style={styles.summaryCardHeader}>
              <View style={[styles.summaryIcon, { backgroundColor: '#E0F2FE' }]}>
                <Ionicons name="speedometer-outline" size={20} color="#0369A1" />
              </View>
              <Text style={styles.summaryLabel}>Distance moyenne</Text>
            </View>
            <Text style={styles.summaryValue}>
              {(revenuesData?.averageDistance ?? 0).toFixed(2)} km
            </Text>
            <Text style={styles.summaryHelper}>Par course</Text>
          </View>
        </View>

        {renderEarningsChart()}

        <View style={styles.methodsContainer}>
          <Text style={styles.sectionTitle}>Revenus par type de livraison</Text>
          {methodKeys.length === 0 ? (
            <Text style={styles.emptySectionText}>Aucune donnée pour cette période.</Text>
          ) : (
            methodKeys.map((method, index) => {
              const earnings = revenuesData?.earningsByMethod[method] || 0;
              const deliveries = revenuesData?.deliveriesByMethod[method] || 0;
              const isLast = index === methodKeys.length - 1;

              return (
                <View
                  key={method}
                  style={[styles.methodCard, isLast && styles.methodCardLast]}
                >
                  <View style={styles.methodHeader}>
                    <View style={styles.methodIconContainer}>
                      <Text style={styles.methodIcon}>{getMethodIcon(method)}</Text>
                    </View>
                    <View style={styles.methodInfo}>
                      <Text style={styles.methodName}>{getMethodLabel(method)}</Text>
                      <Text style={styles.methodStats}>
                        {deliveries} livraison{deliveries > 1 ? 's' : ''}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.methodEarningsContainer}>
                    <Text style={styles.methodEarnings}>
                      {formatCurrency(earnings)}
                    </Text>
                  </View>
                </View>
              );
            })
          )}
        </View>

        {recentOrders.length > 0 && (
          <View style={styles.historyContainer}>
            <Text style={styles.sectionTitle}>Livraisons récentes</Text>
            {recentOrders.map((order, index) => (
              <View
                key={order.id}
                style={[styles.historyCard, index === recentOrders.length - 1 && styles.historyCardLast]}
              >
                <View style={styles.historyHeader}>
                  <Text style={styles.historyIcon}>
                    {getMethodIcon(order.delivery_method)}
                  </Text>
                  <View style={styles.historyInfo}>
                    <Text style={styles.historyId}>
                      Commande #{order.id.slice(0, 8)}
                    </Text>
                    <Text style={styles.historyDate}>
                      {formatDate(order.completed_at)}
                    </Text>
                  </View>
                </View>
                <View style={styles.historyFooter}>
                  <Text style={styles.historyDistance}>
                    {order.distance.toFixed(1)} km
                  </Text>
                  <Text style={styles.historyPrice}>
                    {formatCurrency(order.price)}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {revenuesData && revenuesData.totalDeliveries === 0 && (
          <View style={styles.emptyContainer}>
            <Ionicons name="card-outline" size={72} color="#D1D5DB" />
            <Text style={styles.emptyTitle}>Aucun revenu</Text>
            <Text style={styles.emptyText}>
              Vous n’avez pas encore de livraisons {selectedPeriod === 'today' ? 'aujourd’hui' :
              selectedPeriod === 'week' ? 'cette semaine' :
              selectedPeriod === 'month' ? 'ce mois' : ''}
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#6B7280',
  },
  header: {
    backgroundColor: '#FFFFFF',
    paddingTop: 60,
    paddingBottom: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerEyebrow: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#111827',
    marginTop: 8,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 6,
  },
  filtersWrapper: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  periodsContent: {
    paddingHorizontal: 20,
  },
  periodButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    marginRight: 12,
  },
  periodButtonActive: {
    backgroundColor: '#111827',
    borderColor: '#111827',
  },
  periodText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#4B5563',
  },
  periodTextActive: {
    color: '#FFFFFF',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 20,
    paddingVertical: 24,
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  summaryCard: {
    width: '48%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 12,
  },
  summaryCardFull: {
    width: '100%',
  },
  summaryCardPrimary: {
    backgroundColor: '#111827',
    borderColor: '#111827',
  },
  summaryCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  summaryIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  summaryIconPrimary: {
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  summaryLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4B5563',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  summaryLabelPrimary: {
    color: '#E5E7EB',
  },
  summaryValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 6,
  },
  summaryValuePrimary: {
    color: '#FFFFFF',
  },
  summaryHelper: {
    fontSize: 12,
    color: '#6B7280',
  },
  summaryHelperPrimary: {
    color: '#9CA3AF',
  },
  chartContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 24,
  },
  chartTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 16,
  },
  chart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  chartBarContainer: {
    alignItems: 'center',
    flex: 1,
  },
  chartBarWrapper: {
    alignItems: 'center',
    justifyContent: 'flex-end',
    height: 140,
  },
  chartBar: {
    width: 24,
    backgroundColor: '#6366F1',
    borderRadius: 6,
    minHeight: 8,
  },
  chartBarValue: {
    fontSize: 10,
    fontWeight: '600',
    color: '#6366F1',
    marginTop: 6,
  },
  chartBarLabel: {
    fontSize: 10,
    color: '#6B7280',
    marginTop: 6,
    textTransform: 'capitalize',
  },
  methodsContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 16,
  },
  emptySectionText: {
    fontSize: 13,
    color: '#6B7280',
  },
  methodCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  methodCardLast: {
    borderBottomWidth: 0,
    paddingBottom: 0,
  },
  methodHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  methodIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  methodIcon: {
    fontSize: 24,
  },
  methodInfo: {
    flex: 1,
  },
  methodName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 2,
  },
  methodStats: {
    fontSize: 12,
    color: '#6B7280',
  },
  methodEarningsContainer: {
    backgroundColor: '#EEF2FF',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  methodEarnings: {
    fontSize: 16,
    fontWeight: '700',
    color: '#4C1D95',
  },
  historyContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 24,
  },
  historyCard: {
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    paddingVertical: 14,
  },
  historyCardLast: {
    borderBottomWidth: 0,
    paddingBottom: 0,
  },
  historyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  historyIcon: {
    fontSize: 18,
    marginRight: 12,
  },
  historyInfo: {
    flex: 1,
  },
  historyId: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 2,
  },
  historyDate: {
    fontSize: 12,
    color: '#6B7280',
  },
  historyFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  historyDistance: {
    fontSize: 13,
    color: '#6B7280',
  },
  historyPrice: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
  },
  emptyContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginTop: 20,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    paddingHorizontal: 20,
  },
});
