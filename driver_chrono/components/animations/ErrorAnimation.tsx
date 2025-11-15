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

interface ErrorAnimationProps {
  size?: number;
  color?: string;
  onAnimationComplete?: () => void;
}

export const ErrorAnimation: React.FC<ErrorAnimationProps> = ({
  size = 80,
  color = '#EF4444',
  onAnimationComplete,
}) => {
  const scale = useSharedValue(0);
  const xScale = useSharedValue(0);
  const rotation = useSharedValue(0);
  const opacity = useSharedValue(0);

  useEffect(() => {
    scale.value = withSpring(1, {
      damping: 10,
      stiffness: 100,
    });

    xScale.value = withSequence(
      withTiming(0, { duration: 0 }),
      withDelay(
        200,
        withSpring(1, {
          damping: 8,
          stiffness: 150,
        })
      )
    );

    rotation.value = withSequence(
      withTiming(-10, { duration: 100 }),
      withSpring(0, { damping: 8, stiffness: 150 }),
      withTiming(10, { duration: 100 }),
      withSpring(0, { damping: 8, stiffness: 150 })
    );

    opacity.value = withSequence(
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
      transform: [
        { scale: scale.value },
        { rotate: `${rotation.value}deg` },
      ],
      opacity: opacity.value,
    };
  });

  const xStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: xScale.value }],
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
        <Animated.View style={xStyle}>
          <Ionicons name="close" size={size * 0.6} color="#FFFFFF" />
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

