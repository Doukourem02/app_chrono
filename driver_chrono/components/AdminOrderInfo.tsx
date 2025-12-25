import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface AdminOrderInfoProps {
  isPhoneOrder: boolean;
  isB2BOrder?: boolean;
  driverNotes?: string;
}

/**
 * Composant pour afficher les informations spéciales des commandes créées par l'administrateur
 * S'affiche uniquement pour les commandes téléphoniques/hors ligne ou B2B
 */
export const AdminOrderInfo: React.FC<AdminOrderInfoProps> = ({
  isPhoneOrder,
  isB2BOrder,
  driverNotes,
}) => {
  if (!isPhoneOrder && !isB2BOrder) {
    return null;
  }

  const isB2B = isB2BOrder === true;
  const badgeText = isB2B ? 'Commande B2B' : 'Commande téléphonique';
  const badgeColor = isB2B ? '#4338CA' : '#F59E0B';
  const containerBgColor = isB2B ? '#E0E7FF' : '#FEF3C7';
  const borderColor = isB2B ? '#4338CA' : '#F59E0B';

  return (
    <View style={[styles.container, { backgroundColor: containerBgColor, borderLeftColor: borderColor }]}>
      {/* Badge "Commande B2B" ou "Commande téléphonique" */}
      <View style={styles.badgeContainer}>
        <View style={[styles.badge, { borderColor: badgeColor }]}>
          <Ionicons name="phone-portrait" size={14} color={badgeColor} />
          <Text style={[styles.badgeText, { color: badgeColor }]}>{badgeText}</Text>
        </View>
      </View>

      {/* Notes pour le livreur */}
      {driverNotes && (
        <View style={styles.notesContainer}>
          <View style={styles.notesHeader}>
            <Ionicons name="information-circle" size={16} color="#7C3AED" />
            <Text style={styles.notesTitle}>Note pour le livreur</Text>
          </View>
          <Text style={styles.notesText}>{driverNotes}</Text>
        </View>
      )}

      {/* Message informatif */}
      <View style={styles.infoMessage}>
        <Ionicons name="location-outline" size={14} color="#6B7280" />
        <Text style={styles.infoText}>
          Les coordonnées GPS peuvent être approximatives. Appelez le client pour obtenir la position exacte.
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 12,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    borderRadius: 8,
    borderLeftWidth: 3,
  },
  badgeContainer: {
    marginBottom: 8,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  badgeText: {
    marginLeft: 6,
    fontSize: 12,
    fontWeight: '600',
  },
  notesContainer: {
    marginTop: 8,
    padding: 10,
    backgroundColor: '#FFFFFF',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  notesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  notesTitle: {
    marginLeft: 6,
    fontSize: 13,
    fontWeight: '600',
    color: '#7C3AED',
  },
  notesText: {
    fontSize: 13,
    color: '#374151',
    lineHeight: 18,
  },
  infoMessage: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 8,
    padding: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 6,
  },
  infoText: {
    flex: 1,
    marginLeft: 6,
    fontSize: 12,
    color: '#6B7280',
    lineHeight: 16,
  },
});

