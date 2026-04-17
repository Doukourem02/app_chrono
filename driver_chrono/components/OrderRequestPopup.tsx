import React, { useEffect, useRef } from 'react';
import {View,Text,TouchableOpacity,StyleSheet,Animated,Dimensions,Image,StatusBar,} from 'react-native';
import * as Haptics from 'expo-haptics';
import { useAudioPlayer } from 'expo-audio';
import { AdminOrderInfo } from './AdminOrderInfo';
import { logger } from '../utils/logger';
import { formatUserName } from '../utils/formatName';
import { parseClientOrderInstructions } from '../utils/clientOrderInstructions';
import { driverFacingSpeedOptionLabel } from '../utils/speedOptionLabel';

interface OrderRequest {
  id: string;
  user: {
    name: string;
    first_name?: string | null;
    last_name?: string | null;
    avatar?: string;
    rating?: number; // Rating optionnel car peut ne pas être présent pour les commandes admin
  };
  pickup: {
    address: string;
    coordinates?: { latitude: number; longitude: number }; // Optionnel pour les commandes téléphoniques
    approximate_pickup_zone_label?: string;
    pickup_coordinates_are_approximate?: boolean;
  };
  dropoff: {
    address: string;
    coordinates?: { latitude: number; longitude: number }; // Optionnel pour les commandes téléphoniques
    details?: {
      thermal_bag?: boolean;
      courier_note?: string;
      recipient_message?: string;
    };
  };
  price: number;
  deliveryMethod: 'moto' | 'vehicule' | 'cargo';
  /** express | standard | scheduled — côté client */
  speedOptionId?: string;
  distance: number;
  estimatedDuration: string;
  createdAt: Date;
  isPhoneOrder?: boolean;
  placedByAdmin?: boolean;
  isB2BOrder?: boolean;
  /** Champ « Notes (optionnel) » côté admin. */
  operatorCourseNotes?: string;
  driverNotes?: string; // Notes spéciales pour le livreur
}

interface OrderRequestPopupProps {
  order: OrderRequest | null;
  visible: boolean;
  onAccept: (orderId: string) => void;
  onDecline: (orderId: string) => void;
  autoDeclineTimer?: number; // secondes — aligné avec DRIVER_OFFER_RESPONSE_MS (backend) et la barre client (app_chrono)
}

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const ORDER_SOUND = require('../assets/sounds/chronopopus.wav');

