import { useCallback, useEffect, useRef } from 'react';
import { Animated, Easing } from 'react-native';

interface RadarPulseOptions {
  duration?: number;
}

export const useRadarPulse = (
  isActive: boolean,
  options?: RadarPulseOptions
) => {
  const outerPulse = useRef(new Animated.Value(0)).current;
  const innerPulse = useRef(new Animated.Value(0)).current;
  const outerAnimationRef = useRef<Animated.CompositeAnimation | null>(null);
  const innerAnimationRef = useRef<Animated.CompositeAnimation | null>(null);
  const innerStartTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const duration = options?.duration ?? 1400;
  const phaseOffset = duration / 2;

  const stopPulse = useCallback(() => {
    if (outerAnimationRef.current) {
      outerAnimationRef.current.stop();
      outerAnimationRef.current = null;
    }
    if (innerAnimationRef.current) {
      innerAnimationRef.current.stop();
      innerAnimationRef.current = null;
    }
    if (innerStartTimeoutRef.current) {
      clearTimeout(innerStartTimeoutRef.current);
      innerStartTimeoutRef.current = null;
    }

    outerPulse.stopAnimation(() => {
      outerPulse.setValue(0);
    });
    innerPulse.stopAnimation(() => {
      innerPulse.setValue(0);
    });
  }, [outerPulse, innerPulse]);

  const startPulse = useCallback(() => {
    stopPulse();
    outerPulse.setValue(0);
    innerPulse.setValue(0);

    const createLoop = (anim: Animated.Value) =>
      Animated.loop(
        Animated.timing(anim, {
          toValue: 1,
          duration,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        { resetBeforeIteration: true }
      );

    const outerLoop = createLoop(outerPulse);
    outerAnimationRef.current = outerLoop;
    outerLoop.start();

    innerStartTimeoutRef.current = setTimeout(() => {
      const innerLoop = createLoop(innerPulse);
      innerAnimationRef.current = innerLoop;
      innerLoop.start();
    }, phaseOffset);
  }, [duration, outerPulse, innerPulse, phaseOffset, stopPulse]);

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
    outerPulse,
    innerPulse,
    startPulse,
    stopPulse,
  };
};

