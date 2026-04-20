import { useAuthStore } from "../store/useAuthStore";
import { useOrderStore, type OrderRequest, type OrderStatus } from "../store/useOrderStore";
import { useUserDataResyncStore } from "../store/useUserDataResyncStore";
import { formatUserName } from "../utils/formatName";
import { logger } from "../utils/logger";
import { isDeliveryInProgressStatus, normalizeOrderStatus } from "../utils/orderStatusNormalize";
import { userApiService } from "./userApiService";
import { userOrderSocketService } from "./userOrderSocketService";

const RESYNC_DEBOUNCE_MS = 2000;
let lastUserAppResyncAt = 0;

/** Aligné sur `order-tracking/[orderId].tsx` (vérité serveur pour le store). */
function formatApiDeliveryRow(order: any): OrderRequest {
  const orderStatus: OrderStatus =
    normalizeOrderStatus(order.status) ?? ((order.status || "pending") as OrderStatus);
  let proof: OrderRequest["proof"];
  if (order.proof) {
    try {
      proof =
        typeof order.proof === "string" ? JSON.parse(order.proof) : order.proof;
    } catch {
      proof = undefined;
    }
  }
  return {
    id: order.id,
    user: { id: order.user_id, name: formatUserName(order.user) },
    driver: order.driver_id
      ? {
          id: order.driver_id,
          first_name: order.driver?.first_name,
          last_name: order.driver?.last_name,
          name:
            order.driver?.first_name && order.driver?.last_name
              ? `${order.driver.first_name} ${order.driver.last_name}`.trim()
              : order.driver?.first_name ||
                order.driver?.last_name ||
                formatUserName(order.driver, "Livreur"),
          phone: order.driver?.phone,
          email: order.driver?.email,
          avatar: order.driver?.avatar || order.driver?.profile_image_url || order.driver?.avatar_url,
          avatar_url: order.driver?.avatar_url || order.driver?.profile_image_url || order.driver?.avatar,
          profile_image_url: order.driver?.profile_image_url || order.driver?.avatar_url || order.driver?.avatar,
          rating: order.driver?.rating,
          vehicle_plate: order.driver?.vehicle_plate || order.driver?.vehiclePlate,
          vehicle_type: order.driver?.vehicle_type || order.driver?.vehicleType,
          vehicle_brand: order.driver?.vehicle_brand || order.driver?.vehicleBrand,
          vehicle_model: order.driver?.vehicle_model || order.driver?.vehicleModel,
          vehicle_color: order.driver?.vehicle_color || order.driver?.vehicleColor,
        }
      : undefined,
    pickup: (() => {
      let parsedPickup: { address?: string; coordinates?: { latitude: number; longitude: number } } | null = null;
      try {
        if (typeof order.pickup_address === "string") {
          parsedPickup = JSON.parse(order.pickup_address);
        } else if (order.pickup_address && typeof order.pickup_address === "object") {
          parsedPickup = order.pickup_address;
        }
      } catch {
        parsedPickup = null;
      }
      return {
        address: order.pickup_address_text || parsedPickup?.address || "",
        coordinates: parsedPickup?.coordinates || { latitude: 0, longitude: 0 },
      };
    })(),
    dropoff: (() => {
      let parsedDropoff: { address?: string; coordinates?: { latitude: number; longitude: number } } | null = null;
      try {
        if (typeof order.dropoff_address === "string") {
          parsedDropoff = JSON.parse(order.dropoff_address);
        } else if (order.dropoff_address && typeof order.dropoff_address === "object") {
          parsedDropoff = order.dropoff_address;
        }
      } catch {
        parsedDropoff = null;
      }
      return {
        address: order.dropoff_address_text || parsedDropoff?.address || "",
        coordinates: parsedDropoff?.coordinates || { latitude: 0, longitude: 0 },
      };
    })(),
    price: order.price || order.price_cfa,
    deliveryMethod: order.delivery_method as "moto" | "vehicule" | "cargo",
    distance: order.distance || order.distance_km,
    estimatedDuration: String(order.estimated_duration || order.eta_minutes || ""),
    status: orderStatus,
    driverId: order.driver_id,
    createdAt: order.created_at,
    proof,
    completed_at: order.completed_at,
    cancelled_at: order.cancelled_at,
    ...(order.tracking_token || order.trackingToken
      ? { trackingToken: order.tracking_token || order.trackingToken }
      : {}),
    ...(order.delivery_qr_scanned_at
      ? { delivery_qr_scanned_at: order.delivery_qr_scanned_at }
      : {}),
  } as OrderRequest;
}

/** Exporté pour la tâche de localisation en arrière-plan (alignement commandes via API). */
export async function syncClientOrdersFromApi(userId: string): Promise<void> {
  const result = await userApiService.getUserDeliveries(userId, { limit: 100 });
  const store = useOrderStore.getState();
  const localIds = new Set(store.activeOrders.map((o) => o.id));

  if (result.success && result.data?.length) {
    for (const row of result.data) {
      const st = String(row.status || "");
      // Toujours fusionner les livraisons en cours même absentes du store (socket raté, 2e commande…).
      if (!isDeliveryInProgressStatus(st) && !localIds.has(row.id)) continue;
      try {
        const formatted = formatApiDeliveryRow(row);
        useOrderStore.getState().updateFromSocket({ order: formatted as any });
      } catch (e) {
        logger.warn("userAppResync: ligne livraison ignorée", "userAppResync", e);
      }
    }
  }

  useUserDataResyncStore.getState().bumpDeliveriesList();
}

async function syncUserProfile(userId: string): Promise<void> {
  const result = await userApiService.getUserProfile(userId);
  if (!result.success || !result.data) return;
  const cur = useAuthStore.getState().user;
  if (!cur || cur.id !== userId) return;
  useAuthStore.getState().setUser({
    ...cur,
    first_name: result.data.first_name ?? cur.first_name,
    last_name: result.data.last_name ?? cur.last_name,
    phone: result.data.phone ?? cur.phone,
  });
}

/**
 * Après retour réseau ou premier plan : commandes actives + liste + profil, puis demande resync socket.
 */
export async function runUserAppResync(userId: string): Promise<void> {
  const token = await userApiService.ensureAccessToken();
  if (!token) return;

  const now = Date.now();
  if (now - lastUserAppResyncAt < RESYNC_DEBOUNCE_MS) return;
  lastUserAppResyncAt = now;

  userOrderSocketService.syncAfterAccessTokenRefresh(userId);

  try {
    await Promise.all([syncClientOrdersFromApi(userId), syncUserProfile(userId)]);
  } catch (e) {
    logger.warn("userAppResync: erreur partielle", "userAppResync", e);
  }

  userOrderSocketService.requestServerOrdersResync(userId);
}