export const OrderRequestPopup: React.FC<OrderRequestPopupProps> = ({
  order,
  visible,
  onAccept,
  onDecline,
  autoDeclineTimer = 30,
}) => {
  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const timerAnim = useRef(new Animated.Value(1)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const orderSoundPlayer = useAudioPlayer(ORDER_SOUND);

  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [timeLeft, setTimeLeft] = React.useState(autoDeclineTimer);

  // Animation d'entrée
  useEffect(() => {
    if (visible && order) {
      // Reset animations
      slideAnim.setValue(SCREEN_HEIGHT);
      scaleAnim.setValue(0.8);
      opacityAnim.setValue(0);
      timerAnim.setValue(1);
      setTimeLeft(autoDeclineTimer);

      // Haptic feedback
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      // Lecture du son de notification
      try {
        orderSoundPlayer.seekTo(0);
        orderSoundPlayer.play();
      } catch (err) {
        logger.warn('[OrderRequestPopup] Lecture son échouée', undefined, err);
      }

      // Animation d'entrée sophistiquée
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 0,
          tension: 100,
          friction: 8,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 120,
          friction: 7,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();

      // Animation pulse continue
      const startPulse = () => {
        Animated.loop(
          Animated.sequence([
            Animated.timing(pulseAnim, {
              toValue: 1.05,
              duration: 1000,
              useNativeDriver: true,
            }),
            Animated.timing(pulseAnim, {
              toValue: 1,
              duration: 1000,
              useNativeDriver: true,
            }),
          ])
        ).start();
      };
      startPulse();

      // Timer de countdown
      const startTimer = () => {
        Animated.timing(timerAnim, {
          toValue: 0,
          duration: autoDeclineTimer * 1000,
          useNativeDriver: false,
        }).start();
      };
      startTimer();

      // Countdown
      let currentTime = autoDeclineTimer;
      countdownRef.current = setInterval(() => {
        currentTime -= 1;
        setTimeLeft(currentTime);
        
        if (currentTime <= 0) {
          if (countdownRef.current) {
            clearInterval(countdownRef.current);
          }
          handleDecline();
        }
      }, 1000);
    }

    return () => {
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
      }
    };
  }, [visible, order, autoDeclineTimer]); // eslint-disable-line react-hooks/exhaustive-deps

  // Animation de sortie
  const animateOut = (callback: () => void) => {
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: SCREEN_HEIGHT,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 0.8,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start(callback);
  };

  const handleAccept = () => {
    if (!order) return;
    
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
    }
    
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    animateOut(() => onAccept(order.id));
  };

  const handleDecline = () => {
    if (!order) return;
    
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
    }
    
    Haptics.selectionAsync();
    animateOut(() => onDecline(order.id));
  };

  if (!visible || !order) return null;

  const clientDisplayName = formatUserName(
    {
      first_name: order.user.first_name,
      last_name: order.user.last_name,
      name: order.user.name,
    },
    'Client'
  );
  const clientInitial =
    clientDisplayName.trim().charAt(0).toUpperCase() || '?';

  const getVehicleIcon = (method: string) => {
    switch (method) {
      case 'moto': return require('../assets/images/motoo.png');
      case 'vehicule': return require('../assets/images/carrss.png');
      case 'cargo': return require('../assets/images/ccargo.png');
      default: return require('../assets/images/carrss.png');
    }
  };

  const getMethodLabel = (method: string) => {
    switch (method) {
      case 'moto': return 'Moto';
      case 'vehicule': return 'Véhicule';
      case 'cargo': return 'Cargo';
      default: return 'Véhicule';
    }
  };

  return (
    <>
      <StatusBar backgroundColor="rgba(0,0,0,0.8)" barStyle="light-content" />
      
      {/* Overlay */}
      <Animated.View 
        style={[
          styles.overlay,
          {
            opacity: opacityAnim,
          }
        ]}
      />

      {/* Popup Container */}
      <Animated.View
        style={[
          styles.container,
          {
            transform: [
              { translateY: slideAnim },
              { scale: scaleAnim },
            ],
            opacity: opacityAnim,
          },
        ]}
      >
        {/* Timer Bar */}
        <View style={styles.timerContainer}>
          <Animated.View
            style={[
              styles.timerBar,
              {
                width: timerAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: ['0%', '100%'],
                }),
              },
            ]}
          />
          <Text style={styles.timerText}>{timeLeft}s</Text>
        </View>

        {/* Content */}
        <Animated.View
          style={[
            styles.content,
            {
              transform: [{ scale: pulseAnim }],
            },
          ]}
        >
          {/* Header avec avatar user */}
          <View style={styles.header}>
            <View style={styles.userInfo}>
              <View style={styles.avatarContainer}>
                {order.user.avatar ? (
                  <Image source={{ uri: order.user.avatar }} style={styles.avatar} />
                ) : (
                  <View style={styles.avatarPlaceholder}>
                    <Text style={styles.avatarText}>
                      {clientInitial}
                    </Text>
                  </View>
                )}
              </View>
              <View style={styles.userDetails}>
                <Text style={styles.userName}>{clientDisplayName}</Text>
                <View style={styles.ratingContainer}>
                  <Text style={styles.starIcon}>⭐</Text>
                  <Text style={styles.rating}>
                    {(order.user.rating ?? 0).toFixed(1)}
                  </Text>
                </View>
              </View>
            </View>
            
            <View style={styles.priceContainer}>
              <Text style={styles.priceAmount}>{order.price} FCFA</Text>
              <Text style={styles.priceLabel}>Prix Course</Text>
            </View>
          </View>

          {/* Informations spéciales pour les commandes admin/téléphoniques */}
          <AdminOrderInfo
            isPhoneOrder={order.isPhoneOrder || false}
            placedByAdmin={order.placedByAdmin}
            isB2BOrder={order.isB2BOrder || false}
            operatorCourseNotes={order.operatorCourseNotes}
            driverNotes={order.driverNotes}
            approximatePickupZoneLabel={order.pickup?.approximate_pickup_zone_label}
          />

          {/* Info de livraison */}
          <View style={styles.deliveryInfo}>
            <View style={styles.methodContainer}>
              <Image source={getVehicleIcon(order.deliveryMethod)} style={styles.vehicleIcon} />
              <Text style={styles.methodText}>{getMethodLabel(order.deliveryMethod)}</Text>
            </View>
            
            <View style={styles.distanceInfo}>
              <Text style={styles.distanceText}>{order.distance.toFixed(1)} km</Text>
              <Text style={styles.durationText}>{order.estimatedDuration}</Text>
            </View>
          </View>

          {(() => {
            const modeLabel = driverFacingSpeedOptionLabel(order.speedOptionId);
            if (!order.speedOptionId) return null;
            return (
              <View style={styles.serviceModeBanner}>
                <Text style={styles.serviceModeLabel}>Mode de service</Text>
                <Text style={styles.serviceModeValue}>{modeLabel}</Text>
              </View>
            );
          })()}

          {(() => {
            const instr = parseClientOrderInstructions(
              order.dropoff?.details as Record<string, unknown> | undefined
            );
            if (!instr) return null;
            const hasDetailMessages =
              (instr.courierNote && instr.courierNote.length > 0) ||
              (instr.recipientMessage && instr.recipientMessage.length > 0);
            return (
              <View style={styles.preAcceptHints}>
                {instr.thermalBag ? (
                  <View style={styles.preAcceptRow}>
                    <Text style={styles.preAcceptKey}>Maintien température</Text>
                    <Text style={styles.preAcceptVal}>Oui</Text>
                  </View>
                ) : null}
                {instr.scheduledWindowNote ? (
                  <View style={styles.preAcceptBlock}>
                    <Text style={styles.preAcceptKey}>Créneau souhaité</Text>
                    <Text style={styles.preAcceptMultiline} numberOfLines={3}>
                      {instr.scheduledWindowNote}
                    </Text>
                  </View>
                ) : null}
                {hasDetailMessages ? (
                  <Text style={styles.preAcceptFootnote}>
                    Consignes détaillées (livreur / destinataire) : consultez la fiche commande après acceptation.
                  </Text>
                ) : null}
              </View>
            );
          })()}

          {/* Adresses */}
          <View style={styles.addressesContainer}>
            <View style={styles.addressRow}>
              <View style={styles.addressIcon}>
                <View style={styles.pickupDot} />
              </View>
              <View style={styles.addressContent}>
                <Text style={styles.addressLabel}>Prise en Charge</Text>
                <Text style={styles.addressText} numberOfLines={2}>
                  {order.pickup.address}
                </Text>
              </View>
            </View>
            
            <View style={styles.routeLine} />
            
            <View style={styles.addressRow}>
              <View style={styles.addressIcon}>
                <View style={styles.dropoffDot} />
              </View>
              <View style={styles.addressContent}>
                <Text style={styles.addressLabel}>Destination</Text>
                <Text style={styles.addressText} numberOfLines={2}>
                  {order.dropoff.address}
                </Text>
              </View>
            </View>
          </View>

          {/* Boutons d'action */}
          <View style={styles.actionsContainer}>
            <TouchableOpacity
              style={styles.declineButton}
              onPress={handleDecline}
              activeOpacity={0.8}
            >
              <Text style={styles.declineText}>Décliner</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.acceptButton}
              onPress={handleAccept}
              activeOpacity={0.8}
            >
              <Text style={styles.acceptText}>Accepter</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </Animated.View>
    </>
  );
};

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    zIndex: 999,
  },
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
    paddingHorizontal: 20,
  },
  timerContainer: {
    position: 'absolute',
    top: -10,
    left: 0,
    right: 0,
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 2,
    overflow: 'hidden',
    zIndex: 1,
  },
  timerBar: {
    height: '100%',
    backgroundColor: '#FF6B6B',
    borderRadius: 2,
  },
  timerText: {
    position: 'absolute',
    top: -25,
    right: 0,
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  content: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatarContainer: {
    marginRight: 12,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  avatarPlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#8B5CF6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: 'bold',
  },
  userDetails: {
    flex: 1,
  },
  userName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 2,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  starIcon: {
    fontSize: 14,
    marginRight: 4,
  },
  rating: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '600',
  },
  priceContainer: {
    alignItems: 'flex-end',
  },
  priceAmount: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#059669',
  },
  priceLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  deliveryInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  methodContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  vehicleIcon: {
    width: 24,
    height: 24,
    marginRight: 8,
    resizeMode: 'contain',
  },
  methodText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
  distanceInfo: {
    alignItems: 'flex-end',
  },
  distanceText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  durationText: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  serviceModeBanner: {
    backgroundColor: '#F5F3FF',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#DDD6FE',
  },
  serviceModeLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#6D28D9',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  serviceModeValue: {
    fontSize: 17,
    fontWeight: '700',
    color: '#4C1D95',
  },
  preAcceptHints: {
    marginBottom: 16,
  },
  preAcceptRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFBEB',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  preAcceptKey: {
    fontSize: 13,
    fontWeight: '600',
    color: '#92400E',
  },
  preAcceptVal: {
    fontSize: 13,
    fontWeight: '700',
    color: '#B45309',
  },
  preAcceptBlock: {
    backgroundColor: '#F0FDF4',
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  preAcceptMultiline: {
    fontSize: 13,
    color: '#166534',
    marginTop: 4,
    lineHeight: 18,
  },
  preAcceptFootnote: {
    fontSize: 11,
    color: '#6B7280',
    lineHeight: 16,
    fontStyle: 'italic',
  },
  addressesContainer: {
    marginBottom: 24,
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  addressIcon: {
    width: 24,
    alignItems: 'center',
    paddingTop: 4,
  },
  pickupDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#059669',
  },
  dropoffDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#DC2626',
  },
  routeLine: {
    width: 2,
    height: 20,
    backgroundColor: '#E5E7EB',
    marginLeft: 11,
    marginVertical: 4,
  },
  addressContent: {
    flex: 1,
    marginLeft: 12,
    paddingBottom: 8,
  },
  addressLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: 4,
  },
  addressText: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 20,
  },
  clientInstructionsBox: {
    backgroundColor: '#F5F3FF',
    borderRadius: 12,
    padding: 14,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#DDD6FE',
  },
  clientInstructionsTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#5B21B6',
    marginBottom: 10,
  },
  clientInstructionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  clientInstructionBlock: {
    marginBottom: 10,
  },
  clientInstructionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: 4,
  },
  clientInstructionValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#7C3AED',
  },
  clientInstructionMultiline: {
    fontSize: 14,
    color: '#1F2937',
    lineHeight: 20,
  },
  actionsContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  declineButton: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  declineText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6B7280',
  },
  acceptButton: {
    flex: 1,
    backgroundColor: '#8B5CF6',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  acceptText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});