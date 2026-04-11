/**
 * Hook pour gérer le géofencing (détection automatique d'arrivée)
 */

import { useState, useEffect, useRef } from 'react';
import {
  calculateGeofenceState,
  GeofenceStatus,
  type GeofenceState,
} from '../utils/geofencingUtils';
import { orderSocketService } from '../services/orderSocketService';
import { logger } from '../utils/logger';

interface Coordinates {
  latitude: number;
  longitude: number;
}

interface UseGeofencingOptions {
  driverPosition: Coordinates | null;
  targetPosition: Coordinates | null;
  orderId: string | null;
  orderStatus: string | null;
  enabled?: boolean;
  onEnteredZone?: () => void;
  /** Appelé quand le livreur entre dans la zone de pickup (pas de validation auto, le livreur clique "Colis récupéré") */
  onEnteredPickupZone?: () => void;
  /** Appelé quand le livreur entre dans la zone de dropoff → affiche bouton "Livraison effectuée" */
  onEnteredDropoffZone?: () => void;
}

/**
 * Hook pour gérer le géofencing d'une commande
 * Détecte l’entrée dans une zone (~50 m) : annonces + boutons manuels (pas de complétion auto à la livraison).
 */
export function useGeofencing({
  driverPosition,
  targetPosition,
  orderId,
  orderStatus,
  enabled = true,
  onEnteredZone,
  onEnteredPickupZone,
  onEnteredDropoffZone,
}: UseGeofencingOptions) {
  const [geofenceState, setGeofenceState] = useState<GeofenceState>({
    status: GeofenceStatus.OUTSIDE,
    distance: null,
    enteredAt: null,
    timeInZone: 0,
  });

  const previousStateRef = useRef<GeofenceState | null>(null);
  const lastDriverPositionRef = useRef<Coordinates | null>(null);
  const onEnteredZoneRef = useRef(onEnteredZone);
  const onEnteredPickupZoneRef = useRef(onEnteredPickupZone);
  const onEnteredDropoffZoneRef = useRef(onEnteredDropoffZone);

  useEffect(() => {
    onEnteredZoneRef.current = onEnteredZone;
    onEnteredPickupZoneRef.current = onEnteredPickupZone;
    onEnteredDropoffZoneRef.current = onEnteredDropoffZone;
  }, [onEnteredZone, onEnteredPickupZone, onEnteredDropoffZone]);

  // Réinitialiser quand l'ordre change
  useEffect(() => {
    if (!orderId) {
      setGeofenceState({
        status: GeofenceStatus.OUTSIDE,
        distance: null,
        enteredAt: null,
        timeInZone: 0,
      });
      previousStateRef.current = null;
      return;
    }
  }, [orderId]);

  // Calculer l'état du géofencing
  useEffect(() => {
    if (!enabled || !orderId || !driverPosition || !targetPosition) {
      return;
    }

    // Ne pas valider si la commande est déjà complétée ou annulée
    if (orderStatus === 'completed' || orderStatus === 'cancelled') {
      return;
    }

    // CRITIQUE : Ne pas activer la validation automatique si le statut est 'accepted'
    // Le livreur doit d'abord cliquer sur "Je pars" pour passer à 'enroute'
    // Sinon, le menu "Je pars" disparaît et le livreur ne peut plus mettre à jour le statut
    if (orderStatus === 'accepted') {
      return;
    }

    // Vérifier si la position du driver a vraiment changé (tolérance de 10m pour éviter les recalculs inutiles)
    const lastPos = lastDriverPositionRef.current;
    if (lastPos) {
      const latDiff = Math.abs(lastPos.latitude - driverPosition.latitude);
      const lonDiff = Math.abs(lastPos.longitude - driverPosition.longitude);
      // Si la position n'a pas changé significativement (< 10m), ne pas recalculer
      if (latDiff < 0.0001 && lonDiff < 0.0001) {
        return;
      }
    }
    lastDriverPositionRef.current = driverPosition;

    const newState = calculateGeofenceState(
      driverPosition,
      targetPosition,
      previousStateRef.current
    );

    // Ne mettre à jour l'état que s'il a vraiment changé pour éviter les boucles infinies
    const previousState = previousStateRef.current;
    const hasChanged = 
      !previousState ||
      previousState.status !== newState.status ||
      (previousState.distance !== null && newState.distance !== null && 
       Math.abs(previousState.distance - newState.distance) > 5) || // Tolérance de 5m pour distance
      previousState.enteredAt !== newState.enteredAt;

    if (hasChanged) {
      setGeofenceState(newState);
      previousStateRef.current = newState;
    } else {
      // Mettre à jour la ref même si l'état n'a pas changé
      previousStateRef.current = newState;
    }

    // Si vient d'entrer dans la zone
    if (newState.status === GeofenceStatus.ENTERING) {
      logger.info(
        `Géofencing: Entrée dans la zone pour commande ${orderId.slice(0, 8)}...`,
        'useGeofencing'
      );
      
      if (orderId) {
        orderSocketService.emitGeofenceEvent(orderId, 'entered', driverPosition);
      }
      
      onEnteredZoneRef.current?.();

      // Pickup : annonce + bouton "Colis récupéré" (pas de validation auto)
      if (orderStatus === 'enroute' || orderStatus === 'in_progress') {
        onEnteredPickupZoneRef.current?.();
        // Ne pas programmer la validation
      } else if (orderStatus === 'picked_up' || orderStatus === 'delivering') {
        // Dropoff : annonce + bouton « Livraison effectuée » uniquement (pas de complétion auto :
        // le livreur doit scanner / confirmer après paiement et remise du colis).
        onEnteredDropoffZoneRef.current?.();
      }
    }

  }, [
    enabled,
    driverPosition,
    targetPosition,
    orderId,
    orderStatus,
  ]);

  // Mettre à jour le temps passé dans la zone (seulement si INSIDE)
  useEffect(() => {
    if (geofenceState.status !== GeofenceStatus.INSIDE || !geofenceState.enteredAt) {
      return;
    }

    const interval = setInterval(() => {
      setGeofenceState((prev) => {
        if (prev.status !== GeofenceStatus.INSIDE || !prev.enteredAt) {
          return prev;
        }
        const timeInZone = Date.now() - prev.enteredAt;
        // Ne mettre à jour que si le temps a vraiment changé (tolérance de 500ms)
        if (Math.abs(prev.timeInZone - timeInZone) < 500) {
          return prev;
        }
        return {
          ...prev,
          timeInZone,
        };
      });
    }, 1000); // Mise à jour toutes les 1 seconde (au lieu de 100ms)

    return () => clearInterval(interval);
  }, [geofenceState.status, geofenceState.enteredAt]);

  return {
    geofenceState,
    isInZone: geofenceState.status === GeofenceStatus.INSIDE || 
              geofenceState.status === GeofenceStatus.ENTERING,
    distance: geofenceState.distance,
    timeInZone: geofenceState.timeInZone,
    timeUntilValidation: null,
  };
}

