import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useOrderStore, OrderRequest } from '../store/useOrderStore';

interface ActiveOrdersListProps {
  onOrderSelect?: (orderId: string) => void;
  showPending?: boolean;
}

const getStatusColor = (status: string): string => {
  switch (status) {
    case 'pending':
      return '#F59E0B'; 
    case 'accepted':
      return '#3B82F6'; 
    case 'in_progress':
    case 'enroute':
      return '#8B5CF6'; 
    case 'picked_up':
      return '#10B981'; 
    case 'completed':
      return '#6B7280'; 
    case 'cancelled':
    case 'declined':
      return '#EF4444'; 
    default:
      return '#6B7280';
  }
};

const getStatusLabel = (status: string): string => {
  switch (status) {
    case 'pending':
      return 'En attente';
    case 'accepted':
      return 'Acceptée';
    case 'in_progress':
    case 'enroute':
      return 'En cours';
    case 'picked_up':
      return 'Récupérée';
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

const formatPrice = (price?: number): string => {
  if (!price) return 'N/A';
  return `${price.toLocaleString()} XOF`;
};

const calculateDistance = (order: OrderRequest): number | null => {
  if (!order.pickup?.coordinates || !order.dropoff?.coordinates) return null;
  
  const R = 6371; // Rayon de la Terre en km
  const lat1 = order.pickup.coordinates.latitude;
  const lon1 = order.pickup.coordinates.longitude;
  const lat2 = order.dropoff.coordinates.latitude;
  const lon2 = order.dropoff.coordinates.longitude;
  
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  
  return Math.round(R * c * 10) / 10;
};

export const ActiveOrdersList: React.FC<ActiveOrdersListProps> = ({ 
  onOrderSelect,
  showPending = true 
}) => {
  const { activeOrders, pendingOrders, selectedOrderId, setSelectedOrder } = useOrderStore();

  const handleOrderPress = (orderId: string) => {
    setSelectedOrder(orderId);
    if (onOrderSelect) {
      onOrderSelect(orderId);
    }
  };

  const allOrders = showPending 
    ? [...pendingOrders, ...activeOrders]
    : activeOrders;

  if (allOrders.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="cube-outline" size={48} color="#9CA3AF" />
        <Text style={styles.emptyText}>
          {showPending ? 'Aucune commande' : 'Aucune commande active'}
        </Text>
      </View>
    );
  }


  const sortedOrders = [...allOrders].sort((a, b) => {
    // Pending
    if (a.status === 'pending' && b.status !== 'pending') return -1;
    if (a.status !== 'pending' && b.status === 'pending') return 1;
    
    //trier par statut (picked_up > enroute > accepted)
    const statusPriority: Record<string, number> = {
      'picked_up': 3,
      'delivering': 3,
      'enroute': 2,
      'in_progress': 2,
      'accepted': 1,
      'pending': 0,
    };
    
    const priorityA = statusPriority[a.status] || 0;
    const priorityB = statusPriority[b.status] || 0;
    
    if (priorityA !== priorityB) {
      return priorityB - priorityA; 
    }
    
    const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return dateB - dateA;
  });

  const sortedPending = sortedOrders.filter(o => o.status === 'pending');
  const sortedActive = sortedOrders.filter(o => o.status !== 'pending');

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {showPending && sortedPending.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>En attente ({sortedPending.length})</Text>
          {sortedPending.map((order) => (
            <OrderCard
              key={order.id}
              order={order}
              isSelected={selectedOrderId === order.id}
              onPress={() => handleOrderPress(order.id)}
            />
          ))}
        </View>
      )}

      {sortedActive.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Actives ({sortedActive.length})</Text>
          {sortedActive.map((order) => (
            <OrderCard
              key={order.id}
              order={order}
              isSelected={selectedOrderId === order.id}
              onPress={() => handleOrderPress(order.id)}
            />
          ))}
        </View>
      )}
    </ScrollView>
  );
};

interface OrderCardProps {
  order: OrderRequest;
  isSelected: boolean;
  onPress: () => void;
}

const OrderCard: React.FC<OrderCardProps> = ({ order, isSelected, onPress }) => {
  const statusColor = getStatusColor(order.status);
  const distance = calculateDistance(order);

  return (
    <TouchableOpacity
      style={[styles.orderCard, isSelected && styles.selectedCard]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.orderHeader}>
        <View style={styles.orderInfo}>
          <Text style={styles.orderId}>Commande #{order.id.slice(0, 8)}</Text>
          <View style={[styles.statusBadge, { backgroundColor: `${statusColor}20` }]}>
            <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
            <Text style={[styles.statusText, { color: statusColor }]}>
              {getStatusLabel(order.status)}
            </Text>
          </View>
        </View>
        {order.price && (
          <Text style={styles.price}>{formatPrice(order.price)}</Text>
        )}
      </View>

      <View style={styles.orderDetails}>
        <View style={styles.locationRow}>
          <Ionicons name="location" size={16} color="#8B5CF6" />
          <Text style={styles.locationText} numberOfLines={1}>
            {order.pickup.address}
          </Text>
        </View>
        <View style={styles.locationRow}>
          <Ionicons name="location-outline" size={16} color="#10B981" />
          <Text style={styles.locationText} numberOfLines={1}>
            {order.dropoff.address}
          </Text>
        </View>
      </View>

      <View style={styles.orderMeta}>
        {distance && (
          <View style={styles.metaItem}>
            <Ionicons name="navigate" size={14} color="#6B7280" />
            <Text style={styles.metaText}>{distance} km</Text>
          </View>
        )}
        {order.deliveryMethod && (
          <View style={styles.metaItem}>
            <Ionicons 
              name={order.deliveryMethod === 'moto' ? 'bicycle' : 'car'} 
              size={14} 
              color="#6B7280" 
            />
            <Text style={styles.metaText}>
              {order.deliveryMethod === 'moto' ? 'Moto' : 
               order.deliveryMethod === 'vehicule' ? 'Véhicule' : 'Cargo'}
            </Text>
          </View>
        )}
        {order.user?.name && (
          <View style={styles.metaItem}>
            <Ionicons name="person-outline" size={14} color="#6B7280" />
            <Text style={styles.metaText}>{order.user.name}</Text>
          </View>
        )}
      </View>

      {isSelected && (
        <View style={styles.selectedIndicator}>
          <Ionicons name="checkmark-circle" size={20} color="#8B5CF6" />
          <Text style={styles.selectedText}>Sélectionnée</Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyText: {
    marginTop: 16,
    fontSize: 16,
    color: '#9CA3AF',
    textAlign: 'center',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  orderCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  selectedCard: {
    borderColor: '#8B5CF6',
    borderWidth: 2,
    backgroundColor: '#F5F3FF',
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  orderInfo: {
    flex: 1,
  },
  orderId: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
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
  price: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
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
  orderMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metaText: {
    fontSize: 12,
    color: '#6B7280',
    marginLeft: 4,
  },
  selectedIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  selectedText: {
    fontSize: 13,
    color: '#8B5CF6',
    fontWeight: '600',
    marginLeft: 6,
  },
});

export default ActiveOrdersList;

