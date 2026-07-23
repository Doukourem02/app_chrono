/**
 * Service de gestion des livraisons multiples
 * Permet à un livreur de gérer plusieurs commandes simultanément
 */

import { calculateDistance } from '../utils/geofencingService.js';

interface Coordinates {
  latitude: number;
  longitude: number;
}

interface Order {
  id: string;
  pickup: Coordinates;
  dropoff: Coordinates;
  priority?: number;
}

/**
 * Résout le problème du voyageur de commerce (TSP) de manière approximative
 * Utilise l'algorithme du plus proche voisin amélioré
 */
export function optimizeRoute(orders: Order[], startPosition: Coordinates): string[] {
  if (orders.length === 0) return [];
  if (orders.length === 1) return [orders[0].id];

  // Créer une liste des points à visiter (pickup + dropoff pour chaque commande)
  const points: Array<{ id: string; type: 'pickup' | 'dropoff'; orderId: string; coords: Coordinates; priority: number }> = [];
  
  orders.forEach(order => {
    points.push({
      id: `${order.id}-pickup`,
      type: 'pickup',
      orderId: order.id,
      coords: order.pickup,
      priority: order.priority || 0,
    });
    points.push({
      id: `${order.id}-dropoff`,
      type: 'dropoff',
      orderId: order.id,
      coords: order.dropoff,
      priority: order.priority || 0,
    });
  });

  // Algorithme du plus proche voisin avec contraintes
  const route: string[] = [];
  const visited = new Set<string>();
  let currentPosition = startPosition;
  const remainingPoints = [...points];

  while (remainingPoints.length > 0) {
    // Filtrer les points accessibles (pickup doit être fait avant dropoff)
    const accessiblePoints = remainingPoints.filter(point => {
      if (point.type === 'dropoff') {
        // Vérifier que le pickup correspondant a été fait
        const pickupId = `${point.orderId}-pickup`;
        return visited.has(pickupId);
      }
      return true;
    });

    if (accessiblePoints.length === 0) break;

    // Trouver le point le plus proche (avec priorité)
    let bestPoint = accessiblePoints[0];
    let bestDistance = calculateDistance(currentPosition, bestPoint.coords) - (bestPoint.priority * 1000);

    for (const point of accessiblePoints) {
      const distance = calculateDistance(currentPosition, point.coords) - (point.priority * 1000);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestPoint = point;
      }
    }

    route.push(bestPoint.orderId);
    visited.add(bestPoint.id);
    currentPosition = bestPoint.coords;

    // Retirer le point de la liste
    const index = remainingPoints.findIndex(p => p.id === bestPoint.id);
    if (index !== -1) {
      remainingPoints.splice(index, 1);
    }
  }

  // Retourner les IDs de commandes dans l'ordre optimisé (sans doublons)
  const uniqueOrderIds = Array.from(new Set(route));
  return uniqueOrderIds;
}

/**
 * Groupe les commandes par zone géographique
 */
export function groupOrdersByZone(
  orders: Order[],
  zoneRadiusKm: number = 5
): Order[][] {
  if (orders.length === 0) return [];

  const groups: Order[][] = [];
  const assigned = new Set<string>();

  orders.forEach(order => {
    if (assigned.has(order.id)) return;

    const group: Order[] = [order];
    assigned.add(order.id);

    // Trouver toutes les commandes dans la même zone
    orders.forEach(otherOrder => {
      if (assigned.has(otherOrder.id)) return;

      const distance = calculateDistance(order.pickup, otherOrder.pickup) / 1000; // en km
      if (distance <= zoneRadiusKm) {
        group.push(otherOrder);
        assigned.add(otherOrder.id);
      }
    });

    groups.push(group);
  });

  return groups;
}

/**
 * Calcule l'itinéraire optimal pour un groupe de commandes
 */
export function calculateOptimalRouteForGroup(
  orders: Order[],
  driverPosition: Coordinates
): { orderIds: string[]; totalDistance: number; estimatedTime: number } {
  const optimizedOrderIds = optimizeRoute(orders, driverPosition);
  
  // Calculer la distance totale
  let totalDistance = 0;
  let currentPos = driverPosition;

  for (const orderId of optimizedOrderIds) {
    const order = orders.find(o => o.id === orderId);
    if (!order) continue;

    // Distance jusqu'au pickup
    totalDistance += calculateDistance(currentPos, order.pickup);
    currentPos = order.pickup;

    // Distance jusqu'au dropoff
    totalDistance += calculateDistance(currentPos, order.dropoff);
    currentPos = order.dropoff;
  }

  // Estimation du temps (vitesse moyenne 30 km/h en ville)
  const totalDistanceKm = totalDistance / 1000;
  const estimatedTime = Math.ceil((totalDistanceKm / 30) * 60); // en minutes

  return {
    orderIds: optimizedOrderIds,
    totalDistance,
    estimatedTime,
  };
}

