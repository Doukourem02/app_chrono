import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Image,
  Modal,
  FlatList,
} from 'react-native';
import { useRequireAuth } from '../../hooks/useRequireAuth';
import { useAuthStore } from '../../store/useAuthStore';
import { userApiService } from '../../services/userApiService';
import { OrderRequest, OrderStatus, useOrderStore } from '../../store/useOrderStore';

interface OrderWithDB extends OrderRequest {
  created_at?: string;
  accepted_at?: string;
  completed_at?: string;
  cancelled_at?: string;
}

type FilterKey = 'all' | 'pending' | 'accepted' | 'enroute' | 'completed' | 'cancelled';

interface PaginationState {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface FilterItem {
  key: FilterKey;
  label: string;
}

const FILTER_KEYS: FilterKey[] = ['all', 'pending', 'accepted', 'enroute', 'completed', 'cancelled'];

const FILTER_STATUS_MAP: Record<Exclude<FilterKey, 'all'>, OrderStatus[]> = {
  pending: ['pending'],
  accepted: ['accepted', 'enroute', 'picked_up'],
  enroute: ['enroute', 'picked_up'],
  completed: ['completed'],
  cancelled: ['cancelled', 'declined'],
};

const normalizeDateValue = (value?: string | Date | null): string | undefined => {
  if (!value) return undefined;
  if (typeof value === 'string') return value;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? undefined : value.toISOString();
  }
  return undefined;
};

const normalizeStoreOrder = (order: OrderRequest): OrderWithDB => ({
  ...order,
  created_at: normalizeDateValue((order as any).created_at || order.createdAt),
  accepted_at: normalizeDateValue((order as any).accepted_at || (order as any).acceptedAt),
  completed_at: normalizeDateValue((order as any).completed_at || (order as any).completedAt),
  cancelled_at: normalizeDateValue((order as any).cancelled_at || (order as any).cancelledAt),
});

const filterMatchesStatus = (filter: FilterKey, status: OrderStatus): boolean => {
  if (filter === 'all') return true;
  const allowed = FILTER_STATUS_MAP[filter];
  return allowed.includes(status);
};

const mergeOrders = (apiOrders: OrderWithDB[], liveOrders: OrderWithDB[]): OrderWithDB[] => {
  const map = new Map<string, OrderWithDB>();

  apiOrders.forEach((order) => {
    map.set(order.id, order);
  });

  liveOrders.forEach((order) => {
    const existing = map.get(order.id);
    if (existing) {
      map.set(order.id, {
        ...existing,
        ...order,
        pickup: order.pickup || existing.pickup,
        dropoff: order.dropoff || existing.dropoff,
        status: order.status,
      });
    } else {
      map.set(order.id, order);
    }
  });

  const dateValue = (order: OrderWithDB) => {
    const date =
      normalizeDateValue(order.created_at || (order as any).createdAt) ||
      normalizeDateValue(order.accepted_at) ||
      normalizeDateValue(order.completed_at);
    return date ? new Date(date).getTime() : 0;
  };

  return Array.from(map.values()).sort((a, b) => dateValue(b) - dateValue(a));
};

const createInitialPagination = (): PaginationState => ({
  page: 1,
  limit: 20,
  total: 0,
  totalPages: 0,
});

