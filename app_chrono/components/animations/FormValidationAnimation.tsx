import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';

interface FormValidationAnimationProps {
  isValid: boolean;
  message?: string;
  show?: boolean;
}

export const FormValidationAnimation: React.FC<FormValidationAnimationProps> = ({
  isValid,
  message,
  show = true,
}) => {
  const scale = useSharedValue(0);
  const opacity = useSharedValue(0);
  const translateX = useSharedValue(0);

  useEffect(() => {
    if (show) {
      scale.value = withSequence(
        withSpring(1.1, { damping: 10, stiffness: 200 }),
        withSpring(1, { damping: 10, stiffness: 200 })
      );
      opacity.value = withTiming(1, { duration: 200 });
      
      translateX.value = withSequence(
        withTiming(-10, { duration: 100 }),
        withSpring(0, { damping: 10, stiffness: 200 })
      );
    } else {
      opacity.value = withTiming(0, { duration: 200 });
      scale.value = withTiming(0, { duration: 200 });
    }
  }, [show]);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { scale: scale.value },
        { translateX: translateX.value },
      ],
      opacity: opacity.value,
    };
  });

  if (!show) return null;

  return (
    <Animated.View style={[styles.container, animatedStyle]}>
      <View
        style={[
          styles.iconContainer,
          { backgroundColor: isValid ? '#D1FAE5' : '#FEE2E2' },
        ]}
      >
        <Ionicons
          name={isValid ? 'checkmark-circle' : 'close-circle'}
          size={20}
          color={isValid ? '#10B981' : '#EF4444'}
        />
      </View>
      {message && (
        <Text
          style={[
            styles.message,
            { color: isValid ? '#10B981' : '#EF4444' },
          ]}
        >
          {message}
        </Text>
      )}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  iconContainer: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  message: {
    fontSize: 12,
    fontWeight: '500',
    flex: 1,
  },
});

