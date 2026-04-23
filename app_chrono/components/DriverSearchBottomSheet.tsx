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
    const driverInitials = driverName
      .split(/\s+/)
      .map((part) => part.trim()[0])
      .filter(Boolean)
      .slice(0, 2)
      .join('')
      .toUpperCase() || 'LK';
    const identitySubtitle = [
      'Livreur Krono',
      vehicleTypeLabel || deliveryMethod || null,
      vehiclePlate || null,
    ]
      .filter(Boolean)
      .join(' · ');
    const parcelIconName =
      order?.deliveryMethod === 'moto'
        ? 'bicycle-outline'
        : order?.deliveryMethod === 'cargo'
          ? 'cube-outline'
          : 'car-outline';
    const openCall = () => {
      if (!driverPhone) return;
      Linking.openURL(`tel:${driverPhone}`).catch(() => {
        logger.warn('Impossible d’ouvrir l’appel livreur');
      });
    };

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
            <View style={styles.assignedTopRow}>
              <View style={styles.assignedIdentityBlock}>
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
                      <Text style={styles.driverAvatarInitials}>{driverInitials}</Text>
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
                  <Text style={styles.driverEyebrow}>Votre livreur</Text>
                  <Text style={styles.driverName} numberOfLines={1}>{driverName}</Text>
                  <Text style={styles.driverSubtitle} numberOfLines={1}>
                    {identitySubtitle}
                  </Text>
                </View>
              </View>

              <View style={styles.headerActions}>
                <TouchableOpacity
                  style={styles.headerActionButton}
                  onPress={onDetails}
                  activeOpacity={0.82}
                >
                  <Ionicons name="navigate-outline" size={18} color="#6D28D9" />
                </TouchableOpacity>
                {driverPhone ? (
                  <TouchableOpacity
                    style={[styles.headerActionButton, styles.headerActionButtonPrimary]}
                    onPress={openCall}
                    activeOpacity={0.82}
                  >
                    <Ionicons name="call" size={18} color="#FFFFFF" />
                  </TouchableOpacity>
                ) : null}
              </View>
            </View>

            <View style={styles.metaRibbon}>
              <View style={styles.metaRibbonLeft}>
                {orderIdShort ? <Text style={styles.orderIdBadge}>{orderIdShort}</Text> : null}
                <View style={styles.statusChip}>
                  <Ionicons name="sparkles" size={13} color="#6D28D9" />
                  <Text style={styles.statusChipText}>{statusLabel}</Text>
                </View>
              </View>
              {priceFormatted ? <Text style={styles.priceText}>{priceFormatted}</Text> : null}
            </View>

            <View style={styles.routeShowcase}>
              <View style={styles.routeColumn}>
                {pickupAddr ? (
                  <View style={styles.routeStepRow}>
                    <View style={[styles.routeStepDot, styles.routeStepDotPickup]} />
                    <View style={styles.routeStepTextWrap}>
                      <Text style={styles.routeStepLabel}>Collecte</Text>
                      <Text style={styles.routeStepValue} numberOfLines={2}>{pickupAddr}</Text>
                    </View>
                  </View>
                ) : null}

                {pickupAddr && dropoffAddr ? <View style={styles.routeConnector} /> : null}

                {dropoffAddr ? (
                  <View style={styles.routeStepRow}>
                    <View style={[styles.routeStepDot, styles.routeStepDotDropoff]} />
                    <View style={styles.routeStepTextWrap}>
                      <Text style={styles.routeStepLabel}>Livraison</Text>
                      <Text style={styles.routeStepValue} numberOfLines={2}>{dropoffAddr}</Text>
                    </View>
                  </View>
                ) : null}
              </View>

              <View style={styles.parcelPanel}>
                <View style={styles.parcelPanelBadge}>
                  <Ionicons name={parcelIconName} size={14} color="#6D28D9" />
                  <Text style={styles.parcelPanelBadgeText}>{deliveryMethod || 'Krono'}</Text>
                </View>
                <View style={styles.parcelArtwork}>
                  <View style={styles.parcelArtworkBack} />
                  <View style={styles.parcelArtworkFront}>
                    <Ionicons name="cube" size={28} color="#6D28D9" />
                  </View>
                </View>
              </View>
            </View>

            <View style={styles.footerMetaRow}>
              {(vehiclePlate || vehicleTypeLabel) ? (
                <View style={styles.footerMetaChip}>
                  <Ionicons name="card-outline" size={14} color="#6B7280" />
                  <Text style={styles.footerMetaChipText}>
                    {[vehiclePlate ? `Immat. ${vehiclePlate}` : null, vehicleTypeLabel || null]
                      .filter(Boolean)
                      .join(' · ')}
                  </Text>
                </View>
              ) : <View />}

              {driverPhone ? (
                <Text style={styles.phoneInlineText} numberOfLines={1}>{driverPhone}</Text>
              ) : null}
            </View>

            <View style={styles.driverActions}>
              <TouchableOpacity
                style={styles.actionButtonSecondary}
                onPress={onDetails}
                activeOpacity={0.85}
              >
                <View style={styles.actionButtonLeading}>
                  <Ionicons name="navigate" size={18} color="#6D28D9" />
                </View>
                <Text style={styles.actionButtonSecondaryText}>Suivi en direct</Text>
                <Ionicons name="chevron-forward" size={18} color="#FFFFFF" />
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
    paddingHorizontal: 10,
    paddingBottom: 6,
  },
  assignedCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 22,
    borderWidth: 1,
    borderColor: '#F1EDFF',
    shadowColor: '#24104A',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.11,
    shadowRadius: 26,
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
  assignedTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 18,
  },
  assignedIdentityBlock: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 12,
  },
  driverAvatarContainer: {
    marginRight: 14,
    position: 'relative',
  },
  driverAvatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#F3F4F6',
    borderWidth: 3,
    borderColor: '#A78BFA',
  },
  driverAvatarPlaceholder: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#F5F3FF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#A78BFA',
  },
  driverAvatarInitials: {
    fontSize: 24,
    fontWeight: '800',
    color: '#6D28D9',
  },
  statusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#F5F3FF',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#DDD6FE',
    marginBottom: 6,
  },
  statusChipText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#6D28D9',
    marginLeft: 6,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerActionButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F5F3FF',
    borderWidth: 1,
    borderColor: '#E9D5FF',
    marginLeft: 10,
  },
  headerActionButtonPrimary: {
    backgroundColor: '#8B5CF6',
    borderColor: '#8B5CF6',
  },
  metaRibbon: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  metaRibbonLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    flexWrap: 'wrap',
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
  driverEyebrow: {
    fontSize: 12,
    fontWeight: '700',
    color: '#8B5CF6',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 3,
  },
  driverName: {
    fontSize: 24,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 4,
  },
  driverSubtitle: {
    fontSize: 13,
    fontWeight: '500',
    color: '#6B7280',
  },
  orderIdBadge: {
    fontSize: 11,
    fontWeight: '700',
    color: '#7C3AED',
    backgroundColor: '#EDE9FE',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    letterSpacing: 0.5,
    marginRight: 8,
    marginBottom: 6,
  },
  priceText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#7C3AED',
    letterSpacing: 0.2,
    marginLeft: 12,
  },
  routeShowcase: {
    flexDirection: 'row',
    alignItems: 'stretch',
    backgroundColor: '#FCFCFF',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#EEE8FF',
    padding: 16,
  },
  routeColumn: {
    flex: 1,
    paddingRight: 14,
  },
  routeStepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  routeStepDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginTop: 4,
    marginRight: 12,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  routeStepDotPickup: {
    backgroundColor: '#6D28D9',
  },
  routeStepDotDropoff: {
    backgroundColor: '#C4B5FD',
  },
  routeConnector: {
    width: 2,
    height: 30,
    backgroundColor: '#DDD6FE',
    marginLeft: 5,
    marginTop: 6,
    marginBottom: 6,
  },
  routeStepTextWrap: {
    flex: 1,
  },
  routeStepLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#9CA3AF',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 3,
  },
  routeStepValue: {
    fontSize: 14,
    color: '#1F2937',
    fontWeight: '700',
    lineHeight: 20,
  },
  parcelPanel: {
    width: 112,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  parcelPanelBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F3FF',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#DDD6FE',
    marginBottom: 12,
  },
  parcelPanelBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6D28D9',
    marginLeft: 5,
  },
  parcelArtwork: {
    width: 94,
    height: 94,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  parcelArtworkBack: {
    position: 'absolute',
    top: 12,
    width: 58,
    height: 58,
    borderRadius: 16,
    backgroundColor: '#DDD6FE',
    transform: [{ rotate: '-10deg' }],
  },
  parcelArtworkFront: {
    width: 64,
    height: 64,
    borderRadius: 18,
    backgroundColor: '#F3E8FF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E9D5FF',
    shadowColor: '#8B5CF6',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius: 16,
    elevation: 5,
  },
  footerMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 14,
    marginBottom: 8,
  },
  footerMetaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 1,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  footerMetaChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
    marginLeft: 6,
  },
  phoneInlineText: {
    flexShrink: 1,
    fontSize: 13,
    fontWeight: '700',
    color: '#6D28D9',
    marginLeft: 12,
  },
  driverActions: {
    marginTop: 8,
  },
  actionButtonSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#8B5CF6',
    paddingVertical: 15,
    paddingHorizontal: 16,
    borderRadius: 18,
    shadowColor: '#8B5CF6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  actionButtonLeading: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionButtonSecondaryText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
    marginLeft: 12,
    textAlign: 'center',
  },
});
