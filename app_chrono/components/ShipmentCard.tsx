import { Ionicons } from "@expo/vector-icons";
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router } from "expo-router";
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { OrderRequest } from "../store/useOrderStore";
import { formatDurationLabel } from "../services/orderApi";
import { formatDeliveryId } from "../utils/formatDeliveryId";

interface ShipmentCardProps {
  order: OrderRequest;
  backgroundColor: string;
  progressPercentage: number;
  progressColor: string;
  inactiveColor?: string;
}

export default function ShipmentCard({
  order,
  backgroundColor,
  progressPercentage,
  progressColor,
  inactiveColor = "rgba(0,0,0,0.15)",
}: ShipmentCardProps) {
  // Extraire l'adresse directement depuis order.dropoff.address
  // Les données sont maintenant correctement formatées dans ShipmentList
  const dropoffAddress = order.dropoff?.address || '';
  
  // Limiter l'adresse à 30 caractères maximum pour éviter qu'elle déborde
  const location = dropoffAddress 
    ? (dropoffAddress.length > 30 ? dropoffAddress.substring(0, 30) + '...' : dropoffAddress)
    : 'Adresse non définie';
  
  // Formater le délai de livraison
  // estimatedDuration peut être un nombre (minutes), une string formatée, ou null/undefined
  let deliveryTime = 'Non estimé';
  
  if (order.estimatedDuration !== null && order.estimatedDuration !== undefined && order.estimatedDuration !== '') {
    if (typeof order.estimatedDuration === 'number') {
      // Si c'est un nombre (minutes), le formater
      const formatted = formatDurationLabel(order.estimatedDuration);
      deliveryTime = formatted || `${order.estimatedDuration} min`;
    } else if (typeof order.estimatedDuration === 'string') {
      const trimmed = order.estimatedDuration.trim();
      if (trimmed !== '') {
        // Si c'est déjà une string formatée, l'utiliser directement
        // Mais vérifier si c'est juste un nombre pour le formater
        const numericValue = parseFloat(trimmed);
        if (!isNaN(numericValue) && isFinite(numericValue)) {
          // Si c'est un nombre en string, le formater
          const formatted = formatDurationLabel(Math.round(numericValue));
          deliveryTime = formatted || `${Math.round(numericValue)} min`;
        } else {
          // Sinon, utiliser la string telle quelle (déjà formatée)
          deliveryTime = trimmed;
        }
      }
    }
  }
  
  // Extraire le nom du produit depuis l'adresse ou utiliser un placeholder
  const productName = dropoffAddress 
    ? (dropoffAddress.split(',')[0] || dropoffAddress.substring(0, 30))
    : formatDeliveryId(order.id, order.createdAt);
  
  // Naviguer vers la page dédiée au tracking de cette commande
  const handleCardPress = () => {
    // Seulement pour les commandes en cours (pas terminées)
    if (order.status !== 'completed' && order.status !== 'cancelled' && order.status !== 'declined') {
      router.push({
        pathname: '/order-tracking/[orderId]',
        params: { orderId: order.id }
      });
    }
  };
  
  // Rendre la carte cliquable seulement si c'est une commande en cours
  const isClickable = order.status !== 'completed' && order.status !== 'cancelled' && order.status !== 'declined';
  const CardComponent = isClickable ? TouchableOpacity : View;
  
  return (
    <CardComponent 
      style={[styles.card, { backgroundColor }]} 
      onPress={isClickable ? handleCardPress : undefined}
      activeOpacity={isClickable ? 0.7 : 1}
    >
      {/* HEADER */}
      <View style={styles.header}>
        <View style={styles.productInfo}>
          <View style={styles.productImageContainer}>
            <Ionicons name="cube" size={24} color="#8B5CF6" />
          </View>
          <View style={styles.productDetails}>
            <Text style={styles.productName} numberOfLines={1}>{productName}</Text>
            <Text style={styles.productId}>ID: {formatDeliveryId(order.id, order.createdAt)}</Text>
          </View>
        </View>
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
          <View style={styles.infoColumn}>
            <View style={styles.infoItem}>
              <Ionicons name="location-outline" size={16} color="#666" />
              <Text style={styles.infoLabel}>Localisation</Text>
            </View>
            <Text style={styles.infoValue} numberOfLines={1} ellipsizeMode="tail">
              {location}
            </Text>
          </View>
          <View style={[styles.infoColumn, styles.rightColumn]}>
            <View style={[styles.infoItem, styles.centeredItem]}>
              <Ionicons name="time-outline" size={16} color="#666" />
              <Text style={styles.infoLabel} numberOfLines={2}>
                Délai de livraison
              </Text>
            </View>
            <Text style={[styles.infoValue, styles.centeredValue]} numberOfLines={1}>
              {deliveryTime}
            </Text>
          </View>
        </View>
      </View>
    </CardComponent>
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
    alignItems: "flex-start",
    gap: 8,
  },
  infoColumn: {
    flex: 1,
    minWidth: 0, // Permet au texte de se tronquer correctement
    maxWidth: '48%', // Limite la largeur pour éviter que le texte soit tronqué
  },
  rightColumn: {
    alignItems: "center",
  },
  infoItem: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
    flexWrap: 'wrap', // Permet au texte de passer à la ligne si nécessaire
  },
  centeredItem: {
    justifyContent: "center",
  },
  infoLabel: {
    fontSize: 13,
    color: "#666",
    marginLeft: 6,
    flexShrink: 0, // Empêche le texte de se rétrécir
  },
  infoValue: {
    fontSize: 15,
    fontWeight: "500",
    color: "#333",
    marginTop: 2,
  },
  centeredValue: {
    textAlign: "center",
    alignSelf: "center",
  },
  // Petit espace pour séparer les éléments
  spacer: {
    width: 4,
  },
});
