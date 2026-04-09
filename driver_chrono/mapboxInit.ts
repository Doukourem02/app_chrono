/**
 * Initialisation synchrone du token Mapbox AVANT le premier rendu de MapView.
 * L'ancien code dans _layout utilisait import().then(...) : la carte montait souvent
 * avant setAccessToken → tuiles absentes, écran noir avec logo Mapbox seul.
 *
 * WebSocket / Socket.IO n’alimente pas la carte : si la carte est noire, c’est presque
 * toujours token manquant, expiré, ou scopes URL refusés (401 sur api.mapbox.com).
 */
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { config } from './config';

let lastSetToken: string | null = null;

function resolveMapboxToken(): string | undefined {
  const extra = Constants.expoConfig?.extra as Record<string, unknown> | undefined;
  const candidates = [
    extra?.mapboxAccessToken,
    extra?.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN,
    config.mapboxAccessToken,
    process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN,
    process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN,
  ];
  for (const c of candidates) {
    const s = typeof c === 'string' ? c.trim() : '';
    if (s.length >= 10 && !s.startsWith('<')) {
      return s;
    }
  }
  return undefined;
}

export function ensureMapboxAccessToken(): void {
  if (Platform.OS === 'web') return;

  const token = resolveMapboxToken();
  if (!token) {
    return;
  }
  if (lastSetToken === token) {
    return;
  }

  try {
    // require synchrone : disponible dès le chargement du bundle natif
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Mapbox = require('@rnmapbox/maps').default;
    if (typeof Mapbox?.setAccessToken === 'function') {
      Mapbox.setAccessToken(token);
      lastSetToken = token;
    }
  } catch {
    // Expo Go ou module natif absent
  }
}

ensureMapboxAccessToken();
