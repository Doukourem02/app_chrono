
import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { usePaymentStore } from '../store/usePaymentStore';
import { PaymentMethodType, paymentApi, DeferredPaymentInfo } from '../services/paymentApi';
import { logger } from '../utils/logger';

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
  const [deferredInfo, setDeferredInfo] = useState<DeferredPaymentInfo | null>(null);
  const [loadingDeferredInfo, setLoadingDeferredInfo] = useState(false);

  useEffect(() => {
    // Charger les limites de paiement différé
    const loadDeferredInfo = async () => {
      setLoadingDeferredInfo(true);
      try {
        const result = await paymentApi.getDeferredPaymentLimits();
        if (result.success && result.data) {
          setDeferredInfo(result.data);
        }
      } catch (error) {
        logger.error('Erreur chargement limites paiement différé:', undefined, error);
      } finally {
        setLoadingDeferredInfo(false);
      }
    };

    loadDeferredInfo();
  }, []);

  const handleSelect = (methodType: PaymentMethodType) => {
    // Si c'est un paiement différé et qu'il n'est pas disponible, ne pas permettre la sélection
    if (methodType === 'deferred' && deferredInfo && !deferredInfo.canUse) {
      return;
    }

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
          const isDeferred = method.type === 'deferred';
          const isDeferredDisabled = !!(isDeferred && deferredInfo && !deferredInfo.canUse);
          const isDisabled = (!hasMethod && method.type !== 'cash' && method.type !== 'deferred') || isDeferredDisabled;

          return (
            <View key={method.type} style={styles.methodCardWrapper}>
              <TouchableOpacity
                style={[
                  styles.methodCard,
                  isSelected && styles.methodCardSelected,
                  isDisabled && styles.methodCardDisabled,
                ]}
                onPress={() => handleSelect(method.type)}
                disabled={isDisabled}
              >
                <View style={[styles.iconContainer, { backgroundColor: `${method.color}20` }]}>
                  {method.useImage && method.image ? (
                    <Image 
                      source={method.image} 
                      style={styles.methodImage}
                      resizeMode="contain"
                    />
                  ) : method.icon ? (
                    <Ionicons name={method.icon} size={24} color={isDisabled ? '#999' : method.color} />
                  ) : null}
                </View>
                <Text style={[styles.methodName, isDisabled && styles.methodNameDisabled]}>
                  {method.name}
                </Text>
                {isSelected && !isDisabled && (
                  <View style={styles.checkmark}>
                    <Ionicons name="checkmark-circle" size={20} color={method.color} />
                  </View>
                )}
                {!hasMethod && method.type !== 'cash' && method.type !== 'deferred' && (
                  <Text style={styles.notAvailable}>Non configuré</Text>
                )}
                {isDeferredDisabled && (
                  <View style={styles.disabledBadge}>
                    <Ionicons name="lock-closed" size={14} color="#EF4444" />
                    <Text style={styles.disabledBadgeText}>Indisponible</Text>
                  </View>
                )}
              </TouchableOpacity>
              
              {/* Afficher les informations de crédit pour le paiement différé */}
              {isDeferred && deferredInfo && !loadingDeferredInfo && (
                <View style={styles.deferredInfoContainer}>
                  {deferredInfo.canUse ? (
                    <>
                      <Text style={styles.deferredInfoText}>
                        Crédit mensuel: {deferredInfo.monthlyRemaining.toLocaleString()} / {deferredInfo.monthlyLimit.toLocaleString()} FCFA
                      </Text>
                      <Text style={styles.deferredInfoSubtext}>
                        Utilisations: {deferredInfo.monthlyUsages} / {deferredInfo.maxUsagesPerMonth}
                      </Text>
                      {deferredInfo.cooldownDaysRemaining && deferredInfo.cooldownDaysRemaining > 0 && (
                        <Text style={styles.deferredInfoWarning}>
                          Disponible dans {deferredInfo.cooldownDaysRemaining} jour(s)
                        </Text>
                      )}
                    </>
                  ) : (
                    <Text style={styles.deferredInfoError}>
                      {deferredInfo.reason || 'Paiement différé non disponible'}
                    </Text>
                  )}
                </View>
              )}
              {isDeferred && loadingDeferredInfo && (
                <View style={styles.deferredInfoContainer}>
                  <ActivityIndicator size="small" color="#FFC107" />
                </View>
              )}
            </View>
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
  methodCardWrapper: {
    flex: 1,
    minWidth: '45%',
  },
  methodCard: {
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
  methodCardDisabled: {
    opacity: 0.6,
    backgroundColor: '#F0F0F0',
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
  methodNameDisabled: {
    color: '#999',
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
  disabledBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 4,
  },
  disabledBadgeText: {
    fontSize: 10,
    color: '#EF4444',
    fontWeight: '600',
  },
  deferredInfoContainer: {
    marginTop: 8,
    padding: 8,
    backgroundColor: '#FFF9E6',
    borderRadius: 8,
    width: '100%',
  },
  deferredInfoText: {
    fontSize: 11,
    color: '#856404',
    fontWeight: '500',
    textAlign: 'center',
  },
  deferredInfoSubtext: {
    fontSize: 10,
    color: '#856404',
    textAlign: 'center',
    marginTop: 2,
  },
  deferredInfoWarning: {
    fontSize: 10,
    color: '#FF9800',
    textAlign: 'center',
    marginTop: 4,
    fontWeight: '600',
  },
  deferredInfoError: {
    fontSize: 10,
    color: '#EF4444',
    textAlign: 'center',
    fontWeight: '600',
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

