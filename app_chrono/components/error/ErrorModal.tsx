import React, { useEffect } from 'react';
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
import { useErrorModalStore } from '../../store/useErrorModalStore';

export interface ErrorModalData {
  title: string;
  message: string;
  errorCode?: string;
  icon?: string;
  color?: string;
  suggestions?: string[];
  explanation?: string;
  actionLabel?: string;
  onAction?: () => void;
  onClose: () => void;
}

interface ErrorModalProps {
  visible: boolean;
  error: ErrorModalData | null;
}

export const ErrorModal: React.FC<ErrorModalProps> = ({ visible, error }) => {
  const { hideError } = useErrorModalStore();
  
  // Animations - TOUJOURS initialiser les hooks, même si error est null
  const overlayOpacity = useSharedValue(0);
  const modalScale = useSharedValue(0.8);
  const modalTranslateY = useSharedValue(50);
  const iconScale = useSharedValue(0);
  const iconRotation = useSharedValue(-10);
  const contentOpacity = useSharedValue(0);

  const handleClose = () => {
    if (error?.onClose) {
      error.onClose();
    }
    hideError();
  };

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
      
      // Animation du contenu
      contentOpacity.value = withDelay(300, withTiming(1, { duration: 400 }));
    } else {
      // Animation de sortie
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

  // Ne pas rendre si pas d'erreur
  const shouldShow = visible && !!error;
  const errorColor = error?.color || '#EF4444';
  const iconName = error?.icon || 'alert-circle-outline';

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
                    name={iconName as any}
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
                  <Text style={styles.title}>{error?.title || ''}</Text>
                  <Text style={styles.message}>{error?.message || ''}</Text>

                  {/* Explication détaillée */}
                  {error?.explanation && (
                    <View style={styles.explanationContainer}>
                      <View style={styles.explanationHeader}>
                        <Ionicons name="information-circle" size={20} color="#1E40AF" />
                        <Text style={styles.explanationTitle}>Pourquoi cette erreur ?</Text>
                      </View>
                      <Text style={styles.explanationText}>{error?.explanation}</Text>
                    </View>
                  )}

                  {/* Suggestions */}
                  {error?.suggestions && error.suggestions.length > 0 && (
                    <View style={styles.suggestionsContainer}>
                      <Text style={styles.suggestionsTitle}>Que pouvez-vous faire ?</Text>
                      {error?.suggestions?.map((suggestion, index) => (
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

                  {/* Code d'erreur (pour debug) */}
                  {error?.errorCode && __DEV__ && (
                    <View style={styles.errorCodeContainer}>
                      <Text style={styles.errorCodeLabel}>Code d'erreur:</Text>
                      <Text style={styles.errorCodeText}>{error?.errorCode}</Text>
                    </View>
                  )}
                </ScrollView>
              </Animated.View>

              {/* Footer avec boutons */}
              <View style={styles.footer}>
                {error?.onAction && (
                  <TouchableOpacity
                    style={[styles.button, styles.secondaryButton]}
                    onPress={error?.onAction}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="help-circle-outline" size={20} color="#8B5CF6" />
                    <Text style={styles.secondaryButtonText}>
                      {error?.actionLabel || 'Aide'}
                    </Text>
                  </TouchableOpacity>
                )}
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
  errorCodeContainer: {
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
  },
  errorCodeLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: 4,
  },
  errorCodeText: {
    fontSize: 11,
    color: '#9CA3AF',
    fontFamily: 'monospace',
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

