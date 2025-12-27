/**
 * Composant pour afficher le classement des livreurs
 */

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
// Icons will be displayed as emojis in React Native
import { config } from '../config';
import { logger } from '../utils/logger';

interface LeaderboardEntry {
  driverId: string;
  driverName: string;
  score: number;
  rank: number;
  deliveries: number;
  rating: number;
}

export function LeaderboardCard({ driverId, period = 'week' }: { driverId: string; period?: 'week' | 'month' | 'all' }) {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [myRank, setMyRank] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadLeaderboard = async () => {
      try {
        const response = await fetch(`${config.apiUrl}/api/gamification/leaderboard?period=${period}`);
        if (response.ok) {
          const data = await response.json();
          setLeaderboard(data.leaderboard || []);
          
          // Trouver mon rang
          const myEntry = data.leaderboard?.find((entry: LeaderboardEntry) => entry.driverId === driverId);
          if (myEntry) {
            setMyRank(myEntry.rank);
          }
        }
      } catch (error) {
        logger.error('Error loading leaderboard:', undefined, error);
      } finally {
        setLoading(false);
      }
    };

    loadLeaderboard();
  }, [driverId, period]);

  if (loading) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>Chargement du classement...</Text>
      </View>
    );
  }

  const topThree = leaderboard.slice(0, 3);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Classement {period === 'week' ? 'de la semaine' : period === 'month' ? 'du mois' : 'général'}</Text>
      
      {/* Top 3 */}
      {topThree.length > 0 && (
        <View style={styles.topThree}>
          {topThree.map((entry, index) => (
            <View key={entry.driverId} style={[styles.topEntry, index === 0 && styles.firstPlace]}>
              <Text style={styles.rankIcon}>
                {index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉'}
              </Text>
              <Text style={styles.driverName} numberOfLines={1}>
                {entry.driverName}
              </Text>
              <Text style={styles.score}>{Math.round(entry.score)} pts</Text>
            </View>
          ))}
        </View>
      )}

      {/* Mon rang */}
      {myRank && (
        <View style={styles.myRank}>
          <Text style={styles.myRankText}>Votre rang : #{myRank}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginBottom: 16,
  },
  loadingText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#111827',
  },
  topThree: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 12,
  },
  topEntry: {
    alignItems: 'center',
    flex: 1,
    padding: 8,
  },
  firstPlace: {
    backgroundColor: '#FEF3C7',
    borderRadius: 8,
  },
  rankIcon: {
    fontSize: 24,
    marginBottom: 4,
  },
  driverName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 4,
  },
  score: {
    fontSize: 10,
    color: '#6B7280',
  },
  myRank: {
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  myRankText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#3B82F6',
    textAlign: 'center',
  },
});

