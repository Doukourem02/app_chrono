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
  // 🔒 Hooks toujours appelés sans condition
  const overlayOpacity = useSharedValue(0);
  const modalScale = useSharedValue(0.8);
  const modalTranslateY = useSharedValue(50);
  const iconScale = useSharedValue(0);
  const iconRotation = useSharedValue(-10);
  const contentOpacity = useSharedValue(0);

  useEffect(() => {
    if (!error) return;

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
  }, [
    visible,
    error,
    overlayOpacity,
    modalScale,
    modalTranslateY,
    iconScale,
    iconRotation,
    contentOpacity,
  ]);

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

  if (!error) return null;

  const errorColor = error.color || '#EF4444';
  const iconName = error.icon || 'alert-circle-outline';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={error.onClose}
      statusBarTranslucent
    >
      <Animated.View style={[styles.overlay, overlayStyle]}>
        <TouchableOpacity
          style={styles.overlayTouchable}
          activeOpacity={1}
          onPress={error.onClose}
        >
          <Animated.View style={[styles.modalContainer, modalStyle]}>
            <TouchableOpacity activeOpacity={1}>
              <View style={styles.header}>
                <Animated.View
                  style={[
                    styles.iconContainer,
                    { backgroundColor: `${errorColor}15` },
                    iconStyle,
                  ]}
                >
                  <Ionicons name={iconName as any} size={48} color={errorColor} />
                </Animated.View>

                <TouchableOpacity
                  onPress={error.onClose}
                  style={styles.closeButton}
                >
                  <Ionicons name="close" size={24} color="#6B7280" />
                </TouchableOpacity>
              </View>

              <Animated.View style={contentStyle}>
                <ScrollView
                  style={styles.content}
                  showsVerticalScrollIndicator={false}
                >
                  <Text style={styles.title}>{error.title}</Text>
                  <Text style={styles.message}>{error.message}</Text>
                </ScrollView>
              </Animated.View>

              <View style={styles.footer}>
                <TouchableOpacity
                  style={[styles.button, styles.primaryButton]}
                  onPress={error.onClose}
                >
                  <Text style={styles.primaryButtonText}>
                    J&apos;ai compris
                  </Text>
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
    backgroundColor: 'rgba(0,0,0,0.5)',
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
    elevation: 10,
  },
  header: {
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
    backgroundColor: '#F3F4F6',
    borderRadius: 20,
  },
  content: {
    paddingHorizontal: 24,
    maxHeight: 400,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
  },
  message: {
    fontSize: 16,
    textAlign: 'center',
  },
  footer: {
    padding: 20,
  },
  button: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  primaryButton: {
    backgroundColor: '#8B5CF6',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
