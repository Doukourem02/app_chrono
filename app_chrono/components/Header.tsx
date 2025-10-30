import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

export default function Header() {
  return (
    <View style={styles.header}>
      <View>
        <Text style={styles.headerTitle}>Localisation</Text>
        <View style={styles.locationRow}>
          <Ionicons name="location-outline" size={16} color="#888" />
          <Text style={styles.locationText}>Abidjan Côte d&apos;Ivoire</Text>
        </View>
      </View>
      <TouchableOpacity style={styles.notification}>
        <Ionicons name="notifications-outline" size={20} color="#000" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 16,
    color: "#777",
    fontWeight: "500",
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 10,
  },
  locationText: {
    color: "#111",
    fontWeight: "600",
    marginLeft: 4,
  },
  notification: {
    backgroundColor: "#F5F5F5",
    padding: 8,
    borderRadius: 12,
  },
});