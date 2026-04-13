import { useCallback, useMemo, useRef, useState } from 'react';
import { Animated, Dimensions, Easing, PanResponder, Platform } from 'react-native';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const BOTTOM_SHEET_MIN_HEIGHT = 100;

export type UseBottomSheetOptions = {
  /**
   * Hauteur du sheet une fois ouvert (fraction de l’écran). Défaut 0.5.
   */
  expandedHeightFraction?: number;
  /**
   * Hauteur au focus des champs adresse (style Yango). Si omis, identique à expanded.
   */
  addressInputHeightFraction?: number;
};

export const useBottomSheet = (options?: UseBottomSheetOptions) => {
  const expandedHeight = useMemo(
    () => SCREEN_HEIGHT * (options?.expandedHeightFraction ?? 0.5),
    [options?.expandedHeightFraction]
  );
  const addressInputHeight = useMemo(() => {
    const f = options?.addressInputHeightFraction;
    if (f == null) return expandedHeight;
    return SCREEN_HEIGHT * f;
  }, [options?.addressInputHeightFraction, expandedHeight]);
  const maxDragHeight = useMemo(
    () => Math.max(expandedHeight, addressInputHeight),
    [expandedHeight, addressInputHeight]
  );

  const animatedHeight = useRef(new Animated.Value(BOTTOM_SHEET_MIN_HEIGHT)).current;
  const [isExpanded, setIsExpanded] = useState(false);
  const [isAddressInputExpanded, setIsAddressInputExpanded] = useState(false);

  const sheetMetricsRef = useRef({
    expandedHeight,
    addressInputHeight,
    maxDragHeight,
    minHeight: BOTTOM_SHEET_MIN_HEIGHT,
  });
  sheetMetricsRef.current = {
    expandedHeight,
    addressInputHeight,
    maxDragHeight,
    minHeight: BOTTOM_SHEET_MIN_HEIGHT,
  };

  const isExpandedRef = useRef(isExpanded);
  isExpandedRef.current = isExpanded;
  const isAddressInputExpandedRef = useRef(isAddressInputExpanded);
  isAddressInputExpandedRef.current = isAddressInputExpanded;

  const springTo = useCallback((toValue: number) => {
    if (Platform.OS === 'android') {
      Animated.timing(animatedHeight, {
        toValue,
        duration: 260,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }).start();
      return;
    }
    Animated.spring(animatedHeight, {
      toValue,
      useNativeDriver: false,
      tension: 65,
      friction: 8,
    }).start();
  }, [animatedHeight]);

  const expandedTargetHeight = useCallback(() => {
    const { expandedHeight: expH, addressInputHeight: addrH } = sheetMetricsRef.current;
    return isAddressInputExpandedRef.current && addrH > expH ? addrH : expH;
  }, []);

  const expand = useCallback(() => {
    setIsAddressInputExpanded(false);
    setIsExpanded(true);
    springTo(expandedHeight);
  }, [expandedHeight, springTo]);

  const expandForAddressInput = useCallback(() => {
    if (addressInputHeight <= expandedHeight) {
      expand();
      return;
    }
    setIsAddressInputExpanded(true);
    setIsExpanded(true);
    springTo(addressInputHeight);
  }, [addressInputHeight, expandedHeight, expand, springTo]);

  const restoreAfterAddressInput = useCallback(() => {
    setIsAddressInputExpanded(false);
    if (isExpandedRef.current) {
      springTo(expandedHeight);
    }
  }, [expandedHeight, springTo]);

  const collapse = useCallback(() => {
    setIsAddressInputExpanded(false);
    setIsExpanded(false);
    springTo(BOTTOM_SHEET_MIN_HEIGHT);
  }, [springTo]);

  const toggle = useCallback(() => {
    if (isExpandedRef.current) {
      collapse();
    } else {
      expand();
    }
  }, [collapse, expand]);

  const panGestureApiRef = useRef({
    springTo: springTo as (v: number) => void,
    expand,
    expandedTargetHeight,
  });
  panGestureApiRef.current = { springTo, expand, expandedTargetHeight };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_evt, gestureState) => {
        const { dx, dy } = gestureState;
        return Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 4;
      },
      onPanResponderMove: (_event, gestureState) => {
        const { maxDragHeight: maxH, minHeight } = sheetMetricsRef.current;
        const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
        const newHeight = clamp(maxH - gestureState.dy, minHeight, maxH);
        animatedHeight.setValue(newHeight);
      },
      onPanResponderRelease: (_event, gestureState) => {
        const { springTo: st, expand: ex, expandedTargetHeight: targetH } = panGestureApiRef.current;
        const expanded = isExpandedRef.current;
        if (gestureState.vy > 0.8 || gestureState.dy > 100) {
          setIsAddressInputExpanded(false);
          setIsExpanded(false);
          st(BOTTOM_SHEET_MIN_HEIGHT);
        } else if (gestureState.vy < -0.8 || gestureState.dy < -100) {
          if (!expanded) {
            ex();
          } else {
            st(targetH());
          }
        } else {
          st(expanded ? targetH() : BOTTOM_SHEET_MIN_HEIGHT);
        }
      },
    })
  ).current;

  return {
    animatedHeight,
    isExpanded,
    isAddressInputExpanded,
    panResponder,
    expand,
    expandForAddressInput,
    restoreAfterAddressInput,
    collapse,
    toggle,
  };
};