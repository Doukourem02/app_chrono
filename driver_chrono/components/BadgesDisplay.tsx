/**
 * Composant pour afficher les badges d'un livreur
 */

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { config } from '../config';
import { logger } from '../utils/logger';

interface Badge {
  badge_id: string;
  unlocked_at: string;
}

export function BadgesDisplay({ driverId }: { driverId: string }) {
  const [badges, setBadges] = useState<Badge[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadBadges = async () => {
      try {
        const response = await fetch(`${config.apiUrl}/api/gamification/badges/${driverId}`);
        if (response.ok) {
          const data = await response.json();
          setBadges(data.badges || []);
        }
      } catch (error) {
        logger.error('Error loading badges:', undefined, error);
      } finally {
        setLoading(false);
      }
    };

    if (driverId) {
      loadBadges();
    }
  }, [driverId]);

  const badgeIcons: Record<string, string> = {
    first_delivery: '🎯',
    '10_deliveries': '⭐',
    '100_deliveries': '🏆',
    monthly_champion: '👑',
    '5_stars': '🌟',
  };

  const badgeNames: Record<string, string> = {
    first_delivery: 'Première livraison',
    '10_deliveries': 'Débutant confirmé',
    '100_deliveries': 'Expert',
    monthly_champion: 'Livreur du mois',
    '5_stars': 'Excellence',
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>Chargement des badges...</Text>
      </View>
    );
  }

  if (badges.length === 0) {
    return (
      <View style={styles.container}>
        <Text style={styles.emptyText}>Aucun badge débloqué</Text>
      </View>
    );
  }

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.container}>
      {badges.map((badge) => (
        <View key={badge.badge_id} style={styles.badge}>
          <Text style={styles.badgeIcon}>{badgeIcons[badge.badge_id] || '🏅'}</Text>
          <Text style={styles.badgeName}>{badgeNames[badge.badge_id] || badge.badge_id}</Text>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 12,
  },
  loadingText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
  },
  badge: {
    alignItems: 'center',
    marginRight: 16,
    padding: 12,
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    minWidth: 80,
  },
  badgeIcon: {
    fontSize: 32,
    marginBottom: 4,
  },
  badgeName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
    textAlign: 'center',
  },
});

