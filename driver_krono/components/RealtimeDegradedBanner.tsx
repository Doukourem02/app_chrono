import { Platform, StyleSheet, Text, View } from "react-native";
import { useRealtimeDegradedStore } from "../store/useRealtimeDegradedStore";

/**
 * Avertit quand le temps réel (Socket.IO commandes ou messagerie) n’est plus fiable
 * après échec des reconnexions.
 */
export function RealtimeDegradedBanner() {
  const degraded = useRealtimeDegradedStore(
    (s) => s.ordersSocketDegraded || s.messagesSocketDegraded
  );

  if (Platform.OS === "web" || !degraded) return null;

  return (
    <View style={styles.bar} accessibilityRole="alert">
      <Text style={styles.text}>
        Mises à jour en direct temporairement limitées. Ouvrez l’app à nouveau ou
        vérifiez votre connexion.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: "#44403c",
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(255,255,255,0.2)",
  },
  text: {
    color: "rgba(255,255,255,0.95)",
    fontSize: 12,
    lineHeight: 16,
    textAlign: "center",
    fontWeight: "500",
  },
});
