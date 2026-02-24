/**
 * Écran de navigation professionnelle type Yango/Uber
 * - Bandeau bleu instruction (haut)
 * - Bloc vitesse + limite (gauche)
 * - Boutons Message, Paramètres, Boussole (droite)
 * - Widget météo (bas droite)
 * - Vue 3D, mode nuit, full screen
 */
import React, { useCallback, useState, useEffect } from 'react';
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
import { useWeather } from '../hooks/useWeather';

type Coords = { latitude: number; longitude: number };

interface MapboxNavigationScreenProps {
  origin: Coords;
  destination: Coords;
  onArrive: () => void;
  onCancel: () => void;
  onMessagePress?: () => void;
  onSettingsPress?: () => void;
}

let MapboxNavigation: React.ComponentType<any> | null = null;
try {
  // Optional native module - use require for sync try/catch when module may not be linked
  // eslint-disable-next-line @typescript-eslint/no-require-imports
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
  onMessagePress,
  onSettingsPress,
}: MapboxNavigationScreenProps) {
  const insets = useSafeAreaInsets();
  const [currentSpeedKmh, setCurrentSpeedKmh] = useState<number | null>(null);
  const [navLocation, setNavLocation] = useState<Coords | null>(null);

  const { weather } = useWeather({
    latitude: navLocation?.latitude ?? null,
    longitude: navLocation?.longitude ?? null,
    enabled: !!navLocation,
  });

  const handleError = useCallback((event: { nativeEvent: { message: string } }) => {
    Alert.alert('Erreur navigation', event.nativeEvent.message);
  }, []);

  const handleLocationChange = useCallback((event: { nativeEvent?: { speed?: number; latitude?: number; longitude?: number } }) => {
    const ev = event?.nativeEvent;
    if (ev?.speed != null && ev.speed >= 0) {
      setCurrentSpeedKmh(Math.round(ev.speed * 3.6));
    }
    if (ev?.latitude != null && ev?.longitude != null) {
      setNavLocation({ latitude: ev.latitude, longitude: ev.longitude });
    }
  }, []);

  useEffect(() => {
    setNavLocation(origin);
  }, [origin]);

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

  const getWeatherIcon = (): 'partly-sunny' | 'rainy' | 'cloudy' | 'sunny' => {
    if (!weather) return 'partly-sunny';
    const c = weather.condition?.toLowerCase() || '';
    if (c.includes('rain') || c.includes('pluie')) return 'rainy';
    if (c.includes('cloud') || c.includes('nuage')) return 'cloudy';
    if (c.includes('clear') || c.includes('dégagé')) return 'sunny';
    return 'partly-sunny';
  };

  return (
    <View style={[StyleSheet.absoluteFill, styles.navContainer]}>
      <MapboxNavigation
        style={styles.mapboxNav}
        origin={originArr}
        destination={destArr}
        mute={false}
        showsEndOfRouteFeedback={false}
        hideStatusView={true}
        onLocationChange={handleLocationChange}
        onRouteProgressChange={() => {}}
        onError={handleError}
        onCancelNavigation={onCancel}
        onArrive={onArrive}
      />
      {/* Bouton Retour (gauche haut) */}
      <TouchableOpacity
        style={[styles.overlayBack, { top: insets.top + 8 }]}
        onPress={onCancel}
        activeOpacity={0.8}
      >
        <Ionicons name="arrow-back" size={24} color="#fff" />
      </TouchableOpacity>

      {/* Bloc vitesse (gauche) - style Yango/Uber */}
      <View style={[styles.speedBlock, { top: insets.top + 70 }]}>
        <View style={styles.speedLimitSign}>
          <Text style={styles.speedLimitText}>50</Text>
          <Text style={styles.speedLimitUnit}>km/h</Text>
        </View>
        <View style={styles.currentSpeedBox}>
          <Text style={styles.currentSpeedText}>
            {currentSpeedKmh != null ? currentSpeedKmh : '—'}
          </Text>
        </View>
      </View>

      {/* Bouton Message uniquement (UI épurée) */}
      {onMessagePress && (
        <TouchableOpacity
          style={[styles.floatingButton, styles.singleMessageButton, { top: insets.top + 70 }]}
          onPress={onMessagePress}
          activeOpacity={0.8}
        >
          <Ionicons name="chatbubble-outline" size={22} color="#fff" />
        </TouchableOpacity>
      )}

      {/* Widget météo (bas droite) */}
      <View style={[styles.weatherWidget, { bottom: insets.bottom + 24 }]}>
        <Ionicons name={getWeatherIcon()} size={18} color="#fff" />
        <Text style={styles.weatherTemp}>
          {weather ? `${Math.round(weather.temperature)}°` : '—°'}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  navContainer: {
    flex: 1,
  },
  mapboxNav: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
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
  speedBlock: {
    position: 'absolute',
    left: 16,
    zIndex: 1000,
    alignItems: 'center',
  },
  speedLimitSign: {
    backgroundColor: '#fff',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.9)',
  },
  speedLimitText: {
    fontSize: 20,
    fontWeight: '800',
    color: '#000',
  },
  speedLimitUnit: {
    fontSize: 10,
    fontWeight: '600',
    color: '#374151',
  },
  currentSpeedBox: {
    backgroundColor: 'rgba(0,0,0,0.75)',
    borderRadius: 8,
    marginTop: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    minWidth: 56,
    alignItems: 'center',
  },
  currentSpeedText: {
    fontSize: 22,
    fontWeight: '700',
    color: '#fff',
  },
  rightButtons: {
    position: 'absolute',
    right: 16,
    zIndex: 1000,
  },
  singleMessageButton: {
    position: 'absolute',
    right: 16,
    zIndex: 1000,
  },
  floatingButton: {
    marginBottom: 12,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  weatherWidget: {
    position: 'absolute',
    right: 16,
    zIndex: 1000,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
  },
  weatherTemp: {
    marginLeft: 6,
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});
