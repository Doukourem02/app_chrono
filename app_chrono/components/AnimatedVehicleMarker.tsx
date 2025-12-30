import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Image } from 'react-native';

interface AnimatedVehicleMarkerProps {
  vehicleType: 'moto' | 'vehicule' | 'cargo';
  bearing: number; // Angle en degrés (0-360)
  size?: number;
}

/**
 * Composant pour afficher un marqueur de livreur animé avec rotation
 * Utilise l'image deliveryman.png qui représente un livreur sur scooter
 * La rotation suit la direction du mouvement (comme Yango)
 */
export const AnimatedVehicleMarker: React.FC<AnimatedVehicleMarkerProps> = ({
  vehicleType,
  bearing,
  size = 64, // Taille augmentée pour mieux voir le livreur
}) => {
  const rotationAnim = useRef(new Animated.Value(bearing)).current;
  const previousBearingRef = useRef<number | null>(null);

  // Animer la rotation de manière fluide
  useEffect(() => {
    if (previousBearingRef.current === null) {
      // Première fois : définir directement
      rotationAnim.setValue(bearing);
      previousBearingRef.current = bearing;
      return;
    }

    // Calculer la différence d'angle la plus courte
    const currentAngle = previousBearingRef.current;
    let diff = bearing - currentAngle;

    // Normaliser la différence entre -180 et 180 pour prendre le chemin le plus court
    if (diff > 180) {
      diff -= 360;
    } else if (diff < -180) {
      diff += 360;
    }

    const targetAngle = currentAngle + diff;

    // Animer la rotation
    Animated.spring(rotationAnim, {
      toValue: targetAngle,
      useNativeDriver: true,
      tension: 50,
      friction: 7,
    }).start();

    previousBearingRef.current = targetAngle;
  }, [bearing, rotationAnim]);

  const animatedStyle = {
    transform: [
      {
        rotate: rotationAnim.interpolate({
          inputRange: [0, 360],
          outputRange: ['0deg', '360deg'],
        }),
      },
    ],
  };

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      {/* Cercle de pulse (effet radar) */}
      <View style={[styles.pulseOuter, { width: size + 12, height: size + 12 }]} />
      
      {/* Conteneur du livreur avec rotation */}
      <Animated.View
        style={[
          styles.driverContainer,
          { width: size, height: size },
          animatedStyle,
        ]}
      >
        <Image
          source={require('../assets/images/deliveryman.png')}
          style={[styles.driverImage, { width: size, height: size }]}
          resizeMode="contain"
        />
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  pulseOuter: {
    position: 'absolute',
    borderRadius: 1000,
    borderWidth: 2,
    borderColor: '#8B5CF6',
    backgroundColor: 'rgba(139, 92, 246, 0.15)',
    // Animation de pulse (sera géré par le parent si nécessaire)
  },
  driverContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    // Pas de fond blanc pour laisser l'image transparente visible
  },
  driverImage: {
    // L'image du livreur sera centrée et redimensionnée automatiquement
  },
});

