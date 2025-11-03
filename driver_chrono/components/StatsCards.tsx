import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');

interface StatsCardsProps {
  deliveredPackages?: number;
  totalRevenue?: number;
  isOnline?: boolean;
  todayDeliveries?: number;
}

export const StatsCards: React.FC<StatsCardsProps> = ({ 
  deliveredPackages = 0, 
  totalRevenue = 0,
  isOnline = false,
  todayDeliveries = 0
}) => {
  const formatCurrency = (amount: number) => {
    const formatted = new Intl.NumberFormat('fr-FR', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount ?? 0);

    return `${formatted.replace(/\u00A0/g, ' ')} FCFA`;
  };

  return (
    <View style={styles.statsContainer}>
      <View style={[styles.card, !isOnline && styles.cardDisabled]}>
        <Ionicons 
          name="cube" 
          size={24} 
          color={isOnline ? "#8B5CF6" : "#9CA3AF"} 
        />
        <View style={{ marginLeft: 8 }}>
          <Text style={[styles.cardTitle, !isOnline && styles.textDisabled]}>
            Aujourd&apos;hui
          </Text>
          <Text style={[styles.cardSubtitle, !isOnline && styles.textDisabled]}>
            {todayDeliveries} colis
          </Text>
        </View>
      </View>

      <View style={[styles.card, !isOnline && styles.cardDisabled]}>
        <MaterialCommunityIcons 
          name="wallet" 
          size={24} 
          color={isOnline ? "#8B5CF6" : "#9CA3AF"} 
        />
        <View style={{ marginLeft: 8 }}>
          <Text style={[styles.cardTitle, !isOnline && styles.textDisabled]}>
            Revenus total
          </Text>
          <Text style={[styles.cardSubtitle, !isOnline && styles.textDisabled]}>
            {formatCurrency(totalRevenue)}
          </Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  statsContainer: {
    position: 'absolute',
    top: 140,
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-evenly',
  },
  card: {
    backgroundColor: '#fff',
    width: width * 0.4,
    paddingVertical: 16,
    paddingHorizontal: 10,
    borderRadius: 15,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },
  cardDisabled: {
    backgroundColor: '#F9FAFB',
    opacity: 0.7,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  cardSubtitle: {
    fontSize: 12,
    color: '#666',
  },
  textDisabled: {
    color: '#9CA3AF',
  },
});