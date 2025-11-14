import React, { useEffect, useState, useCallback } from "react";
import { View, RefreshControl, ScrollView, Text, StyleSheet } from "react-native";
import ShipmentCard from "./ShipmentCard";
import { userApiService } from "../services/userApiService";
import { useAuthStore } from "../store/useAuthStore";
import { OrderRequest, OrderStatus, useOrderStore } from "../store/useOrderStore";
import { formatDurationLabel, estimateDurationMinutes } from "../services/orderApi";
import { AnimatedCard, SkeletonLoader } from "./animations";

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

export default function ShipmentList() {
  const { user } = useAuthStore();
  // 🆕 Utiliser les commandes actives depuis le store en priorité
  const activeOrdersFromStore = useOrderStore((s) => s.activeOrders);
  const [orders, setOrders] = useState<OrderWithDB[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

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

        // Calculer les dates d'aujourd'hui
        const today = new Date();
        today.setHours(0, 0, 0, 0); // Début de la journée
        
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1); // Début de demain

        // Séparer les commandes en cours et terminées
        const inProgressOrders = formattedOrders.filter((order) => {
          const isInProgress = order.status === 'pending' || 
                            order.status === 'accepted' || 
                            order.status === 'enroute' || 
                            order.status === 'picked_up';
          return isInProgress;
        });

        const completedOrders = formattedOrders.filter((order) => {
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
          total: formattedOrders.length,
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
              return {
                ...order,
                status: storeOrder.status, // Mettre à jour le statut (et donc la couleur)
              };
            }
            return order; // Pas de changement, retourner l'ordre tel quel
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

  // 🆕 Rafraîchir automatiquement la liste toutes les 5 secondes si on a des commandes en cours
  useEffect(() => {
    const hasInProgressOrders = orders.some(order => 
      order.status === 'pending' || 
      order.status === 'accepted' || 
      order.status === 'enroute' || 
      order.status === 'picked_up'
    );

    if (hasInProgressOrders) {
      const interval = setInterval(() => {
        // Log supprimé pour réduire la pollution du terminal
        loadOrders();
      }, 5000); // Rafraîchir toutes les 5 secondes

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