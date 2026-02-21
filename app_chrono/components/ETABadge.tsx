/**
 * Badge ETA style Yango : bulle avec bec, double couche, ombre non coupée
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface ETABadgeProps {
  value: string;
  unit: string;
  /** 'bottom' = bec en bas (pour marqueur en dessous), 'top' = bec en haut (pour marqueur au-dessus) */
  tailPosition?: 'bottom' | 'top';
}

export function ETABadge({ value, unit, tailPosition = 'bottom' }: ETABadgeProps) {
  const tailStyle = tailPosition === 'top' ? styles.tailTop : styles.tail;
  return (
    <View style={[styles.wrapper, tailPosition === 'top' && styles.wrapperTailTop]}>
      {tailPosition === 'top' && <View style={tailStyle} />}
      <View style={styles.outerBubble}>
        <View style={styles.innerBubble}>
          <Text style={styles.valueText}>{value}</Text>
          <Text style={styles.unitText}>{unit}</Text>
        </View>
      </View>
      {tailPosition === 'bottom' && <View style={tailStyle} />}
    </View>
  );
}

const BUBBLE_SIZE = 48;
const TAIL_SIZE = 10;

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    marginBottom: 4,
    // Pas de overflow: 'hidden' pour ne pas couper l'ombre
  },
  outerBubble: {
    backgroundColor: '#FFFFFF',
    padding: 4,
    borderRadius: 14,
    minWidth: BUBBLE_SIZE,
    minHeight: BUBBLE_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 8,
  },
  innerBubble: {
    backgroundColor: '#8B5CF6',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 6,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: BUBBLE_SIZE - 8,
    minHeight: BUBBLE_SIZE - 8,
  },
  valueText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '800',
    lineHeight: 22,
  },
  unitText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
    marginTop: -2,
  },
  tail: {
    width: 0,
    height: 0,
    borderLeftWidth: TAIL_SIZE,
    borderRightWidth: TAIL_SIZE,
    borderTopWidth: TAIL_SIZE,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: '#FFFFFF',
    marginTop: -2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 4,
  },
  wrapperTailTop: { marginBottom: 0, marginTop: 4 },
  tailTop: {
    width: 0,
    height: 0,
    borderLeftWidth: TAIL_SIZE,
    borderRightWidth: TAIL_SIZE,
    borderBottomWidth: TAIL_SIZE,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: '#FFFFFF',
    marginBottom: -2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 4,
  },
});
