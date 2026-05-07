import React, { useEffect, useRef, useState } from 'react';
import {Animated,Modal,StyleSheet,Text,TouchableOpacity,View,useWindowDimensions,} from 'react-native';
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
}

export const BatchOfferPopup: React.FC<BatchOfferPopupProps> = ({
  offer,
  errorMessage,
  visible,
  onAccept,
  onDecline,
  onDismissError,
}) => {
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const translateY = useRef(new Animated.Value(height)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.92)).current;
  const [rendered, setRendered] = useState(false);
  const count = offer?.ordersCount ?? 0;

  useEffect(() => {
    if (visible || errorMessage) {
      setRendered(true);
      Haptics.notificationAsync(
        errorMessage ? Haptics.NotificationFeedbackType.Warning : Haptics.NotificationFeedbackType.Success
      ).catch(() => {});
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }),
        Animated.spring(translateY, { toValue: 0, damping: 18, stiffness: 180, useNativeDriver: true }),
        Animated.spring(scale, { toValue: 1, damping: 16, stiffness: 180, useNativeDriver: true }),
      ]).start();
      return;
    }

    Animated.parallel([
      Animated.timing(opacity, { toValue: 0, duration: 160, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: height, duration: 180, useNativeDriver: true }),
      Animated.timing(scale, { toValue: 0.92, duration: 180, useNativeDriver: true }),
    ]).start(() => setRendered(false));
  }, [visible, errorMessage, height, opacity, scale, translateY]);

  if (!rendered) return null;

  const hasError = Boolean(errorMessage);
  const title = hasError ? 'Tournée indisponible' : 'Nouvelle tournée B2B';
  const subtitle = hasError
    ? errorMessage
    : `${count} livraison${count === 1 ? '' : 's'} à effectuer.`;

  return (
    <Modal transparent visible={rendered} animationType="none" statusBarTranslucent>
      <Animated.View style={[styles.overlay, { opacity }]} />
      <View style={[styles.root, { paddingTop: insets.top + 20, paddingBottom: Math.max(insets.bottom + 26, 42) }]}>
        <Animated.View style={[styles.card, { transform: [{ translateY }, { scale }] }]}>
          <View style={[styles.iconBadge, hasError && styles.errorBadge]}>
            <Ionicons
              name={hasError ? 'alert-circle' : 'cube'}
              size={28}
              color={hasError ? '#F97316' : '#7C3AED'}
            />
          </View>

          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>

          {!hasError && offer?.partner_name ? (
            <Text style={styles.partner} numberOfLines={1}>{offer.partner_name}</Text>
          ) : null}

          <View style={styles.actions}>
            {hasError ? (
              <TouchableOpacity style={styles.primaryButton} onPress={onDismissError} activeOpacity={0.85}>
                <Text style={styles.primaryText}>OK</Text>
              </TouchableOpacity>
            ) : (
              <>
                <TouchableOpacity
                  style={styles.secondaryButton}
                  onPress={() => offer && onDecline(offer.batchId)}
                  activeOpacity={0.85}
                >
                  <Text style={styles.secondaryText}>Refuser</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.primaryButton}
                  onPress={() => offer && onAccept(offer.batchId)}
                  activeOpacity={0.85}
                >
                  <Text style={styles.primaryText}>Accepter</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 42, 0.62)',
  },
  root: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingHorizontal: 24,
  },
  card: {
    width: '100%',
    borderRadius: 28,
    backgroundColor: '#111827',
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 22,
    shadowColor: '#000',
    shadowOpacity: 0.28,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 14 },
    elevation: 14,
  },
  iconBadge: {
    width: 58,
    height: 58,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3E8FF',
    marginBottom: 18,
  },
  errorBadge: {
    backgroundColor: '#FFF7ED',
  },
  title: {
    color: '#FFFFFF',
    fontSize: 27,
    fontWeight: '800',
    letterSpacing: 0,
  },
  subtitle: {
    color: '#D1D5DB',
    fontSize: 19,
    lineHeight: 27,
    marginTop: 8,
  },
  partner: {
    color: '#A78BFA',
    fontSize: 15,
    fontWeight: '700',
    marginTop: 12,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 26,
  },
  primaryButton: {
    flex: 1,
    minHeight: 58,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#7C3AED',
  },
  secondaryButton: {
    flex: 1,
    minHeight: 58,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#374151',
  },
  primaryText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '800',
  },
  secondaryText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '800',
  },
});
