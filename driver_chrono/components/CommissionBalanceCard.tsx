import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Dimensions } from 'react-native';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import { useCommissionStore } from '../store/useCommissionStore';
import { useDriverStore } from '../store/useDriverStore';
import { RechargeModal } from './RechargeModal';
import { logger } from '../utils/logger';

const { width } = Dimensions.get('window');

interface CommissionBalanceCardProps {
  isOnline?: boolean;
  onPress?: () => void;
}

export const CommissionBalanceCard: React.FC<CommissionBalanceCardProps> = ({ 
  isOnline = false,
  onPress 
}) => {
  const { account, isLoading, alerts, error, fetchBalance } = useCommissionStore();
  const { profile } = useDriverStore();
  const [showRechargeModal, setShowRechargeModal] = useState(false);

  // Charger le solde au montage et quand le profil change
  useEffect(() => {
    if (profile?.driver_type === 'partner') {
      fetchBalance().catch((error) => {
        // Erreur silencieuse si l'API n'est pas encore disponible
        if (__DEV__) {
          logger.warn('Commission API non disponible:', undefined, error);
        }
      });
    }
  }, [profile?.driver_type, fetchBalance]);

  const formatCurrency = (amount: number) => {
    const formatted = new Intl.NumberFormat('fr-FR', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount ?? 0);

    return `${formatted.replace(/\u00A0/g, ' ')} FCFA`;
  };

  const getBalanceColor = () => {
    if (alerts.suspended) return '#EF4444'; // Rouge si suspendu
    if (alerts.veryLowBalance) return '#F59E0B'; // Orange si très faible
    if (alerts.lowBalance) return '#FBBF24'; // Jaune si faible
    return '#666'; // Gris normal
  };

  const getAlertIcon = () => {
    if (alerts.suspended) return 'alert-circle';
    if (alerts.veryLowBalance || alerts.lowBalance) return 'warning';
    return null;
  };

  const balance = account?.balance ?? 0;
  const balanceColor = getBalanceColor();
  const alertIcon = getAlertIcon();

  const handleCardPress = () => {
    if (onPress) {
      onPress();
    } else {
      setShowRechargeModal(true);
    }
  };

  const CardContent = (
    <View style={[styles.card, !isOnline && styles.cardDisabled]}>
      <MaterialCommunityIcons 
        name="wallet" 
        size={24} 
        color={isOnline ? "#8B5CF6" : "#9CA3AF"} 
      />
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={[styles.cardTitle, !isOnline && styles.textDisabled]}>
            Solde Commission
          </Text>
          {alertIcon && (
            <Ionicons 
              name={alertIcon as any} 
              size={16} 
              color={balanceColor} 
              style={styles.alertIcon}
            />
          )}
        </View>
        
        {isLoading ? (
          <ActivityIndicator size="small" color="#8B5CF6" />
        ) : error && error.includes('pas encore disponible') ? (
          <Text style={[styles.cardSubtitle, styles.unavailableText]}>
            Bientôt disponible
          </Text>
        ) : (
          <Text 
            style={[
              styles.cardSubtitle, 
              !isOnline && styles.textDisabled,
              { color: balanceColor }
            ]}
          >
            {formatCurrency(balance)}
          </Text>
        )}
        
        {alerts.suspended && (
          <Text style={styles.suspendedText}>
            Compte suspendu
          </Text>
        )}
        {alerts.veryLowBalance && !alerts.suspended && (
          <Text style={styles.alertText}>
            Solde très faible
          </Text>
        )}
        {alerts.lowBalance && !alerts.veryLowBalance && !alerts.suspended && (
          <Text style={styles.alertText}>
            Solde faible
          </Text>
        )}
      </View>
    </View>
  );

  return (
    <>
      <TouchableOpacity 
        onPress={handleCardPress}
        activeOpacity={0.7}
        disabled={!isOnline}
      >
        {CardContent}
      </TouchableOpacity>
      
      <RechargeModal
        visible={showRechargeModal}
        onClose={() => setShowRechargeModal(false)}
      />
    </>
  );
};

const styles = StyleSheet.create({
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
  content: {
    marginLeft: 8,
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    flex: 1,
  },
  alertIcon: {
    marginLeft: 4,
  },
  cardSubtitle: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  textDisabled: {
    color: '#9CA3AF',
  },
  suspendedText: {
    fontSize: 10,
    color: '#EF4444',
    marginTop: 2,
    fontWeight: '500',
  },
  alertText: {
    fontSize: 10,
    color: '#F59E0B',
    marginTop: 2,
    fontWeight: '500',
  },
  unavailableText: {
    fontSize: 12,
    color: '#9CA3AF',
    fontStyle: 'italic',
  },
});

