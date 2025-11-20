import React, { useEffect, useState, useCallback, useRef } from "react";
import { View, RefreshControl, ScrollView, Text, StyleSheet } from "react-native";
import ShipmentCard from "./ShipmentCard";
import { userApiService } from "../services/userApiService";
import { useAuthStore } from "../store/useAuthStore";
import { OrderRequest, OrderStatus, useOrderStore } from "../store/useOrderStore";
import { formatDurationLabel, estimateDurationMinutes } from "../services/orderApi";
import { AnimatedCard, SkeletonLoader } from "./animations";
import { userOrderSocketService } from "../services/userOrderSocketService";

interface OrderWithDB extends OrderRequest {
  created_at?: string;
  accepted_at?: string;
  completed_at?: string;
  cancelled_at?: string;
}


const getBackgroundColor = (status: OrderStatus): string => {
  // Commandes en cours (violet) - UNIQUEMENT pending, accepted, enroute, picked_up
  if (status === 'pending' || status === 'accepted' || status === 'enroute' || status === 'picked_up') {
    return '#E5D5FF'; // Violet clair pour les commandes en cours
  }
  // Commandes terminées, annulées ou refusées (bleu clair d'origine)
  // completed, cancelled, declined → toutes en bleu clair
  return '#E8F0F4'; // Bleu clair pour les commandes terminées/annulées/refusées
};


const getProgressColor = (status: OrderStatus): string => {
  // Commandes en cours (violet) - UNIQUEMENT pending, accepted, enroute, picked_up
  if (status === 'pending' || status === 'accepted' || status === 'enroute' || status === 'picked_up') {
    return '#8B5CF6'; // Violet pour les commandes en cours
  }
  // Commandes terminées, annulées ou refusées (gris d'origine)
  // completed, cancelled, declined → toutes en gris
  return '#999'; // Gris pour les commandes terminées/annulées/refusées
};


const getProgressPercentage = (status: OrderStatus): number => {
  switch (status) {
    case 'pending':
      return 10;
    case 'accepted':
      return 30;
    case 'enroute':
      return 50;
    case 'picked_up':
      return 80;
    case 'completed':
      return 100;
    default:
      return 0;
  }
};

const PENDING_AUTO_CANCEL_DELAY_MS = 30 * 1000; // 30 secondes max en pending sans réponse

