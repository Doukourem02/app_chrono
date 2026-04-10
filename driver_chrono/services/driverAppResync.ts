import { useDriverStore } from "../store/useDriverStore";
import { logger } from "../utils/logger";
import { apiService } from "./apiService";
import { driverMessageSocketService } from "./driverMessageSocketService";
import { orderSocketService } from "./orderSocketService";

const RESYNC_DEBOUNCE_MS = 2000;
let lastDriverAppResyncAt = 0;

async function syncDriverProfiles(userId: string): Promise<void> {
  const [profileResult, userProfileResult] = await Promise.all([
    apiService.getDriverProfile(userId),
    apiService.getUserProfile(userId),
  ]);

  if (profileResult.success && profileResult.data) {
    useDriverStore.getState().setProfile(profileResult.data);
  }

  if (userProfileResult.success && userProfileResult.data) {
    const cur = useDriverStore.getState().user;
    if (cur) {
      useDriverStore.getState().setUser({
        ...cur,
        first_name: userProfileResult.data.first_name ?? cur.first_name,
        last_name: userProfileResult.data.last_name ?? cur.last_name,
        phone: userProfileResult.data.phone ?? cur.phone,
      });
    }
  }
}

/**
 * Après retour réseau ou premier plan : profil driver + user, sockets, puis redemande l’état commandes au serveur.
 */
export async function runDriverAppResync(userId: string): Promise<void> {
  const tokenResult = await apiService.ensureAccessToken();
  if (!tokenResult.token) return;

  const now = Date.now();
  if (now - lastDriverAppResyncAt < RESYNC_DEBOUNCE_MS) return;
  lastDriverAppResyncAt = now;

  const online = useDriverStore.getState().isOnline;
  orderSocketService.syncAfterAccessTokenRefresh(userId, online);
  driverMessageSocketService.syncAfterAccessTokenRefresh(userId);

  try {
    await syncDriverProfiles(userId);
  } catch (e) {
    logger.warn("driverAppResync: profil partiel", "driverAppResync", e);
  }

  orderSocketService.requestServerOrdersResync(userId);
  /** iOS peut reconnecter le socket quelques ms après le retour premier plan : re-tenter le resync offres pending. */
  setTimeout(() => orderSocketService.requestServerOrdersResync(userId), 500);
  setTimeout(() => orderSocketService.requestServerOrdersResync(userId), 1800);

  driverMessageSocketService.reassertDriverPresence(userId);
}
