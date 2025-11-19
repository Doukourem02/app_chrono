import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useOrderStore } from '../store/useOrderStore';
import { ActiveOrdersList } from './ActiveOrdersList';

const NAV_BAR_HEIGHT = 80;
const NAV_BAR_BOTTOM = 25;
const SPACING_ABOVE_NAV = 15;
const BOTTOM_OFFSET = NAV_BAR_HEIGHT + NAV_BAR_BOTTOM + SPACING_ABOVE_NAV; // 120px

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
  const insets = useSafeAreaInsets();
  const { activeOrders, pendingOrders, setSelectedOrder } = useOrderStore();
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
          bottom: Math.max(insets.bottom, BOTTOM_OFFSET),
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
      <ScrollView 
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={true}
      >
        <ActiveOrdersList 
          onOrderSelect={handleOrderSelect}
          showPending={true}
        />
      </ScrollView>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    right: 0,
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
  },
  contentContainer: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 20,
  },
});

export default OrdersListBottomSheet;

