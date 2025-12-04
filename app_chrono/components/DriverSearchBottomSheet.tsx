import React, { useEffect, useRef, useState } from 'react';
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
  phone?: string;
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
  const animationRef = useRef<Animated.CompositeAnimation | null>(null);
  const [avatarError, setAvatarError] = useState(false);
  const maxSearchTime = 25; // 25 secondes max

  // Animation fluide et continue de la barre de progression
  useEffect(() => {
    if (isSearching) {
      // Réinitialiser la valeur à 0
      progressAnim.setValue(0);
      
      // Arrêter toute animation en cours
      if (animationRef.current) {
        animationRef.current.stop();
      }
      
      // Démarrer une animation continue de 25 secondes
      animationRef.current = Animated.timing(progressAnim, {
        toValue: 1,
        duration: maxSearchTime * 1000, // 25000ms = 25 secondes
        useNativeDriver: false,
      });
      
      animationRef.current.start();
    } else {
      // Arrêter l'animation et réinitialiser
      if (animationRef.current) {
        animationRef.current.stop();
        animationRef.current = null;
      }
      progressAnim.setValue(0);
    }
    
    // Cleanup
    return () => {
      if (animationRef.current) {
        animationRef.current.stop();
      }
    };
  }, [isSearching, maxSearchTime, progressAnim]);

  // Réinitialiser l'erreur d'avatar quand le driver change
  useEffect(() => {
    if (driver?.id) {
      setAvatarError(false);
    }
  }, [driver?.id]);

  // Formater le temps de recherche (MM:SS)
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Si le livreur est accepté, afficher ses infos
  if (driver && !isSearching) {
    // Formater le nom complet (prénom + nom)
    // Priorité: first_name + last_name > name > email (sans fallback pour éviter d'afficher l'ID)
    let driverName = '';
    
    // Vérifier si first_name et last_name sont disponibles et ne sont pas des valeurs par défaut
    const isDefaultName = driver.first_name === 'Livreur' || 
                         (driver.first_name === 'Livreur' && driver.last_name && driver.last_name.length === 8);
    
    if (!isDefaultName && (driver.first_name || driver.last_name)) {
      const firstName = driver.first_name || '';
      const lastName = driver.last_name || '';
      driverName = `${firstName} ${lastName}`.trim();
    } else if (driver.name && driver.name !== 'Livreur' && !driver.name.match(/^[a-f0-9]{8}$/i)) {
      // Utiliser name seulement s'il n'est pas "Livreur" et ne ressemble pas à un ID
      driverName = driver.name;
    } else if (driver.email) {
      driverName = driver.email.split('@')[0]; // Prendre la partie avant @ de l'email
    }
    
    // Si on n'a toujours pas de nom valide, utiliser un texte générique (pas l'ID)
    if (!driverName || driverName === 'Livreur' || driverName.match(/^[a-f0-9]{8}$/i)) {
      driverName = 'Votre livreur';
    }
    
    // Debug en développement
    if (__DEV__) {
      console.log('📦 Driver info:', {
        id: driver.id,
        first_name: driver.first_name,
        last_name: driver.last_name,
        name: driver.name,
        formattedName: driverName,
      });
    }
    
    // Priorité: avatar_url > profile_image_url > avatar
    const driverAvatar = driver.avatar_url || driver.profile_image_url || driver.avatar;
    const driverRating = driver.rating || 0;
    const driverPhone = driver.phone;

    return (
      <View style={styles.container}>
        <View style={styles.driverHeader}>
          <Text style={styles.driverHeaderTitle}>Livreur assigné</Text>
        </View>
        
        <View style={styles.driverInfoContainer}>
          <View style={styles.driverAvatarContainer}>
            {driverAvatar && !avatarError ? (
              <Image 
                source={{ uri: driverAvatar }} 
                style={styles.driverAvatar}
                resizeMode="cover"
                onError={() => setAvatarError(true)}
              />
            ) : (
              <View style={styles.driverAvatarPlaceholder}>
                <Ionicons name="person" size={32} color="#8B5CF6" />
              </View>
            )}
            {driverRating > 0 && (
              <View style={styles.ratingBadge}>
                <Ionicons name="star" size={12} color="#FFFFFF" />
                <Text style={styles.ratingBadgeText}>{driverRating.toFixed(1)}</Text>
              </View>
            )}
          </View>
          
          <View style={styles.driverDetails}>
            <Text style={styles.driverName}>{driverName}</Text>
            
            {driverRating > 0 && (
              <View style={styles.ratingContainer}>
                {[...Array(5)].map((_, i) => (
                  <Ionicons
                    key={i}
                    name={i < Math.floor(driverRating) ? "star" : "star-outline"}
                    size={16}
                    color="#FBBF24"
                  />
                ))}
                <Text style={styles.ratingText}>{driverRating.toFixed(1)}</Text>
              </View>
            )}
            
            {driverPhone && (
              <View style={styles.phoneContainer}>
                <Ionicons name="call-outline" size={16} color="#6B7280" />
                <Text style={styles.phoneText}>{driverPhone}</Text>
              </View>
            )}
          </View>
        </View>

        <View style={styles.driverActions}>
          <TouchableOpacity 
            style={styles.actionButtonSecondary} 
            onPress={onDetails}
            activeOpacity={0.7}
          >
            <Ionicons name="information-circle-outline" size={20} color="#8B5CF6" />
            <Text style={styles.actionButtonSecondaryText}>Détails de la course</Text>
          </TouchableOpacity>
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
  driverHeader: {
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  driverHeaderTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  driverInfoContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 8,
    marginBottom: 20,
  },
  driverAvatarContainer: {
    marginRight: 16,
    position: 'relative',
  },
  driverAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#F3F4F6',
    borderWidth: 3,
    borderColor: '#8B5CF6',
  },
  driverAvatarPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#8B5CF6',
  },
  ratingBadge: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    backgroundColor: '#8B5CF6',
    borderRadius: 12,
    paddingHorizontal: 6,
    paddingVertical: 2,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  ratingBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
    marginLeft: 2,
  },
  driverDetails: {
    flex: 1,
    justifyContent: 'center',
  },
  driverName: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  ratingText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
    marginLeft: 6,
  },
  phoneContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  phoneText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6B7280',
    marginLeft: 6,
  },
  driverActions: {
    marginTop: 8,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  actionButtonSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3F4F6',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
  },
  actionButtonSecondaryText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#8B5CF6',
    marginLeft: 8,
  },
});

