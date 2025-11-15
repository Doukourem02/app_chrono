import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useDriverStore } from '../../store/useDriverStore';
import { apiService } from '../../services/apiService';

export default function StatisticsPage() {
  const { user } = useDriverStore();
  const [statistics, setStatistics] = useState({
    completedDeliveries: 0,
    averageRating: 0,
    totalEarnings: 0,
    totalDistance: 0,
    averageDeliveryTime: 0,
  });
  const [isLoading, setIsLoading] = useState(true);

  const loadStatistics = useCallback(async () => {
    if (!user?.id) return;
    
    setIsLoading(true);
    try {
      const result = await apiService.getDriverStatistics(user.id);
      if (result.success && result.data) {
        const data = result.data as any;
        setStatistics({
          completedDeliveries: data.completedDeliveries || 0,
          averageRating: data.averageRating || 0,
          totalEarnings: data.totalEarnings || 0,
          totalDistance: data.totalDistance || 0,
          averageDeliveryTime: data.averageDeliveryTime || 0,
        });
      }
    } catch (error) {
      console.error('Erreur chargement statistiques:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    loadStatistics();
  }, [loadStatistics]);

  const formatCurrency = (amount?: number) => {
    if (!amount && amount !== 0) return '0 FCFA';
    return `${amount.toLocaleString()} FCFA`;
  };

  const formatDistance = (km?: number) => {
    if (!km && km !== 0) return '0 km';
    return `${km.toFixed(1)} km`;
  };

  const formatTime = (minutes?: number) => {
    if (!minutes && minutes !== 0) return '0 min';
    if (minutes < 60) return `${Math.round(minutes)} min`;
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    return `${hours}h${mins > 0 ? mins : ''}`;
  };

  const statCards = [
    {
      icon: 'cube',
      label: 'Livraisons complétées',
      value: statistics.completedDeliveries.toString(),
      color: '#8B5CF6',
    },
    {
      icon: 'star',
      label: 'Note moyenne',
      value: (statistics.averageRating || 0).toFixed(1),
      color: '#FBBF24',
    },
    {
      icon: 'cash',
      label: 'Gains totaux',
      value: formatCurrency(statistics.totalEarnings),
      color: '#10B981',
    },
    {
      icon: 'location',
      label: 'Distance totale',
      value: formatDistance(statistics.totalDistance),
      color: '#3B82F6',
    },
    {
      icon: 'time',
      label: 'Temps moyen',
      value: formatTime(statistics.averageDeliveryTime),
      color: '#EF4444',
    },
  ];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#1F2937" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Statistiques</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#8B5CF6" />
          </View>
        ) : (
          <View style={styles.statsGrid}>
            {statCards.map((stat, index) => (
              <View key={index} style={styles.statCard}>
                <View style={[styles.statIconContainer, { backgroundColor: `${stat.color}15` }]}>
                  <Ionicons name={stat.icon as any} size={32} color={stat.color} />
                </View>
                <Text style={styles.statValue}>{stat.value}</Text>
                <Text style={styles.statLabel}>{stat.label}</Text>
              </View>
            ))}
          </View>
        )}

        <View style={styles.infoCard}>
          <Ionicons name="information-circle" size={24} color="#8B5CF6" />
          <Text style={styles.infoText}>
            Ces statistiques sont mises à jour en temps réel après chaque livraison complétée.
          </Text>
        </View>
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
  content: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 16,
    gap: 12,
  },
  statCard: {
    width: '47%',
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  statIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center',
  },
  infoCard: {
    backgroundColor: '#F3F0FF',
    marginHorizontal: 20,
    marginTop: 20,
    marginBottom: 40,
    padding: 16,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
  },
});

