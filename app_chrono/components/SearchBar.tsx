import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, TextInput, TouchableOpacity, View } from "react-native";

export default function SearchBar() {
return (
    <View style={styles.searchContainer}>
    <View style={styles.searchBox}>
        <Ionicons name="search-outline" size={18} color="#999" />
        <TextInput
        placeholder="Recherche"
        placeholderTextColor="#aaa"
        style={styles.searchInput}
        />
    </View>
    <TouchableOpacity style={styles.scanButton}>
        <Ionicons name="scan-outline" size={18} color="#999" />
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
    backgroundColor: "#F6F6F6",
    borderRadius: 12,
    paddingHorizontal: 10,
    height: 45,
},
searchInput: {
    flex: 1,
    marginHorizontal: 8,
    fontSize: 14,
},
scanButton: {
    backgroundColor: "#F6F6F6",
    padding: 12,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
},
});