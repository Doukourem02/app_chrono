import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { paymentApi } from '../../services/paymentApi';

interface PaymentMethod {
  id: string;
  method_type: 'orange_money' | 'wave' | 'cash' | 'deferred';
  provider_account?: string;
  provider_name?: string;
  is_default: boolean;
}

export default function PaymentMethodsPage() {
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadPaymentMethods();
  }, []);

  const loadPaymentMethods = async () => {
    setIsLoading(true);
    try {
      const result = await paymentApi.getPaymentMethods();
      if (result.success && result.data) {
        setPaymentMethods(result.data);
      }
    } catch {
      Alert.alert('Erreur', 'Impossible de charger les méthodes de paiement');
    } finally {
      setIsLoading(false);
    }
  };

  const getMethodIcon = (type: string) => {
    switch (type) {
      case 'orange_money':
        return 'phone-portrait';
      case 'wave':
        return 'wallet';
      case 'cash':
        return 'cash';
      case 'deferred':
        return 'time';
      default:
        return 'card';
    }
  };

  const getMethodLabel = (type: string) => {
    switch (type) {
      case 'orange_money':
        return 'Orange Money';
      case 'wave':
        return 'Wave';
      case 'cash':
        return 'Espèces';
      case 'deferred':
        return 'Paiement différé';
      default:
        return type;
    }
  };

  const handleSetDefault = async (methodId: string) => {
    try {
      // TODO: Mettre à jour la méthode par défaut via l'API
      setPaymentMethods(methods =>
        methods.map(m => ({ ...m, is_default: m.id === methodId }))
      );
      Alert.alert('Succès', 'Méthode de paiement par défaut mise à jour');
    } catch {
      Alert.alert('Erreur', 'Impossible de mettre à jour la méthode');
    }
  };

  const handleDelete = (methodId: string) => {
    Alert.alert(
      'Supprimer la méthode',
      'Êtes-vous sûr de vouloir supprimer cette méthode de paiement ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            try {
              // TODO: Supprimer via l'API
              setPaymentMethods(methods => methods.filter(m => m.id !== methodId));
              Alert.alert('Succès', 'Méthode supprimée');
            } catch {
              Alert.alert('Erreur', 'Impossible de supprimer la méthode');
            }
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#1F2937" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Moyens de paiement</Text>
        <TouchableOpacity
          onPress={() => router.push('/profile/add-payment-method' as any)}
          style={styles.addButton}
        >
          <Ionicons name="add" size={24} color="#8B5CF6" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#8B5CF6" />
          </View>
        ) : paymentMethods.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="card-outline" size={64} color="#9CA3AF" />
            <Text style={styles.emptyText}>Aucune méthode de paiement</Text>
            <TouchableOpacity
              style={styles.addFirstButton}
              onPress={() => router.push('/profile/add-payment-method' as any)}
            >
              <Text style={styles.addFirstButtonText}>Ajouter une méthode</Text>
            </TouchableOpacity>
          </View>
        ) : (
          paymentMethods.map((method) => (
            <View key={method.id} style={styles.methodCard}>
              <View style={styles.methodHeader}>
                <View style={styles.methodInfo}>
                  <View style={styles.methodIconContainer}>
                    <Ionicons
                      name={getMethodIcon(method.method_type) as any}
                      size={24}
                      color="#8B5CF6"
                    />
                  </View>
                  <View style={styles.methodDetails}>
                    <Text style={styles.methodLabel}>
                      {getMethodLabel(method.method_type)}
                    </Text>
                    {method.provider_account && (
                      <Text style={styles.methodAccount}>{method.provider_account}</Text>
                    )}
                    {method.is_default && (
                      <View style={styles.defaultBadge}>
                        <Text style={styles.defaultBadgeText}>Par défaut</Text>
                      </View>
                    )}
                  </View>
                </View>
                <TouchableOpacity
                  onPress={() => handleDelete(method.id)}
                  style={styles.deleteButton}
                >
                  <Ionicons name="trash-outline" size={20} color="#EF4444" />
                </TouchableOpacity>
              </View>
              {!method.is_default && (
                <TouchableOpacity
                  style={styles.setDefaultButton}
                  onPress={() => handleSetDefault(method.id)}
                >
                  <Text style={styles.setDefaultButtonText}>Définir par défaut</Text>
                </TouchableOpacity>
              )}
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
  addButton: {
    padding: 8,
  },
  content: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: 16,
    color: '#6B7280',
    marginTop: 16,
    marginBottom: 24,
  },
  addFirstButton: {
    backgroundColor: '#8B5CF6',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  addFirstButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  methodCard: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 20,
    marginTop: 16,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  methodHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  methodInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  methodIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F3F0FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  methodDetails: {
    flex: 1,
  },
  methodLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 4,
  },
  methodAccount: {
    fontSize: 14,
    color: '#6B7280',
  },
  defaultBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#10B981',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 4,
  },
  defaultBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '600',
  },
  deleteButton: {
    padding: 4,
  },
  setDefaultButton: {
    alignSelf: 'flex-start',
    marginTop: 12,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    backgroundColor: '#F3F0FF',
  },
  setDefaultButtonText: {
    color: '#8B5CF6',
    fontSize: 12,
    fontWeight: '600',
  },
});

