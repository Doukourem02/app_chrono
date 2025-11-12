/**
 * Bottom Sheet pour afficher et gérer toutes les commandes actives du livreur
 * Permet de basculer entre plusieurs livraisons en cours
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useOrderStore, OrderRequest } from '../store/useOrderStore';
import ActiveOrdersList from './ActiveOrdersList';

interface OrdersListBottomSheetProps {
  animatedHeight: any;
  panResponder: any;
  isExpanded: boolean;
  onToggle: () => void;
  onOrderSelect?: (orderId: string) => void;
}

export const OrdersListBottomSheet: React.FC<OrdersListBottomSheetProps> = ({
  animatedHeight,
  panResponder,
  isExpanded,
  onToggle,
  onOrderSelect,
}) => {
  const { activeOrders, pendingOrders, selectedOrderId, setSelectedOrder } = useOrderStore();
  const totalOrders = activeOrders.length + pendingOrders.length;

  const handleOrderSelect = (orderId: string) => {
    setSelectedOrder(orderId);
    if (onOrderSelect) {
      onOrderSelect(orderId);
    }
    // Fermer le bottom sheet après sélection
    setTimeout(() => {
      onToggle();
    }, 300);
  };

  return (
    <Animated.View
      {...panResponder.panHandlers}
      style={[
        styles.container,
        {
          height: animatedHeight,
        },
      ]}
    >
      {/* Handle */}
      <TouchableOpacity onPress={onToggle} style={styles.dragIndicator}>
        <View style={styles.dragHandle} />
      </TouchableOpacity>

      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Mes commandes</Text>
          <Text style={styles.subtitle}>
            {totalOrders > 0 
              ? `${totalOrders} commande${totalOrders > 1 ? 's' : ''} en cours`
              : 'Aucune commande'}
          </Text>
        </View>
        {totalOrders > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{totalOrders}</Text>
          </View>
        )}
      </View>

      {/* Liste des commandes */}
      <View style={styles.content}>
        <ActiveOrdersList 
          onOrderSelect={handleOrderSelect}
          showPending={true}
        />
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 10,
    paddingTop: 12,
  },
  dragIndicator: {
    alignItems: 'center',
    marginBottom: 8,
  },
  dragHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#D1D5DB',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  subtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 4,
  },
  badge: {
    backgroundColor: '#8B5CF6',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    minWidth: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
});

export default OrdersListBottomSheet;

