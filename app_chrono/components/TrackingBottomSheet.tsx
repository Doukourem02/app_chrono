import React, { useEffect, useRef } from "react";
import {
  View,
  Text,
  Animated,
  PanResponderInstance,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

interface TrackingBottomSheetProps {
  currentOrder: any;
  panResponder: PanResponderInstance;
  animatedHeight: Animated.Value;
  isExpanded: boolean;
  onToggle: () => void;
}

const TrackingBottomSheet: React.FC<TrackingBottomSheetProps> = ({
  currentOrder,
  panResponder,
  animatedHeight,
  isExpanded,
  onToggle,
}) => {
  const insets = useSafeAreaInsets();

  const status: string = currentOrder?.status || "accepted";
  const isCompleted = status === 'completed';

  // Harmoniser avec OrderStatus: 'accepted' | 'enroute' | 'picked_up' | 'completed'
  const statusSteps = [
    { label: "Livreur en route pour récupérer le colis", key: "accepted" },
    { label: "Colis pris en charge", key: "picked_up" },
    { label: "En cours de livraison", key: "enroute" },
    { label: "Colis livré", key: "completed" },
  ];

  const activeIndex = Math.max(
    0,
    statusSteps.findIndex((s) => s.key === status)
  );

  // 🎨 Animations pour les transitions de statut
  const stepAnimations = useRef(
    statusSteps.map((_, index) => {
      const initialActive = index <= activeIndex;
      return {
        color: new Animated.Value(initialActive ? 1 : 0),
        scale: new Animated.Value(1),
        opacity: new Animated.Value(initialActive ? 1 : 0.5),
      };
    })
  ).current;

  // Animer les transitions quand le statut change
  useEffect(() => {
    statusSteps.forEach((_, index) => {
      const isActive = index <= activeIndex;
      const targetColor = isActive ? 1 : 0;
      const targetOpacity = isActive ? 1 : 0.5;
      const isCurrentStep = index === activeIndex;

      // 🔧 Arrêter les animations en cours pour éviter les conflits
      stepAnimations[index].color.stopAnimation();
      stepAnimations[index].scale.stopAnimation();
      stepAnimations[index].opacity.stopAnimation();

      // Animation de couleur pour le cercle et la ligne (fluide)
      // Utiliser uniquement JS driver pour éviter les conflits avec les autres animations
      Animated.spring(stepAnimations[index].color, {
        toValue: targetColor,
        useNativeDriver: false, // Couleur nécessite le driver JS
        tension: 65,
        friction: 8,
      }).start();

      // Animation de scale avec pulse pour le statut actuel (effet visuel)
      // Utiliser JS driver pour éviter les conflits avec l'animation de couleur
      if (isCurrentStep && isActive) {
        // Petit pulse quand le statut devient actif
        Animated.sequence([
          Animated.spring(stepAnimations[index].scale, {
            toValue: 1.25,
            useNativeDriver: false, // Utiliser JS driver pour cohérence
            tension: 65,
            friction: 5,
          }),
          Animated.spring(stepAnimations[index].scale, {
            toValue: 1,
            useNativeDriver: false,
            tension: 65,
            friction: 7,
          }),
        ]).start();
      } else {
        Animated.spring(stepAnimations[index].scale, {
          toValue: 1,
          useNativeDriver: false,
          tension: 65,
          friction: 7,
        }).start();
      }

      // Animation d'opacité pour le texte (transition douce)
      // Utiliser JS driver pour éviter les conflits
      Animated.timing(stepAnimations[index].opacity, {
        toValue: targetOpacity,
        duration: 400,
        useNativeDriver: false, // Utiliser JS driver pour cohérence
      }).start();
    });
  }, [activeIndex, status]);

  return (
    <Animated.View
      {...panResponder.panHandlers}
      style={[
        styles.sheetContainer,
        {
          height: animatedHeight,
          bottom: insets.bottom + 25,
        },
      ]}
    >
      {/* Handle */}
      <TouchableOpacity onPress={onToggle} style={styles.dragIndicator}>
        <View style={styles.dragHandle} />
      </TouchableOpacity>

      {/* ✅ COLLAPSÉ */}
      {!isExpanded && (
        <View style={styles.collapsedWrapper}>
          <View style={styles.collapsedContainer}>
            <View style={styles.driverAvatar} />

            {/* If completed, show a small badge so the user sees confirmation even when collapsed */}
            {isCompleted ? (
              <View style={styles.completedBadge}>
                <Ionicons name="checkmark" size={16} color="#fff" />
                <Text style={styles.completedBadgeText}>Livré</Text>
              </View>
            ) : (
              <View style={styles.actionButtonsCollapsed}>
                <TouchableOpacity style={styles.iconCircle}>
                  <Ionicons name="chatbubble-ellipses-outline" size={20} color="#fff" />
                </TouchableOpacity>
                <TouchableOpacity style={styles.iconCircle}>
                  <Ionicons name="call-outline" size={20} color="#fff" />
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      )}

      {/* ✅ EXPANDÉ */}
      {isExpanded && (
        <View style={styles.expandedCard}>
          <Text style={styles.title}>Statut de la commande</Text>

          {/* Confirmation banner when order is completed */}
          {isCompleted && (
            <View style={styles.completedBanner}>
              <Ionicons name="checkmark-circle" size={20} color="#fff" />
              <Text style={styles.completedBannerText}>
                Course terminée{currentOrder?.proof?.uploadedAt ? ' — preuve reçue' : ''}
              </Text>
            </View>
          )}

          {/* Timeline avec animations fluides */}
          <View style={styles.timelineContainer}>
            {statusSteps.map((step, index) => {
              const isActive = index <= activeIndex;
              const anim = stepAnimations[index];
              
              // Interpolations pour les animations
              const circleColor = anim.color.interpolate({
                inputRange: [0, 1],
                outputRange: ['#E0E0E0', '#7C3AED'],
              });
              
              const lineColor = anim.color.interpolate({
                inputRange: [0, 1],
                outputRange: ['#E0E0E0', '#7C3AED'],
              });
              
              const textColor = anim.color.interpolate({
                inputRange: [0, 1],
                outputRange: ['#aaa', '#000'],
              });

              return (
                <View key={step.key} style={styles.stepContainer}>
                  {index !== 0 && (
                    <Animated.View
                      style={[
                        styles.line,
                        { backgroundColor: lineColor },
                      ]}
                    />
                  )}
                  <Animated.View
                    style={[
                      styles.circle,
                      {
                        backgroundColor: circleColor,
                        borderColor: circleColor,
                        transform: [{ scale: anim.scale }],
                      },
                    ]}
                  />
                  <Animated.Text
                    style={[
                      styles.stepText,
                      { 
                        color: textColor,
                        opacity: anim.opacity,
                      },
                    ]}
                  >
                    {step.label}
                  </Animated.Text>
                </View>
              );
            })}
          </View>

          {/* Preuve de livraison si disponible */}
          {currentOrder?.proof?.uploadedAt && (
            <View style={styles.proofRow}>
              <Ionicons name="checkmark-circle" size={18} color="#10B981" />
              <Text style={styles.proofText}>
                Preuve de livraison reçue
              </Text>
            </View>
          )}

          {/* Barre d’action */}
          <View style={styles.actionBar}>
            <View style={styles.driverAvatar} />
            <View style={styles.actionButtons}>
              <TouchableOpacity style={styles.actionButton}>
                <Ionicons name="chatbubble-ellipses-outline" size={20} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionButton}>
                <Ionicons name="call-outline" size={20} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </Animated.View>
  );
};

export default TrackingBottomSheet;

const styles = StyleSheet.create({
  sheetContainer: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
    backgroundColor: "transparent",
  },

  dragIndicator: {
    alignItems: "center",
    marginTop: 6,
  },
  dragHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#D1D5DB",
  },

  collapsedWrapper: {
    alignSelf: "center",
    width: "92%",
    backgroundColor: "#fff",
    padding: 10,
    borderRadius: 28,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },

  collapsedContainer: {
    backgroundColor: "#7C3AED",
    borderRadius: 22,
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 16,
    paddingHorizontal: 18,
  },

  driverAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#d1d5db",
  },

  actionButtonsCollapsed: {
    flexDirection: "row",
    marginLeft: "auto",
    gap: 12,
  },

  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#000",
    justifyContent: "center",
    alignItems: "center",
  },

  // ✅ NOUVELLE PARTIE FIDÈLE AU FIGMA
  expandedCard: {
    width: "92%",
    backgroundColor: "#fff",
    borderRadius: 28,
    paddingTop: 20,
    paddingHorizontal: 22,
    paddingBottom: 18,
    alignSelf: "center",
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 15,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },

  title: {
    fontSize: 17,
    fontWeight: "600",
    color: "#333",
    textAlign: "center",
    marginBottom: 16,
  },

  timelineContainer: {
    marginBottom: 24,
    paddingLeft: 6,
  },

  stepContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
    position: "relative",
  },

  line: {
    position: "absolute",
    left: 7,
    top: -14,
    width: 2,
    height: 26,
  },

  circle: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1.5,
    marginRight: 12,
  },

  stepText: {
    fontSize: 15,
    fontWeight: "500",
  },

  actionBar: {
    flexDirection: "row",
    backgroundColor: "#7C3AED",
    borderRadius: 35,
    paddingVertical: 12,
    paddingHorizontal: 18,
    alignItems: "center",
    justifyContent: "space-between",
    shadowColor: "#7C3AED",
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },

  actionButtons: {
    flexDirection: "row",
    gap: 12,
  },

  actionButton: {
    backgroundColor: "#000",
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
  },
  proofRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    marginBottom: 8,
  },
  proofText: {
    fontSize: 14,
    color: '#065F46',
    fontWeight: '500',
  },
  completedBadge: {
    marginLeft: 'auto',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#10B981',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 20,
  },
  completedBadgeText: {
    color: '#fff',
    fontWeight: '600',
    marginLeft: 6,
  },
  completedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#10B981',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginBottom: 12,
  },
  completedBannerText: {
    color: '#fff',
    fontWeight: '600',
    marginLeft: 8,
    fontSize: 15,
  },
});
