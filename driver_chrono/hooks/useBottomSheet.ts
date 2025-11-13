import { useRef, useState } from 'react';
import { Animated, Dimensions, PanResponder } from 'react-native';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const BOTTOM_SHEET_MAX_HEIGHT = SCREEN_HEIGHT * 0.85;
const BOTTOM_SHEET_MIN_HEIGHT = 100;

export const useBottomSheet = () => {
  const animatedHeight = useRef(new Animated.Value(BOTTOM_SHEET_MIN_HEIGHT)).current;
  const [isExpanded, setIsExpanded] = useState(false);
  const currentAnimationRef = useRef<Animated.CompositeAnimation | null>(null);
  const startHeightRef = useRef<number>(BOTTOM_SHEET_MIN_HEIGHT);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_evt, gestureState) => {
        const { dx, dy } = gestureState;
        return Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 4;
      },
      onPanResponderGrant: () => {
        
        if (currentAnimationRef.current) {
          currentAnimationRef.current.stop();
          currentAnimationRef.current = null;
        }
      
        animatedHeight.stopAnimation((currentValue) => {
          startHeightRef.current = currentValue || BOTTOM_SHEET_MIN_HEIGHT;
        });
      },
      onPanResponderMove: (_event, gestureState) => {
      
        if (currentAnimationRef.current) {
          currentAnimationRef.current.stop();
          currentAnimationRef.current = null;
        }
        const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
        // Calculer la nouvelle hauteur basée sur la valeur de départ stockée
        const newHeight = clamp(startHeightRef.current - gestureState.dy, BOTTOM_SHEET_MIN_HEIGHT, BOTTOM_SHEET_MAX_HEIGHT);
        // Utiliser setValue maintenant que l'animation est arrêtée
        animatedHeight.setValue(newHeight);
      },
      onPanResponderRelease: (_event, gestureState) => {
        if (gestureState.vy > 0.8 || gestureState.dy > 100) {
          collapse();
        } else if (gestureState.vy < -0.8 || gestureState.dy < -100) {
          expand();
        } else {
          const animation = Animated.spring(animatedHeight, {
            toValue: isExpanded ? BOTTOM_SHEET_MAX_HEIGHT : BOTTOM_SHEET_MIN_HEIGHT,
            useNativeDriver: false,
          });
          currentAnimationRef.current = animation;
          animation.start(() => {
            currentAnimationRef.current = null;
          });
        }
      },
    })
  ).current;

  const expand = () => {
    setIsExpanded(true);
    
    if (currentAnimationRef.current) {
      currentAnimationRef.current.stop();
      currentAnimationRef.current = null;
    }
    const animation = Animated.spring(animatedHeight, {
      toValue: BOTTOM_SHEET_MAX_HEIGHT,
      useNativeDriver: false,
      tension: 65,
      friction: 8,
    });
    currentAnimationRef.current = animation;
    animation.start(() => {
      currentAnimationRef.current = null;
    });
  };

  const collapse = () => {
    setIsExpanded(false);
  
    if (currentAnimationRef.current) {
      currentAnimationRef.current.stop();
      currentAnimationRef.current = null;
    }
    const animation = Animated.spring(animatedHeight, {
      toValue: BOTTOM_SHEET_MIN_HEIGHT,
      useNativeDriver: false,
      tension: 65,
      friction: 8,
    });
    currentAnimationRef.current = animation;
    animation.start(() => {
      currentAnimationRef.current = null;
    });
  };

  const toggle = () => {
    if (isExpanded) {
      collapse();
    } else {
      expand();
    }
  };

  return {
    animatedHeight,
    isExpanded,
    panResponder,
    expand,
    collapse,
    toggle,
  };
};