export default function ShipmentList() {
  const { user } = useAuthStore();
  // 🆕 Utiliser les commandes actives depuis le store en priorité
  const activeOrdersFromStore = useOrderStore((s) => s.activeOrders);
  const [orders, setOrders] = useState<OrderWithDB[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const autoCancelledPendingRef = useRef<Set<string>>(new Set());

  const autoCancelPendingOrders = useCallback(async (incomingOrders: OrderWithDB[]) => {
    const updatedOrders = [...incomingOrders];
    const now = Date.now();

    for (const order of incomingOrders) {
      // 🛡️ Vérifier d'abord dans le store si la commande a été acceptée
      // Cela évite d'annuler une commande qui vient d'être acceptée par un livreur
      const storeOrder = useOrderStore.getState().activeOrders.find(o => o.id === order.id);
      if (storeOrder) {
        // Si la commande existe dans le store avec un statut accepté ou un driverId, ne pas l'annuler
        if (storeOrder.status === 'accepted' || 
            storeOrder.status === 'enroute' || 
            storeOrder.status === 'picked_up' || 
            storeOrder.status === 'delivering' ||
            storeOrder.status === 'completed' ||
            storeOrder.driverId || 
            storeOrder.driver?.id) {
          console.log(`✅ Commande ${order.id.slice(0, 8)}... acceptée dans le store, annulation ignorée`);
          continue;
        }
      }
      
      // Vérifier que la commande est bien en pending, sans driver, et pas déjà en cours d'annulation
      if (order.status !== 'pending' || order.driverId || autoCancelledPendingRef.current.has(order.id)) {
        continue;
      }

      const createdAt = order.created_at || (order as any).createdAt;
      const createdTime = createdAt ? new Date(createdAt).getTime() : 0;

      if (!createdTime) {
        console.warn('⚠️ Commande sans date de création:', order.id);
        continue;
      }

      const age = now - createdTime;
      if (age < PENDING_AUTO_CANCEL_DELAY_MS) {
        continue;
      }

      // 🛡️ Double vérification dans le store juste avant d'annuler
      // (au cas où la commande aurait été acceptée entre-temps)
      const finalStoreCheck = useOrderStore.getState().activeOrders.find(o => o.id === order.id);
      if (finalStoreCheck && (finalStoreCheck.status !== 'pending' || finalStoreCheck.driverId || finalStoreCheck.driver?.id)) {
        console.log(`✅ Commande ${order.id.slice(0, 8)}... acceptée entre-temps, annulation annulée`);
        continue;
      }

      // Marquer comme en cours d'annulation AVANT l'appel API
      autoCancelledPendingRef.current.add(order.id);
      
      try {
        console.log(`⏰ Auto-annulation commande ${order.id.slice(0, 8)}... (en pending depuis ${Math.round(age / 1000)}s)`);
        const result = await userApiService.cancelOrder(order.id, order.status);
        
        if (result.success) {
          // Mettre à jour le store immédiatement
          useOrderStore.getState().updateOrderStatus(order.id, 'cancelled');
          
          // Mettre à jour l'état local immédiatement
          const targetIndex = updatedOrders.findIndex((o) => o.id === order.id);
          if (targetIndex !== -1) {
            updatedOrders[targetIndex] = {
              ...updatedOrders[targetIndex],
              status: 'cancelled',
              cancelled_at: new Date().toISOString(),
            };
          }
          
          console.log(`✅ Commande ${order.id.slice(0, 8)}... annulée automatiquement`);
        } else {
          console.warn(`⚠️ Échec auto-annulation ${order.id.slice(0, 8)}...:`, result.message);
          // Retirer du set pour permettre une nouvelle tentative
          autoCancelledPendingRef.current.delete(order.id);
        }
      } catch (err: any) {
        console.error('❌ Erreur auto-cancel pending:', order.id, err);
        // Retirer du set pour permettre une nouvelle tentative
        autoCancelledPendingRef.current.delete(order.id);
      }
    }

    return updatedOrders;
  }, []);

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
        // Log réduit pour éviter la pollution du terminal
        if (__DEV__ && result.data.length > 0) {
          console.debug('📦 Commandes reçues:', result.data.length);
        }

        const formattedOrders = result.data.map((order: any) => {
          
          let pickupData = order.pickup_address || order.pickup;
          let dropoffData = order.dropoff_address || order.dropoff;
          
      
          let pickup = pickupData;
          let dropoff = dropoffData;
          
          try {
            if (typeof pickupData === 'string') {
              pickup = JSON.parse(pickupData);
            } else if (pickupData && typeof pickupData === 'object') {
              pickup = pickupData;
            } else {
              pickup = { address: '', coordinates: { latitude: 0, longitude: 0 } };
            }
          } catch (e) {
            console.warn('⚠️ Erreur parsing pickup:', e);
            pickup = { address: '', coordinates: { latitude: 0, longitude: 0 } };
          }
          
          try {
            if (typeof dropoffData === 'string') {
              dropoff = JSON.parse(dropoffData);
            } else if (dropoffData && typeof dropoffData === 'object') {
              dropoff = dropoffData;
            } else {
              dropoff = { address: '', coordinates: { latitude: 0, longitude: 0 } };
            }
          } catch (e) {
            console.warn('⚠️ Erreur parsing dropoff:', e);
            dropoff = { address: '', coordinates: { latitude: 0, longitude: 0 } };
          }

          
          const pickupAddress = order.pickup_address_text || pickup?.address || '';
          const dropoffAddress = order.dropoff_address_text || dropoff?.address || '';

          // Log supprimé pour réduire la pollution du terminal

          return {
            id: order.id,
            user: {
              id: order.user_id,
              name: order.user?.name || 'Client',
            },
            driver: order.driver_id
              ? {
                  id: order.driver_id,
                  name: order.driver?.name || 'Livreur',
                }
              : undefined,
            pickup: {
              address: pickupAddress,
              coordinates: pickup?.coordinates || { latitude: 0, longitude: 0 },
            },
            dropoff: {
              address: dropoffAddress,
              coordinates: dropoff?.coordinates || { latitude: 0, longitude: 0 },
            },
            price: order.price || order.price_cfa,
            deliveryMethod: order.delivery_method as 'moto' | 'vehicule' | 'cargo',
            distance: order.distance || order.distance_km,
         
            estimatedDuration: (() => {
              // 🆕 Priorité 1: Utiliser eta_minutes depuis la base de données
              // Priorité 2: estimated_duration
              // Priorité 3: Calculer à partir de distance et delivery_method
              let duration = order.eta_minutes || order.estimated_duration || order.estimatedDuration;
            
              // Si on n'a pas de durée mais qu'on a distance et delivery_method, calculer
              if (!duration && order.distance && order.delivery_method) {
                const distanceKm = order.distance || order.distance_km;
                if (distanceKm) {
                  const minutes = estimateDurationMinutes(
                    distanceKm,
                    order.delivery_method as 'moto' | 'vehicule' | 'cargo'
                  );
                  return formatDurationLabel(minutes) || `${minutes} min`;
                }
              }
            
              // Si on a une durée (nombre ou string), la formater
              if (duration !== null && duration !== undefined && duration !== '') {
                // Si c'est un nombre, le formater
                if (typeof duration === 'number') {
                  return formatDurationLabel(duration) || `${duration} min`;
                }
                // Si c'est une string représentant un nombre, la parser et formater
                if (typeof duration === 'string') {
                  const numericValue = parseFloat(duration);
                  if (!isNaN(numericValue) && isFinite(numericValue)) {
                    return formatDurationLabel(Math.round(numericValue)) || `${Math.round(numericValue)} min`;
                  }
                  // Si c'est déjà une string formatée, l'utiliser directement
                  return duration;
                }
              }
            
              return '';
            })(),
            status: order.status as OrderStatus,
            driverId: order.driver_id,
            createdAt: order.created_at || order.createdAt,
            proof: order.proof
              ? typeof order.proof === 'string'
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

        // Calculer les dates d'aujourd'hui
        const today = new Date();
        today.setHours(0, 0, 0, 0); // Début de la journée
        
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1); // Début de demain

        // Séparer les commandes en cours et terminées
        const inProgressOrders = sanitizedOrders.filter((order) => {
          const isInProgress = order.status === 'pending' || 
                            order.status === 'accepted' || 
                            order.status === 'enroute' || 
                            order.status === 'picked_up';
          return isInProgress;
        });

        const completedOrders = sanitizedOrders.filter((order) => {
          return order.status === 'completed';
        });

        // Trier par date de création (plus récentes en premier)
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

        // Filtrer les commandes d'aujourd'hui
        const todayInProgress = inProgressOrders.filter((order) => {
          const orderDate = order.created_at ? new Date(order.created_at) : null;
          if (!orderDate) return false;
          // Comparer les dates en ignorant l'heure
          const orderDateOnly = new Date(orderDate.getFullYear(), orderDate.getMonth(), orderDate.getDate());
          const todayOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());
          return orderDateOnly.getTime() === todayOnly.getTime();
        });

        const todayCompleted = completedOrders.filter((order) => {
          const orderDate = order.created_at ? new Date(order.created_at) : null;
          if (!orderDate) return false;
          // Comparer les dates en ignorant l'heure
          const orderDateOnly = new Date(orderDate.getFullYear(), orderDate.getMonth(), orderDate.getDate());
          const todayOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());
          return orderDateOnly.getTime() === todayOnly.getTime();
        });

        // Sélectionner les commandes à afficher
        const displayOrders: OrderWithDB[] = [];

        // Debug: logger les filtres
        console.log('🔍 Filtres:', {
          total: sanitizedOrders.length,
          inProgress: inProgressOrders.length,
          completed: completedOrders.length,
          todayInProgress: todayInProgress.length,
          todayCompleted: todayCompleted.length,
        });

        // PRIORITÉ 1: Toujours afficher les commandes en cours (même si pas d'aujourd'hui)
        // Les commandes en cours sont prioritaires car elles sont actives
        if (inProgressOrders.length > 0) {
          // Prendre la commande en cours la plus récente (peu importe la date)
          console.log('✅ Ajout commande en cours:', inProgressOrders[0].id, inProgressOrders[0].status);
          displayOrders.push(inProgressOrders[0]);
        }

        // PRIORITÉ 2: Ajouter des commandes terminées pour avoir au minimum 2 commandes affichées
        // Si on a des commandes d'aujourd'hui, prioriser celles d'aujourd'hui
        if (todayCompleted.length > 0) {
          // Ajouter les commandes terminées d'aujourd'hui jusqu'à atteindre 2 commandes au total
          for (let i = 0; i < todayCompleted.length && displayOrders.length < 2; i++) {
            console.log('✅ Ajout commande terminée d\'aujourd\'hui:', todayCompleted[i].id);
            displayOrders.push(todayCompleted[i]);
          }
        }
        
        // Si on n'a pas encore 2 commandes, ajouter les commandes terminées les plus récentes (toutes dates confondues)
        if (displayOrders.length < 2 && completedOrders.length > 0) {
          // Ajouter les commandes terminées les plus récentes jusqu'à atteindre 2 commandes au total
          for (let i = 0; i < completedOrders.length && displayOrders.length < 2; i++) {
            // Vérifier qu'on n'ajoute pas une commande déjà présente
            const alreadyAdded = displayOrders.some(order => order.id === completedOrders[i].id);
            if (!alreadyAdded) {
              console.log('✅ Ajout commande terminée:', completedOrders[i].id);
              displayOrders.push(completedOrders[i]);
            }
          }
        }

        // 🆕 PRIORITÉ 0: Utiliser TOUTES les commandes depuis le store (actives ET terminées)
        // Les commandes du store sont prioritaires car elles sont en temps réel
        // On inclut toutes les commandes pour que les couleurs se mettent à jour dynamiquement
        const storeActiveOrders: OrderWithDB[] = activeOrdersFromStore
          .map(order => ({
            ...order,
            created_at: (order as any).createdAt || (order as any).created_at,
            accepted_at: (order as any).acceptedAt || (order as any).accepted_at,
            completed_at: (order as any).completedAt || (order as any).completed_at,
            cancelled_at: (order as any).cancelledAt || (order as any).cancelled_at,
          }));

        // Combiner les commandes du store avec celles de l'API
        // Les commandes du store sont prioritaires
        const combinedOrders: OrderWithDB[] = [];
        
        // Ajouter toutes les commandes actives du store
        storeActiveOrders.forEach(storeOrder => {
          if (!combinedOrders.find(o => o.id === storeOrder.id)) {
            combinedOrders.push(storeOrder);
          }
        });

        // Ajouter les commandes de l'API qui ne sont pas déjà dans le store
        displayOrders.forEach(apiOrder => {
          if (!combinedOrders.find(o => o.id === apiOrder.id)) {
            combinedOrders.push(apiOrder);
          }
        });

        // Toujours afficher au minimum 2 commandes si elles existent
        // Limiter à maximum 2 commandes
        const finalOrders = combinedOrders.slice(0, 2);
        // Log supprimé pour réduire la pollution du terminal

        setOrders(finalOrders);
      } else {
        setOrders([]);
      }
    } catch (error) {
      console.error('❌ Erreur chargement commandes:', error);
      setOrders([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, activeOrdersFromStore.length]); // activeOrdersFromStore.length pour éviter les re-renders infinis

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  // 🆕 Synchroniser automatiquement les commandes du store avec l'affichage
  // Mettre à jour les couleurs dynamiquement quand le statut change
  const lastActiveOrdersHashRef = React.useRef<string>('');
  
  useEffect(() => {
    // Écouter les changements dans le store pour mettre à jour immédiatement les couleurs
    const unsubscribe = useOrderStore.subscribe((state) => {
      const storeActiveOrders = state.activeOrders;
      
      // 🛡️ Protection contre les boucles infinies : créer un hash des commandes pour détecter les vrais changements
      const ordersHash = storeActiveOrders.map(o => `${o.id}:${o.status}`).join('|');
      
      // Ne mettre à jour que si les commandes ou leurs statuts ont vraiment changé
      // Ignorer les changements de selectedOrderId qui ne concernent pas les commandes elles-mêmes
      if (ordersHash === lastActiveOrdersHashRef.current) {
        return; // Pas de changement réel, ignorer
      }
      
      lastActiveOrdersHashRef.current = ordersHash;
      
      // Mettre à jour les commandes dans l'état local avec les statuts du store
      setOrders((currentOrders) => {
        const updatedOrders = currentOrders.map((order) => {
          // Trouver la commande correspondante dans le store
          const storeOrder = storeActiveOrders.find((so) => so.id === order.id);
          
          // Si la commande existe dans le store, utiliser son statut à jour
          // Cela permet de mettre à jour les couleurs dynamiquement
          if (storeOrder) {
            // Ne mettre à jour que si le statut a vraiment changé
            if (order.status !== storeOrder.status) {
              console.log(`🔄 Mise à jour statut commande ${order.id.slice(0, 8)}...: ${order.status} → ${storeOrder.status}`);
              return {
                ...order,
                status: storeOrder.status, // Mettre à jour le statut (et donc la couleur)
                // Ajouter cancelled_at si la commande est annulée
                ...(storeOrder.status === 'cancelled' && !order.cancelled_at 
                  ? { cancelled_at: new Date().toISOString() }
                  : {}),
                // Ajouter completed_at si la commande est complétée
                ...(storeOrder.status === 'completed' && !order.completed_at 
                  ? { completed_at: new Date().toISOString() }
                  : {}),
              };
            }
            return order; // Pas de changement, retourner l'ordre tel quel
          }
          
          // Si la commande n'existe plus dans le store, vérifier si elle doit être marquée comme terminée/annulée
          // Cela peut arriver si la commande a été complétée et retirée du store
          if (!storeOrder) {
            // Si la commande était en cours et n'est plus dans le store, elle a probablement été complétée
            const wasInProgress = order.status === 'pending' || 
                                 order.status === 'accepted' || 
                                 order.status === 'enroute' || 
                                 order.status === 'picked_up';
            
            if (wasInProgress) {
              // Vérifier si elle devrait être annulée (pending depuis trop longtemps)
              if (order.status === 'pending') {
                const createdAt = order.created_at || (order as any).createdAt;
                const createdTime = createdAt ? new Date(createdAt).getTime() : 0;
                const now = Date.now();
                if (createdTime && now - createdTime >= PENDING_AUTO_CANCEL_DELAY_MS) {
                  console.log(`🔄 Commande ${order.id.slice(0, 8)}... retirée du store, marquage comme annulée`);
                  return {
                    ...order,
                    status: 'cancelled' as OrderStatus,
                    cancelled_at: new Date().toISOString(),
                  };
                }
              } else {
                // Si elle était en cours et n'est plus dans le store, elle a probablement été complétée
                // On la marque comme complétée pour que la couleur change immédiatement
                console.log(`✅ Commande ${order.id.slice(0, 8)}... retirée du store, marquage comme complétée`);
                return {
                  ...order,
                  status: 'completed' as OrderStatus,
                  completed_at: new Date().toISOString(),
                };
              }
            }
          }
          
          return order;
        });
        
        // Ajouter les nouvelles commandes du store qui ne sont pas encore dans la liste
        storeActiveOrders.forEach((storeOrder) => {
          if (!updatedOrders.find((o) => o.id === storeOrder.id)) {
            updatedOrders.push({
              ...storeOrder,
              created_at: (storeOrder as any).createdAt || (storeOrder as any).created_at,
              accepted_at: (storeOrder as any).acceptedAt || (storeOrder as any).accepted_at,
              completed_at: (storeOrder as any).completedAt || (storeOrder as any).completed_at,
              cancelled_at: (storeOrder as any).cancelledAt || (storeOrder as any).cancelled_at,
            } as OrderWithDB);
          }
        });
        
        return updatedOrders;
      });
    });

    return () => {
      unsubscribe();
    };
  }, []);

  // 🆕 Rafraîchir depuis l'API quand le nombre de commandes actives change
  useEffect(() => {
    if (activeOrdersFromStore.length > 0) {
      // Rafraîchir la liste pour inclure les nouvelles commandes actives
      loadOrders();
    }
  }, [activeOrdersFromStore.length, loadOrders]);

  // 🆕 Écouter les événements socket pour les annulations
  useEffect(() => {
    // Écouter les annulations via socket pour mettre à jour immédiatement
    const handleOrderCancelled = (data: { orderId: string }) => {
      if (data?.orderId) {
        console.log(`📡 Événement socket: commande ${data.orderId.slice(0, 8)}... annulée`);
        // Mettre à jour l'état local immédiatement pour changer la couleur
        setOrders((prevOrders) =>
          prevOrders.map((o) =>
            o.id === data.orderId
              ? { ...o, status: 'cancelled' as OrderStatus, cancelled_at: new Date().toISOString() }
              : o
          )
        );
        // Marquer comme déjà annulée pour éviter les tentatives d'auto-annulation
        autoCancelledPendingRef.current.add(data.orderId);
      }
    };

    // S'abonner à l'événement order-cancelled
    // Note: userOrderSocketService gère déjà la mise à jour du store, on met juste à jour l'état local ici
    // On peut écouter directement via le store ou ajouter un listener si disponible
    
    return () => {
      // Nettoyage si nécessaire
    };
  }, []);

  // 🆕 Vérifier périodiquement les commandes en pending et les annuler automatiquement
  useEffect(() => {
    const checkAndCancelPendingOrders = async () => {
      // Filtrer uniquement les commandes vraiment en pending, sans driver, et pas déjà en cours d'annulation
      const pendingOrders = orders.filter(
        (order) => 
          order.status === 'pending' && 
          !order.driverId && 
          !autoCancelledPendingRef.current.has(order.id)
      );

      if (pendingOrders.length === 0) return;

      const now = Date.now();
      const ordersToCancel: OrderWithDB[] = [];

      for (const order of pendingOrders) {
        // 🛡️ Vérifier d'abord dans le store si la commande a été acceptée
        const storeOrder = useOrderStore.getState().activeOrders.find(o => o.id === order.id);
        if (storeOrder) {
          // Si la commande existe dans le store avec un statut accepté ou un driverId, ne pas l'annuler
          if (storeOrder.status === 'accepted' || 
              storeOrder.status === 'enroute' || 
              storeOrder.status === 'picked_up' || 
              storeOrder.status === 'delivering' ||
              storeOrder.status === 'completed' ||
              storeOrder.driverId || 
              storeOrder.driver?.id) {
            console.log(`✅ Commande ${order.id.slice(0, 8)}... acceptée dans le store, annulation ignorée`);
            continue;
          }
        }
        
        const createdAt = order.created_at || (order as any).createdAt;
        const createdTime = createdAt ? new Date(createdAt).getTime() : 0;

        if (!createdTime) {
          console.warn('⚠️ Commande sans date de création dans checkAndCancel:', order.id);
          continue;
        }

        const age = now - createdTime;
        if (age >= PENDING_AUTO_CANCEL_DELAY_MS) {
          ordersToCancel.push(order);
        }
      }

      if (ordersToCancel.length > 0) {
        console.log(`🔍 ${ordersToCancel.length} commande(s) à annuler automatiquement`);
        
        for (const order of ordersToCancel) {
          // 🛡️ Double vérification dans le store juste avant d'annuler
          const finalStoreCheck = useOrderStore.getState().activeOrders.find(o => o.id === order.id);
          if (finalStoreCheck && (finalStoreCheck.status !== 'pending' || finalStoreCheck.driverId || finalStoreCheck.driver?.id)) {
            console.log(`✅ Commande ${order.id.slice(0, 8)}... acceptée entre-temps, annulation annulée`);
            continue;
          }
          
          // Marquer comme en cours d'annulation AVANT l'appel API
          autoCancelledPendingRef.current.add(order.id);
          
          try {
            const createdAt = order.created_at || (order as any).createdAt;
            const createdTime = createdAt ? new Date(createdAt).getTime() : 0;
            const age = now - createdTime;
            
            console.log(`⏰ Auto-annulation commande ${order.id.slice(0, 8)}... (en pending depuis ${Math.round(age / 1000)}s)`);
            
            const result = await userApiService.cancelOrder(order.id, order.status);
            
            if (result.success) {
              // Mettre à jour le store immédiatement
              useOrderStore.getState().updateOrderStatus(order.id, 'cancelled');
              
              // Mettre à jour l'état local immédiatement pour changer la couleur
              setOrders((prevOrders) =>
                prevOrders.map((o) =>
                  o.id === order.id
                    ? { ...o, status: 'cancelled' as OrderStatus, cancelled_at: new Date().toISOString() }
                    : o
                )
              );
              
              console.log(`✅ Commande ${order.id.slice(0, 8)}... annulée automatiquement`);
            } else {
              console.warn(`⚠️ Échec auto-annulation ${order.id.slice(0, 8)}...:`, result.message);
              // Retirer du set pour permettre une nouvelle tentative
              autoCancelledPendingRef.current.delete(order.id);
            }
          } catch (err: any) {
            console.error('❌ Erreur auto-cancel pending:', order.id, err?.message || err);
            // Retirer du set pour permettre une nouvelle tentative
            autoCancelledPendingRef.current.delete(order.id);
          }
        }
      }
    };

    // Vérifier immédiatement
    checkAndCancelPendingOrders();

    // Vérifier toutes les 3 secondes (plus fréquent pour une meilleure réactivité)
    const interval = setInterval(() => {
      checkAndCancelPendingOrders();
    }, 3000);

    return () => clearInterval(interval);
  }, [orders]);

  // 🆕 Rafraîchir automatiquement la liste toutes les 3 secondes si on a des commandes en cours
  useEffect(() => {
    const hasInProgressOrders = orders.some(order => 
      order.status === 'pending' || 
      order.status === 'accepted' || 
      order.status === 'enroute' || 
      order.status === 'picked_up'
    );

    if (hasInProgressOrders) {
      const interval = setInterval(() => {
        loadOrders();
      }, 3000); // Rafraîchir toutes les 3 secondes pour une meilleure réactivité

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
    color: '#666',
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: '#666',
  },
});