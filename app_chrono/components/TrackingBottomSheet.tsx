import React, { useEffect, useRef, useMemo, useState, useCallback } from "react";
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
import { userApiService } from "../services/userApiService";

interface TrackingBottomSheetProps {
  currentOrder: any;
  panResponder: PanResponderInstance;
  animatedHeight: Animated.Value;
  isExpanded: boolean;
  onToggle: () => void;
  onCancel?: () => void;
  onNewOrder?: () => void; // Callback pour créer une nouvelle commande
  onMessage?: () => void; // Callback pour ouvrir la messagerie
  activeOrdersCount?: number; // Nombre de commandes actives
}

const TrackingBottomSheet: React.FC<TrackingBottomSheetProps> = ({
  currentOrder,
  panResponder,
  animatedHeight,
  isExpanded,
  onToggle,
  onCancel,
  onNewOrder,
  onMessage,
  activeOrdersCount = 0,
}) => {
  const insets = useSafeAreaInsets();
  
  // État pour stocker le rating et commentaire
  const [orderRating, setOrderRating] = useState<{ rating: number; comment: string | null } | null>(null);
  const [isLoadingRating, setIsLoadingRating] = useState(false);

  // Charger le rating et commentaire de la commande
  const loadOrderRating = useCallback(async () => {
    if (!currentOrder?.id) {
      setOrderRating(null);
      return;
    }
    
    // Charger le rating même si la commande n'est pas encore marquée comme complétée
    // (au cas où l'utilisateur a déjà soumis une évaluation)
    setIsLoadingRating(true);
    try {
      const result = await userApiService.getOrderRating(currentOrder.id);
      if (result.success && result.data) {
        setOrderRating({
          rating: result.data.rating,
          comment: result.data.comment,
        });
        if (__DEV__) {
          console.log(`✅ Rating chargé pour commande ${currentOrder.id.slice(0, 8)}...: ${result.data.rating}/5, comment: ${result.data.comment ? 'oui' : 'non'}`);
        }
      } else {
        setOrderRating(null);
        if (__DEV__) {
          console.log(`ℹ️ Aucun rating trouvé pour commande ${currentOrder.id.slice(0, 8)}...`);
        }
      }
    } catch (error) {
      console.error('Erreur chargement rating:', error);
      setOrderRating(null);
    } finally {
      setIsLoadingRating(false);
    }
  }, [currentOrder?.id]);

  // Charger le rating quand la commande change ou est complétée
  useEffect(() => {
    if (currentOrder?.id) {
      // Charger immédiatement
      loadOrderRating();
      
      // Recharger périodiquement si la commande est complétée (au cas où l'utilisateur vient de soumettre une évaluation)
      if (isCompleted) {
        const interval = setInterval(() => {
          loadOrderRating();
        }, 3000); // Recharger toutes les 3 secondes si complétée
        
        return () => clearInterval(interval);
      }
    }
  }, [currentOrder?.id, isCompleted, loadOrderRating]);

  // S'assurer que le statut est toujours à jour depuis currentOrder
  // Utiliser useMemo pour forcer le recalcul quand currentOrder change
  const status: string = React.useMemo(() => {
    const currentStatus = String(currentOrder?.status || "accepted");
    if (__DEV__ && currentOrder?.id) {
      console.log(`📊 TrackingBottomSheet - Statut calculé: ${currentStatus} pour commande ${currentOrder.id.slice(0, 8)}...`);
    }
    return currentStatus;
  }, [currentOrder?.status, currentOrder?.id]);
  
  const isCompleted = status === 'completed';
  const canCancel = (status === 'pending' || status === 'accepted') && onCancel;

  // Séquence correcte des statuts :
  // 1. accepted → "Livreur assigné" (quand le driver accepte la commande)
  // 2. enroute → "Livreur en route pour récupérer le colis" (quand le driver clique sur "Je pars")
  // 3. picked_up → "Colis pris en charge" (quand le driver clique sur "Colis récupéré")
  // 4. picked_up (en route vers destination) → "En cours de livraison" (même statut, étape visuelle)
  // 5. completed → "Colis livré" (quand le driver clique sur "Terminé")
  const statusSteps = useMemo(() => [
    { label: "Livreur assigné", key: "accepted" },
    { label: "Livreur en route pour récupérer le colis", key: "enroute" },
    { label: "Colis pris en charge", key: "picked_up" },
    { label: "En cours de livraison", key: "delivering" }, // Étape visuelle pour picked_up
    { label: "Colis livré", key: "completed" },
  ], []);

  // Déterminer quels index sont actifs en fonction du statut
  const getActiveIndexes = () => {
    switch (status) {
      case 'accepted':
        return [0]; // "Livreur assigné"
      case 'enroute':
        return [0, 1]; // "Livreur assigné" + "Livreur en route pour récupérer le colis"
      case 'picked_up':
      case 'delivering':
        // Quand le colis est récupéré, on active "Colis pris en charge" ET "En cours de livraison"
        return [0, 1, 2, 3]; // Toutes les étapes jusqu'à "En cours de livraison"
      case 'completed':
        return [0, 1, 2, 3, 4]; // Toutes les étapes
      default:
        return [0];
    }
  };

  // Recalculer activeIndexes à chaque fois que le statut change
  const activeIndexes = React.useMemo(() => getActiveIndexes(), [status]);
  
  // Pour la compatibilité avec l'ancien code, on garde activeIndex comme le dernier index actif
  const activeIndex = React.useMemo(() => Math.max(...activeIndexes, 0), [activeIndexes]);

  // 🎨 Animations pour les transitions de statut
  const stepAnimations = useRef(
    statusSteps.map((_, index) => {
      const initialActive = activeIndexes.includes(index);
      return {
        color: new Animated.Value(initialActive ? 1 : 0),
        scale: new Animated.Value(1),
        opacity: new Animated.Value(initialActive ? 1 : 0.5),
      };
    })
  ).current;

  // Animer les transitions quand le statut change
  useEffect(() => {
    // Recalculer activeIndexes à chaque fois que le statut change
    const currentActiveIndexes = getActiveIndexes();
    const currentActiveIndex = Math.max(...currentActiveIndexes, 0);
    
    statusSteps.forEach((_, index) => {
      const isActive = currentActiveIndexes.includes(index);
      const targetColor = isActive ? 1 : 0;
      const targetOpacity = isActive ? 1 : 0.5;
      const isCurrentStep = index === currentActiveIndex;

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
  }, [status, currentOrder?.status, statusSteps]); // Dépendre directement du statut pour forcer le re-render

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
                <TouchableOpacity 
                  style={styles.iconCircle}
                  onPress={onMessage}
                >
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

          {/* Rating et commentaire si la commande est complétée */}
          {isCompleted && (
            <View style={styles.ratingSection}>
              {isLoadingRating ? (
                <Text style={styles.loadingText}>Chargement de l'évaluation...</Text>
              ) : orderRating ? (
                <>
                  <View style={styles.ratingHeader}>
                    <Ionicons name="star" size={18} color="#FBBF24" />
                    <Text style={styles.ratingTitle}>Votre évaluation</Text>
                  </View>
                  <View style={styles.ratingStars}>
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Ionicons
                        key={star}
                        name={star <= orderRating.rating ? 'star' : 'star-outline'}
                        size={20}
                        color={star <= orderRating.rating ? '#FBBF24' : '#D1D5DB'}
                      />
                    ))}
                    <Text style={styles.ratingValue}>{orderRating.rating}/5</Text>
                  </View>
                  {orderRating.comment && (
                    <View style={styles.commentContainer}>
                      <Text style={styles.commentLabel}>Votre commentaire :</Text>
                      <Text style={styles.commentText}>{orderRating.comment}</Text>
                    </View>
                  )}
                </>
              ) : (
                <Text style={styles.noRatingText}>Aucune évaluation pour le moment</Text>
              )}
            </View>
          )}

          {/* Barre d'action */}
          <View style={styles.actionBar}>
            <View style={styles.driverAvatar} />
            <View style={styles.actionButtons}>
              {canCancel && (
                <TouchableOpacity 
                  style={[styles.actionButton, styles.cancelButton]} 
                  onPress={onCancel}
                >
                  <Ionicons name="close-circle" size={20} color="#fff" />
                </TouchableOpacity>
              )}
              <TouchableOpacity 
                style={styles.actionButton}
                onPress={onMessage}
              >
                <Ionicons name="chatbubble-ellipses-outline" size={20} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionButton}>
                <Ionicons name="call-outline" size={20} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Bouton "Nouvelle commande" - Permet de créer une autre commande même avec des commandes actives */}
          {onNewOrder && (
            <TouchableOpacity 
              style={styles.newOrderButton}
              onPress={onNewOrder}
            >
              <Ionicons name="add-circle-outline" size={20} color="#7C3AED" />
              <Text style={styles.newOrderButtonText}>
                Nouvelle commande{activeOrdersCount > 1 ? ` (${activeOrdersCount} actives)` : ''}
              </Text>
            </TouchableOpacity>
          )}
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
  cancelButton: {
    backgroundColor: "#EF4444",
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
  newOrderButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F3F4F6",
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 20,
    marginTop: 16,
    borderWidth: 1.5,
    borderColor: "#7C3AED",
    borderStyle: "dashed",
  },
  newOrderButtonText: {
    color: "#7C3AED",
    fontSize: 16,
    fontWeight: "600",
    marginLeft: 8,
  },
  ratingSection: {
    marginTop: 16,
    padding: 16,
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  ratingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  ratingTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginLeft: 8,
  },
  ratingStars: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  ratingValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
    marginLeft: 8,
  },
  commentContainer: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  commentLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: 6,
  },
  commentText: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 20,
  },
  loadingText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    paddingVertical: 8,
  },
  noRatingText: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
    paddingVertical: 8,
    fontStyle: 'italic',
  },
});
