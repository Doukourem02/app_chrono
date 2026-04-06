import {
  type NetworkState,
  NetworkStateType,
  useNetworkState,
} from "expo-network";
import { Platform, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

function isOffline(state: NetworkState): boolean {
  if (state.isConnected === false) return true;
  if (state.type === NetworkStateType.NONE) return true;
  if (state.isInternetReachable === false) return true;
  return false;
}

/**
 * Bandeau discret en tête : l’écran en dessous reste celui de l’app (pas d’écran blanc plein page).
 */
export function OfflineBanner() {
  const insets = useSafeAreaInsets();
  const network = useNetworkState();

  if (Platform.OS === "web") return null;
  if (!isOffline(network)) return null;

  return (
    <View
      style={[styles.bar, { paddingTop: Math.max(insets.top, 8) }]}
      accessibilityRole="alert"
      accessibilityLabel="Réseau indisponible. Vérifiez le Wi-Fi ou les données mobiles."
    >
      <Text style={styles.title}>Réseau indisponible</Text>
      <Text style={styles.subtitle}>
        Vous pouvez toujours naviguer. Vérifiez le Wi‑Fi ou les données mobiles pour mettre à jour.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: "#6D28D9",
    paddingBottom: 12,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 4,
  },
  subtitle: {
    color: "rgba(255,255,255,0.92)",
    fontSize: 13,
    fontWeight: "400",
    textAlign: "center",
    lineHeight: 18,
  },
});
