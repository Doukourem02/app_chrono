import React, { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withRepeat,
  withTiming,
  interpolate,
  Extrapolate,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';

interface PullToRefreshIndicatorProps {
  progress: number;
  refreshing: boolean;
}

export const PullToRefreshIndicator: React.FC<PullToRefreshIndicatorProps> = ({
  progress,
  refreshing,
}) => {
  const rotation = useSharedValue(0);
  const scale = useSharedValue(0.5);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (refreshing) {
      rotation.value = withRepeat(
        withTiming(360, { duration: 1000 }),
        -1,
        false
      );
      scale.value = withSpring(1, {
        damping: 10,
        stiffness: 100,
      });
      opacity.value = withTiming(1, { duration: 200 });
    } else {
      rotation.value = 0;
      scale.value = interpolate(
        progress,
        [0, 0.5, 1],
        [0.5, 0.75, 1],
        Extrapolate.CLAMP
      );
      opacity.value = interpolate(
        progress,
        [0, 0.5, 1],
        [0, 0.5, 1],
        Extrapolate.CLAMP
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshing, progress]);

  const animatedStyle = useAnimatedStyle(() => {
    const rotate = refreshing
      ? rotation.value
      : interpolate(
          progress,
          [0, 1],
          [0, 180],
          Extrapolate.CLAMP
        );

    return {
      transform: [
        { rotate: `${rotate}deg` },
        { scale: scale.value },
      ],
      opacity: opacity.value,
    };
  });

  return (
    <Animated.View style={[styles.container, animatedStyle]}>
      <Ionicons name="refresh" size={24} color="#8B5CF6" />
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 10,
  },
});