export default function BoxPage() {
  const { requireAuth } = useRequireAuth();
  const { user } = useAuthStore();
  const activeOrders = useOrderStore((state) => state.activeOrders);
  const [orders, setOrders] = useState<OrderWithDB[]>([]);
  const [ordersByFilter, setOrdersByFilter] = useState<Record<FilterKey, OrderWithDB[]>>(() =>
    FILTER_KEYS.reduce((acc, key) => {
      acc[key] = [];
      return acc;
    }, {} as Record<FilterKey, OrderWithDB[]>)
  );
  const [paginationByFilter, setPaginationByFilter] = useState<Record<FilterKey, PaginationState>>(() =>
    FILTER_KEYS.reduce((acc, key) => {
      acc[key] = createInitialPagination();
      return acc;
    }, {} as Record<FilterKey, PaginationState>)
  );
  const [pagination, setPagination] = useState<PaginationState>(createInitialPagination());
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isFilterLoading, setIsFilterLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState<FilterKey>('all');
  const [selectedOrder, setSelectedOrder] = useState<OrderWithDB | null>(null);
  const [showOrderDetails, setShowOrderDetails] = useState(false);

  const filtersListRef = useRef<FlatList<FilterItem>>(null);
  const selectedFilterRef = useRef<FilterKey>('all');

  const loadOrders = useCallback(
    async (filter: FilterKey, page = 1, options: { silent?: boolean } = {}) => {
      if (!user?.id) return;

      const { silent = false } = options;
      const isFirstPage = page === 1;
      const isInitialFetch = isFirstPage && isInitialLoading && filter === 'all';

      if (isFirstPage) {
        if (isInitialFetch) {
          setIsInitialLoading(true);
        } else if (!silent) {
          setIsFilterLoading(true);
        }
      } else {
        setIsLoadingMore(true);
      }

      try {
        const result = await userApiService.getUserDeliveries(user.id, {
          page,
          limit: 20,
          status: filter !== 'all' ? filter : undefined,
        });

        if (result.success && result.data) {
          const formattedOrders = result.data.map((order: any) => ({
            id: order.id,
            user: {
              id: order.user_id,
              name: order.user?.name || 'Client',
            },
            driver: order.driver_id
              ? {
                  id: order.driver_id,
                  name: order.driver?.name || 'Livreur',
                }
              : undefined,
            pickup: typeof order.pickup === 'string' ? JSON.parse(order.pickup) : order.pickup,
            dropoff: typeof order.dropoff === 'string' ? JSON.parse(order.dropoff) : order.dropoff,
            price: order.price,
            deliveryMethod: order.delivery_method as 'moto' | 'vehicule' | 'cargo',
            distance: order.distance,
            estimatedDuration: order.estimated_duration,
            status: order.status as OrderStatus,
            driverId: order.driver_id,
            createdAt: order.created_at || order.createdAt,
            proof: order.proof
              ? typeof order.proof === 'string'
                ? JSON.parse(order.proof)
                : order.proof
              : undefined,
            created_at: order.created_at,
            accepted_at: order.accepted_at,
            completed_at: order.completed_at,
            cancelled_at: order.cancelled_at,
          })) as OrderWithDB[];

          setOrdersByFilter((prev) => {
            const previousOrders = prev[filter] || [];
            const mergedOrders = isFirstPage ? formattedOrders : [...previousOrders, ...formattedOrders];
            const next = {
              ...prev,
              [filter]: mergedOrders,
            };

            if (selectedFilterRef.current === filter) {
              setOrders(mergedOrders);
            }

            return next;
          });

          setPaginationByFilter((prev) => {
            const previousPagination = prev[filter] || createInitialPagination();
            const updatedPagination = result.pagination
              ? result.pagination
              : {
                  ...previousPagination,
                  page,
                };

            if (selectedFilterRef.current === filter) {
              setPagination(updatedPagination);
            }

            return {
              ...prev,
              [filter]: updatedPagination,
            };
          });
        } else if (!result.success && result.message && isFirstPage && selectedFilterRef.current === filter) {
          // Si la session est expirée, le logout() a déjà été appelé, ne pas afficher d'alerte
          // Le système de redirection gérera la navigation vers la page de connexion
          if (!result.message.includes('Session expirée')) {
            Alert.alert('Erreur', result.message);
          }
        }
      } catch (err) {
        console.error('Erreur chargement commandes:', err);
        if (isFirstPage) {
          // Vérifier si c'est une erreur de session expirée
          const errorMessage = err instanceof Error ? err.message : 'Impossible de charger vos commandes';
          if (!errorMessage.includes('Session expirée')) {
            Alert.alert('Erreur', errorMessage);
          }
        }
      } finally {
        if (isFirstPage) {
          setIsInitialLoading(false);
          if (!silent) {
            setIsFilterLoading(false);
          }
        } else {
          setIsLoadingMore(false);
        }
        setRefreshing(false);
      }
    },
    [user?.id, isInitialLoading]
  );

  useEffect(() => {
    selectedFilterRef.current = selectedFilter;
  }, [selectedFilter]);

  // Vérifier l'authentification dès l'accès à la page
  useEffect(() => {
    // Vérifier si l'utilisateur est toujours connecté
    if (!user?.id) {
      return;
    }
    requireAuth(() => {
      // L'utilisateur est connecté, charger les commandes
      if (user?.id) {
        loadOrders('all');
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requireAuth, user?.id]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadOrders(selectedFilter, 1);
  }, [loadOrders, selectedFilter]);

  const handleFilterChange = useCallback(
    (filter: FilterKey, index: number) => {
      if (filter === selectedFilter) return;

      selectedFilterRef.current = filter;
    setSelectedFilter(filter);

      const cachedOrders = ordersByFilter[filter] || [];
      setOrders(cachedOrders);

      const cachedPagination = paginationByFilter[filter] || createInitialPagination();
      setPagination(cachedPagination);

      if (filtersListRef.current) {
        try {
          filtersListRef.current.scrollToIndex({ index, animated: true, viewPosition: 0.5 });
        } catch {
          filtersListRef.current.scrollToEnd({ animated: true });
        }
      }

      loadOrders(filter, 1, { silent: cachedOrders.length > 0 });
    },
    [loadOrders, ordersByFilter, paginationByFilter, selectedFilter]
  );

  const handleCancelOrder = async (orderId: string) => {
    // Trouver la commande pour vérifier son statut
    const order = orders.find(o => o.id === orderId);
    
    // Vérifier le statut de la commande avant d'afficher l'alerte
    if (order && order.status !== 'pending' && order.status !== 'accepted') {
      const statusMessages: Record<string, string> = {
        'picked_up': 'Impossible d\'annuler une commande dont le colis a déjà été récupéré',
        'enroute': 'Impossible d\'annuler une commande en cours de livraison',
        'completed': 'Impossible d\'annuler une commande déjà terminée',
        'cancelled': 'Cette commande a déjà été annulée',
        'declined': 'Cette commande a été refusée',
      };
      Alert.alert('Annulation impossible', statusMessages[order.status] || 'Cette commande ne peut pas être annulée');
      return;
    }

    Alert.alert(
      'Annuler la commande',
      'Êtes-vous sûr de vouloir annuler cette commande ?',
      [
        { text: 'Non', style: 'cancel' },
        {
          text: 'Oui',
          style: 'destructive',
          onPress: async () => {
            try {
              const result = await userApiService.cancelOrder(orderId, order?.status);
              if (result.success) {
                Alert.alert('Succès', 'Commande annulée avec succès');
                loadOrders(selectedFilter, 1);
              } else {
                Alert.alert('Erreur', result.message || 'Impossible d\'annuler la commande');
              }
            } catch {
              Alert.alert('Erreur', 'Impossible d\'annuler la commande');
            }
          },
        },
      ]
    );
  };

  const getStatusColor = (status: OrderStatus) => {
    switch (status) {
      case 'completed':
        return '#10B981';
      case 'accepted':
      case 'enroute':
      case 'picked_up':
        return '#8B5CF6';
      case 'pending':
        return '#F59E0B';
      case 'cancelled':
      case 'declined':
        return '#EF4444';
      default:
        return '#6B7280';
    }
  };

  const getStatusLabel = (status: OrderStatus) => {
    switch (status) {
      case 'pending':
        return 'En attente';
      case 'accepted':
        return 'Acceptée';
      case 'enroute':
        return 'En route';
      case 'picked_up':
        return 'Colis récupéré';
      case 'completed':
        return 'Terminée';
      case 'cancelled':
        return 'Annulée';
      case 'declined':
        return 'Refusée';
      default:
        return status;
    }
  };

  const getDeliveryMethodIcon = (method: 'moto' | 'vehicule' | 'cargo') => {
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

  const formatDate = (date?: string | Date) => {
    if (!date) return 'N/A';
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const filters: FilterItem[] = [
    { key: 'all', label: 'Toutes' },
    { key: 'pending', label: 'En attente' },
    { key: 'accepted', label: 'Acceptées' },
    { key: 'enroute', label: 'En route' },
    { key: 'completed', label: 'Terminées' },
    { key: 'cancelled', label: 'Annulées' },
  ];

  const normalizedActiveOrders = useMemo(
    () => activeOrders.map(normalizeStoreOrder),
    [activeOrders]
  );

  const liveOrdersForFilter = useMemo(
    () =>
      normalizedActiveOrders.filter((order) => filterMatchesStatus(selectedFilter, order.status)),
    [normalizedActiveOrders, selectedFilter]
  );

  const displayedOrders = useMemo(
    () => mergeOrders(orders, liveOrdersForFilter),
    [orders, liveOrdersForFilter]
  );

  if (isInitialLoading && displayedOrders.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#8B5CF6" />
          <Text style={styles.loadingText}>Chargement de vos colis...</Text>
        </View>
      </View>
    );
  }

  const renderFilter = ({ item, index }: { item: FilterItem; index: number }) => (
    <TouchableOpacity
      style={[
        styles.filterButton,
        selectedFilter === item.key && styles.filterButtonActive,
      ]}
      onPress={() => handleFilterChange(item.key, index)}
    >
      <Text
        style={[
          styles.filterText,
          selectedFilter === item.key && styles.filterTextActive,
        ]}
      >
        {item.label}
      </Text>
    </TouchableOpacity>
  );

  const renderOrder = ({ item: order }: { item: OrderWithDB }) => {
    const orderName = order.dropoff?.address?.split(',')[0] || `Commande #${order.id.slice(0, 8)}`;
    const routeText = order.pickup?.address && order.dropoff?.address
      ? `${order.pickup.address.split(',').pop()?.trim() || 'Départ'} → ${order.dropoff.address.split(',').pop()?.trim() || 'Destination'}`
      : 'Route non définie';

    return (
      <TouchableOpacity
        style={styles.orderCard}
        onPress={() => {
          setSelectedOrder(order);
          setShowOrderDetails(true);
        }}
      >
        <View style={styles.orderCardContent}>
          <View style={styles.orderCardLeft}>
            <View style={styles.orderCardIcon}>
              <Image 
                source={getDeliveryMethodIcon(order.deliveryMethod || 'moto')}
                style={styles.orderCardIconImage}
                resizeMode="contain"
              />
            </View>
            <View style={styles.orderCardInfo}>
              <Text style={styles.orderCardTitle}>{orderName}</Text>
              <Text style={styles.orderCardRoute}>{routeText}</Text>
            </View>
          </View>
          <View style={styles.orderCardRight}>
            <View
              style={[
                styles.statusBadge,
                { backgroundColor: `${getStatusColor(order.status)}20` },
              ]}
            >
              <Text
                style={[
                  styles.statusText,
                  { color: getStatusColor(order.status) },
                ]}
              >
                {getStatusLabel(order.status)}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="cube-outline" size={80} color="#D1D5DB" />
      <Text style={styles.emptyTitle}>Aucun colis trouvé</Text>
      <Text style={styles.emptyText}>
        {selectedFilter === 'all'
          ? 'Vous n\'avez pas encore de commandes'
          : `Aucune commande ${filters.find(f => f.key === selectedFilter)?.label.toLowerCase()}`}
      </Text>
    </View>
  );

  const renderFooter = () => {
    if (pagination.totalPages <= 1 || pagination.page >= pagination.totalPages) {
      return null;
    }
    return (
      <TouchableOpacity
        style={styles.loadMoreButton}
        disabled={isLoadingMore}
        onPress={() => loadOrders(selectedFilter, pagination.page + 1)}
      >
        {isLoadingMore ? (
          <ActivityIndicator size="small" color="#8B5CF6" />
        ) : (
          <Text style={styles.loadMoreText}>Charger plus</Text>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <Text style={styles.headerTitle}>Mes Colis</Text>

      {/* Filtres */}
      <View style={styles.filtersWrapper}>
        <FlatList
          ref={filtersListRef}
          data={filters}
          horizontal
          extraData={selectedFilter}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filtersContent}
          renderItem={renderFilter}
          keyExtractor={(item) => item.key}
          onScrollToIndexFailed={({ index }) => {
            setTimeout(() => {
              filtersListRef.current?.scrollToIndex({ index, animated: true, viewPosition: 0.5 });
            }, 100);
          }}
        />
        {isFilterLoading && (
          <View style={styles.filterLoadingIndicator}>
            <ActivityIndicator size="small" color="#8B5CF6" />
          </View>
        )}
      </View>

      {/* Liste ou état vide */}
      {displayedOrders.length === 0 ? (
        <View style={styles.emptyStateContainer}>
          {renderEmptyState()}
        </View>
      ) : (
        <FlatList
          data={displayedOrders}
          renderItem={renderOrder}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.ordersListContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          ListFooterComponent={renderFooter}
        />
      )}

      {/* Modal détails de la commande */}
      <Modal
        visible={showOrderDetails}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowOrderDetails(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Détails de la commande</Text>
            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => setShowOrderDetails(false)}
            >
              <Ionicons name="close" size={24} color="#000000" />
            </TouchableOpacity>
          </View>

          {selectedOrder && (
            <ScrollView style={styles.modalContent}>
              {/* Informations générales */}
              <View style={styles.detailSection}>
                <Text style={styles.detailSectionTitle}>Informations</Text>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>ID Commande</Text>
                  <Text style={styles.detailValue}>{selectedOrder.id}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Statut</Text>
                  <View
                    style={[
                      styles.statusBadge,
                      { backgroundColor: `${getStatusColor(selectedOrder.status)}15` },
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusText,
                        { color: getStatusColor(selectedOrder.status) },
                      ]}
                    >
                      {getStatusLabel(selectedOrder.status)}
                    </Text>
                  </View>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Méthode de livraison</Text>
                  <View style={styles.detailValueWithIcon}>
                    <Image 
                      source={getDeliveryMethodIcon(selectedOrder.deliveryMethod || 'moto')}
                      style={styles.detailIconImage}
                      resizeMode="contain"
                    />
                    <Text style={styles.detailValue}>
                      {selectedOrder.deliveryMethod || 'moto'}
                    </Text>
                  </View>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Prix</Text>
                  <Text style={[styles.detailValue, styles.detailPrice]}>
                    {selectedOrder.price ? `${selectedOrder.price} FCFA` : 'Non défini'}
                  </Text>
                </View>
                {selectedOrder.distance && (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Distance</Text>
                    <Text style={styles.detailValue}>
                      {selectedOrder.distance.toFixed(2)} km
                    </Text>
                  </View>
                )}
                {selectedOrder.estimatedDuration && (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Durée estimée</Text>
                    <Text style={styles.detailValue}>
                      {selectedOrder.estimatedDuration}
                    </Text>
                  </View>
                )}
              </View>

              {/* Adresses */}
              <View style={styles.detailSection}>
                <Text style={styles.detailSectionTitle}>Adresses</Text>
                <View style={styles.addressCard}>
                  <View style={styles.addressHeader}>
                    <View style={[styles.addressDot, { backgroundColor: '#10B981' }]} />
                    <Text style={styles.addressLabel}>Point de départ</Text>
                  </View>
                  <Text style={styles.addressText}>
                    {selectedOrder.pickup?.address || 'Non définie'}
                  </Text>
                </View>
                <View style={styles.addressCard}>
                  <View style={styles.addressHeader}>
                    <View style={[styles.addressDot, { backgroundColor: '#EF4444' }]} />
                    <Text style={styles.addressLabel}>Destination</Text>
                  </View>
                  <Text style={styles.addressText}>
                    {selectedOrder.dropoff?.address || 'Non définie'}
                  </Text>
                </View>
              </View>

              {/* Livreur */}
              {selectedOrder.driver && (
                <View style={styles.detailSection}>
                  <Text style={styles.detailSectionTitle}>Livreur</Text>
                  <View style={styles.driverCard}>
                    <Text style={styles.driverName}>{selectedOrder.driver.name}</Text>
                    {selectedOrder.driver.phone && (
                      <Text style={styles.driverPhone}>{selectedOrder.driver.phone}</Text>
                    )}
                    {selectedOrder.driver.rating && (
                      <View style={styles.driverRating}>
                        <Ionicons name="star" size={16} color="#F59E0B" />
                        <Text style={styles.driverRatingText}>
                          {selectedOrder.driver.rating.toFixed(1)}
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
              )}

              {/* Preuve de livraison */}
              {selectedOrder.proof && (
                <View style={styles.detailSection}>
                  <Text style={styles.detailSectionTitle}>Preuve de livraison</Text>
                  <View style={styles.proofCard}>
                    <Text style={styles.proofType}>
                      Type: {selectedOrder.proof.type || 'photo'}
                    </Text>
                    {selectedOrder.proof.uploadedAt && (
                      <Text style={styles.proofDate}>
                        Uploadé le: {formatDate(selectedOrder.proof.uploadedAt)}
                      </Text>
                    )}
                    {selectedOrder.proof.url && (
                      <Image
                        source={{ uri: selectedOrder.proof.url }}
                        style={styles.proofImage}
                        resizeMode="cover"
                      />
                    )}
                  </View>
                </View>
              )}

              {/* Dates */}
              <View style={styles.detailSection}>
                <Text style={styles.detailSectionTitle}>Dates</Text>
                {selectedOrder.created_at && (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Créée le</Text>
                    <Text style={styles.detailValue}>
                      {formatDate(selectedOrder.created_at)}
                    </Text>
                  </View>
                )}
                {selectedOrder.accepted_at && (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Acceptée le</Text>
                    <Text style={styles.detailValue}>
                      {formatDate(selectedOrder.accepted_at)}
                    </Text>
                  </View>
                )}
                {selectedOrder.completed_at && (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Terminée le</Text>
                    <Text style={styles.detailValue}>
                      {formatDate(selectedOrder.completed_at)}
                    </Text>
                  </View>
                )}
              </View>

              {/* Bouton Annuler pour les commandes en attente */}
              {selectedOrder.status === 'pending' && (
                <TouchableOpacity
                  style={styles.cancelButtonModal}
                  onPress={() => {
                    setShowOrderDetails(false);
                    handleCancelOrder(selectedOrder.id);
                  }}
                >
                  <Ionicons name="close-circle" size={20} color="#EF4444" />
                  <Text style={styles.cancelButtonText}>Annuler la commande</Text>
                </TouchableOpacity>
              )}
            </ScrollView>
          )}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    paddingTop: 50,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#6B7280',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginHorizontal: 20,
    marginBottom: 16,
  },
  filtersWrapper: {
    marginTop: 16,
  },
  filtersContent: {
    paddingHorizontal: 20,
    gap: 8,
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 36,
  },
  filterButtonActive: {
    backgroundColor: '#8B5CF6',
    borderColor: '#8B5CF6',
  },
  filterText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6B7280',
  },
  filterTextActive: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  ordersListContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 40,
  },
  emptyStateContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 80,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1F2937',
    marginTop: 20,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  orderCard: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  orderCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  orderCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  orderCardIcon: {
    width: 48,
    height: 48,
    borderRadius: 8,
    backgroundColor: '#F9FAFB',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  orderCardIconImage: {
    width: 40,
    height: 40,
  },
  orderCardInfo: {
    flex: 1,
  },
  orderCardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 4,
  },
  orderCardRoute: {
    fontSize: 13,
    color: '#6B7280',
  },
  orderCardRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
  },
  loadMoreButton: {
    padding: 16,
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginTop: 12,
  },
  loadMoreText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#8B5CF6',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 20,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#000000',
  },
  modalCloseButton: {
    padding: 4,
  },
  modalContent: {
    flex: 1,
    padding: 20,
  },
  detailSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  detailSectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 18,
    letterSpacing: -0.3,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  detailLabel: {
    fontSize: 14,
    color: '#6B7280',
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
  },
  detailValueWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  detailIconImage: {
    width: 24,
    height: 24,
  },
  detailPrice: {
    color: '#8B5CF6',
    fontSize: 18,
  },
  addressCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  addressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  addressDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  addressLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
    textTransform: 'uppercase',
  },
  addressText: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 20,
  },
  driverCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    padding: 12,
  },
  driverName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 4,
  },
  driverPhone: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 8,
  },
  driverRating: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  driverRatingText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#F59E0B',
    marginLeft: 4,
  },
  proofCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    padding: 12,
  },
  proofType: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 4,
  },
  proofDate: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 12,
  },
  proofImage: {
    width: '100%',
    height: 200,
    borderRadius: 8,
  },
  cancelButtonModal: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
    marginBottom: 20,
    paddingVertical: 12,
    backgroundColor: '#FEF2F2',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#EF444430',
  },
  cancelButtonText: {
    fontSize: 14,
    color: '#EF4444',
    fontWeight: '600',
    marginLeft: 6,
  },
  filterLoadingIndicator: {
    paddingVertical: 8,
    alignItems: 'center',
  },
});
