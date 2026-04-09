/**
 * Initialisation synchrone du token Mapbox AVANT le premier rendu de MapView.
 * Même logique que driver_chrono/mapboxInit.ts (évite course async import().then).
 */
import { Platform } from 'react-native';
import Constants from 'expo-constants';

let done = false;

export function ensureMapboxAccessToken(): void {
  if (Platform.OS === 'web' || done) return;

  const extra = Constants.expoConfig?.extra as Record<string, unknown> | undefined;
  const token =
    (extra?.mapboxAccessToken as string | undefined) ||
    (extra?.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN as string | undefined) ||
    process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN ||
    process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;

  if (!token || String(token).length < 10) {
    return;
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Mapbox = require('@rnmapbox/maps').default;
    if (typeof Mapbox?.setAccessToken === 'function') {
      Mapbox.setAccessToken(String(token));
      done = true;
    }
  } catch {
    // Expo Go ou module natif absent
  }
}

ensureMapboxAccessToken();
