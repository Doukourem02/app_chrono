import React from 'react';
import { View, StyleSheet } from 'react-native';

interface OnlineDriverMarkerProps {
  color?: string;
  size?: number;
}

/**
 * Marqueur pour les livreurs en ligne (moto, voiture, cargo).
 * Statique : pas de pulse. Le mouvement est reflété par useAnimatedDriverPositions
 * (quand la position du livreur change, le marqueur se déplace en douceur).
 */
export const OnlineDriverMarker: React.FC<OnlineDriverMarkerProps> = ({
  color = '#8B5CF6',
  size = 16,
}) => {
  return (
    <View
      style={[
        styles.dot,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color,
        },
      ]}
    />
  );
};

const styles = StyleSheet.create({
  dot: {
    borderWidth: 2,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
});
