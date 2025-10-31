import { useRef, useState } from 'react';
import { Animated, Dimensions, PanResponder } from 'react-native';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const BOTTOM_SHEET_MAX_HEIGHT = SCREEN_HEIGHT * 0.5;
const BOTTOM_SHEET_MIN_HEIGHT = 100;

export const useBottomSheet = () => {
  const animatedHeight = useRef(new Animated.Value(BOTTOM_SHEET_MIN_HEIGHT)).current;
  const [isExpanded, setIsExpanded] = useState(false);

  const panResponder = useRef(
    PanResponder.create({
      // Only become responder when a vertical drag is detected to avoid
      // stealing touches from inner ScrollViews / buttons.
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_evt, gestureState) => {
        const { dx, dy } = gestureState;
        // Only take the responder if the user is dragging mostly vertically
        // and movement is noticeable.
        return Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 4;
      },
      onPanResponderMove: (_event, gestureState) => {
        // We compute the new height starting from the expanded max and
        // subtract the gesture dy so dragging up increases height.
        const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
        const newHeight = clamp(BOTTOM_SHEET_MAX_HEIGHT - gestureState.dy, BOTTOM_SHEET_MIN_HEIGHT, BOTTOM_SHEET_MAX_HEIGHT);
        animatedHeight.setValue(newHeight);
      },
      onPanResponderRelease: (_event, gestureState) => {
        // Use velocity + distance threshold to determine final state
        if (gestureState.vy > 0.8 || gestureState.dy > 100) {
          // fast or long swipe down -> collapse
          collapse();
        } else if (gestureState.vy < -0.8 || gestureState.dy < -100) {
          // fast or long swipe up -> expand
          expand();
        } else {
          // Return to the nearest state
          Animated.spring(animatedHeight, {
            toValue: isExpanded ? BOTTOM_SHEET_MAX_HEIGHT : BOTTOM_SHEET_MIN_HEIGHT,
            useNativeDriver: false,
          }).start();
        }
      },
    })
  ).current;

  const expand = () => {
    setIsExpanded(true);
    Animated.spring(animatedHeight, {
      toValue: BOTTOM_SHEET_MAX_HEIGHT,
      useNativeDriver: false,
    }).start();
  };

  const collapse = () => {
    setIsExpanded(false);
    Animated.spring(animatedHeight, {
      toValue: BOTTOM_SHEET_MIN_HEIGHT,
      useNativeDriver: false,
    }).start();
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