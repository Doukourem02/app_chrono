import React, { useEffect } from 'react';
import {View,Text,StyleSheet,Modal,TouchableOpacity,ScrollView,} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {useSharedValue,useAnimatedStyle,withSpring,withTiming,withSequence,withDelay,} from 'react-native-reanimated';

interface PaymentErrorModalProps {
  visible: boolean;
  title?: string;
  message: string;
  errorCode?: string;
  onClose: () => void;
  onAction?: () => void;
  actionLabel?: string;
}

export const PaymentErrorModal: React.FC<PaymentErrorModalProps> = ({
  visible,
  title = 'Paiement différé non disponible',
  message,
  errorCode,
  onClose,
  onAction,
  actionLabel = 'Comprendre',
}) => {
  // Animations
  const overlayOpacity = useSharedValue(0);
  const modalScale = useSharedValue(0.8);
  const modalTranslateY = useSharedValue(50);
  const iconScale = useSharedValue(0);
  const iconRotation = useSharedValue(-10);

  useEffect(() => {
    if (visible) {
      // Animation d'entrée
      overlayOpacity.value = withTiming(1, { duration: 300 });
      modalScale.value = withSpring(1, { damping: 12, stiffness: 100 });
      modalTranslateY.value = withSpring(0, { damping: 15, stiffness: 100 });
      
      // Animation de l'icône avec rebond
      iconScale.value = withSequence(
        withTiming(0, { duration: 0 }),
        withDelay(200, withSpring(1, { damping: 8, stiffness: 150 }))
      );
      iconRotation.value = withSequence(
        withTiming(-10, { duration: 100 }),
        withSpring(0, { damping: 8, stiffness: 150 }),
        withTiming(10, { duration: 100 }),
        withSpring(0, { damping: 8, stiffness: 150 })
      );
    } else {
      // Animation de sortie
      overlayOpacity.value = withTiming(0, { duration: 200 });
      modalScale.value = withTiming(0.8, { duration: 200 });
      modalTranslateY.value = withTiming(50, { duration: 200 });
      iconScale.value = withTiming(0, { duration: 200 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const overlayStyle = useAnimatedStyle(() => ({
    opacity: overlayOpacity.value,
  }));

  const modalStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: modalScale.value },
      { translateY: modalTranslateY.value },
    ],
  }));

  const iconStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: iconScale.value },
      { rotate: `${iconRotation.value}deg` },
    ],
  }));

  const getErrorIcon = () => {
    switch (errorCode) {
      case 'DEFERRED_PAYMENT_LIMIT_EXCEEDED':
      case 'MONTHLY_LIMIT_EXCEEDED':
        return 'card-outline';
      case 'ANNUAL_LIMIT_EXCEEDED':
        return 'calendar-outline';
      case 'MAX_MONTHLY_USAGES_EXCEEDED':
        return 'time-outline';
      case 'COOLDOWN_ACTIVE':
        return 'hourglass-outline';
      case 'DEFERRED_PAYMENT_BLOCKED':
        return 'lock-closed-outline';
      default:
        return 'alert-circle-outline';
    }
  };

  const getErrorColor = () => {
    switch (errorCode) {
      case 'DEFERRED_PAYMENT_BLOCKED':
        return '#DC2626'; // Rouge plus foncé pour bloqué
      default:
        return '#EF4444'; // Rouge standard
    }
  };

  const getSuggestions = () => {
    const suggestions: string[] = [];

    if (errorCode === 'MONTHLY_LIMIT_EXCEEDED' || errorCode === 'DEFERRED_PAYMENT_LIMIT_EXCEEDED' || errorCode === 'MAX_MONTHLY_USAGES_EXCEEDED') {
      suggestions.push('Attendre le mois prochain pour utiliser à nouveau le paiement différé');
      suggestions.push('Utiliser une autre méthode de paiement pour cette commande');
    } else if (errorCode === 'ANNUAL_LIMIT_EXCEEDED') {
      suggestions.push('Votre quota annuel a été atteint');
      suggestions.push('Utiliser une autre méthode de paiement pour cette commande');
    } else if (errorCode === 'COOLDOWN_ACTIVE') {
      suggestions.push('Attendre la fin de la période de refroidissement');
      suggestions.push('Utiliser une autre méthode de paiement en attendant');
    } else if (errorCode === 'DEFERRED_PAYMENT_BLOCKED') {
      suggestions.push('Réglez vos dettes en retard pour débloquer votre compte');
      suggestions.push('Utilisez une autre méthode de paiement pour le moment');
    }

    return suggestions;
  };

  const suggestions = getSuggestions();
  const errorColor = getErrorColor();

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Animated.View style={[styles.overlay, overlayStyle]}>
        <TouchableOpacity
          style={styles.overlayTouchable}
          activeOpacity={1}
          onPress={onClose}
        >
          <Animated.View style={[styles.modalContainer, modalStyle]}>
            <TouchableOpacity activeOpacity={1}>
              {/* Header avec icône animée */}
              <View style={styles.header}>
                <Animated.View
                  style={[
                    styles.iconContainer,
                    { backgroundColor: `${errorColor}15` },
                    iconStyle,
                  ]}
                >
                  <Ionicons
                    name={getErrorIcon() as any}
                    size={48}
                    color={errorColor}
                  />
                </Animated.View>
                <TouchableOpacity
                  onPress={onClose}
                  style={styles.closeButton}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Ionicons name="close" size={24} color="#6B7280" />
                </TouchableOpacity>
              </View>

              {/* Contenu */}
              <ScrollView
                style={styles.content}
                showsVerticalScrollIndicator={false}
              >
                <Text style={styles.title}>{title}</Text>
                <Text style={styles.message}>{message}</Text>

                {suggestions.length > 0 && (
                  <View style={styles.suggestionsContainer}>
                    <Text style={styles.suggestionsTitle}>Que pouvez-vous faire ?</Text>
                    {suggestions.map((suggestion, index) => (
                      <View key={index} style={styles.suggestionItem}>
                        <Ionicons
                          name="checkmark-circle"
                          size={20}
                          color="#8B5CF6"
                          style={styles.suggestionIcon}
                        />
                        <Text style={styles.suggestionText}>{suggestion}</Text>
                      </View>
                    ))}
                  </View>
                )}

                {/* Informations supplémentaires */}
                <View style={styles.infoContainer}>
                  <Ionicons name="information-circle-outline" size={20} color="#6B7280" />
                  <Text style={styles.infoText}>
                    Le paiement différé vous permet de payer plus tard, mais avec des limites pour votre sécurité.
                  </Text>
                </View>
              </ScrollView>

              {/* Footer avec boutons */}
              <View style={styles.footer}>
                {onAction && (
                  <TouchableOpacity
                    style={[styles.button, styles.secondaryButton]}
                    onPress={onAction}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="help-circle-outline" size={20} color="#8B5CF6" />
                    <Text style={styles.secondaryButtonText}>{actionLabel}</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={[styles.button, styles.primaryButton]}
                  onPress={onClose}
                  activeOpacity={0.8}
                >
                  <Text style={styles.primaryButtonText}>J&apos;ai compris</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          </Animated.View>
        </TouchableOpacity>
      </Animated.View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  overlayTouchable: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    width: '90%',
    maxWidth: 400,
    maxHeight: '85%',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 10,
    },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  header: {
    position: 'relative',
    alignItems: 'center',
    paddingTop: 32,
    paddingBottom: 16,
  },
  iconContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
  },
  content: {
    paddingHorizontal: 24,
    paddingBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1F2937',
    textAlign: 'center',
    marginBottom: 12,
  },
  message: {
    fontSize: 16,
    color: '#4B5563',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
  },
  suggestionsContainer: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  suggestionsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 12,
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  suggestionIcon: {
    marginRight: 10,
    marginTop: 2,
  },
  suggestionText: {
    flex: 1,
    fontSize: 14,
    color: '#4B5563',
    lineHeight: 20,
  },
  infoContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#EFF6FF',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: '#1E40AF',
    lineHeight: 18,
    marginLeft: 8,
  },
  footer: {
    flexDirection: 'row',
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    gap: 12,
  },
  button: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    gap: 8,
  },
  primaryButton: {
    backgroundColor: '#8B5CF6',
    shadowColor: '#8B5CF6',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    backgroundColor: '#F3F4F6',
  },
  secondaryButtonText: {
    color: '#8B5CF6',
    fontSize: 16,
    fontWeight: '600',
  },
});

