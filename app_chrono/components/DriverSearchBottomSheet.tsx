import React, { useEffect, useRef } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Animated, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { formatUserName } from '../utils/formatName';

interface DriverInfo {
  id?: string;
  name?: string;
  first_name?: string;
  last_name?: string;
  avatar?: string;
  avatar_url?: string;
  profile_image_url?: string;
  rating?: number;
}

interface DriverSearchBottomSheetProps {
  isSearching: boolean;
  searchSeconds: number;
  driver?: DriverInfo | null;
  onCancel: () => void;
  onDetails: () => void;
  onBack?: () => void;
}

export const DriverSearchBottomSheet: React.FC<DriverSearchBottomSheetProps> = ({
  isSearching,
  searchSeconds,
  driver,
  onCancel,
  onDetails,
  onBack,
}) => {
  const progressAnim = useRef(new Animated.Value(0)).current;
  const maxSearchTime = 25; // 25 secondes max

  // Animation de la barre de progression
  useEffect(() => {
    if (isSearching) {
      const progress = Math.min(searchSeconds / maxSearchTime, 1);
      Animated.timing(progressAnim, {
        toValue: progress,
        duration: 300,
        useNativeDriver: false,
      }).start();
    } else {
      progressAnim.setValue(0);
    }
  }, [isSearching, searchSeconds, maxSearchTime, progressAnim]);

  // Formater le temps de recherche (MM:SS)
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Si le livreur est accepté, afficher ses infos
  if (driver && !isSearching) {
    // Formater le nom complet (prénom + nom)
    const driverName = formatUserName(driver, 'Livreur');
    // Priorité: avatar_url > profile_image_url > avatar
    const driverAvatar = driver.avatar_url || driver.profile_image_url || driver.avatar;
    const driverRating = driver.rating || 0;

    return (
      <View style={styles.container}>
        <View style={styles.driverInfoContainer}>
          <View style={styles.driverAvatarContainer}>
            {driverAvatar ? (
              <Image source={{ uri: driverAvatar }} style={styles.driverAvatar} />
            ) : (
              <View style={styles.driverAvatarPlaceholder}>
                <Ionicons name="person" size={24} color="#8B5CF6" />
              </View>
            )}
          </View>
          <View style={styles.driverDetails}>
            <Text style={styles.driverName}>{driverName}</Text>
            {driverRating > 0 && (
              <View style={styles.ratingContainer}>
                <Ionicons name="star" size={14} color="#FBBF24" />
                <Text style={styles.ratingText}>{driverRating.toFixed(1)}</Text>
              </View>
            )}
          </View>
        </View>
      </View>
    );
  }

  // État de recherche
  if (!isSearching) {
    return null;
  }

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.titleContainer}>
          <Text style={styles.title}>Recherche d'un livreur</Text>
          <Text style={styles.timer}>{formatTime(searchSeconds)}</Text>
        </View>
        <View style={styles.progressBarWrapper}>
          <Animated.View style={[styles.progressBarContainer, { width: progressWidth }]}>
            <View style={styles.progressBar} />
          </Animated.View>
        </View>
      </View>

      <View style={styles.actionsContainer}>
        <TouchableOpacity style={styles.actionButton} onPress={onCancel} activeOpacity={0.7}>
          <View style={[styles.actionIconContainer, styles.cancelIconContainer]}>
            <Ionicons name="close" size={24} color="#6B7280" />
          </View>
          <Text style={styles.actionLabel}>Annuler</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionButton} onPress={onDetails} activeOpacity={0.7}>
          <View style={[styles.actionIconContainer, styles.detailsIconContainer]}>
            <Ionicons name="menu" size={24} color="#6B7280" />
          </View>
          <Text style={styles.actionLabel}>Détails</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 20,
    paddingBottom: 40,
    paddingHorizontal: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 15,
    zIndex: 1000,
    minHeight: 200,
  },
  header: {
    marginBottom: 24,
  },
  titleContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  timer: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6B7280',
  },
  progressBarWrapper: {
    width: '100%',
    height: 4,
    backgroundColor: '#F3F4F6',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBarContainer: {
    height: '100%',
    backgroundColor: '#8B5CF6', // Violet
    borderRadius: 2,
  },
  actionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  actionButton: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  cancelIconContainer: {
    backgroundColor: '#F3F4F6',
  },
  detailsIconContainer: {
    backgroundColor: '#F3F4F6',
  },
  actionLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6B7280',
  },
  driverInfoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  driverAvatarContainer: {
    marginRight: 12,
  },
  driverAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#F3F4F6',
  },
  driverAvatarPlaceholder: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  driverDetails: {
    flex: 1,
  },
  driverName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ratingText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
    marginLeft: 4,
  },
});

