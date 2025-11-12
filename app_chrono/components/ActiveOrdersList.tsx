/**
 * Composant pour afficher la liste des commandes actives
 * Permet de gérer plusieurs commandes simultanées
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useOrderStore, OrderRequest } from '../store/useOrderStore';

interface ActiveOrdersListProps {
  onOrderSelect?: (orderId: string) => void;
}

const getStatusColor = (status: string): string => {
  switch (status) {
    case 'pending':
      return '#F59E0B'; // Orange
    case 'accepted':
      return '#3B82F6'; // Bleu
    case 'enroute':
      return '#8B5CF6'; // Violet
    case 'picked_up':
      return '#10B981'; // Vert
    case 'completed':
      return '#6B7280'; // Gris
    case 'cancelled':
    case 'declined':
      return '#EF4444'; // Rouge
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
    case 'enroute':
      return 'En route';
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

export const ActiveOrdersList: React.FC<ActiveOrdersListProps> = ({ onOrderSelect }) => {
  const { activeOrders, selectedOrderId, setSelectedOrder } = useOrderStore();

  if (activeOrders.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="cube-outline" size={48} color="#9CA3AF" />
        <Text style={styles.emptyText}>Aucune commande active</Text>
      </View>
    );
  }

  const handleOrderPress = (orderId: string) => {
    setSelectedOrder(orderId);
    if (onOrderSelect) {
      onOrderSelect(orderId);
    }
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {activeOrders.map((order) => {
        const isSelected = selectedOrderId === order.id;
        const statusColor = getStatusColor(order.status);
        
        return (
          <TouchableOpacity
            key={order.id}
            style={[styles.orderCard, isSelected && styles.selectedCard]}
            onPress={() => handleOrderPress(order.id)}
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

            {order.driver && (
              <View style={styles.driverInfo}>
                <Ionicons name="person-circle-outline" size={16} color="#6B7280" />
                <Text style={styles.driverText}>
                  {order.driver.name || 'Livreur assigné'}
                </Text>
              </View>
            )}

            {isSelected && (
              <View style={styles.selectedIndicator}>
                <Ionicons name="checkmark-circle" size={20} color="#8B5CF6" />
                <Text style={styles.selectedText}>Sélectionnée</Text>
              </View>
            )}
          </TouchableOpacity>
        );
      })}
    </ScrollView>
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
  driverInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  driverText: {
    fontSize: 13,
    color: '#6B7280',
    marginLeft: 8,
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

