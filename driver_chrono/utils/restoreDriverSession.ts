import { useDriverStore, DriverProfile } from '../store/useDriverStore';
import { apiService } from '../services/apiService';
import { decodeAccessTokenPayload } from './jwtDecodePayload';
import { logger } from './logger';

function mapDriverProfile(d: Record<string, unknown>, userId: string): DriverProfile {
  return {
    id: String(d.id ?? d.user_id ?? userId),
    user_id: String(d.user_id ?? userId),
    first_name: (d.first_name as string) ?? null,
    last_name: (d.last_name as string) ?? null,
    phone: (d.phone as string) ?? null,
    license_number: d.license_number as string | undefined,
    vehicle_type: d.vehicle_type as DriverProfile['vehicle_type'],
    vehicle_plate: d.vehicle_plate as string | undefined,
    vehicle_brand: d.vehicle_brand as string | undefined,
    vehicle_model: d.vehicle_model as string | undefined,
    vehicle_color: d.vehicle_color as string | undefined,
    current_latitude: d.current_latitude as number | undefined,
    current_longitude: d.current_longitude as number | undefined,
    is_online: Boolean(d.is_online),
    is_available: Boolean(d.is_available ?? d.is_online),
    total_deliveries: Number(d.total_deliveries ?? 0),
    completed_deliveries: Number(d.completed_deliveries ?? 0),
    rating: typeof d.rating === 'number' ? d.rating : Number(d.rating ?? 0),
    total_earnings: typeof d.total_earnings === 'number' ? d.total_earnings : Number(d.total_earnings ?? 0),
    profile_image_url: d.profile_image_url as string | undefined,
    driver_type: d.driver_type as DriverProfile['driver_type'],
  };
}

/**
 * Réhydrate user + profile quand le refresh est en SecureStore mais pas user en mémoire (persist lent / tuile app).
 */
export async function tryRestoreDriverSessionFromRefresh(): Promise<boolean> {
  const { refreshToken, setUser, setProfile } = useDriverStore.getState();
  if (!refreshToken) return false;

  try {
    const { token } = await apiService.ensureAccessToken();
    if (!token) return false;

    const payload = decodeAccessTokenPayload(token);
    const userId = typeof payload?.id === 'string' ? payload.id : null;
    if (!userId) return false;

    const res = await apiService.getDriverProfile(userId);
    if (!res.success || !res.data) return false;

    const d = res.data as Record<string, unknown>;
    const uid = String(d.user_id ?? userId);
    const roleFromJwt = typeof payload?.role === 'string' ? payload.role : 'driver';
    setUser({
      id: uid,
      email: String(d.email ?? ''),
      phone: String(d.phone ?? ''),
      role: roleFromJwt,
      created_at: String(d.created_at ?? new Date().toISOString()),
      first_name: (d.first_name as string) ?? null,
      last_name: (d.last_name as string) ?? null,
    });
    setProfile(mapDriverProfile(d, uid));
    return true;
  } catch (e) {
    logger.warn('tryRestoreDriverSessionFromRefresh', undefined, e);
    return false;
  }
}
