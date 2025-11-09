/**
 * Composant pour afficher le calcul de prix d'une livraison
 */

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { paymentApi } from '../services/paymentApi';

interface PriceCalculationCardProps {
  distance: number;
  deliveryMethod: 'moto' | 'vehicule' | 'cargo';
  isUrgent?: boolean;
  onPriceCalculated?: (price: number) => void;
}

export default function PriceCalculationCard({
  distance,
  deliveryMethod,
  isUrgent = false,
  onPriceCalculated,
}: PriceCalculationCardProps) {
  const [calculation, setCalculation] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const calculatePrice = async () => {
      if (distance <= 0) {
        setCalculation(null);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const result = await paymentApi.calculatePrice({
          distance,
          deliveryMethod,
          isUrgent,
        });

        if (result.success && result.data) {
          setCalculation(result.data);
          onPriceCalculated?.(result.data.totalPrice);
        } else {
          setError(result.message || 'Erreur lors du calcul du prix');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erreur inconnue');
      } finally {
        setIsLoading(false);
      }
    };

    calculatePrice();
  }, [distance, deliveryMethod, isUrgent, onPriceCalculated]);

  if (isLoading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="small" color="#007AFF" />
        <Text style={styles.loadingText}>Calcul du prix...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <Ionicons name="alert-circle" size={24} color="#FF3B30" />
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  if (!calculation) {
    return null;
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Ionicons name="calculator" size={24} color="#007AFF" />
        <Text style={styles.title}>Détail du prix</Text>
      </View>

      <View style={styles.breakdown}>
        <View style={styles.row}>
          <Text style={styles.label}>Distance</Text>
          <Text style={styles.value}>{calculation.breakdown.distance} km</Text>
        </View>

        <View style={styles.row}>
          <Text style={styles.label}>Tarif par km</Text>
          <Text style={styles.value}>{calculation.pricePerKm.toLocaleString()} XOF/km</Text>
        </View>

        <View style={styles.row}>
          <Text style={styles.label}>Prix de base</Text>
          <Text style={styles.value}>{calculation.basePrice.toLocaleString()} XOF</Text>
        </View>

        {calculation.urgencyFee > 0 && (
          <View style={styles.row}>
            <Text style={styles.label}>Frais d'urgence</Text>
            <Text style={[styles.value, styles.urgentValue]}>
              +{calculation.urgencyFee.toLocaleString()} XOF
            </Text>
          </View>
        )}

        <View style={[styles.row, styles.totalRow]}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.totalValue}>
            {calculation.totalPrice.toLocaleString()} XOF
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    marginVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    marginLeft: 8,
    color: '#000',
  },
  loadingText: {
    marginTop: 8,
    fontSize: 14,
    color: '#666',
  },
  errorText: {
    marginTop: 8,
    fontSize: 14,
    color: '#FF3B30',
  },
  breakdown: {
    gap: 12,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  label: {
    fontSize: 14,
    color: '#666',
  },
  value: {
    fontSize: 14,
    fontWeight: '500',
    color: '#000',
  },
  urgentValue: {
    color: '#FF3B30',
  },
  totalRow: {
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },
  totalValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#007AFF',
  },
});

