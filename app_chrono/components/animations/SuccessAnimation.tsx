import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withSequence,
  withTiming,
  withDelay,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';

interface SuccessAnimationProps {
  size?: number;
  color?: string;
  onAnimationComplete?: () => void;
}

export const SuccessAnimation: React.FC<SuccessAnimationProps> = ({
  size = 80,
  color = '#10B981',
  onAnimationComplete,
}) => {
  const scale = useSharedValue(0);
  const checkmarkScale = useSharedValue(0);
  const circleOpacity = useSharedValue(0);

  useEffect(() => {
    scale.value = withSpring(1, {
      damping: 10,
      stiffness: 100,
    });

    checkmarkScale.value = withSequence(
      withTiming(0, { duration: 0 }),
      withDelay(
        200,
        withSpring(1, {
          damping: 8,
          stiffness: 150,
        })
      )
    );

    circleOpacity.value = withSequence(
      withTiming(1, { duration: 300 }),
      withDelay(1500, withTiming(0, { duration: 300 }))
    );

    if (onAnimationComplete) {
      setTimeout(() => {
        onAnimationComplete();
      }, 2000);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const circleStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: scale.value }],
      opacity: circleOpacity.value,
    };
  });

  const checkmarkStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: checkmarkScale.value }],
    };
  });

  return (
    <View style={styles.container}>
      <Animated.View
        style={[
          styles.circle,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: color,
          },
          circleStyle,
        ]}
      >
        <Animated.View style={checkmarkStyle}>
          <Ionicons name="checkmark" size={size * 0.6} color="#FFFFFF" />
        </Animated.View>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  circle: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});

