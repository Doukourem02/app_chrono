import React, { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, StyleSheet, Text, TouchableOpacity } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useBatchStore } from "../store/useBatchStore";
import { useGeofencing } from "../hooks/useGeofencing";
import { orderSocketService } from "../services/orderSocketService";
import { confirmBatchPickup } from "../services/batchApiService";
import { speakAnnouncement } from "../utils/speechAnnouncement";
import { BatchOfferPopup } from "./BatchOfferPopup";

type Coords = { latitude: number; longitude: number };

interface Props {
  location: Coords | null;
  isOnline: boolean;
}

export default function BatchDeliveryFlow({ location }: Props) {
  const activeBatch = useBatchStore((s) => s.activeBatch);
  const batchLastEtaMinutes = useBatchStore((s) => s.lastEtaMinutes);
  const pendingBatchOffer = useBatchStore((s) => s.pendingOffer);
  const batchOfferError = useBatchStore((s) => s.offerError);
  const clearBatchOfferError = useBatchStore((s) => s.clearOfferError);

  const [showBatchPickupBtn, setShowBatchPickupBtn] = useState(false);
  const [isConfirmingBatchPickup, setIsConfirmingBatchPickup] = useState(false);
  const batchPickupGeoRef = useRef(false);

  const handleAcceptBatchOffer = useCallback((batchId: string) => {
    void orderSocketService.acceptBatch(batchId);
  }, []);

  const handleDeclineBatchOffer = useCallback((batchId: string) => {
    void orderSocketService.declineBatch(batchId);
  }, []);

  const handleBatchPickupConfirmOnMap = useCallback(async () => {
    if (!activeBatch?.id || isConfirmingBatchPickup) return;
    setIsConfirmingBatchPickup(true);
    try {
      await confirmBatchPickup(activeBatch.id);
      useBatchStore.getState().setPickedUp(activeBatch.id);
      setShowBatchPickupBtn(false);
      batchPickupGeoRef.current = false;
      speakAnnouncement('Tous les colis pris en charge. Vous pouvez commencer vos livraisons.', {});
      router.push(`/batch/${activeBatch.id}` as any);
    } catch (err: any) {
      Alert.alert('Erreur', err?.message ?? 'Impossible de confirmer la collecte.');
    } finally {
      setIsConfirmingBatchPickup(false);
    }
  }, [activeBatch?.id, isConfirmingBatchPickup]);

  useGeofencing({
    driverPosition: location,
    targetPosition: activeBatch && !activeBatch.pickedUp && activeBatch.pickupCoordinates
      ? activeBatch.pickupCoordinates
      : null,
    orderId: activeBatch?.id ?? null,
    orderStatus: activeBatch && !activeBatch.pickedUp ? 'enroute' : null,
    enabled: !!activeBatch && !activeBatch.pickedUp && !!location && !!(activeBatch.pickupCoordinates),
    onEnteredPickupZone: () => {
      if (batchPickupGeoRef.current) return;
      batchPickupGeoRef.current = true;
      setShowBatchPickupBtn(true);
    },
  });

  useEffect(() => {
    if (!activeBatch || activeBatch.pickedUp) {
      setShowBatchPickupBtn(false);
      batchPickupGeoRef.current = false;
    }
  }, [activeBatch, activeBatch?.pickedUp]);

  // Fallback : si le batch n'a pas de coordonnées de collecte, afficher le bouton directement
  useEffect(() => {
    if (
      activeBatch &&
      !activeBatch.pickedUp &&
      activeBatch.stops.length > 0 &&
      !activeBatch.pickupCoordinates &&
      !batchPickupGeoRef.current
    ) {
      batchPickupGeoRef.current = true;
      setShowBatchPickupBtn(true);
    }
  }, [activeBatch, activeBatch?.pickedUp, activeBatch?.pickupCoordinates, activeBatch?.stops.length]);

  // Nettoyage de sécurité : vider le store dès que l'accueil reprend le focus et que la tournée est terminée
  useFocusEffect(
    useCallback(() => {
      const batch = useBatchStore.getState().activeBatch;
      if (!batch || !batch.pickedUp || batch.stops.length === 0) return;
      const pending = batch.stops.filter((s) => s.status === 'pending').length;
      if (pending === 0) {
        useBatchStore.getState().clearBatch();
      }
    }, [])
  );

  return (
    <>
      {activeBatch && (
        <TouchableOpacity
          style={styles.batchReturnFab}
          onPress={() => router.push(`/batch/${activeBatch.id}` as any)}
          accessibilityLabel="Retour à la tournée groupée"
        >
          <Ionicons name="list-outline" size={18} color="#fff" />
          <Text style={styles.batchReturnFabText}>
            Tournée · {activeBatch.stops.filter(s => s.status === 'pending').length} restant(s)
            {batchLastEtaMinutes != null ? ` · ${batchLastEtaMinutes} min` : ''}
          </Text>
        </TouchableOpacity>
      )}

      {showBatchPickupBtn && (
        <TouchableOpacity
          style={styles.batchPickupConfirmBar}
          onPress={handleBatchPickupConfirmOnMap}
          disabled={isConfirmingBatchPickup}
          activeOpacity={0.85}
        >
          {isConfirmingBatchPickup ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Ionicons name="checkmark-circle" size={22} color="#fff" />
              <Text style={styles.batchReturnFabText}>Tous les colis récupérés</Text>
            </>
          )}
        </TouchableOpacity>
      )}

      <BatchOfferPopup
        offer={pendingBatchOffer}
        visible={!!pendingBatchOffer}
        errorMessage={batchOfferError?.message ?? null}
        onAccept={handleAcceptBatchOffer}
        onDecline={handleDeclineBatchOffer}
        onDismissError={clearBatchOfferError}
      />
    </>
  );
}

const styles = StyleSheet.create({
  batchReturnFab: {
    position: 'absolute',
    top: 80,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#7C3AED',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 6,
    zIndex: 1000,
  },
  batchReturnFabText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  batchPickupConfirmBar: {
    position: 'absolute',
    bottom: 100,
    left: 20,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#10B981',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 16,
    zIndex: 2000,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 8,
  },
});
