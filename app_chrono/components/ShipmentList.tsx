import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  estimateDurationMinutes,
  formatDurationLabel,
} from "../services/orderApi";
import { userApiService } from "../services/userApiService";
import { useAuthStore } from "../store/useAuthStore";
import {
  OrderRequest,
  OrderStatus,
  useOrderStore,
} from "../store/useOrderStore";
import { formatUserName } from "../utils/formatName";
import { AnimatedCard, SkeletonLoader } from "./animations";
import ShipmentCard from "./ShipmentCard";

interface OrderWithDB extends OrderRequest {
  created_at?: string;
  accepted_at?: string;
  completed_at?: string;
  cancelled_at?: string;
}

const getBackgroundColor = (status: OrderStatus): string => {
  if (
    status === "pending" ||
    status === "accepted" ||
    status === "enroute" ||
    status === "picked_up" ||
    status === "delivering"
  ) {
    return "#E5D5FF";
  }
  return "#E8F0F4";
};

const getProgressColor = (status: OrderStatus): string => {
  if (
    status === "pending" ||
    status === "accepted" ||
    status === "enroute" ||
    status === "picked_up" ||
    status === "delivering"
  ) {
    return "#8B5CF6";
  }
  return "#999";
};

const getProgressPercentage = (status: OrderStatus): number => {
  switch (status) {
    case "pending":
      return 10;
    case "accepted":
      return 30;
    case "enroute":
      return 50;
    case "picked_up":
    case "delivering":
      return 80;
    case "completed":
      return 100;
    default:
      return 0;
  }
};

const PENDING_AUTO_CANCEL_DELAY_MS = 30 * 1000;

