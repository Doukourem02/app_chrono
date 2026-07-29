import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useOrderStore } from "../store/useOrderStore";

/** Statuts où un livreur est censé être en train de bouger/suivi activement. */
const TRACKED_STATUSES = new Set([
  "accepted",
  "enroute",
  "picked_up",
  "delivering",
  "in_progress",
]);

/** Au-delà de ce délai sans nouvelle position, on considère la position potentiellement obsolète
 * même si aucun event driver:connection:status explicite n'a été reçu (filet de secours). */
const STALE_POSITION_MS = 45_000;

/**
 * Avertit le client quand le livreur suivi vient de perdre sa connexion — sans ça le marker
 * reste figé sur la carte sans aucune explication (audit carte/géoloc 2026-07-29).
 */
export function DriverConnectionBanner({ orderId, orderStatus }: { orderId?: string | null; orderStatus?: string | null }) {
  const connectionInfo = useOrderStore((s) => (orderId ? s.driverConnection.get(orderId) : undefined));
  const [now, setNow] = useState(() => Date.now());

  const isTracked = !!orderId && !!orderStatus && TRACKED_STATUSES.has(orderStatus);

  // Re-vérifie l'âge de la dernière position toutes les 10s tant qu'on suit une course.
  useEffect(() => {
    if (!isTracked) return;
    const t = setInterval(() => setNow(Date.now()), 10_000);
    return () => clearInterval(t);
  }, [isTracked]);

  if (!isTracked) return null;

  const explicitlyDisconnected = connectionInfo?.connected === false;
  const stale = connectionInfo != null && now - connectionInfo.updatedAt > STALE_POSITION_MS;
  if (!explicitlyDisconnected && !stale) return null;

  return (
    <View style={styles.bar} accessibilityRole="alert">
      <Text style={styles.text}>
        Connexion avec votre livreur instable — sa position affichée peut être obsolète.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: "#B45309",
    paddingVertical: 8,
    paddingHorizontal: 14,
    zIndex: 20,
  },
  text: {
    color: "#FFFFFF",
    fontSize: 12,
    lineHeight: 16,
    textAlign: "center",
    fontWeight: "600",
  },
});
