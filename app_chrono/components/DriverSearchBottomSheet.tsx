import React, { useEffect, useRef, useState } from 'react';
import {StyleSheet,View,Text,TouchableOpacity,Animated,Image,Linking,Dimensions,ScrollView,Platform,} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { logger } from '../utils/logger';
import { clientStatusLabel } from '../utils/orderProductRules';

const { height: SCREEN_H } = Dimensions.get('window');

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
  email?: string;
  vehicle_plate?: string;
  vehicle_type?: string;
}

interface OrderInfo {
  id?: string;
  status?: string;
  pickup?: { address?: string };
  dropoff?: { address?: string };
  deliveryMethod?: 'moto' | 'vehicule' | 'cargo';
  price?: number;
}

interface DriverSearchBottomSheetProps {
  isSearching: boolean;
  searchSeconds: number;
  driver?: DriverInfo | null;
  order?: OrderInfo | null;
  onCancel: () => void;
  onDetails: () => void;
  onBack?: () => void;
}

const STATUS_LABELS: Record<string, string> = {
  accepted: clientStatusLabel('accepted'),
  enroute: clientStatusLabel('enroute'),
  in_progress: clientStatusLabel('in_progress'),
  picked_up: clientStatusLabel('picked_up'),
  delivering: clientStatusLabel('delivering'),
  completed: clientStatusLabel('completed'),
};

const DELIVERY_METHOD_LABELS: Record<string, string> = {
  moto: 'Moto',
  vehicule: 'Véhicule',
  cargo: 'Cargo',
};

