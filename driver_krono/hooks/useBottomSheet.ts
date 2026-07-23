import { useRef, useState } from 'react';
import { Animated, Dimensions, PanResponder } from 'react-native';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

const NAV_BAR_HEIGHT = 80;
const NAV_BAR_BOTTOM = 25;
const SPACING_ABOVE_NAV = 15;
const BOTTOM_OFFSET = NAV_BAR_HEIGHT + NAV_BAR_BOTTOM + SPACING_ABOVE_NAV;
const BOTTOM_SHEET_MIN_HEIGHT = 120;
/** Hauteur panneau ouvert : laisser un peu de carte visible en haut (l’ancien `-500` plafonnait ~200px et vidait le ScrollView). */
const TOP_PEEK_FOR_MAP = 72;
const BOTTOM_SHEET_MAX_HEIGHT = Math.max(340, SCREEN_HEIGHT - BOTTOM_OFFSET - TOP_PEEK_FOR_MAP);

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
        const newHeight = clamp(startHeightRef.current - gestureState.dy, BOTTOM_SHEET_MIN_HEIGHT, BOTTOM_SHEET_MAX_HEIGHT);
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

