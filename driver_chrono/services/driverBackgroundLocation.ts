/**
 * Suivi de position en arrière-plan lorsque l’app n’est pas tuée (multitâche iOS / Android).
 * Permet de garder la position et la disponibilité « matching » à jour quand le livreur passe sur une autre app.
 *
 * Limite iOS : le JavaScript / Socket.IO restent suspendus en arrière-plan — les nouvelles offres
 * en temps réel passent surtout par une notification push (à brancher côté serveur + APNs).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { Platform } from 'react-native';
import { apiService } from './apiService';
import { useDriverStore } from '../store/useDriverStore';
import { logger } from '../utils/logger';

export const DRIVER_BACKGROUND_LOCATION_TASK = 'krono-driver-background-location-v1';

const DUTY_KEY = '@krono_driver_background_duty';

export async function setDriverBackgroundDutyUser(userId: string | null): Promise<void> {
  if (!userId) {
    await AsyncStorage.removeItem(DUTY_KEY);
    return;
  }
  await AsyncStorage.setItem(DUTY_KEY, JSON.stringify({ userId, t: Date.now() }));
}

export async function clearDriverBackgroundDutyUser(): Promise<void> {
  await AsyncStorage.removeItem(DUTY_KEY);
}

async function readDutyUserId(): Promise<string | null> {
  try {
    const raw = await AsyncStorage.getItem(DUTY_KEY);
    if (!raw) return null;
    const j = JSON.parse(raw) as { userId?: string };
    return typeof j.userId === 'string' ? j.userId : null;
  } catch {
    return null;
  }
}

if (Platform.OS !== 'web') {
  TaskManager.defineTask(DRIVER_BACKGROUND_LOCATION_TASK, async ({ data, error }) => {
    if (error) {
      logger.warn('[bg-location] tâche erreur', 'driverBgLocation', String(error));
      return;
    }
    if (!data) return;

    const payload = data as { locations?: Location.LocationObject[] };
    const loc = payload.locations?.[0];
    if (!loc?.coords) return;

    try {
      if (!useDriverStore.persist.hasHydrated()) {
        await new Promise<void>((resolve) => {
          const unsub = useDriverStore.persist.onFinishHydration(() => {
            unsub?.();
            resolve();
          });
        });
      }
    } catch {
      /* ignore */
    }

    const userId = await readDutyUserId();
    if (!userId) return;

    const tokenResult = await apiService.ensureAccessToken();
    if (!tokenResult.token) return;

    const r = await apiService.updateDriverLocation(
      userId,
      loc.coords.latitude,
      loc.coords.longitude
    );
    if (!r.success && __DEV__) {
      logger.debug('[bg-location] updateDriverLocation échoué', 'driverBgLocation', r.message);
    }
  });
}

/**
 * À appeler quand le livreur passe « En ligne » (app au premier plan) pour pouvoir
 * démarrer le suivi en arrière-plan ensuite.
 */
export async function requestBackgroundLocationPermissionForDuty(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  const fg = await Location.getForegroundPermissionsAsync();
  if (fg.status !== Location.PermissionStatus.GRANTED) return false;
  const bg = await Location.getBackgroundPermissionsAsync();
  if (bg.status === Location.PermissionStatus.GRANTED) return true;
  const res = await Location.requestBackgroundPermissionsAsync();
  return res.status === Location.PermissionStatus.GRANTED;
}

export async function startDriverBackgroundLocation(userId: string): Promise<boolean> {
  if (Platform.OS === 'web' || !userId) return false;

  try {
    const already = await Location.hasStartedLocationUpdatesAsync(DRIVER_BACKGROUND_LOCATION_TASK);
    if (already) {
      await setDriverBackgroundDutyUser(userId);
      return true;
    }

    const fg = await Location.getForegroundPermissionsAsync();
    if (fg.status !== Location.PermissionStatus.GRANTED) {
      logger.warn('[bg-location] pas de permission premier plan', 'driverBgLocation');
      return false;
    }

    let bg = await Location.getBackgroundPermissionsAsync();
    if (bg.status !== Location.PermissionStatus.GRANTED) {
      bg = await Location.requestBackgroundPermissionsAsync();
      if (bg.status !== Location.PermissionStatus.GRANTED) {
        logger.warn(
          '[bg-location] permission « Toujours » refusée — suivi en arrière-plan limité',
          'driverBgLocation'
        );
        return false;
      }
    }

    await setDriverBackgroundDutyUser(userId);

    await Location.startLocationUpdatesAsync(DRIVER_BACKGROUND_LOCATION_TASK, {
      accuracy: Location.Accuracy.Balanced,
      distanceInterval: 50,
      timeInterval: 20000,
      deferredUpdatesDistance: 80,
      deferredUpdatesInterval: 45000,
      showsBackgroundLocationIndicator: true,
      activityType: Location.ActivityType.AutomotiveNavigation,
      pausesUpdatesAutomatically: true,
      foregroundService: {
        notificationTitle: 'Krono Pro — suivi actif',
        notificationBody: 'Mise à jour de position pour les courses.',
        notificationColor: '#8B5CF6',
      },
    });

    logger.info('[bg-location] démarré', 'driverBgLocation', { userId: userId.slice(0, 8) });
    return true;
  } catch (e) {
    logger.warn('[bg-location] start échoué', 'driverBgLocation', e);
    await clearDriverBackgroundDutyUser();
    return false;
  }
}

export async function stopDriverBackgroundLocation(): Promise<void> {
  if (Platform.OS === 'web') return;

  try {
    await clearDriverBackgroundDutyUser();
    const started = await Location.hasStartedLocationUpdatesAsync(DRIVER_BACKGROUND_LOCATION_TASK);
    if (started) {
      await Location.stopLocationUpdatesAsync(DRIVER_BACKGROUND_LOCATION_TASK);
    }
    if (__DEV__) {
      logger.debug('[bg-location] arrêté', 'driverBgLocation');
    }
  } catch (e) {
    logger.warn('[bg-location] stop échoué', 'driverBgLocation', e);
  }
}
