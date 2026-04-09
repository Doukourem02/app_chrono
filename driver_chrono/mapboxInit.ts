/**
 * Initialisation synchrone du token Mapbox AVANT le premier rendu de MapView.
 * L'ancien code dans _layout utilisait import().then(...) : la carte montait souvent
 * avant setAccessToken → tuiles absentes, écran noir avec logo Mapbox seul.
 */
import { Platform } from 'react-native';
import Constants from 'expo-constants';

let done = false;

export function ensureMapboxAccessToken(): void {
  if (Platform.OS === 'web' || done) return;

  // En build EAS, `extra` (app.config.js) est la source la plus fiable ; process.env peut diverger selon le bundler.
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
    // require synchrone : disponible dès le chargement du bundle natif
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
