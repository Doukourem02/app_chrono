import { Ionicons } from "@expo/vector-icons";
import React, { useMemo } from "react";
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useLocation } from "../hooks/useLocation";
import { useLocationStore } from "../store/useLocationStore";

const FALLBACK_REGION = "Abidjan, Côte d'Ivoire";

export default function Header() {
  const { address: hookAddress, loading } = useLocation();
  const storeAddress = useLocationStore((s) => s.currentLocation?.address);

  const locationLine = useMemo(() => {
    const fromStore = storeAddress?.trim();
    if (fromStore) return fromStore;
    const fromHook = hookAddress?.trim();
    if (fromHook) return fromHook;
    return null;
  }, [storeAddress, hookAddress]);

  const showLoading = loading && !locationLine;

  return (
    <View style={styles.header}>
      <View style={styles.headerMain}>
        <Text style={styles.headerTitle}>Localisation</Text>
        <View style={styles.locationRow}>
          <Ionicons name="location-outline" size={18} color="#5B21B6" />
          {showLoading ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator size="small" color="#7C3AED" style={styles.spinner} />
              <Text style={styles.locationTextMuted}>Recherche de votre adresse…</Text>
            </View>
          ) : (
            <Text style={styles.locationText} numberOfLines={2} ellipsizeMode="tail">
              {locationLine ?? FALLBACK_REGION}
            </Text>
          )}
        </View>
      </View>
      <TouchableOpacity style={styles.notification} accessibilityLabel="Notifications">
        <Ionicons name="notifications-outline" size={22} color="#1F2937" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  headerMain: {
    flex: 1,
    marginRight: 12,
  },
  headerTitle: {
    fontSize: 13,
    color: "#4B5563",
    fontWeight: "600",
    letterSpacing: 0.2,
    textTransform: "uppercase",
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginTop: 8,
    gap: 6,
  },
  loadingRow: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
  },
  spinner: {
    marginRight: 8,
  },
  locationText: {
    flex: 1,
    color: "#111827",
    fontWeight: "600",
    fontSize: 16,
    lineHeight: 22,
  },
  locationTextMuted: {
    flex: 1,
    color: "#6B7280",
    fontSize: 15,
    lineHeight: 22,
  },
  notification: {
    backgroundColor: "#F3F4F6",
    padding: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
});
