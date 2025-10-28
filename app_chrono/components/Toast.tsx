import React, { useCallback, useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

interface ToastProps {
  type: ToastType;
  message: string;
  visible: boolean;
  onHide: () => void;
  duration?: number;
}

export const Toast: React.FC<ToastProps> = ({ 
  type, 
  message, 
  visible, 
  onHide, 
  duration = 3000 
}) => {
  const slideAnim = useRef(new Animated.Value(-100)).current;
  const timeoutRef = useRef<number | undefined>(undefined);

  const hideToast = useCallback(() => {
    Animated.timing(slideAnim, {
      toValue: -100,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      onHide();
    });
  }, [slideAnim, onHide]);

  useEffect(() => {
    if (visible) {
      // Slide in
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 100,
        friction: 8,
      }).start();

      // Auto hide after duration
      timeoutRef.current = setTimeout(() => {
        hideToast();
      }, duration) as unknown as number;
    } else {
      hideToast();
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [visible, duration, hideToast, slideAnim]);

  const getToastStyle = () => {
    switch (type) {
      case 'success':
        return { backgroundColor: '#10B981', iconName: 'checkmark-circle' as const };
      case 'error':
        return { backgroundColor: '#EF4444', iconName: 'close-circle' as const };
      case 'warning':
        return { backgroundColor: '#F59E0B', iconName: 'warning' as const };
      case 'info':
        return { backgroundColor: '#3B82F6', iconName: 'information-circle' as const };
      default:
        return { backgroundColor: '#6B7280', iconName: 'information-circle' as const };
    }
  };

  const { backgroundColor, iconName } = getToastStyle();

  if (!visible) return null;

  return (
    <Animated.View 
      style={[
        styles.container,
        { backgroundColor, transform: [{ translateY: slideAnim }] }
      ]}
    >
      <Ionicons name={iconName} size={24} color="white" />
      <Text style={styles.message}>{message}</Text>
      <TouchableOpacity onPress={hideToast} style={styles.closeButton}>
        <Ionicons name="close" size={20} color="white" />
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 60,
    left: 20,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
    zIndex: 1000,
  },
  message: {
    flex: 1,
    color: 'white',
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 10,
  },
  closeButton: {
    marginLeft: 10,
    padding: 2,
  },
});