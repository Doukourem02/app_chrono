
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { usePaymentStore } from '../store/usePaymentStore';
import { PaymentMethodType } from '../services/paymentApi';

interface PaymentMethodSelectorProps {
  onSelect?: (methodType: PaymentMethodType) => void;
  selectedMethod?: PaymentMethodType | null;
  showAddNew?: boolean;
  onAddNew?: () => void;
}

const PAYMENT_METHODS: {
  type: PaymentMethodType;
  name: string;
  icon?: keyof typeof Ionicons.glyphMap;
  image?: any; 
  color: string;
  useImage?: boolean; 
}[] = [
  { 
    type: 'orange_money', 
    name: 'Orange Money', 
    icon: 'phone-portrait', 
    image: require('../assets/images/images.png'), 
    color: '#FF6600',
    useImage: true 
  },
  { 
    type: 'wave', 
    name: 'Wave', 
    icon: 'wallet', 
    image: require('../assets/images/WAVE-recrute-pour-ce-poste-12-Decembre-2024.png'),
    color: '#00A8E8',
    useImage: true 
  },
  { type: 'cash', name: 'Espèces', icon: 'cash', color: '#28A745', useImage: false },
  { type: 'deferred', name: 'Paiement différé', icon: 'time', color: '#FFC107', useImage: false },
];

export default function PaymentMethodSelector({
  onSelect,
  selectedMethod,
  showAddNew = true,
  onAddNew,
}: PaymentMethodSelectorProps) {
  const { paymentMethods, isLoading } = usePaymentStore();

  const handleSelect = (methodType: PaymentMethodType) => {
    const method = paymentMethods.find((m) => m.method_type === methodType);
    if (method) {
      usePaymentStore.getState().selectPaymentMethod(method);
    }
    onSelect?.(methodType);
  };

  if (isLoading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="small" color="#007AFF" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Méthode de paiement</Text>
      
      <View style={styles.methodsContainer}>
        {PAYMENT_METHODS.map((method) => {
          const isSelected = selectedMethod === method.type;
          const hasMethod = paymentMethods.some((m) => m.method_type === method.type);

          return (
            <TouchableOpacity
              key={method.type}
              style={[styles.methodCard, isSelected && styles.methodCardSelected]}
              onPress={() => handleSelect(method.type)}
              disabled={!hasMethod && method.type !== 'cash' && method.type !== 'deferred'}
            >
              <View style={[styles.iconContainer, { backgroundColor: `${method.color}20` }]}>
                {method.useImage && method.image ? (
                  <Image 
                    source={method.image} 
                    style={styles.methodImage}
                    resizeMode="contain"
                  />
                ) : method.icon ? (
                  <Ionicons name={method.icon} size={24} color={method.color} />
                ) : null}
              </View>
              <Text style={styles.methodName}>{method.name}</Text>
              {isSelected && (
                <View style={styles.checkmark}>
                  <Ionicons name="checkmark-circle" size={20} color={method.color} />
                </View>
              )}
              {!hasMethod && method.type !== 'cash' && method.type !== 'deferred' && (
                <Text style={styles.notAvailable}>Non configuré</Text>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {showAddNew && onAddNew && (
        <TouchableOpacity style={styles.addButton} onPress={onAddNew}>
          <Ionicons name="add-circle-outline" size={20} color="#007AFF" />
          <Text style={styles.addButtonText}>Ajouter une méthode de paiement</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
    color: '#000',
  },
  methodsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  methodCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
    position: 'relative',
  },
  methodCardSelected: {
    borderColor: '#007AFF',
    backgroundColor: '#E3F2FD',
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  methodImage: {
    width: 32,
    height: 32,
  },
  methodName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#000',
    textAlign: 'center',
  },
  checkmark: {
    position: 'absolute',
    top: 8,
    right: 8,
  },
  notAvailable: {
    fontSize: 10,
    color: '#999',
    marginTop: 4,
    textAlign: 'center',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    padding: 12,
    backgroundColor: '#F0F0F0',
    borderRadius: 8,
  },
  addButtonText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '500',
  },
});