export default function ShipmentList() {
  const { user } = useAuthStore();
  const activeOrdersFromStore = useOrderStore((s) => s.activeOrders);
  const [orders, setOrders] = useState<OrderWithDB[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const autoCancelledPendingRef = useRef<Set<string>>(new Set());

  const autoCancelPendingOrders = useCallback(
    async (incomingOrders: OrderWithDB[]) => {
      const updatedOrders = [...incomingOrders];
      const now = Date.now();

      for (const order of incomingOrders) {
        const storeOrder = useOrderStore
          .getState()
          .activeOrders.find((o) => o.id === order.id);
        if (storeOrder) {
          if (
            storeOrder.status === "accepted" ||
            storeOrder.status === "enroute" ||
            storeOrder.status === "picked_up" ||
            storeOrder.status === "delivering" ||
            storeOrder.status === "completed" ||
            storeOrder.driverId ||
            storeOrder.driver?.id
          ) {
            continue;
          }
        }

        if (
          order.status !== "pending" ||
          order.driverId ||
          autoCancelledPendingRef.current.has(order.id)
        ) {
          continue;
        }

        const createdAt = order.created_at || (order as any).createdAt;
        const createdTime = createdAt ? new Date(createdAt).getTime() : 0;

        if (!createdTime) {
          console.warn("Commande sans date de création:", order.id);
          continue;
        }

        const age = now - createdTime;
        if (age < PENDING_AUTO_CANCEL_DELAY_MS) {
          continue;
        }

        const finalStoreCheck = useOrderStore
          .getState()
          .activeOrders.find((o) => o.id === order.id);
        if (
          finalStoreCheck &&
          (finalStoreCheck.status !== "pending" ||
            finalStoreCheck.driverId ||
            finalStoreCheck.driver?.id)
        ) {
          continue;
        }

        autoCancelledPendingRef.current.add(order.id);

        try {
          const result = await userApiService.cancelOrder(
            order.id,
            order.status
          );

          if (result.success) {
            useOrderStore.getState().updateOrderStatus(order.id, "cancelled");

            const targetIndex = updatedOrders.findIndex(
              (o) => o.id === order.id
            );
            if (targetIndex !== -1) {
              updatedOrders[targetIndex] = {
                ...updatedOrders[targetIndex],
                status: "cancelled",
                cancelled_at: new Date().toISOString(),
              };
            }
          } else {
            autoCancelledPendingRef.current.delete(order.id);
          }
        } catch (err: any) {
          console.error("Erreur auto-cancel pending:", order.id, err);
          autoCancelledPendingRef.current.delete(order.id);
        }
      }

      return updatedOrders;
    },
    []
  );

  const loadOrders = useCallback(async () => {
    if (!user?.id) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const result = await userApiService.getUserDeliveries(user.id, {
        page: 1,
        limit: 50,
      });

      if (result.success && result.data) {
        if (__DEV__ && result.data.length > 0) {
          console.debug("Commandes reçues:", result.data.length);
        }

        const formattedOrders = result.data.map((order: any) => {
          let pickupData = order.pickup_address || order.pickup;
          let dropoffData = order.dropoff_address || order.dropoff;

          let pickup = pickupData;
          let dropoff = dropoffData;

          try {
            if (typeof pickupData === "string") {
              pickup = JSON.parse(pickupData);
            } else if (pickupData && typeof pickupData === "object") {
              pickup = pickupData;
            } else {
              pickup = {
                address: "",
                coordinates: { latitude: 0, longitude: 0 },
              };
            }
          } catch (e) {
            console.warn("Erreur parsing pickup:", e);
            pickup = {
              address: "",
              coordinates: { latitude: 0, longitude: 0 },
            };
          }

          try {
            if (typeof dropoffData === "string") {
              dropoff = JSON.parse(dropoffData);
            } else if (dropoffData && typeof dropoffData === "object") {
              dropoff = dropoffData;
            } else {
              dropoff = {
                address: "",
                coordinates: { latitude: 0, longitude: 0 },
              };
            }
          } catch (e) {
            console.warn("Erreur parsing dropoff:", e);
            dropoff = {
              address: "",
              coordinates: { latitude: 0, longitude: 0 },
            };
          }

          const pickupAddress =
            order.pickup_address_text || pickup?.address || "";
          const dropoffAddress =
            order.dropoff_address_text || dropoff?.address || "";

          return {
            id: order.id,
            user: {
              id: order.user_id,
              name: formatUserName(order.user),
            },
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
                  avatar_url: order.driver?.avatar_url,
                  rating: order.driver?.rating,
                }
              : undefined,
            pickup: {
              address: pickupAddress,
              coordinates: pickup?.coordinates || { latitude: 0, longitude: 0 },
            },
            dropoff: {
              address: dropoffAddress,
              coordinates: dropoff?.coordinates || {
                latitude: 0,
                longitude: 0,
              },
            },
            price: order.price || order.price_cfa,
            deliveryMethod: order.delivery_method as
              | "moto"
              | "vehicule"
              | "cargo",
            distance: order.distance || order.distance_km,

            estimatedDuration: (() => {
              let duration =
                order.eta_minutes ||
                order.estimated_duration ||
                order.estimatedDuration;

              if (!duration && order.distance && order.delivery_method) {
                const distanceKm = order.distance || order.distance_km;
                if (distanceKm) {
                  const minutes = estimateDurationMinutes(
                    distanceKm,
                    order.delivery_method as "moto" | "vehicule" | "cargo"
                  );
                  return formatDurationLabel(minutes) || `${minutes} min`;
                }
              }

              if (
                duration !== null &&
                duration !== undefined &&
                duration !== ""
              ) {
                if (typeof duration === "number") {
                  return formatDurationLabel(duration) || `${duration} min`;
                }
                if (typeof duration === "string") {
                  const numericValue = parseFloat(duration);
                  if (!isNaN(numericValue) && isFinite(numericValue)) {
                    return (
                      formatDurationLabel(Math.round(numericValue)) ||
                      `${Math.round(numericValue)} min`
                    );
                  }
                  return duration;
                }
              }

              return "";
            })(),
            status: order.status as OrderStatus,
            driverId: order.driver_id,
            createdAt: order.created_at || order.createdAt,
            proof: order.proof
              ? typeof order.proof === "string"
                ? JSON.parse(order.proof)
                : order.proof
              : undefined,
            created_at: order.created_at,
            accepted_at: order.accepted_at,
            completed_at: order.completed_at,
            cancelled_at: order.cancelled_at,
          };
        }) as OrderWithDB[];

        const sanitizedOrders = await autoCancelPendingOrders(formattedOrders);

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        const inProgressOrders = sanitizedOrders.filter((order) => {
          const isInProgress =
            order.status === "pending" ||
            order.status === "accepted" ||
            order.status === "enroute" ||
            order.status === "picked_up" ||
            order.status === "delivering";
          return isInProgress;
        });

        const completedOrders = sanitizedOrders.filter((order) => {
          return order.status === "completed";
        });

        inProgressOrders.sort((a, b) => {
          const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
          const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
          return dateB - dateA;
        });

        completedOrders.sort((a, b) => {
          const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
          const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
          return dateB - dateA;
        });

        // Mapper les commandes du store avec les bonnes propriétés
        const storeActiveOrders: OrderWithDB[] = activeOrdersFromStore.map(
          (order) => ({
            ...order,
            created_at: (order as any).createdAt || (order as any).created_at,
            accepted_at:
              (order as any).acceptedAt || (order as any).accepted_at,
            completed_at:
              (order as any).completedAt || (order as any).completed_at,
            cancelled_at:
              (order as any).cancelledAt || (order as any).cancelled_at,
          })
        );

        // Combiner les commandes du store et de l'API
        // Priorité : si une commande existe dans les deux, prendre la version la plus récente (du store car elle est mise à jour en temps réel)
        const combinedOrdersMap = new Map<string, OrderWithDB>();

        // D'abord ajouter les commandes de l'API
        sanitizedOrders.forEach((apiOrder) => {
          combinedOrdersMap.set(apiOrder.id, apiOrder);
        });

        // Ensuite, écraser avec les commandes du store (plus récentes, mises à jour via WebSocket)
        storeActiveOrders.forEach((storeOrder) => {
          const existing = combinedOrdersMap.get(storeOrder.id);
          if (existing) {
            // Fusionner : prendre les données du store (plus récentes) mais garder les données complètes de l'API si manquantes
            combinedOrdersMap.set(storeOrder.id, {
              ...existing,
              ...storeOrder,
              // Garder les dates de l'API si le store n'en a pas
              created_at: storeOrder.created_at || existing.created_at,
              accepted_at: storeOrder.accepted_at || existing.accepted_at,
              completed_at: storeOrder.completed_at || existing.completed_at,
              cancelled_at: storeOrder.cancelled_at || existing.cancelled_at,
            });
          } else {
            // Commande uniquement dans le store (créée localement, pas encore dans l'API)
            combinedOrdersMap.set(storeOrder.id, storeOrder);
          }
        });

        const allCombinedOrders = Array.from(combinedOrdersMap.values());

        // Re-filtrer et re-trier pour prioriser les commandes en cours
        const inProgressCombined = allCombinedOrders.filter((order) => {
          const isInProgress =
            order.status === "pending" ||
            order.status === "accepted" ||
            order.status === "enroute" ||
            order.status === "picked_up" ||
            order.status === "delivering";
          return isInProgress;
        });

        const completedCombined = allCombinedOrders.filter((order) => {
          return order.status === "completed";
        });

        // Trier les commandes en cours par date (plus récentes en premier)
        inProgressCombined.sort((a, b) => {
          const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
          const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
          return dateB - dateA;
        });

        // Trier les commandes complétées par date (plus récentes en premier)
        completedCombined.sort((a, b) => {
          const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
          const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
          return dateB - dateA;
        });

        // Filtrer les commandes complétées aujourd'hui
        const todayCompletedCombined = completedCombined.filter((order) => {
          const orderDate = order.created_at
            ? new Date(order.created_at)
            : null;
          if (!orderDate) return false;
          const orderDateOnly = new Date(
            orderDate.getFullYear(),
            orderDate.getMonth(),
            orderDate.getDate()
          );
          const todayOnly = new Date(
            today.getFullYear(),
            today.getMonth(),
            today.getDate()
          );
          return orderDateOnly.getTime() === todayOnly.getTime();
        });

        // Construire la liste finale en priorisant les commandes en cours
        const finalOrders: OrderWithDB[] = [];

        // 1. Ajouter la première commande en cours (la plus récente)
        if (inProgressCombined.length > 0) {
          finalOrders.push(inProgressCombined[0]);
        }

        // 2. Si on a de la place, ajouter les commandes complétées aujourd'hui
        if (finalOrders.length < 2 && todayCompletedCombined.length > 0) {
          for (
            let i = 0;
            i < todayCompletedCombined.length && finalOrders.length < 2;
            i++
          ) {
            const alreadyAdded = finalOrders.some(
              (order) => order.id === todayCompletedCombined[i].id
            );
            if (!alreadyAdded) {
              finalOrders.push(todayCompletedCombined[i]);
            }
          }
        }

        // 3. Si on a encore de la place, ajouter d'autres commandes complétées
        if (finalOrders.length < 2 && completedCombined.length > 0) {
          for (
            let i = 0;
            i < completedCombined.length && finalOrders.length < 2;
            i++
          ) {
            const alreadyAdded = finalOrders.some(
              (order) => order.id === completedCombined[i].id
            );
            if (!alreadyAdded) {
              finalOrders.push(completedCombined[i]);
            }
          }
        }

        setOrders(finalOrders);
      } else {
        setOrders([]);
      }
    } catch (error) {
      console.error("Erreur chargement commandes:", error);
      setOrders([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, activeOrdersFromStore.length]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  const lastActiveOrdersHashRef = React.useRef<string>("");

  useEffect(() => {
    const unsubscribe = useOrderStore.subscribe((state) => {
      const storeActiveOrders = state.activeOrders;

      const ordersHash = storeActiveOrders
        .map((o) => `${o.id}:${o.status}`)
        .join("|");

      if (ordersHash === lastActiveOrdersHashRef.current) {
        return;
      }

      lastActiveOrdersHashRef.current = ordersHash;

      // Recharger les commandes quand le store change (ex: commande acceptée par le livreur)
      // Cela garantit que les commandes en cours sont toujours visibles
      loadOrders();

      setOrders((currentOrders) => {
        const updatedOrders = currentOrders.map((order) => {
          const storeOrder = storeActiveOrders.find((so) => so.id === order.id);

          if (storeOrder) {
            if (order.status !== storeOrder.status) {
              return {
                ...order,
                status: storeOrder.status,
                ...(storeOrder.status === "cancelled" && !order.cancelled_at
                  ? { cancelled_at: new Date().toISOString() }
                  : {}),
                ...(storeOrder.status === "completed" && !order.completed_at
                  ? { completed_at: new Date().toISOString() }
                  : {}),
              };
            }
            return order;
          }

          if (!storeOrder) {
            const wasInProgress =
              order.status === "pending" ||
              order.status === "accepted" ||
              order.status === "enroute" ||
              order.status === "picked_up" ||
              order.status === "delivering";

            if (wasInProgress) {
              if (order.status === "pending") {
                const createdAt = order.created_at || (order as any).createdAt;
                const createdTime = createdAt
                  ? new Date(createdAt).getTime()
                  : 0;
                const now = Date.now();
                if (
                  createdTime &&
                  now - createdTime >= PENDING_AUTO_CANCEL_DELAY_MS
                ) {
                  return {
                    ...order,
                    status: "cancelled" as OrderStatus,
                    cancelled_at: new Date().toISOString(),
                  };
                }
              } else {
                return {
                  ...order,
                  status: "completed" as OrderStatus,
                  completed_at: new Date().toISOString(),
                };
              }
            }
          }

          return order;
        });

        storeActiveOrders.forEach((storeOrder) => {
          if (!updatedOrders.find((o) => o.id === storeOrder.id)) {
            updatedOrders.push({
              ...storeOrder,
              created_at:
                (storeOrder as any).createdAt || (storeOrder as any).created_at,
              accepted_at:
                (storeOrder as any).acceptedAt ||
                (storeOrder as any).accepted_at,
              completed_at:
                (storeOrder as any).completedAt ||
                (storeOrder as any).completed_at,
              cancelled_at:
                (storeOrder as any).cancelledAt ||
                (storeOrder as any).cancelled_at,
            } as OrderWithDB);
          }
        });

        return updatedOrders;
      });
    });

    return () => {
      unsubscribe();
    };
  }, [loadOrders]);

  useEffect(() => {
    if (activeOrdersFromStore.length > 0) {
      loadOrders();
    }
  }, [activeOrdersFromStore.length, loadOrders]);

  useEffect(() => {
    const checkAndCancelPendingOrders = async () => {
      const pendingOrders = orders.filter(
        (order) =>
          order.status === "pending" &&
          !order.driverId &&
          !autoCancelledPendingRef.current.has(order.id)
      );

      if (pendingOrders.length === 0) return;

      const now = Date.now();
      const ordersToCancel: OrderWithDB[] = [];

      for (const order of pendingOrders) {
        const storeOrder = useOrderStore
          .getState()
          .activeOrders.find((o) => o.id === order.id);
        if (storeOrder) {
          if (
            storeOrder.status === "accepted" ||
            storeOrder.status === "enroute" ||
            storeOrder.status === "picked_up" ||
            storeOrder.status === "delivering" ||
            storeOrder.status === "completed" ||
            storeOrder.driverId ||
            storeOrder.driver?.id
          ) {
            continue;
          }
        }

        const createdAt = order.created_at || (order as any).createdAt;
        const createdTime = createdAt ? new Date(createdAt).getTime() : 0;

        if (!createdTime) {
          console.warn(
            "Commande sans date de création dans checkAndCancel:",
            order.id
          );
          continue;
        }

        const age = now - createdTime;
        if (age >= PENDING_AUTO_CANCEL_DELAY_MS) {
          ordersToCancel.push(order);
        }
      }

      if (ordersToCancel.length > 0) {
        for (const order of ordersToCancel) {
          const finalStoreCheck = useOrderStore
            .getState()
            .activeOrders.find((o) => o.id === order.id);
          if (
            finalStoreCheck &&
            (finalStoreCheck.status !== "pending" ||
              finalStoreCheck.driverId ||
              finalStoreCheck.driver?.id)
          ) {
            continue;
          }

          autoCancelledPendingRef.current.add(order.id);

          try {
            const result = await userApiService.cancelOrder(
              order.id,
              order.status
            );

            if (result.success) {
              useOrderStore.getState().updateOrderStatus(order.id, "cancelled");

              setOrders((prevOrders) =>
                prevOrders.map((o) =>
                  o.id === order.id
                    ? {
                        ...o,
                        status: "cancelled" as OrderStatus,
                        cancelled_at: new Date().toISOString(),
                      }
                    : o
                )
              );
            } else {
              autoCancelledPendingRef.current.delete(order.id);
            }
          } catch (err: any) {
            console.error(
              "Erreur auto-cancel pending:",
              order.id,
              err?.message || err
            );
            autoCancelledPendingRef.current.delete(order.id);
          }
        }
      }
    };

    checkAndCancelPendingOrders();

    const interval = setInterval(() => {
      checkAndCancelPendingOrders();
    }, 3000);

    return () => clearInterval(interval);
  }, [orders]);

  useEffect(() => {
    const hasInProgressOrders = orders.some(
      (order) =>
        order.status === "pending" ||
        order.status === "accepted" ||
        order.status === "enroute" ||
        order.status === "picked_up" ||
        order.status === "delivering"
    );

    if (hasInProgressOrders) {
      const interval = setInterval(() => {
        loadOrders();
      }, 3000);

      return () => clearInterval(interval);
    }
  }, [orders, loadOrders]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadOrders();
  }, [loadOrders]);

  if (loading && orders.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <View style={styles.skeletonContainer}>
          <SkeletonLoader width="100%" height={180} borderRadius={22} />
          <View style={{ height: 18 }} />
          <SkeletonLoader width="100%" height={180} borderRadius={22} />
        </View>
      </View>
    );
  }

  if (orders.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>Aucune commande pour le moment</Text>
      </View>
    );
  }

  return (
    <ScrollView
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <View>
        {orders.map((order, index) => (
          <AnimatedCard key={order.id} index={index} delay={0}>
            <ShipmentCard
              order={order}
              backgroundColor={getBackgroundColor(order.status)}
              progressPercentage={getProgressPercentage(order.status)}
              progressColor={getProgressColor(order.status)}
            />
          </AnimatedCard>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    padding: 20,
  },
  skeletonContainer: {
    paddingHorizontal: 0,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: "#666",
  },
  emptyContainer: {
    padding: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyText: {
    fontSize: 14,
    color: "#666",
  },
});
