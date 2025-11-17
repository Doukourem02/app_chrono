import { useCallback, useEffect, useRef } from 'react';
import { Animated } from 'react-native';

interface RadarPulseOptions {
  duration?: number;
}

export const useRadarPulse = (
  isActive: boolean,
  options?: RadarPulseOptions
) => {
  const pulseAnim = useRef(new Animated.Value(0)).current;
  const animationRef = useRef<Animated.CompositeAnimation | null>(null);

  const duration = options?.duration ?? 1400;

  const stopPulse = useCallback(() => {
    if (animationRef.current) {
      animationRef.current.stop();
      animationRef.current = null;
    }
    pulseAnim.stopAnimation(() => {
      pulseAnim.setValue(0);
    });
  }, [pulseAnim]);

  const startPulse = useCallback(() => {
    stopPulse();
    pulseAnim.setValue(0);
    const animation = Animated.loop(
      Animated.timing(pulseAnim, {
        toValue: 1,
        duration,
        useNativeDriver: true,
      }),
      {
        resetBeforeIteration: true,
      }
    );
    animationRef.current = animation;
    animation.start();
  }, [duration, pulseAnim, stopPulse]);

  useEffect(() => {
    if (isActive) {
      startPulse();
    } else {
      stopPulse();
    }

    return () => {
      stopPulse();
    };
  }, [isActive, startPulse, stopPulse]);

  return {
    pulseAnim,
    startPulse,
    stopPulse,
  };
};

