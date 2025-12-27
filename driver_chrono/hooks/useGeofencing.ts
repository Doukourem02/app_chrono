/**
 * Hook pour gérer le géofencing (détection automatique d'arrivée)
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  calculateGeofenceState,
  GeofenceStatus,
  type GeofenceState,
  AUTO_VALIDATE_DELAY,
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
  onValidated?: () => void;
}

/**
 * Hook pour gérer le géofencing d'une commande
 * Détecte quand le livreur entre dans une zone de 50m et valide automatiquement après 10 secondes
 */
export function useGeofencing({
  driverPosition,
  targetPosition,
  orderId,
  orderStatus,
  enabled = true,
  onEnteredZone,
  onValidated,
}: UseGeofencingOptions) {
  const [geofenceState, setGeofenceState] = useState<GeofenceState>({
    status: GeofenceStatus.OUTSIDE,
    distance: null,
    enteredAt: null,
    timeInZone: 0,
  });

  const previousStateRef = useRef<GeofenceState | null>(null);
  const validationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasValidatedRef = useRef<boolean>(false);

  // Fonction pour valider automatiquement
  const handleAutoValidate = useCallback(
    (orderId: string, currentStatus: string | null) => {
      if (hasValidatedRef.current) {
        return;
      }

      hasValidatedRef.current = true;

      // Déterminer le nouveau statut selon le statut actuel
      let newStatus: string;
      if (currentStatus === 'enroute' || currentStatus === 'accepted') {
        // Si en route vers le pickup, marquer comme picked_up
        newStatus = 'picked_up';
      } else if (currentStatus === 'picked_up' || currentStatus === 'delivering') {
        // Si a déjà récupéré, marquer comme completed
        newStatus = 'completed';
      } else {
        // Par défaut, ne rien faire
        logger.warn(
          `Géofencing: Statut ${currentStatus} non géré pour validation automatique`,
          'useGeofencing'
        );
        return;
      }

      logger.info(
        `✅ Géofencing: Validation automatique ${newStatus} pour commande ${orderId.slice(0, 8)}...`,
        'useGeofencing'
      );

      // Notifier le client que la validation a été déclenchée
      orderSocketService.emitGeofenceEvent(orderId, 'validated', driverPosition);

      // Mettre à jour le statut via Socket.IO
      orderSocketService.updateDeliveryStatus(orderId, newStatus, driverPosition);

      // Mettre à jour l'état local
      setGeofenceState((prev) => ({
        ...prev,
        status: GeofenceStatus.VALIDATED,
      }));

      onValidated?.();
    },
    [driverPosition, onValidated]
  );

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
      hasValidatedRef.current = false;
      if (validationTimeoutRef.current) {
        clearTimeout(validationTimeoutRef.current);
        validationTimeoutRef.current = null;
      }
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

    const newState = calculateGeofenceState(
      driverPosition,
      targetPosition,
      previousStateRef.current
    );

    setGeofenceState(newState);
    previousStateRef.current = newState;

    // Si vient d'entrer dans la zone
    if (newState.status === GeofenceStatus.ENTERING) {
      logger.info(
        `📍 Géofencing: Entrée dans la zone pour commande ${orderId.slice(0, 8)}...`,
        'useGeofencing'
      );
      
      // Notifier le client via Socket.IO
      if (orderId) {
        orderSocketService.emitGeofenceEvent(orderId, 'entered', driverPosition);
      }
      
      onEnteredZone?.();

      // Programmer la validation automatique après 10 secondes
      if (validationTimeoutRef.current) {
        clearTimeout(validationTimeoutRef.current);
      }

      validationTimeoutRef.current = setTimeout(() => {
        if (!hasValidatedRef.current && orderId) {
          handleAutoValidate(orderId, orderStatus);
        }
      }, AUTO_VALIDATE_DELAY);
    }

    // Si sort de la zone, annuler la validation programmée
    if (newState.status === GeofenceStatus.OUTSIDE) {
      if (validationTimeoutRef.current) {
        clearTimeout(validationTimeoutRef.current);
        validationTimeoutRef.current = null;
      }
      hasValidatedRef.current = false;
    }
  }, [
    enabled,
    driverPosition,
    targetPosition,
    orderId,
    orderStatus,
    onEnteredZone,
    handleAutoValidate,
  ]);

  // Mettre à jour le temps passé dans la zone
  useEffect(() => {
    if (geofenceState.status !== GeofenceStatus.INSIDE) {
      return;
    }

    const interval = setInterval(() => {
      if (geofenceState.enteredAt) {
        const timeInZone = Date.now() - geofenceState.enteredAt;
        setGeofenceState((prev) => ({
          ...prev,
          timeInZone,
        }));
      }
    }, 100); // Mise à jour toutes les 100ms pour l'affichage

    return () => clearInterval(interval);
  }, [geofenceState.status, geofenceState.enteredAt]);

  // Nettoyer les timeouts au démontage
  useEffect(() => {
    return () => {
      if (validationTimeoutRef.current) {
        clearTimeout(validationTimeoutRef.current);
      }
    };
  }, []);

  return {
    geofenceState,
    isInZone: geofenceState.status === GeofenceStatus.INSIDE || 
              geofenceState.status === GeofenceStatus.ENTERING,
    distance: geofenceState.distance,
    timeInZone: geofenceState.timeInZone,
    timeUntilValidation: geofenceState.enteredAt
      ? Math.max(0, AUTO_VALIDATE_DELAY - geofenceState.timeInZone)
      : null,
  };
}

