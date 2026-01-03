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
  const lastDriverPositionRef = useRef<Coordinates | null>(null);
  const onEnteredZoneRef = useRef(onEnteredZone);
  const onValidatedRef = useRef(onValidated);

  // Mettre à jour les refs des callbacks à chaque render
  useEffect(() => {
    onEnteredZoneRef.current = onEnteredZone;
    onValidatedRef.current = onValidated;
  }, [onEnteredZone, onValidated]);

  const driverPositionRef = useRef(driverPosition);
  
  // Mettre à jour la ref de la position du driver
  useEffect(() => {
    driverPositionRef.current = driverPosition;
  }, [driverPosition]);

  // Fonction pour valider automatiquement (stabilisée avec useRef)
  const handleAutoValidate = useCallback(
    (orderId: string, currentStatus: string | null) => {
      if (hasValidatedRef.current) {
        return;
      }

      hasValidatedRef.current = true;

      // Déterminer le nouveau statut selon le statut actuel
      let newStatus: string;
      
      // CRITIQUE : Ne jamais valider automatiquement si le statut est 'accepted'
      // Le livreur doit d'abord cliquer sur "Je pars" pour passer à 'enroute'
      if (currentStatus === 'accepted') {
        logger.warn(
          `Géofencing: Validation automatique ignorée pour statut 'accepted' - le livreur doit d'abord cliquer sur "Je pars"`,
          'useGeofencing'
        );
        return;
      }
      
      if (currentStatus === 'enroute' || currentStatus === 'in_progress') {
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
        `Géofencing: Validation automatique ${newStatus} pour commande ${orderId.slice(0, 8)}...`,
        'useGeofencing'
      );

      const currentDriverPosition = driverPositionRef.current;

      // Notifier le client que la validation a été déclenchée
      if (currentDriverPosition) {
        orderSocketService.emitGeofenceEvent(orderId, 'validated', currentDriverPosition);

        // Mettre à jour le statut via Socket.IO
        orderSocketService.updateDeliveryStatus(orderId, newStatus, currentDriverPosition);
      }

      // Mettre à jour l'état local
      setGeofenceState((prev) => ({
        ...prev,
        status: GeofenceStatus.VALIDATED,
      }));

      onValidatedRef.current?.();
    },
    []
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

    // CRITIQUE : Ne pas activer la validation automatique si le statut est 'accepted'
    // Le livreur doit d'abord cliquer sur "Je pars" pour passer à 'enroute'
    // Sinon, le menu "Je pars" disparaît et le livreur ne peut plus mettre à jour le statut
    if (orderStatus === 'accepted') {
      // Annuler toute validation programmée
      if (validationTimeoutRef.current) {
        clearTimeout(validationTimeoutRef.current);
        validationTimeoutRef.current = null;
      }
      hasValidatedRef.current = false;
      // Ne pas calculer le géofencing pour éviter les notifications prématurées
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
      
      // Notifier le client via Socket.IO
      if (orderId) {
        orderSocketService.emitGeofenceEvent(orderId, 'entered', driverPosition);
      }
      
      onEnteredZoneRef.current?.();

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
    handleAutoValidate,
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

