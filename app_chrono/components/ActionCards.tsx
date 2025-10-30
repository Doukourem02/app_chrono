import React from "react";
import { Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useRequireAuth } from "../hooks/useRequireAuth";

export default function ActionCards() {
  const { requireAuth } = useRequireAuth();

  const handleNewDelivery = () => {
    requireAuth(() => {
      
      console.log('Naviguer vers nouvelle livraison');
    
    });
  };

  const handleTrackPackage = () => {
    requireAuth(() => {
      
      console.log('Naviguer vers suivi de colis');
    
    });
  };

  return (
    <View style={styles.actionRow}>
      <TouchableOpacity 
        style={[styles.actionCard, { backgroundColor: "#F5E8FF" }]}
        onPress={handleNewDelivery}
      >
        <Text style={styles.cardTitle}>Nouvelle{"\n"}Livraison</Text>
        <Image
          source={require("../assets/images/delivery.png")}
          style={styles.cardImage}
        />
      </TouchableOpacity>

      <TouchableOpacity 
        style={[styles.actionCard, { backgroundColor: "#eeeeeeff" }]}
        onPress={handleTrackPackage}
      >
        <Text style={styles.cardTitle}>Suivis de{"\n"}Colis</Text>
        <Image
          source={require("../assets/images/colis.png")}
          style={styles.cardImage}
        />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
actionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 25,
},
actionCard: {
    flex: 1,
    borderRadius: 15,
    padding: 15,
    marginRight: 10,
    justifyContent: "space-between",
    height: 140,
},
cardTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#222",
},
cardImage: {
    width: 110,
    height: 110,
    alignSelf: "flex-end",
    marginTop: 5,
    position: "absolute",
    bottom: -10,
    right: -5,
},
});