import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface AdminOrderInfoProps {
  isPhoneOrder: boolean;
  /** Commande créée depuis l’admin (client hors-ligne, saisie opérateur) */
  placedByAdmin?: boolean;
  isB2BOrder?: boolean;
  /** Champ formulaire « Notes (optionnel) » (contexte course). */
  operatorCourseNotes?: string;
  /** Champ « Notes pour le livreur ». */
  driverNotes?: string;
  /** Commune / zone indiquée par l’opérateur quand le retrait n’a pas de GPS précis */
  approximatePickupZoneLabel?: string;
}

/** Notes générales de course saisies par l’opérateur (champ « Notes (optionnel) » du formulaire admin). */
export function OperatorCourseNotesBlock({ operatorCourseNotes }: { operatorCourseNotes?: string }) {
  const text = typeof operatorCourseNotes === 'string' ? operatorCourseNotes.trim() : '';
  if (!text) return null;
  return (
    <View style={[styles.notesContainer, styles.notesContainerAmber]}>
      <View style={styles.notesHeader}>
        <Ionicons name="reader-outline" size={16} color="#B45309" />
        <Text style={[styles.notesTitle, styles.notesTitleAmber]}>Notes commande (opérateur)</Text>
      </View>
      <Text style={styles.notesText}>{text}</Text>
    </View>
  );
}

/** Notes laissées par l’opérateur (admin) — réutilisable hors de la carte « commande admin » (ex. fiche commande en cours). */
export function OperatorDriverNotesBlock({ driverNotes }: { driverNotes?: string }) {
  const text = typeof driverNotes === 'string' ? driverNotes.trim() : '';
  if (!text) return null;
  return (
    <View style={styles.notesContainer}>
      <View style={styles.notesHeader}>
        <Ionicons name="information-circle" size={16} color="#7C3AED" />
        <Text style={styles.notesTitle}>Note pour le livreur</Text>
      </View>
      <Text style={styles.notesText}>{text}</Text>
    </View>
  );
}

/**
 * Commandes passées par l’admin / hors-ligne / B2B — le livreur doit les distinguer des commandes app client.
 */
export const AdminOrderInfo: React.FC<AdminOrderInfoProps> = ({
  isPhoneOrder,
  placedByAdmin,
  isB2BOrder,
  operatorCourseNotes,
  driverNotes,
  approximatePickupZoneLabel,
}) => {
  const show = isB2BOrder || placedByAdmin || isPhoneOrder;
  if (!show) {
    return null;
  }

  const isB2B = isB2BOrder === true;
  const isOperator = !isB2B && !!placedByAdmin;
  const badgeText = isB2B
    ? 'Commande B2B'
    : isOperator
      ? 'Hors-ligne · Opérateur'
      : 'Commande téléphonique';
  const badgeColor = isB2B ? '#4338CA' : '#EA580C';
  const containerBgColor = isB2B ? '#E0E7FF' : '#FFEDD5';
  const borderColor = isB2B ? '#4338CA' : '#EA580C';
  const badgeIcon = isB2B ? ('briefcase-outline' as const) : isOperator ? ('headset-outline' as const) : ('call-outline' as const);

  return (
    <View style={[styles.container, { backgroundColor: containerBgColor, borderLeftColor: borderColor }]}>
      <View style={styles.badgeContainer}>
        <View style={[styles.badge, { borderColor: badgeColor }]}>
          <Ionicons name={badgeIcon} size={14} color={badgeColor} />
          <Text style={[styles.badgeText, { color: badgeColor }]}>{badgeText}</Text>
        </View>
      </View>

      <OperatorCourseNotesBlock operatorCourseNotes={operatorCourseNotes} />
      <OperatorDriverNotesBlock driverNotes={driverNotes} />

      {approximatePickupZoneLabel ? (
        <View style={styles.zoneHint}>
          <Ionicons name="map-outline" size={14} color="#B45309" />
          <Text style={styles.zoneHintText}>
            Zone de retrait indiquée par l’opérateur : {approximatePickupZoneLabel} (point carte approximatif — confirmez avec le client).
          </Text>
        </View>
      ) : null}

      {/* Message informatif */}
      <View style={styles.infoMessage}>
        <Ionicons name="location-outline" size={14} color="#6B7280" />
        <Text style={styles.infoText}>
          {isB2B
            ? 'Commande B2B / planning. Suivez l’adresse et les notes indiquées par l’opérateur.'
            : isOperator
              ? 'Saisie par un administrateur pour un client (sans appli ou sans connexion). Vérifiez les points sur la carte et appelez le client si besoin.'
              : 'Les coordonnées GPS peuvent être approximatives. Appelez le client pour obtenir la position exacte.'}
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
  zoneHint: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginTop: 8,
    padding: 10,
    backgroundColor: '#FFFBEB',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  zoneHintText: {
    flex: 1,
    fontSize: 12,
    color: '#92400E',
    lineHeight: 18,
  },
  notesText: {
    fontSize: 13,
    color: '#374151',
    lineHeight: 18,
  },
  notesContainerAmber: {
    borderColor: '#FDE68A',
    backgroundColor: '#FFFBEB',
  },
  notesTitleAmber: {
    color: '#92400E',
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

