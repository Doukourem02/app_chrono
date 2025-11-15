import React, { useEffect } from 'react';
import { ViewStyle, TouchableOpacity } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withDelay,
} from 'react-native-reanimated';

interface AnimatedCardProps {
  children: React.ReactNode;
  style?: ViewStyle | ViewStyle[];
  index?: number;
  delay?: number;
  onPress?: () => void;
}

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

export const AnimatedCard: React.FC<AnimatedCardProps> = ({
  children,
  style,
  index = 0,
  delay = 0,
  onPress,
}) => {
  const translateY = useSharedValue(50);
  const opacity = useSharedValue(1); // Commencer à 1 pour éviter la disparition
  const scale = useSharedValue(0.95);

  useEffect(() => {
    const animationDelay = delay + index * 100;

    // Réinitialiser les valeurs
    translateY.value = 30;
    opacity.value = 1; // Toujours visible
    scale.value = 0.95;

    // Animer seulement translateY et scale, pas opacity
    translateY.value = withDelay(
      animationDelay,
      withSpring(0, {
        damping: 15,
        stiffness: 100,
      })
    );

    scale.value = withDelay(
      animationDelay,
      withSpring(1, {
        damping: 15,
        stiffness: 100,
      })
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [delay, index]);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { translateY: translateY.value },
        { scale: scale.value },
      ],
      opacity: opacity.value, // Toujours 1, donc toujours visible
    };
  });

  if (onPress) {
    return (
      <AnimatedTouchable
        style={[style, animatedStyle]}
        onPress={onPress}
        activeOpacity={0.7}
      >
        {children}
      </AnimatedTouchable>
    );
  }

  return (
    <Animated.View style={[style, animatedStyle]}>
      {children}
    </Animated.View>
  );
};

