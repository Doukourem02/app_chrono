import { useAuthStore } from '../store/useAuthStore';
import { userApiService } from '../services/userApiService';
import { decodeAccessTokenPayload } from './jwtDecodePayload';
import { logger } from './logger';

/**
 * Quand Zustand n’a pas encore (ou plus) user/isAuthenticated mais qu’un refresh token existe
 * (SecureStore / persist), on refait une session : refresh → access → profil API → setUser.
 */
export async function tryRestoreAuthSessionFromRefresh(): Promise<boolean> {
  const { refreshToken, setUser } = useAuthStore.getState();
  if (!refreshToken) return false;

  try {
    const access = await userApiService.ensureAccessToken();
    if (!access) return false;

    const payload = decodeAccessTokenPayload(access);
    const userId = typeof payload?.id === 'string' ? payload.id : null;
    if (!userId) return false;

    const res = await userApiService.getUserProfile(userId);
    if (!res.success || !res.data) return false;

    const d = res.data;
    setUser({
      id: d.id,
      email: d.email,
      phone: d.phone || '',
      isVerified: true,
      first_name: d.first_name,
      last_name: d.last_name,
    });
    return true;
  } catch (e) {
    logger.warn('tryRestoreAuthSessionFromRefresh', undefined, e);
    return false;
  }
}
