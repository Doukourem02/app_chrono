import React, { useEffect, useState, useCallback } from "react";
import { View, ActivityIndicator, RefreshControl, ScrollView, Text, StyleSheet } from "react-native";
import ShipmentCard from "./ShipmentCard";
import { userApiService } from "../services/userApiService";
import { useAuthStore } from "../store/useAuthStore";
import { OrderRequest, OrderStatus } from "../store/useOrderStore";

interface OrderWithDB extends OrderRequest {
  created_at?: string;
  accepted_at?: string;
  completed_at?: string;
  cancelled_at?: string;
}

// Fonction pour obtenir la couleur de fond selon le statut
const getBackgroundColor = (status: OrderStatus): string => {
  // Commandes en cours
  if (status === 'pending' || status === 'accepted' || status === 'enroute' || status === 'picked_up') {
    return '#E5D5FF'; // Violet clair pour les colis en cours
  }
  // Commandes terminées
  if (status === 'completed') {
    return '#E8F0F4'; // Bleu clair pour les colis terminés
  }
  // Par défaut (cancelled, declined)
  return '#E8F0F4';
};

// Fonction pour obtenir la couleur de progression selon le statut
const getProgressColor = (status: OrderStatus): string => {
  if (status === 'pending' || status === 'accepted' || status === 'enroute' || status === 'picked_up') {
    return '#8B5CF6'; // Violet pour les en cours
  }
  if (status === 'completed') {
    return '#999'; // Gris pour les terminés
  }
  return '#999';
};

// Fonction pour calculer le pourcentage de progression selon le statut
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
        limit: 50, // Charger plus de commandes pour la liste
      });

      if (result.success && result.data) {
        const formattedOrders = result.data.map((order: any) => ({
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
          pickup: typeof order.pickup === 'string' ? JSON.parse(order.pickup) : order.pickup,
          dropoff: typeof order.dropoff === 'string' ? JSON.parse(order.dropoff) : order.dropoff,
          price: order.price,
          deliveryMethod: order.delivery_method as 'moto' | 'vehicule' | 'cargo',
          distance: order.distance,
          estimatedDuration: order.estimated_duration,
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
        })) as OrderWithDB[];

        // Filtrer pour ne garder que les commandes en cours aujourd'hui
        const today = new Date();
        today.setHours(0, 0, 0, 0); // Début de la journée
        
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1); // Début de demain
        
        const todayOrders = formattedOrders.filter((order) => {
          // Vérifier que la commande est créée aujourd'hui
          const orderDate = order.created_at ? new Date(order.created_at) : null;
          if (!orderDate) return false;
          
          const isToday = orderDate >= today && orderDate < tomorrow;
          
          // Vérifier que la commande est en cours (pas terminée, annulée ou refusée)
          const isInProgress = order.status === 'pending' || 
                             order.status === 'accepted' || 
                             order.status === 'enroute' || 
                             order.status === 'picked_up';
          
          return isToday && isInProgress;
        });

        // Trier par date de création (plus récentes en premier)
        todayOrders.sort((a, b) => {
          const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
          const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
          return dateB - dateA;
        });

        setOrders(todayOrders);
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
  }, [user?.id]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadOrders();
  }, [loadOrders]);

  if (loading && orders.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#8B5CF6" />
        <Text style={styles.loadingText}>Chargement de vos commandes...</Text>
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
        {orders.map((order) => (
          <ShipmentCard
            key={order.id}
            order={order}
            backgroundColor={getBackgroundColor(order.status)}
            progressPercentage={getProgressPercentage(order.status)}
            progressColor={getProgressColor(order.status)}
          />
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
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