import { Ionicons } from "@expo/vector-icons";
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router } from "expo-router";
import React, { useEffect, useMemo, useRef } from "react";
import { Animated, Easing, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { OrderRequest } from "../store/useOrderStore";
import { formatDurationLabel } from "../services/orderApi";
import { formatDeliveryId } from "../utils/formatDeliveryId";

/**
 * 4 cercles : Commande acceptée → Colis pris en charge → En cours de livraison → Colis livré.
 * "Livreur en route pour récupérer" est inclus dans la phase "Commande acceptée" (implicite).
 */
function getActiveStageIndex(status: string): number {
  switch (status) {
    case 'accepted':
    case 'enroute':
      return 0; // Commande acceptée (inclut en route pickup)
    case 'picked_up':
      return 1; // Colis pris en charge
    case 'delivering':
      return 2; // En cours de livraison
    case 'completed':
      return 3; // Colis livré
    case 'pending':
      return -1;
    default:
      return 0;
  }
}

/** 4 étapes : acceptée, colis pris, en livraison, livré */
const PROGRESS_STEPS = [
  { key: 'accepted', icon: 'checkmark' as const },
  { key: 'picked_up', icon: 'cube' as const },
  { key: 'delivering', icon: 'navigate' as const },
  { key: 'completed', icon: 'checkmark-done' as const },
];

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
  
  const status = String(order.status || 'pending');
  const activeStageIndex = useMemo(() => getActiveStageIndex(status), [status]);

  /** Pour chaque étape : isCompleted = statut >= étape, isActive = étape courante (animée) */
  const isStepCompleted = (index: number) => index <= activeStageIndex;
  const isStepActive = (index: number) => index === activeStageIndex;

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const isInProgress =
    status === "accepted" || status === "enroute" || status === "picked_up" || status === "delivering";

  // Animations progressives type barre de chargement (cercles + segments)
  const circleAnims = useRef(
    PROGRESS_STEPS.map((_, i) => new Animated.Value(i <= activeStageIndex ? 1 : 0))
  ).current;
  const segmentAnims = useRef(
    [0, 1, 2].map((i) => new Animated.Value(i < activeStageIndex ? 1 : 0))
  ).current;

  useEffect(() => {
    const STAGGER_MS = 90;
    const DURATION_MS = 420;
    const easing = Easing.bezier(0.25, 0.1, 0.25, 1);

    const anims: Animated.CompositeAnimation[] = [];
    for (let i = 0; i < 4; i++) {
      const target = i <= activeStageIndex ? 1 : 0;
      circleAnims[i].stopAnimation();
      anims.push(
        Animated.timing(circleAnims[i], {
          toValue: target,
          duration: DURATION_MS,
          useNativeDriver: false,
          easing,
        })
      );
      if (i < 3) {
        const segTarget = i < activeStageIndex ? 1 : 0;
        segmentAnims[i].stopAnimation();
        anims.push(
          Animated.timing(segmentAnims[i], {
            toValue: segTarget,
            duration: DURATION_MS,
            useNativeDriver: false,
            easing,
          })
        );
      }
    }
    // Ordre : cercle0, seg0, cercle1, seg1, cercle2, seg2, cercle3
    Animated.stagger(STAGGER_MS, anims).start();
  }, [activeStageIndex, circleAnims, segmentAnims]);

  useEffect(() => {
    if (!isInProgress) return;
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.08,
          duration: 700,
          useNativeDriver: false,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 700,
          useNativeDriver: false,
        }),
      ])
    );
    pulseLoop.start();
    return () => pulseLoop.stop();
  }, [pulseAnim, isInProgress]);

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

      {/* ==== BARRE DE PROGRESSION (alignée sur le statut, animation type chargement) ==== */}
      <View style={styles.progressContainer}>
        <View style={styles.progressLineContainer}>
          {PROGRESS_STEPS.map((step, index) => {
            const active = isStepActive(index);
            const circleAnim = circleAnims[index];
            const circleBg = circleAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [inactiveColor, progressColor],
            });

            return (
              <React.Fragment key={step.key}>
                {index > 0 && (
                  <Animated.View
                    style={[
                      styles.progressSegment,
                      {
                        backgroundColor: segmentAnims[index - 1].interpolate({
                          inputRange: [0, 1],
                          outputRange: [inactiveColor, progressColor],
                        }),
                      },
                    ]}
                  />
                )}
                {active && isInProgress ? (
                  <Animated.View
                    style={[
                      styles.progressCircle,
                      styles.progressCircleActive,
                      { backgroundColor: circleBg, transform: [{ scale: pulseAnim }] },
                    ]}
                  >
                    <MaterialCommunityIcons name="truck-delivery" size={16} color="#fff" />
                  </Animated.View>
                ) : (
                  <Animated.View style={[styles.progressCircle, { backgroundColor: circleBg }]}>
                    {isStepCompleted(index) ? (
                      <Ionicons name={step.icon} size={12} color="#fff" />
                    ) : null}
                  </Animated.View>
                )}
              </React.Fragment>
            );
          })}
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

  /* ==== Progression alignée sur le statut ==== */
  progressContainer: {
    alignItems: "center",
    marginVertical: 25,
  },
  progressLineContainer: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
  },
  progressSegment: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    marginHorizontal: 2,
    minWidth: 12,
  },
  progressCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  progressCircleActive: {
    width: 36,
    height: 36,
    borderRadius: 18,
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
});
