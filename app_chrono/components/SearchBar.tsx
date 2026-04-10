import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, TextInput, TouchableOpacity, View } from "react-native";

export default function SearchBar() {
  return (
    <View style={styles.searchContainer}>
      <View style={styles.searchBox}>
        <Ionicons name="search-outline" size={20} color="#4B5563" />
        <TextInput
          placeholder="Rechercher une adresse, un lieu…"
          placeholderTextColor="#6B7280"
          style={styles.searchInput}
        />
      </View>
      <TouchableOpacity
        style={styles.scanButton}
        accessibilityLabel="Scanner un code"
        activeOpacity={0.85}
      >
        <Ionicons name="scan-outline" size={22} color="#374151" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 20,
    gap: 10,
  },
  searchBox: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 48,
    borderWidth: 1.5,
    borderColor: "#D1D5DB",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  searchInput: {
    flex: 1,
    marginLeft: 10,
    fontSize: 15,
    color: "#111827",
  },
  scanButton: {
    backgroundColor: "#FFFFFF",
    padding: 12,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "#D1D5DB",
    minWidth: 48,
    minHeight: 48,
  },
});
