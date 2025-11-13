import React, { useEffect } from 'react';
import { ViewStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
} from 'react-native-reanimated';

interface ScreenTransitionProps {
  children: React.ReactNode;
  style?: ViewStyle;
  direction?: 'left' | 'right' | 'up' | 'down' | 'fade';
  duration?: number;
}

export const ScreenTransition: React.FC<ScreenTransitionProps> = ({
  children,
  style,
  direction = 'fade',
  duration = 300,
}) => {
  const opacity = useSharedValue(0);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);

  useEffect(() => {
    opacity.value = withTiming(1, { duration });

    switch (direction) {
      case 'left':
        translateX.value = -50;
        translateX.value = withSpring(0, {
          damping: 15,
          stiffness: 100,
        });
        break;
      case 'right':
        translateX.value = 50;
        translateX.value = withSpring(0, {
          damping: 15,
          stiffness: 100,
        });
        break;
      case 'up':
        translateY.value = -50;
        translateY.value = withSpring(0, {
          damping: 15,
          stiffness: 100,
        });
        break;
      case 'down':
        translateY.value = 50;
        translateY.value = withSpring(0, {
          damping: 15,
          stiffness: 100,
        });
        break;
      default:
        break;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [direction, duration]);

  const animatedStyle = useAnimatedStyle(() => {
    const transforms: any[] = [];
    
    if (direction === 'left' || direction === 'right') {
      transforms.push({ translateX: translateX.value });
    }
    if (direction === 'up' || direction === 'down') {
      transforms.push({ translateY: translateY.value });
    }

    return {
      opacity: opacity.value,
      transform: transforms.length > 0 ? transforms : undefined,
    };
  });

  return (
    <Animated.View style={[animatedStyle, style]}>
      {children}
    </Animated.View>
  );
};

