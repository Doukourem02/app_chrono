import React, { useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withSequence,
  withDelay,
} from 'react-native-reanimated';
import { useDeferredPaymentErrorStore } from '../../store/useDeferredPaymentErrorStore';

export interface DeferredPaymentErrorData {
  message: string;
  errorCode?: string;
  details?: {
    monthlyRemaining?: number;
    monthlyLimit?: number;
    requestedAmount?: number;
    monthlyUsages?: number;
    maxUsagesPerMonth?: number;
    annualLimit?: number;
    cooldownDaysRemaining?: number;
    blockEndDate?: string;
    minAmount?: number;
  };
  onClose: () => void;
}

interface DeferredPaymentErrorModalProps {
  visible: boolean;
  error: DeferredPaymentErrorData | null;
}

export const DeferredPaymentErrorModal: React.FC<DeferredPaymentErrorModalProps> = ({
  visible,
  error,
}) => {
  const { hideError } = useDeferredPaymentErrorStore();
  
  // Animations - TOUJOURS initialiser les hooks, même si error est null
  const overlayOpacity = useSharedValue(0);
  const modalScale = useSharedValue(0.8);
  const modalTranslateY = useSharedValue(50);
  const iconScale = useSharedValue(0);
  const iconRotation = useSharedValue(-10);
  const contentOpacity = useSharedValue(0);

  const handleClose = () => {
    if (error.onClose) {
      error.onClose();
    }
    hideError();
  };

  useEffect(() => {
    if (visible) {
      overlayOpacity.value = withTiming(1, { duration: 300 });
      modalScale.value = withSpring(1, { damping: 12, stiffness: 100 });
      modalTranslateY.value = withSpring(0, { damping: 15, stiffness: 100 });
      
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
      
      contentOpacity.value = withDelay(300, withTiming(1, { duration: 400 }));
    } else {
      overlayOpacity.value = withTiming(0, { duration: 200 });
      modalScale.value = withTiming(0.8, { duration: 200 });
      modalTranslateY.value = withTiming(50, { duration: 200 });
      iconScale.value = withTiming(0, { duration: 200 });
      contentOpacity.value = withTiming(0, { duration: 200 });
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

  const contentStyle = useAnimatedStyle(() => ({
    opacity: contentOpacity.value,
  }));

  const config = useMemo(() => {
    if (!error) return null;
    
    const code = error.errorCode;
    const details = error.details || {};

    switch (code) {
      case 'MONTHLY_CREDIT_INSUFFICIENT':
        return {
          title: 'Crédit mensuel insuffisant',
          icon: 'card-outline',
          color: '#F59E0B',
          explanation: `Votre crédit mensuel disponible est de ${details.monthlyRemaining?.toLocaleString('fr-FR') || '0'} FCFA, mais vous essayez d'utiliser ${details.requestedAmount?.toLocaleString('fr-FR') || 'N/A'} FCFA. Le paiement différé a des limites mensuelles pour votre sécurité financière.`,
          suggestions: [
            `Réduisez le montant à ${details.monthlyRemaining?.toLocaleString('fr-FR') || '0'} FCFA ou moins`,
            'Utilisez une autre méthode de paiement pour cette commande',
            'Attendez le mois prochain pour réinitialiser votre crédit mensuel',
          ],
          details: [
            details.monthlyRemaining !== undefined && details.monthlyLimit !== undefined
              ? `Crédit disponible : ${details.monthlyRemaining.toLocaleString('fr-FR')} / ${details.monthlyLimit.toLocaleString('fr-FR')} FCFA`
              : null,
            details.requestedAmount !== undefined
              ? `Montant demandé : ${details.requestedAmount.toLocaleString('fr-FR')} FCFA`
              : null,
          ].filter(Boolean) as string[],
        };

      case 'MONTHLY_USAGE_LIMIT_EXCEEDED':
        return {
          title: 'Limite d\'utilisations mensuelles atteinte',
          icon: 'time-outline',
          color: '#F59E0B',
          explanation: `Vous avez atteint la limite d'utilisations mensuelles du paiement différé (${details.maxUsagesPerMonth || 'N/A'} utilisations par mois). Cette limite existe pour protéger votre compte et éviter les abus.`,
          suggestions: [
            'Utilisez une autre méthode de paiement pour cette commande',
            'Attendez le mois prochain pour réinitialiser votre quota',
            'Contactez le support si vous avez besoin d\'augmenter votre limite',
          ],
          details: [
            details.monthlyUsages !== undefined && details.maxUsagesPerMonth !== undefined
              ? `Utilisations : ${details.monthlyUsages} / ${details.maxUsagesPerMonth} ce mois`
              : null,
          ].filter(Boolean) as string[],
        };

      case 'ANNUAL_LIMIT_EXCEEDED':
        return {
          title: 'Quota annuel atteint',
          icon: 'calendar-outline',
          color: '#EF4444',
          explanation: `Vous avez atteint votre quota annuel de paiement différé (${details.annualLimit?.toLocaleString('fr-FR') || 'N/A'} FCFA). Cette limite annuelle existe pour protéger votre compte sur le long terme.`,
          suggestions: [
            'Utilisez une autre méthode de paiement pour cette commande',
            'Attendez l\'année prochaine pour réinitialiser votre quota annuel',
            'Contactez le support pour plus d\'informations',
          ],
          details: [
            details.annualLimit !== undefined
              ? `Quota annuel : ${details.annualLimit.toLocaleString('fr-FR')} FCFA`
              : null,
          ].filter(Boolean) as string[],
        };

      case 'COOLDOWN_PERIOD_ACTIVE':
        return {
          title: 'Période de refroidissement active',
          icon: 'hourglass-outline',
          color: '#F59E0B',
          explanation: `Une période de refroidissement est active. Vous devez attendre ${details.cooldownDaysRemaining || 'X'} jour(s) avant de pouvoir utiliser à nouveau le paiement différé. Cette période existe pour protéger votre compte après plusieurs utilisations.`,
          suggestions: [
            `Attendez ${details.cooldownDaysRemaining || 'X'} jour(s) avant de réessayer`,
            'Utilisez une autre méthode de paiement en attendant',
            'La période de refroidissement se réinitialisera automatiquement',
          ],
          details: [
            details.cooldownDaysRemaining !== undefined
              ? `Jours restants : ${details.cooldownDaysRemaining} jour(s)`
              : null,
          ].filter(Boolean) as string[],
        };

      case 'DEFERRED_PAYMENT_BLOCKED':
        return {
          title: 'Paiement différé bloqué',
          icon: 'lock-closed-outline',
          color: '#DC2626',
          explanation: `Votre paiement différé est bloqué jusqu'au ${details.blockEndDate ? new Date(details.blockEndDate).toLocaleDateString('fr-FR') : 'date indéterminée'} en raison de 3 retards de paiement consécutifs. Cette mesure de sécurité protège votre compte et celui de nos partenaires.`,
          suggestions: [
            'Réglez vos dettes en retard pour débloquer votre compte',
            'Utilisez une autre méthode de paiement pour le moment',
            'Contactez le support pour discuter d\'un plan de remboursement',
          ],
          details: [
            details.blockEndDate
              ? `Déblocage prévu : ${new Date(details.blockEndDate).toLocaleDateString('fr-FR')}`
              : null,
          ].filter(Boolean) as string[],
        };

      case 'MIN_AMOUNT_NOT_REACHED':
        return {
          title: 'Montant minimum non atteint',
          icon: 'cash-outline',
          color: '#F59E0B',
          explanation: `Le montant minimum pour utiliser le paiement différé est de ${details.minAmount?.toLocaleString('fr-FR') || 'N/A'} FCFA. Votre commande actuelle ne respecte pas ce minimum.`,
          suggestions: [
            `Augmentez le montant de votre commande à ${details.minAmount?.toLocaleString('fr-FR') || 'N/A'} FCFA ou plus`,
            'Utilisez une autre méthode de paiement pour cette commande',
            'Ajoutez des articles à votre commande pour atteindre le minimum',
          ],
          details: [
            details.minAmount !== undefined
              ? `Montant minimum requis : ${details.minAmount.toLocaleString('fr-FR')} FCFA`
              : null,
            details.requestedAmount !== undefined
              ? `Montant actuel : ${details.requestedAmount.toLocaleString('fr-FR')} FCFA`
              : null,
          ].filter(Boolean) as string[],
        };

      default:
        return {
          title: 'Paiement différé non disponible',
          icon: 'alert-circle-outline',
          color: '#EF4444',
          explanation: error.message || 'Le paiement différé n\'est pas disponible pour le moment.',
          suggestions: [
            'Utilisez une autre méthode de paiement',
            'Réessayez plus tard',
            'Contactez le support si le problème persiste',
          ],
          details: [],
        };
    }
  }, [error]);

  // Ne pas rendre si pas d'erreur ou pas de config
  const shouldShow = visible && !!error && !!config;
  const errorColor = config?.color || '#EF4444';

  return (
    <Modal
      visible={shouldShow}
      transparent={true}
      animationType="none"
      onRequestClose={handleClose}
      statusBarTranslucent
    >
      <Animated.View style={[styles.overlay, overlayStyle]}>
        <TouchableOpacity
          style={styles.overlayTouchable}
          activeOpacity={1}
          onPress={handleClose}
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
                    name={(config?.icon || 'alert-circle-outline') as any}
                    size={48}
                    color={errorColor}
                  />
                </Animated.View>
                <TouchableOpacity
                  onPress={handleClose}
                  style={styles.closeButton}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Ionicons name="close" size={24} color="#6B7280" />
                </TouchableOpacity>
              </View>

              {/* Contenu */}
              <Animated.View style={contentStyle}>
                <ScrollView
                  style={styles.content}
                  showsVerticalScrollIndicator={false}
                >
                  <Text style={styles.title}>{config?.title || ''}</Text>
                  <Text style={styles.message}>{error?.message || ''}</Text>

                  {/* Explication détaillée */}
                  <View style={styles.explanationContainer}>
                    <View style={styles.explanationHeader}>
                      <Ionicons name="information-circle" size={20} color="#1E40AF" />
                      <Text style={styles.explanationTitle}>Pourquoi cette erreur ?</Text>
                    </View>
                    <Text style={styles.explanationText}>{config?.explanation || ''}</Text>
                  </View>

                  {/* Détails chiffrés */}
                  {config?.details && config.details.length > 0 && (
                    <View style={styles.detailsContainer}>
                      {config?.details?.map((detail, index) => (
                        <View key={index} style={styles.detailItem}>
                          <Ionicons name="stats-chart" size={16} color="#8B5CF6" />
                          <Text style={styles.detailText}>{detail}</Text>
                        </View>
                      ))}
                    </View>
                  )}

                  {/* Suggestions */}
                  {config?.suggestions && config.suggestions.length > 0 && (
                    <View style={styles.suggestionsContainer}>
                      <Text style={styles.suggestionsTitle}>Que pouvez-vous faire ?</Text>
                      {config?.suggestions?.map((suggestion, index) => (
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
                    <Ionicons name="shield-checkmark-outline" size={20} color="#6B7280" />
                    <Text style={styles.infoText}>
                      Le paiement différé vous permet de payer plus tard, mais avec des limites pour votre sécurité financière et celle de nos partenaires.
                    </Text>
                  </View>
                </ScrollView>
              </Animated.View>

              {/* Footer */}
              <View style={styles.footer}>
                <TouchableOpacity
                  style={[styles.button, styles.primaryButton]}
                  onPress={handleClose}
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
    maxHeight: 400,
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
  explanationContainer: {
    backgroundColor: '#EFF6FF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  explanationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  explanationTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E40AF',
  },
  explanationText: {
    fontSize: 14,
    color: '#1E40AF',
    lineHeight: 20,
  },
  detailsContainer: {
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  detailText: {
    flex: 1,
    fontSize: 14,
    color: '#374151',
    fontWeight: '500',
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
    backgroundColor: '#FEF3C7',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: '#92400E',
    lineHeight: 18,
    marginLeft: 8,
  },
  footer: {
    flexDirection: 'row',
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
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
});

