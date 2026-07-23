import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {View,Text,StyleSheet,TouchableOpacity,ScrollView,RefreshControl,} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useAuthStore } from '../../store/useAuthStore';
import { userApiService } from '../../services/userApiService';
import { logger } from '../../utils/logger';
import { formatDeliveryId } from '../../utils/formatDeliveryId';

interface Order {
  id: string;
  status: string;
  pickup_address?: string | { address?: string; coordinates?: any; details?: any };
  dropoff_address?: string | { address?: string; coordinates?: any; details?: any };
  pickup_address_text?: string;
  dropoff_address_text?: string;
  price?: number;
  price_cfa?: number;
  created_at: string;
  completed_at?: string;
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function startOfWeekMonday(ref: Date): Date {
  const x = new Date(ref);
  const day = x.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  x.setDate(x.getDate() + diff);
  x.setHours(0, 0, 0, 0);
  return x;
}

/** Libellé de section pour regrouper les commandes (le plus récent en premier). */
function getSectionLabelForDate(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const dDay = startOfDay(d);
  const nDay = startOfDay(now);
  const diffMs = nDay.getTime() - dDay.getTime();
  const diffDays = Math.round(diffMs / 86400000);

  if (diffDays === 0) return "Aujourd'hui";
  if (diffDays === 1) return 'Hier';

  const weekStart = startOfWeekMonday(now);
  if (dDay.getTime() >= weekStart.getTime()) return 'Cette semaine';

  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  if (dDay.getTime() >= monthStart.getTime()) return 'Ce mois-ci';

  return d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
}

function getOrderReferenceDate(order: Order): string {
  return order.completed_at || order.created_at;
}

function groupOrdersBySection(orders: Order[]): { title: string; data: Order[] }[] {
  const sorted = [...orders].sort(
    (a, b) => new Date(getOrderReferenceDate(b)).getTime() - new Date(getOrderReferenceDate(a)).getTime()
  );
  const sectionOrder: string[] = [];
  const map = new Map<string, Order[]>();
  for (const o of sorted) {
    const title = getSectionLabelForDate(getOrderReferenceDate(o));
    if (!map.has(title)) {
      sectionOrder.push(title);
      map.set(title, []);
    }
    map.get(title)!.push(o);
  }
  return sectionOrder.map((title) => ({ title, data: map.get(title)! }));
}

function truncateAddress(text: string, max = 52): string {
  const t = text.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

function HistorySkeleton() {
  return (
    <View style={styles.skeletonWrap}>
      {[0, 1, 2].map((i) => (
        <View key={i} style={styles.skeletonCard}>
          <View style={styles.skeletonRow}>
            <View style={[styles.skeletonBar, { width: '45%' }]} />
            <View style={[styles.skeletonBar, { width: 56 }]} />
          </View>
          <View style={[styles.skeletonBar, { width: '70%', marginTop: 12 }]} />
          <View style={[styles.skeletonBar, { width: '85%', marginTop: 8 }]} />
          <View style={[styles.skeletonBar, { width: '80%', marginTop: 8 }]} />
          <View style={[styles.skeletonBar, { width: '40%', marginTop: 16 }]} />
        </View>
      ))}
    </View>
  );
}

export default function OrderHistoryPage() {
  const { user } = useAuthStore();
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'all' | 'completed' | 'cancelled'>('all');

  const loadOrders = useCallback(
    async (mode: 'full' | 'refresh' = 'full') => {
      if (!user?.id) return;

      if (mode === 'full') setIsLoading(true);
      else setRefreshing(true);

      try {
        const result = await userApiService.getUserDeliveries(user.id, {
          limit: 100,
          status: filter === 'all' ? undefined : filter,
        });

        if (result.success && result.data) {
          setOrders(result.data);
        }
      } catch (error) {
        logger.error('Erreur chargement historique:', undefined, error);
      } finally {
        setIsLoading(false);
        setRefreshing(false);
      }
    },
    [user?.id, filter]
  );

  useEffect(() => {
    loadOrders('full');
  }, [loadOrders]);

  const sections = useMemo(() => groupOrdersBySection(orders), [orders]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return '#F59E0B';
      case 'accepted':
        return '#3B82F6';
      case 'enroute':
        return '#8B5CF6';
      case 'picked_up':
      case 'delivering':
        return '#10B981';
      case 'completed':
        return '#10B981';
      case 'cancelled':
      case 'declined':
        return '#EF4444';
      default:
        return '#6B7280';
    }
  };

  /** Libellés courts pour la liste (lisibilité). */
  const getStatusLabelShort = (status: string) => {
    switch (status) {
      case 'pending':
        return 'Recherche';
      case 'accepted':
        return 'Prise en charge';
      case 'enroute':
        return 'Livreur en route';
      case 'picked_up':
        return 'Colis récupéré';
      case 'delivering':
        return 'Livraison';
      case 'completed':
        return 'Livraison terminée';
      case 'cancelled':
        return 'Annulée';
      case 'declined':
        return 'Refusée';
      default:
        return status;
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const formatPrice = (order: Order) => {
    const price = order.price ?? order.price_cfa;
    if (!price || price === 0) return '—';
    return `${price.toLocaleString('fr-FR')} FCFA`;
  };

  const emptyMessage =
    filter === 'completed'
      ? 'Aucune livraison terminée pour le moment.'
      : filter === 'cancelled'
        ? 'Aucune commande annulée.'
        : 'Aucune commande pour le moment.';

  const pickupLine = (order: Order) => {
    const raw =
      order.pickup_address_text ||
      (typeof order.pickup_address === 'string'
        ? order.pickup_address
        : order.pickup_address?.address) ||
      'Adresse non disponible';
    return truncateAddress(raw);
  };

  const dropoffLine = (order: Order) => {
    const raw =
      order.dropoff_address_text ||
      (typeof order.dropoff_address === 'string'
        ? order.dropoff_address
        : order.dropoff_address?.address) ||
      'Adresse non disponible';
    return truncateAddress(raw);
  };

  const footerHint = (order: Order) => {
    if (order.completed_at) return 'Livraison terminée';
    if (order.status === 'cancelled' || order.status === 'declined') return 'Commande annulée';
    return 'Créée';
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#1F2937" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Historique des commandes</Text>
        <View style={styles.placeholder} />
      </View>

      <View style={styles.filters}>
        <TouchableOpacity
          style={[styles.filterButton, filter === 'all' && styles.filterButtonActive]}
          onPress={() => setFilter('all')}
          accessibilityRole="button"
          accessibilityState={{ selected: filter === 'all' }}
        >
          <Text style={[styles.filterText, filter === 'all' && styles.filterTextActive]}>Toutes</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterButton, filter === 'completed' && styles.filterButtonActive]}
          onPress={() => setFilter('completed')}
          accessibilityRole="button"
          accessibilityState={{ selected: filter === 'completed' }}
        >
          <Text style={[styles.filterText, filter === 'completed' && styles.filterTextActive]}>
            Terminées
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterButton, filter === 'cancelled' && styles.filterButtonActive]}
          onPress={() => setFilter('cancelled')}
          accessibilityRole="button"
          accessibilityState={{ selected: filter === 'cancelled' }}
        >
          <Text style={[styles.filterText, filter === 'cancelled' && styles.filterTextActive]}>
            Annulées
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadOrders('refresh')}
            tintColor="#8B5CF6"
            colors={['#8B5CF6']}
          />
        }
      >
        {isLoading ? (
          <HistorySkeleton />
        ) : orders.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="cube-outline" size={64} color="#9CA3AF" />
            <Text style={styles.emptyTitle}>Aucune commande</Text>
            <Text style={styles.emptyText}>{emptyMessage}</Text>
            <Text style={styles.emptyHint}>Tirez vers le bas pour actualiser.</Text>
          </View>
        ) : (
          sections.map((section, sectionIndex) => (
            <View key={section.title}>
              <Text style={[styles.sectionTitle, sectionIndex === 0 && styles.sectionTitleFirst]}>
                {section.title}
              </Text>
              {section.data.map((order) => {
                const refDate = getOrderReferenceDate(order);
                const a11y = `Commande ${formatDeliveryId(order.id, order.created_at)}, ${formatPrice(order)}, ${getStatusLabelShort(order.status)}, ${formatDate(refDate)}`;
                return (
                  <TouchableOpacity
                    key={order.id}
                    style={styles.orderCard}
                    onPress={() => router.push(`/order-tracking/${order.id}`)}
                    accessibilityRole="button"
                    accessibilityLabel={a11y}
                  >
                    <View style={styles.orderHeader}>
                      <View style={styles.orderInfo}>
                        <Text style={styles.orderId}>
                          {formatDeliveryId(order.id, order.created_at)}
                        </Text>
                        <View
                          style={[
                            styles.statusBadge,
                            { backgroundColor: `${getStatusColor(order.status)}20` },
                          ]}
                        >
                          <View
                            style={[styles.statusDot, { backgroundColor: getStatusColor(order.status) }]}
                          />
                          <Text style={[styles.statusText, { color: getStatusColor(order.status) }]}>
                            {getStatusLabelShort(order.status)}
                          </Text>
                        </View>
                      </View>
                      <View style={styles.orderHeaderRight}>
                        <Text style={styles.orderPrice}>{formatPrice(order)}</Text>
                        <Text style={styles.orderDateHeader}>{formatDate(refDate)}</Text>
                      </View>
                    </View>

                    <View style={styles.orderDetails}>
                      <View style={styles.locationRow}>
                        <Ionicons name="location" size={16} color="#8B5CF6" />
                        <Text style={styles.locationText} numberOfLines={1}>
                          {pickupLine(order)}
                        </Text>
                      </View>
                      <View style={styles.locationRow}>
                        <Ionicons name="location-outline" size={16} color="#10B981" />
                        <Text style={styles.locationText} numberOfLines={1}>
                          {dropoffLine(order)}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.orderFooter}>
                      <Text style={styles.orderFooterHint}>{footerHint(order)}</Text>
                      <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          ))
        )}
      </ScrollView>
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
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 20,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
  },
  placeholder: {
    width: 40,
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
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
  },
  filterButtonActive: {
    backgroundColor: '#8B5CF6',
  },
  filterText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  filterTextActive: {
    color: '#FFFFFF',
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 32,
  },
  skeletonWrap: {
    paddingTop: 8,
  },
  skeletonCard: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 20,
    marginTop: 16,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  skeletonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  skeletonBar: {
    height: 14,
    borderRadius: 6,
    backgroundColor: '#E5E7EB',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    minHeight: 320,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#374151',
    marginTop: 16,
  },
  emptyText: {
    fontSize: 15,
    color: '#6B7280',
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 22,
  },
  emptyHint: {
    fontSize: 13,
    color: '#9CA3AF',
    marginTop: 16,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginTop: 20,
    marginBottom: 4,
    marginHorizontal: 20,
  },
  sectionTitleFirst: {
    marginTop: 12,
  },
  orderCard: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 20,
    marginTop: 12,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  orderInfo: {
    flex: 1,
    marginRight: 12,
  },
  orderHeaderRight: {
    alignItems: 'flex-end',
  },
  orderDateHeader: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 4,
  },
  orderId: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 6,
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
    fontWeight: '500',
  },
  orderPrice: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2937',
  },
  orderDetails: {
    marginBottom: 12,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  locationText: {
    fontSize: 13,
    color: '#6B7280',
    marginLeft: 8,
    flex: 1,
  },
  orderFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  orderFooterHint: {
    fontSize: 12,
    color: '#9CA3AF',
  },
});
