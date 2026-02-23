/**
 * Écran de navigation professionnelle type Yango/Mapbox
 * - Guidage vocal (Amazon Polly)
 * - Instructions tour-à-tour
 * - Reroutage trafic en temps réel
 * - Style 3D professionnel
 *
 * Option A: Fleetbase + @rnmapbox/maps en MapboxMaps v10
 * Voir NAVIGATION_SETUP.md pour la configuration complète.
 */
import React, { useCallback } from 'react';
import {
  View,
  TouchableOpacity,
  Text,
  Alert,
  Linking,
  StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { logger } from '../utils/logger';

type Coords = { latitude: number; longitude: number };

interface MapboxNavigationScreenProps {
  origin: Coords;
  destination: Coords;
  onArrive: () => void;
  onCancel: () => void;
}

let MapboxNavigation: React.ComponentType<any> | null = null;
try {
  const nav = require('@fleetbase/react-native-mapbox-navigation');
  MapboxNavigation = nav.default || nav;
} catch (e: unknown) {
  if (__DEV__) {
    logger.warn('Mapbox Navigation non chargé', 'MapboxNavigationScreen', {
      error: e instanceof Error ? e.message : String(e),
    });
  }
}

export function MapboxNavigationScreen({
  origin,
  destination,
  onArrive,
  onCancel,
}: MapboxNavigationScreenProps) {
  const insets = useSafeAreaInsets();
  const handleError = useCallback((event: { nativeEvent: { message: string } }) => {
    Alert.alert('Erreur navigation', event.nativeEvent.message);
  }, []);

  const originArr: [number, number] = [origin.longitude, origin.latitude];
  const destArr: [number, number] = [destination.longitude, destination.latitude];

  const isValidCoord = (c: [number, number]) =>
    Array.isArray(c) && c.length === 2 && Number.isFinite(c[0]) && Number.isFinite(c[1]);

  if (!isValidCoord(originArr) || !isValidCoord(destArr)) {
    return (
      <View style={[styles.fallback, { paddingTop: insets.top }]}>
        <Text style={styles.fallbackTitle}>Coordonnées invalides</Text>
        <Text style={styles.fallbackText}>
          L&apos;origine ou la destination n&apos;a pas de coordonnées GPS valides.
        </Text>
        <TouchableOpacity style={styles.backButton} onPress={onCancel}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
          <Text style={styles.backButtonText}>Retour</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const openGoogleMaps = () => {
    const o =
      origin?.latitude != null && origin?.longitude != null
        ? `${origin.latitude},${origin.longitude}`
        : '';
    const d = `${destination.latitude},${destination.longitude}`;
    const url = o
      ? `https://www.google.com/maps/dir/?api=1&origin=${o}&destination=${d}`
      : `https://www.google.com/maps/dir/?api=1&destination=${d}`;
    Linking.openURL(url).catch(() =>
      Alert.alert('Erreur', "Impossible d'ouvrir la navigation")
    );
    onCancel();
  };

  if (!MapboxNavigation) {
    // Fallback : ouvrir Google Maps directement pour une expérience navigation identique
    const handleOpenGoogleMaps = () => {
      openGoogleMaps();
    };

    return (
      <View style={[styles.fallback, { paddingTop: insets.top }]}>
        <Text style={styles.fallbackTitle}>Navigation intégrée non disponible</Text>
        <Text style={styles.fallbackText}>
          Utilisez Google Maps pour le guidage vocal et les instructions tour-à-tour.
        </Text>
        <TouchableOpacity
          style={[styles.backButton, styles.googleMapsButton]}
          onPress={handleOpenGoogleMaps}
        >
          <Ionicons name="navigate" size={24} color="#fff" />
          <Text style={styles.backButtonText}>Démarrer la navigation (Google Maps)</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.backButton} onPress={onCancel}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
          <Text style={styles.backButtonText}>Retour</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={StyleSheet.absoluteFill}>
      <MapboxNavigation
        origin={originArr}
        destination={destArr}
        mute={false}
        showsEndOfRouteFeedback
        hideStatusView
        onLocationChange={() => {}}
        onRouteProgressChange={() => {}}
        onError={handleError}
        onCancelNavigation={onCancel}
        onArrive={onArrive}
      />
      <TouchableOpacity
        style={[styles.overlayBack, { top: insets.top + 8 }]}
        onPress={onCancel}
        activeOpacity={0.8}
      >
        <Ionicons name="arrow-back" size={24} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  fallback: {
    flex: 1,
    backgroundColor: '#1F2937',
    padding: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fallbackTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 12,
    textAlign: 'center',
  },
  fallbackText: {
    fontSize: 16,
    color: '#9CA3AF',
    textAlign: 'center',
    marginBottom: 8,
  },
  googleMapsButton: {
    backgroundColor: '#4285F4',
    marginBottom: 12,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#8B5CF6',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  backButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  overlayBack: {
    position: 'absolute',
    left: 16,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
});
