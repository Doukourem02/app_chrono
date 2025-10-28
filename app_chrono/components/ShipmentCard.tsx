import { Ionicons } from "@expo/vector-icons";
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import React from "react";
import { Image, StyleSheet, Text, View } from "react-native";

interface ShipmentCardProps {
  id: string;
  productName: string;
  productIcon: any;
  backgroundColor: string;
  transportIcon: any;
  location: string;
  deliveryTime: string;
  progressPercentage: number;
  progressColor: string;
  inactiveColor?: string;
}

export default function ShipmentCard({
  id,
  productName,
  productIcon,
  backgroundColor,
  transportIcon,
  location,
  deliveryTime,
  progressPercentage,
  progressColor,
  inactiveColor = "rgba(0,0,0,0.15)",
}: ShipmentCardProps) {
  return (
    <View style={[styles.card, { backgroundColor }]}>
      {/* HEADER */}
      <View style={styles.header}>
        <View style={styles.productInfo}>
          <View style={styles.productImageContainer}>
            <Image
              source={productIcon}
              style={styles.productIconImage}
              resizeMode="contain"
            />
          </View>
          <View style={styles.productDetails}>
            <Text style={styles.productName}>{productName}</Text>
            <Text style={styles.productId}>ID: {id}</Text>
          </View>
        </View>

        <Image
          source={transportIcon}
          style={styles.transportImage}
          resizeMode="contain"
        />
      </View>

      {/* ==== BARRE DE PROGRESSION (comme l'image) ==== */}
      <View style={styles.progressContainer}>
        <View style={styles.progressLineContainer}>
          {/* Point de départ */}
          <View style={[styles.progressStartDot, { backgroundColor: progressColor }]} />
          
          {/* Ligne de progression (plus courte) */}
          <View style={[styles.progressLine, { backgroundColor: progressColor }]} />
          
          {/* Cercle avec icône de camion */}
          <View style={[styles.progressEndCircle, { backgroundColor: progressColor }]}>
            <MaterialCommunityIcons name="truck-delivery" size={16} color="#fff" />
          </View>
          
          {/* Petit espace après le camion */}
          <View style={styles.spacer} />
          
          {/* Petites lignes inactives (3 au lieu de 5, plus grandes) */}
          <View style={styles.dottedSection}>
            <View style={[styles.dottedLine, { backgroundColor: inactiveColor }]} />
            <View style={[styles.dottedLine, { backgroundColor: inactiveColor }]} />
            <View style={[styles.dottedLine, { backgroundColor: inactiveColor }]} />
          </View>
          
          {/* Petit espace avant la sphère */}
          <View style={styles.spacer} />
          
          {/* Sphère inactive */}
          <View style={[styles.inactiveSphere, { backgroundColor: inactiveColor }]} />
          
          {/* Petit espace après la sphère */}
          <View style={styles.spacer} />
          
          {/* Petites lignes inactives (3 au lieu de 5, plus grandes) */}
          <View style={styles.dottedSection}>
            <View style={[styles.dottedLine, { backgroundColor: inactiveColor }]} />
            <View style={[styles.dottedLine, { backgroundColor: inactiveColor }]} />
            <View style={[styles.dottedLine, { backgroundColor: inactiveColor }]} />
          </View>
          
          {/* Sphère inactive finale */}
          <View style={[styles.inactiveSphere, { backgroundColor: inactiveColor }]} />
        </View>
      </View>

      {/* INFOS DE LIVRAISON */}
      <View style={styles.deliveryInfo}>
        <View style={styles.infoRow}>
          <View style={styles.infoItem}>
            <Ionicons name="location-outline" size={16} color="#666" />
            <Text style={styles.infoLabel}>Localisation</Text>
          </View>
          <View style={styles.infoItem}>
            <Ionicons name="time-outline" size={16} color="#666" />
            <Text style={styles.infoLabel}>Délai de livraison</Text>
          </View>
        </View>
        <View style={styles.infoValues}>
          <Text style={styles.infoValue}>{location}</Text>
          <Text style={styles.infoValue}>{deliveryTime}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 22,
    padding: 12,
    marginBottom: 18,
    marginTop: 10,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  productInfo: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  productImageContainer: {
    width: 56,
    height: 56,
    backgroundColor: "white",
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  productIconImage: {
    width: 40,
    height: 40,
  },
  productDetails: {
    flex: 1,
  },
  productName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#222",
  },
  productId: {
    fontSize: 12,
    color: "#666",
    marginTop: 2,
  },
  transportImage: {
    width: 110,
    height: 90,
    marginLeft: 10,
  },

  /* ==== Progression stylée ==== */
  progressContainer: {
    alignItems: "center",
    marginVertical: 25,
  },
  progressLineContainer: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
    position: "relative",
  },
  // Point de départ (petit cercle)
  progressStartDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  // Ligne de progression (plus courte et fixe)
  progressLine: {
    height: 4,
    width: 60, // Longueur fixe plus courte
    borderRadius: 2,
    marginLeft: 8,
  },
  // Cercle avec icône à la fin de la progression
  progressEndCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 8,
  },
  // Section pointillés (maintenant des lignes)
  dottedSection: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1, // Prend tout l'espace disponible
    marginLeft: 0, // Supprime la marge pour toucher les sphères
    marginRight: 0, // Supprime la marge pour toucher les sphères
    gap: 1,
  },
  // Ligne pointillée individuelle (au lieu de point)
  dottedLine: {
    flex: 1, // Prend tout l'espace disponible pour s'étendre jusqu'aux sphères
    height: 3, // Agrandi de 2 à 3
    borderRadius: 1,
  },
  // Sphère inactive
  inactiveSphere: {
    width: 16,
    height: 16,
    borderRadius: 8,
    marginLeft: 8,
  },

  /* ==== Infos livraison ==== */
  deliveryInfo: {
    marginTop: 15,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  infoItem: {
    flexDirection: "row",
    alignItems: "center",
  },
  infoLabel: {
    fontSize: 13,
    color: "#666",
    marginLeft: 6,
  },
  infoValues: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  infoValue: {
    fontSize: 15,
    fontWeight: "500",
    color: "#333",
  },
  // Petit espace pour séparer les éléments
  spacer: {
    width: 4,
  },
});
