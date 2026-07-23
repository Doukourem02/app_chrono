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
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useDriverStore } from '../../store/useDriverStore';
import { apiService } from '../../services/apiService';
import { logger } from '../../utils/logger';

/** Espace sous le contenu pour la tab bar flottante (~80px) + marge + safe area. */
const TAB_BAR_FLOAT_OFFSET = 108;

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

function RevenusSkeleton() {
  return (
    <View style={styles.skeletonWrap}>
      <View style={[styles.skeletonBlock, { height: 140, width: '100%' }]} />
      <View style={styles.skeletonRow}>
        <View style={[styles.skeletonBlock, { height: 100, flex: 1, marginRight: 8 }]} />
        <View style={[styles.skeletonBlock, { height: 100, flex: 1, marginLeft: 8 }]} />
      </View>
      <View style={[styles.skeletonBlock, { height: 120, width: '100%' }]} />
    </View>
  );
}

export default function RevenusPage() {
  const insets = useSafeAreaInsets();
  const { user } = useDriverStore();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState<Period>('all'); // Commencer par 'all' pour voir toutes les données
  const [revenuesData, setRevenuesData] = useState<RevenuesData | null>(null);

  const scrollBottomPadding = TAB_BAR_FLOAT_OFFSET + insets.bottom;

  const loadRevenues = useCallback(async (isRefresh = false) => {
    if (!user?.id) {
      if (__DEV__) {
        logger.debug('[Revenus] Pas de user.id, impossible de charger les revenus');
      }
      setLoading(false);
      setRefreshing(false);
      return;
    }

    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      const result = await apiService.getDriverRevenues(user.id, {
        period: selectedPeriod,
      });

      if (result.success && result.data) {
        // Vérifier si les données sont vraiment vides (tous à 0)
        const hasData = result.data.totalDeliveries > 0 || 
                      result.data.totalEarnings > 0 || 
                      (result.data.orders && result.data.orders.length > 0);
        
        if (__DEV__) {
          if (hasData) {
            logger.debug('[Revenus] Données reçues:', undefined, {
              livraisons: result.data.totalDeliveries || 0,
              distance: result.data.totalDistance || 0,
              commandes: result.data.orders?.length || 0
            });
          } else {
            logger.debug('[Revenus] Données reçues mais vides (pas de livraisons pour cette période)');
          }
        }
        setRevenuesData(result.data);
      } else {
        // Si l'API retourne des données même en cas d'erreur (structure par défaut), les utiliser
        if (result.data) {
          if (__DEV__) {
            logger.warn('[Revenus] API retourné des données par défaut. Message:', result.message || 'Aucun message');
          }
          setRevenuesData(result.data);
        } else {
          if (__DEV__) {
            logger.warn('[Revenus] Pas de données reçues. Message:', result.message || 'Aucun message');
          }
          setRevenuesData(null);
        }
      }
    } catch (error) {
      if (__DEV__) {
        logger.error('[Revenus] Erreur chargement revenus:', undefined, error);
      }
      // En cas d'erreur, initialiser avec des données vides pour éviter les crashes
      setRevenuesData({
        period: selectedPeriod,
        totalEarnings: 0,
        totalDeliveries: 0,
        totalDistance: 0,
        averageEarningPerDelivery: 0,
        averageDistance: 0,
        earningsByMethod: { moto: 0, vehicule: 0, cargo: 0 },
        deliveriesByMethod: { moto: 0, vehicule: 0, cargo: 0 },
        earningsByDay: {},
        orders: [],
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id, selectedPeriod]);

  useEffect(() => {
    if (user?.id) {
      loadRevenues(false);
    }
  }, [user?.id, loadRevenues]);

  const onRefresh = useCallback(() => {
    void loadRevenues(true);
  }, [loadRevenues]);

  const formatCurrency = (amount: number) => {
    const n = Math.round(amount);
    return `${n.toLocaleString('fr-FR')} FCFA`;
  };

  const getMethodIcon = (method: string) => {
    switch (method) {
      case 'moto':
        return require('../../assets/images/motoo.png');
      case 'vehicule':
        return require('../../assets/images/carrss.png');
      case 'cargo':
        return require('../../assets/images/ccargo.png');
      default:
        return require('../../assets/images/motoo.png');
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

  const renderPeriodItem = ({ item }: { item: { key: Period; label: string } }) => (
    <TouchableOpacity
      style={[
        styles.periodButton,
        selectedPeriod === item.key && styles.periodButtonActive,
      ]}
      onPress={() => {
        logger.debug('[Revenus] Changement période:', item.key);
        setSelectedPeriod(item.key);
      }}
      accessibilityRole="button"
      accessibilityState={{ selected: selectedPeriod === item.key }}
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

  if (loading && !revenuesData) {
    return (
      <View style={styles.container}>
        <View style={[styles.header, { paddingTop: Math.max(insets.top + 12, 60) }]}>
          <Text style={styles.headerTitle}>Mes Revenus</Text>
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
        <View style={styles.loadingContainer}>
          <RevenusSkeleton />
          <Text style={styles.loadingText}>Chargement de vos revenus…</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: Math.max(insets.top + 12, 60) }]}>
        <Text style={styles.headerTitle}>Mes Revenus</Text>
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
        contentContainerStyle={[styles.contentContainer, { paddingBottom: scrollBottomPadding }]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#8B5CF6"
            colors={['#8B5CF6']}
          />
        }
      >
        {loading && revenuesData ? (
          <View style={styles.inlineRefreshRow}>
            <ActivityIndicator size="small" color="#8B5CF6" />
            <Text style={styles.inlineRefreshText}>Mise à jour des chiffres…</Text>
          </View>
        ) : null}

        <View style={[styles.summaryGrid, loading && revenuesData ? styles.contentDimmed : null]}>
          <View style={[styles.summaryCard, styles.summaryCardPrimary, styles.summaryCardFull]}>
            <View style={styles.summaryCardHeader}>
              <View style={[styles.summaryIcon, styles.summaryIconPrimary]}>
                <Ionicons name="wallet" size={24} color="#FFFFFF" />
              </View>
              <Text style={[styles.summaryLabel, styles.summaryLabelPrimary]}>REVENUS TOTAUX</Text>
            </View>
            <Text style={[styles.summaryValue, styles.summaryValuePrimary]}>
              {formatCurrency(revenuesData?.totalEarnings || 0)}
            </Text>
            {revenuesData && revenuesData.totalDeliveries > 0 && (
              <Text style={styles.summaryHelperPrimary}>
                Moyenne: {formatCurrency(revenuesData.averageEarningPerDelivery || 0)} / livraison
              </Text>
            )}
          </View>

          <View style={styles.summaryCard}>
            <View style={styles.summaryCardHeader}>
              <View style={[styles.summaryIcon, { backgroundColor: '#EEF2FF' }]}>
                <Ionicons name="cube" size={20} color="#4C1D95" />
              </View>
              <Text style={styles.summaryLabel}>LIVRAISONS</Text>
            </View>
            <Text style={styles.summaryValue}>
              {revenuesData?.totalDeliveries || 0}
            </Text>
          </View>

          {revenuesData && revenuesData.totalDistance > 0 && (
            <View style={styles.summaryCard}>
              <View style={styles.summaryCardHeader}>
                <View style={[styles.summaryIcon, { backgroundColor: '#F0FDF4' }]}>
                  <Ionicons name="map" size={20} color="#16A34A" />
                </View>
                <Text style={styles.summaryLabel}>DISTANCE</Text>
              </View>
              <Text style={styles.summaryValue}>
                {revenuesData.totalDistance.toFixed(1)} km
              </Text>
              {revenuesData.totalDeliveries > 0 && (
                <Text style={styles.summaryHelper}>
                  Moyenne: {(revenuesData.totalDistance / revenuesData.totalDeliveries).toFixed(1)} km
                </Text>
              )}
            </View>
          )}
        </View>

        {methodKeys.length > 0 && (
          <View style={[styles.methodsContainer, loading && revenuesData ? styles.contentDimmed : null]}>
            <Text style={styles.sectionTitle}>Par type de livraison</Text>
            <Text style={styles.sectionSubtitle}>Détail par mode (sous-total)</Text>
            {methodKeys.map((method, index) => {
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
                      <Image
                        source={getMethodIcon(method)}
                        style={styles.methodIconImage}
                        resizeMode="contain"
                      />
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
            })}
          </View>
        )}

        {revenuesData && revenuesData.orders && revenuesData.orders.length > 0 && (
          <View style={[styles.ordersContainer, loading && revenuesData ? styles.contentDimmed : null]}>
            <Text style={[styles.sectionTitle, styles.sectionTitleSpaced]}>Historique des commandes</Text>
            <View style={styles.ordersList}>
              {revenuesData.orders.slice(0, 10).map((order, index) => (
                <View key={order.id} style={[styles.orderItem, index === revenuesData.orders.length - 1 && styles.orderItemLast]}>
                  <View style={styles.orderItemLeft}>
                    <View style={styles.orderIconContainer}>
                      <Ionicons 
                        name={order.delivery_method === 'moto' ? 'bicycle' : order.delivery_method === 'vehicule' ? 'car' : 'cube'} 
                        size={18} 
                        color="#4C1D95" 
                      />
                    </View>
                    <View style={styles.orderInfo}>
                      <Text style={styles.orderMethod}>{getMethodLabel(order.delivery_method)}</Text>
                      <Text style={styles.orderDate}>
                        {new Date(order.completed_at || order.created_at).toLocaleDateString('fr-FR', {
                          day: 'numeric',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.orderItemRight}>
                    <Text style={styles.orderPrice}>{formatCurrency(order.price || 0)}</Text>
                    {order.distance && (
                      <Text style={styles.orderDistance}>{order.distance.toFixed(1)} km</Text>
                    )}
                  </View>
                </View>
              ))}
            </View>
            {revenuesData.orders.length > 10 && (
              <Text style={styles.moreOrdersText}>
                +{revenuesData.orders.length - 10} autres commandes
              </Text>
            )}
          </View>
        )}

        {revenuesData && revenuesData.totalDeliveries === 0 && (
          <View style={styles.emptyContainer}>
            <Ionicons name="card-outline" size={72} color="#D1D5DB" />
            <Text style={styles.emptyTitle}>Aucun revenu</Text>
            <Text style={styles.emptyText}>
              {selectedPeriod === 'today'
                ? "Vous n'avez pas encore de livraisons aujourd'hui."
                : selectedPeriod === 'month'
                  ? "Vous n'avez pas encore de livraisons ce mois-ci."
                  : selectedPeriod === 'all'
                    ? "Vous n'avez pas encore de livraisons enregistrées."
                    : 'Aucune livraison sur cette période.'}
            </Text>
            <Text style={styles.emptyHint}>Tirez vers le bas pour actualiser.</Text>
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
  skeletonWrap: {
    width: '100%',
    paddingHorizontal: 4,
  },
  skeletonBlock: {
    backgroundColor: '#E5E7EB',
    borderRadius: 12,
    marginBottom: 12,
  },
  skeletonRow: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  inlineRefreshRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 16,
    paddingVertical: 8,
  },
  inlineRefreshText: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '500',
  },
  contentDimmed: {
    opacity: 0.55,
  },
  header: {
    backgroundColor: '#FFFFFF',
    paddingTop: 60,
    paddingBottom: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#111827',
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  summaryCardFull: {
    width: '100%',
  },
  summaryCardPrimary: {
    backgroundColor: '#111827',
    borderColor: '#111827',
    shadowColor: '#111827',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
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
    flexShrink: 0, // Empêcher l'icône de rétrécir
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
    flex: 1, // Permettre au texte de prendre l'espace restant
    flexShrink: 1, // Permettre au texte de rétrécir si nécessaire
  },
  summaryLabelPrimary: {
    color: '#E5E7EB',
  },
  summaryValue: {
    fontSize: 28,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  summaryValuePrimary: {
    color: '#FFFFFF',
    fontSize: 32,
  },
  summaryHelper: {
    fontSize: 12,
    color: '#6B7280',
  },
  summaryHelperPrimary: {
    color: '#9CA3AF',
  },
  methodsContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  sectionTitleSpaced: {
    marginBottom: 16,
  },
  sectionSubtitle: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 16,
    lineHeight: 18,
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
  methodIconImage: {
    width: 40,
    height: 40,
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
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 12,
    paddingVertical: 8,
    minWidth: 92,
    alignItems: 'flex-end',
  },
  methodEarnings: {
    fontSize: 15,
    fontWeight: '700',
    color: '#334155',
    fontVariant: ['tabular-nums'],
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
  emptyHint: {
    fontSize: 13,
    color: '#9CA3AF',
    marginTop: 16,
    textAlign: 'center',
  },
  ordersContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  ordersList: {
    marginTop: 12,
  },
  orderItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  orderItemLast: {
    borderBottomWidth: 0,
    paddingBottom: 0,
  },
  orderItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  orderIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  orderInfo: {
    flex: 1,
  },
  orderMethod: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 2,
  },
  orderDate: {
    fontSize: 12,
    color: '#6B7280',
  },
  orderItemRight: {
    alignItems: 'flex-end',
  },
  orderPrice: {
    fontSize: 16,
    fontWeight: '700',
    color: '#4C1D95',
    marginBottom: 2,
  },
  orderDistance: {
    fontSize: 12,
    color: '#6B7280',
  },
  moreOrdersText: {
    fontSize: 13,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 12,
    fontStyle: 'italic',
  },
});