export const DriverSearchBottomSheet: React.FC<DriverSearchBottomSheetProps> = ({
  isSearching,
  searchSeconds,
  driver,
  order,
  onCancel,
  onDetails,
  onBack,
}) => {
  const progressAnim = useRef(new Animated.Value(0)).current;
  const animationRef = useRef<Animated.CompositeAnimation | null>(null);
  const [avatarError, setAvatarError] = useState(false);
  /** Durée d’un cycle de barre (alignée sur la fenêtre d’acceptation livreur côté serveur / driver_chrono). */
  const progressCycleSeconds = 30;

  // Barre en boucle tant que la recherche est active (pas de « fin » artificielle toutes les 25 s)
  useEffect(() => {
    if (isSearching) {
      progressAnim.setValue(0);

      if (animationRef.current) {
        animationRef.current.stop();
      }

      animationRef.current = Animated.loop(
        Animated.timing(progressAnim, {
          toValue: 1,
          duration: progressCycleSeconds * 1000,
          useNativeDriver: false,
        })
      );

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
  }, [isSearching, progressCycleSeconds, progressAnim]);

  // Réinitialiser l'erreur d'avatar quand le driver change
  useEffect(() => {
    if (driver?.id) {
      setAvatarError(false);
    }
  }, [driver?.id]);

  const insets = useSafeAreaInsets();

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
      logger.debug('📦 Driver info:', undefined, {
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

    const statusLabel = order?.status ? STATUS_LABELS[order.status] || order.status : 'Prise en charge';
    const pickupAddr = order?.pickup?.address;
    const dropoffAddr = order?.dropoff?.address;
    const deliveryMethod = order?.deliveryMethod ? DELIVERY_METHOD_LABELS[order.deliveryMethod] : null;
    const orderIdShort = order?.id ? `#${order.id.slice(0, 8).toUpperCase()}` : null;
    const priceFormatted = order?.price != null ? `${order.price.toLocaleString('fr-FR')} FCFA` : null;
    const vehiclePlate = driver.vehicle_plate?.trim();
    const vehicleTypeLabel = driver.vehicle_type
      ? DELIVERY_METHOD_LABELS[driver.vehicle_type as keyof typeof DELIVERY_METHOD_LABELS] || driver.vehicle_type
      : null;

    return (
      <View
        style={[
          styles.assignedFloatOuter,
          { paddingBottom: Math.max(insets.bottom, 10) },
        ]}
        pointerEvents="box-none"
      >
        <ScrollView
          style={styles.assignedScroll}
          contentContainerStyle={styles.assignedScrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.assignedCard}>
        <View style={styles.driverHeader}>
          <Text style={styles.driverHeaderTitle}>Livreur confirmé</Text>
          {orderIdShort && (
            <Text style={styles.orderIdBadge}>{orderIdShort}</Text>
          )}
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
            {driverRating > 0 && typeof driverRating === 'number' && (
              <View style={styles.ratingBadge}>
                <Ionicons name="star" size={12} color="#FFFFFF" />
                <Text style={styles.ratingBadgeText}>{driverRating.toFixed(1)}</Text>
              </View>
            )}
          </View>
          
          <View style={styles.driverDetails}>
            <Text style={styles.driverName}>{driverName}</Text>
            
            {driverRating > 0 && typeof driverRating === 'number' && (
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
              <TouchableOpacity 
                style={styles.phoneContainer}
                onPress={() => driverPhone && Linking.openURL(`tel:${driverPhone}`)}
                activeOpacity={0.7}
              >
                <View style={styles.phoneIconWrap}>
                  <Ionicons name="call" size={14} color="#FFFFFF" />
                </View>
                <Text style={styles.phoneText}>{driverPhone}</Text>
              </TouchableOpacity>
            )}

            {(vehiclePlate || vehicleTypeLabel) && (
              <View style={styles.vehiclePlateRow}>
                <Ionicons name="card-outline" size={16} color="#6B7280" />
                <Text style={styles.vehiclePlateText}>
                  {[vehiclePlate ? `Immat. ${vehiclePlate}` : null, vehicleTypeLabel || null]
                    .filter(Boolean)
                    .join(' · ')}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Infos commande */}
        {(pickupAddr || dropoffAddr || statusLabel || deliveryMethod || priceFormatted) && (
          <View style={styles.orderInfoSection}>
            <View style={styles.statusChip}>
              <Ionicons name="navigate-circle" size={14} color="#8B5CF6" />
              <Text style={styles.statusChipText}>{statusLabel}</Text>
            </View>
            {pickupAddr && (
              <View style={styles.addressRow}>
                <Ionicons name="location" size={14} color="#10B981" />
                <Text style={styles.addressLabel}>De :</Text>
                <Text style={styles.addressText} numberOfLines={1}>{pickupAddr}</Text>
              </View>
            )}
            {dropoffAddr && (
              <View style={styles.addressRow}>
                <Ionicons name="flag" size={14} color="#EF4444" />
                <Text style={styles.addressLabel}>À :</Text>
                <Text style={styles.addressText} numberOfLines={1}>{dropoffAddr}</Text>
              </View>
            )}
            <View style={styles.orderMetaRow}>
              {deliveryMethod && (
                <View style={styles.metaChip}>
                  <Ionicons
                    name={order?.deliveryMethod === 'moto' ? 'bicycle-outline' : order?.deliveryMethod === 'cargo' ? 'cube-outline' : 'car-outline'}
                    size={12}
                    color="#6B7280"
                  />
                  <Text style={styles.metaChipText}>{deliveryMethod}</Text>
                </View>
              )}
              {priceFormatted && (
                <Text style={styles.priceText}>{priceFormatted}</Text>
              )}
            </View>
          </View>
        )}

        <View style={styles.driverActions}>
          <TouchableOpacity 
            style={styles.actionButtonSecondary} 
            onPress={onDetails}
            activeOpacity={0.85}
          >
            <Ionicons name="navigate" size={20} color="#FFFFFF" />
            <Text style={styles.actionButtonSecondaryText}>Suivi en direct</Text>
          </TouchableOpacity>
        </View>
          </View>
        </ScrollView>
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
    <View style={styles.searchFloatOuter} pointerEvents="box-none">
      <View
        style={[
          styles.searchFloatCard,
          { paddingBottom: Math.max(insets.bottom, 20) },
        ]}
      >
        <View style={styles.searchTitleRow}>
          <Text style={styles.searchTitle} numberOfLines={1}>
            Recherche d&apos;un livreur
          </Text>
          <Text style={styles.searchTimer}>{formatTime(searchSeconds)}</Text>
        </View>

        <View style={styles.progressBarWrapper}>
          <Animated.View style={[styles.progressBarFill, { width: progressWidth }]} />
        </View>

        <View style={styles.searchActionsRow}>
          <TouchableOpacity style={styles.searchActionBtn} onPress={onCancel} activeOpacity={0.7}>
            <View style={[styles.searchActionIconWrap, styles.searchActionIconCancel]}>
              <Ionicons name="close" size={22} color="#4B5563" />
            </View>
            <Text style={styles.searchActionLabel}>Annuler</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.searchActionBtn} onPress={onDetails} activeOpacity={0.7}>
            <View style={[styles.searchActionIconWrap, styles.searchActionIconDetails]}>
              <Ionicons name="menu" size={22} color="#4B5563" />
            </View>
            <Text style={styles.searchActionLabel}>Détails</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  searchFloatOuter: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1000,
    backgroundColor: 'transparent',
  },
  /** Bandeau pleine largeur (ref. capture) : coins sup. arrondis, bord haut léger, pas d’ombre forte. */
  searchFloatCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E8E8EA',
    paddingHorizontal: 20,
    paddingTop: 18,
    ...(Platform.OS === 'android' ? { elevation: 2 } : {}),
  },
  assignedFloatOuter: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1000,
    backgroundColor: 'transparent',
  },
  assignedScroll: {
    maxHeight: SCREEN_H * 0.76,
  },
  assignedScrollContent: {
    paddingHorizontal: 12,
    paddingBottom: 4,
  },
  assignedCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 16,
  },
  searchTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  searchTitle: {
    flex: 1,
    flexShrink: 1,
    fontSize: 18,
    fontWeight: '700',
    color: '#000000',
    paddingRight: 10,
    letterSpacing: -0.2,
  },
  searchTimer: {
    fontSize: 15,
    fontWeight: '400',
    color: '#1F2937',
    fontVariant: ['tabular-nums'],
  },
  progressBarWrapper: {
    width: '100%',
    height: 3,
    backgroundColor: '#F3F4F6',
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 26,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#8B5CF6',
    borderRadius: 2,
  },
  searchActionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-start',
    paddingHorizontal: 8,
  },
  searchActionBtn: {
    alignItems: 'center',
    justifyContent: 'flex-start',
    minWidth: 88,
  },
  searchActionIconWrap: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  searchActionIconCancel: {
    backgroundColor: '#F3F4F6',
  },
  searchActionIconDetails: {
    backgroundColor: '#F3F4F6',
  },
  searchActionLabel: {
    fontSize: 14,
    fontWeight: '400',
    color: '#4B5563',
  },
  vehiclePlateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    gap: 6,
  },
  vehiclePlateText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: '#4B5563',
  },
  driverHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
  orderIdBadge: {
    fontSize: 11,
    fontWeight: '700',
    color: '#7C3AED',
    backgroundColor: '#EDE9FE',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    letterSpacing: 0.5,
  },
  orderInfoSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#8B5CF6',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  statusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(139, 92, 246, 0.12)',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.2)',
  },
  statusChipText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#6D28D9',
    marginLeft: 6,
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    paddingVertical: 4,
    paddingLeft: 2,
  },
  addressLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#9CA3AF',
    marginLeft: 8,
    width: 26,
  },
  addressText: {
    flex: 1,
    fontSize: 14,
    color: '#1F2937',
    fontWeight: '500',
  },
  orderMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  metaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  metaChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
    marginLeft: 5,
  },
  priceText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#7C3AED',
    letterSpacing: 0.3,
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
    marginTop: 6,
    alignSelf: 'flex-start',
    backgroundColor: '#EDE9FE',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 10,
  },
  phoneIconWrap: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#8B5CF6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  phoneText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6D28D9',
  },
  driverActions: {
    marginTop: 4,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  actionButtonSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#8B5CF6',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 14,
    shadowColor: '#8B5CF6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  actionButtonSecondaryText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
    marginLeft: 10,
  },
});
