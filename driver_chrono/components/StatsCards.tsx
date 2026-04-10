import React from 'react';
import { View, Text, StyleSheet, Dimensions, TouchableOpacity } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useDriverStore } from '../store/useDriverStore';
import { CommissionBalanceCard } from './CommissionBalanceCard';

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
  const { profile } = useDriverStore();
  const driverType = profile?.driver_type;
  const needsTypeChoice = profile != null && (driverType == null || driverType === undefined);
  const isPartner = driverType === 'partner';

  const formatCurrency = (amount: number) => {
    const formatted = new Intl.NumberFormat('fr-FR', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount ?? 0);

    return `${formatted.replace(/\u00A0/g, ' ')} FCFA`;
  };

  return (
    <View style={styles.statsContainer}>
      {/* Carte "Aujourd'hui" - Toujours affichée */}
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

      {/* Carte conditionnelle : choix type / commission partenaire / revenus interne */}
      {needsTypeChoice ? (
        <TouchableOpacity
          style={[styles.card, styles.cardAction]}
          onPress={() => router.push('/(auth)/driver-type-selection' as any)}
          activeOpacity={0.85}
        >
          <Ionicons name="person-outline" size={24} color="#8B5CF6" />
          <View style={{ marginLeft: 8, flex: 1 }}>
            <Text style={styles.cardTitle}>Type de livreur</Text>
            <Text style={styles.cardSubtitleAction}>
              Appuyez pour choisir interne ou partenaire
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#8B5CF6" />
        </TouchableOpacity>
      ) : isPartner ? (
        <CommissionBalanceCard isOnline={isOnline} />
      ) : (
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
      )}
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
  cardAction: {
    borderWidth: 1,
    borderColor: '#E9D5FF',
    backgroundColor: '#FAF5FF',
  },
  cardSubtitleAction: {
    fontSize: 12,
    color: '#7C3AED',
    marginTop: 2,
  },
});