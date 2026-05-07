import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, TouchableOpacity, View, StatusBar, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BatchOffer } from '../store/useBatchStore';

interface BatchOfferPopupProps {
  offer: BatchOffer | null;
  errorMessage?: string | null;
  visible: boolean;
  onAccept: (batchId: string) => void;
  onDecline: (batchId: string) => void;
  onDismissError: () => void;
  autoDeclineTimer?: number;
}

export const BatchOfferPopup: React.FC<BatchOfferPopupProps> = ({
  offer,
  errorMessage,
  visible,
  onAccept,
  onDecline,
  onDismissError,
  autoDeclineTimer = 30,
}) => {
  const { height: screenHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [rendered, setRendered] = useState(false);
  const [timeLeft, setTimeLeft] = useState(autoDeclineTimer);

  const slideAnim = useRef(new Animated.Value(screenHeight)).current;
  const scaleAnim = useRef(new Animated.Value(0.86)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const timerAnim = useRef(new Animated.Value(1)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const hasError = Boolean(errorMessage);
  const count = offer?.ordersCount ?? 0;

  const clearCountdown = useCallback(() => {
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
  }, []);

  const animateOut = useCallback((callback?: () => void) => {
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: screenHeight,
        duration: 260,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 0.86,
        duration: 260,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 0,
        duration: 260,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setRendered(false);
      callback?.();
    });
  }, [opacityAnim, scaleAnim, screenHeight, slideAnim]);

  const handleAccept = useCallback(() => {
    if (!offer) return;
    clearCountdown();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
    animateOut(() => onAccept(offer.batchId));
  }, [animateOut, clearCountdown, offer, onAccept]);

  const handleDecline = useCallback(() => {
    if (!offer) return;
    clearCountdown();
    Haptics.selectionAsync().catch(() => {});
    animateOut(() => onDecline(offer.batchId));
  }, [animateOut, clearCountdown, offer, onDecline]);

  const handleDismissError = useCallback(() => {
    clearCountdown();
    animateOut(onDismissError);
  }, [animateOut, clearCountdown, onDismissError]);

  useEffect(() => {
    const shouldShow = visible || hasError;
    if (!shouldShow) {
      clearCountdown();
      animateOut();
      return;
    }

    setRendered(true);
    slideAnim.setValue(screenHeight);
    scaleAnim.setValue(0.86);
    opacityAnim.setValue(0);
    timerAnim.setValue(1);
    pulseAnim.setValue(1);
    setTimeLeft(autoDeclineTimer);

    Haptics.notificationAsync(
      hasError ? Haptics.NotificationFeedbackType.Warning : Haptics.NotificationFeedbackType.Success
    ).catch(() => {});

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
        duration: 280,
        useNativeDriver: true,
      }),
    ]).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.015,
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

    if (!hasError && offer) {
      Animated.timing(timerAnim, {
        toValue: 0,
        duration: autoDeclineTimer * 1000,
        useNativeDriver: false,
      }).start();

      let currentTime = autoDeclineTimer;
      clearCountdown();
      countdownRef.current = setInterval(() => {
        currentTime -= 1;
        setTimeLeft(currentTime);
        if (currentTime <= 0) {
          handleDecline();
        }
      }, 1000);
    }

    return clearCountdown;
  }, [
    animateOut,
    autoDeclineTimer,
    clearCountdown,
    handleDecline,
    hasError,
    offer,
    opacityAnim,
    pulseAnim,
    scaleAnim,
    screenHeight,
    slideAnim,
    timerAnim,
    visible,
  ]);

  if (!rendered) return null;

  return (
    <>
      <StatusBar backgroundColor="rgba(0,0,0,0.8)" barStyle="light-content" />
      <Animated.View style={[styles.overlay, { opacity: opacityAnim }]} />

      <Animated.View
        style={[
          styles.container,
          {
            paddingTop: insets.top + 14,
            paddingBottom: Math.max(insets.bottom + 72, 88),
            transform: [{ translateY: slideAnim }, { scale: scaleAnim }],
            opacity: opacityAnim,
          },
        ]}
      >
        {!hasError && (
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
        )}

        <Animated.View style={[styles.content, { transform: [{ scale: pulseAnim }] }]}>
          <View style={styles.header}>
            <View style={[styles.iconBadge, hasError && styles.errorBadge]}>
              <Ionicons name={hasError ? 'alert-circle' : 'cube-outline'} size={25} color={hasError ? '#F97316' : '#7C3AED'} />
            </View>
            <View style={styles.headerText}>
              <Text style={styles.title}>{hasError ? 'Tournée indisponible' : `Nouvelle tournée B2B - ${count} livraison${count === 1 ? '' : 's'}`}</Text>
              <Text style={styles.subtitle}>
                {hasError ? errorMessage : `${count} livraison${count === 1 ? '' : 's'} à effectuer`}
              </Text>
            </View>
          </View>

          {!hasError && (
            <>
              <View style={styles.summaryRow}>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryLabel}>Type</Text>
                  <Text style={styles.summaryValue}>Livraison groupée</Text>
                </View>
                <View style={styles.summaryDivider} />
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryLabel}>Livraisons</Text>
                  <Text style={styles.summaryValue}>{count}</Text>
                </View>
              </View>

              <View style={styles.infoBox}>
                <Ionicons name="business-outline" size={18} color="#7C3AED" />
                <View style={styles.infoContent}>
                  <Text style={styles.infoLabel}>Partenaire</Text>
                  <Text style={styles.infoValue} numberOfLines={1}>
                    {offer?.partner_name ?? ''}
                  </Text>
                </View>
              </View>

              <View style={styles.hintBox}>
                <Ionicons name="navigate-circle-outline" size={18} color="#92400E" />
                <Text style={styles.hintText}>
                  Après acceptation, tu choisis librement le prochain arrêt depuis la liste.
                </Text>
              </View>
            </>
          )}

          <View style={styles.actionsContainer}>
            {hasError ? (
              <TouchableOpacity style={styles.acceptButton} onPress={handleDismissError} activeOpacity={0.85}>
                <Text style={styles.acceptText}>OK</Text>
              </TouchableOpacity>
            ) : (
              <>
                <TouchableOpacity style={styles.declineButton} onPress={handleDecline} activeOpacity={0.85}>
                  <Text style={styles.declineText}>Refuser</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.acceptButton} onPress={handleAccept} activeOpacity={0.85}>
                  <Text style={styles.acceptText}>Accepter</Text>
                </TouchableOpacity>
              </>
            )}
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
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
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
    left: 20,
    right: 20,
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
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
    borderRadius: 18,
    padding: 18,
    width: '100%',
    maxWidth: 380,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  iconBadge: {
    width: 48,
    height: 48,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3E8FF',
    marginRight: 12,
  },
  errorBadge: {
    backgroundColor: '#FFF7ED',
  },
  headerText: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    color: '#111827',
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: 0,
  },
  subtitle: {
    color: '#6B7280',
    fontSize: 15,
    lineHeight: 21,
    marginTop: 3,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginBottom: 10,
  },
  summaryItem: {
    flex: 1,
  },
  summaryDivider: {
    width: 1,
    height: 34,
    backgroundColor: '#E5E7EB',
    marginHorizontal: 12,
  },
  summaryLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1F2937',
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F3FF',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#DDD6FE',
    marginBottom: 10,
  },
  infoContent: {
    flex: 1,
    marginLeft: 9,
    minWidth: 0,
  },
  infoLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6D28D9',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 3,
  },
  infoValue: {
    fontSize: 15,
    fontWeight: '800',
    color: '#4C1D95',
  },
  hintBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FFFBEB',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#FDE68A',
    marginBottom: 14,
  },
  hintText: {
    flex: 1,
    marginLeft: 8,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
    color: '#92400E',
  },
  actionsContainer: {
    flexDirection: 'row',
    gap: 12,
    paddingTop: 2,
  },
  declineButton: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  declineText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#6B7280',
  },
  acceptButton: {
    flex: 1,
    backgroundColor: '#8B5CF6',
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: 'center',
  },
  acceptText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
