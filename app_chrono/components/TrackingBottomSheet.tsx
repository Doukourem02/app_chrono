import React, { useEffect, useRef, useMemo, useState, useCallback } from "react";
import {View,Text,Animated,PanResponderInstance,TouchableOpacity,StyleSheet} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { userApiService } from "../services/userApiService";
import { QRCodeDisplay } from "./QRCodeDisplay";

interface TrackingBottomSheetProps {
  currentOrder: any;
  panResponder: PanResponderInstance;
  animatedHeight: Animated.Value;
  isExpanded: boolean;
  onToggle: () => void;
  onCancel?: () => void;
  onNewOrder?: () => void;
  onMessage?: () => void;
  activeOrdersCount?: number;
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
  
  const [orderRating, setOrderRating] = useState<{ rating: number; comment: string | null } | null>(null);
  const [isLoadingRating, setIsLoadingRating] = useState(false);
  const [showQRCode, setShowQRCode] = useState(false);
  const [qrCodeData, setQrCodeData] = useState<{ qrCodeImage: string; qrCodeData?: { expiresAt: string; orderNumber: string } } | null>(null);

  const loadOrderRating = useCallback(async () => {
    if (!currentOrder?.id) {
      setOrderRating(null);
      return;
    }
    
    setIsLoadingRating(true);
    try {
      const result = await userApiService.getOrderRating(currentOrder.id);
      if (result.success && result.data) {
        setOrderRating({
          rating: result.data.rating,
          comment: result.data.comment,
        });
      } else {
        setOrderRating(null);
      }
    } catch (error) {
      console.error('Erreur chargement rating:', error);
      setOrderRating(null);
    } finally {
      setIsLoadingRating(false);
    }
  }, [currentOrder?.id]);

  const status: string = React.useMemo(() => {
    // Ne pas utiliser de valeur par défaut, utiliser le statut réel de la commande
    const currentStatus = currentOrder?.status ? String(currentOrder.status) : "pending";
    if (__DEV__) {
      console.log('🔍 TrackingBottomSheet status:', {
        orderId: currentOrder?.id,
        status: currentStatus,
        rawStatus: currentOrder?.status,
      });
    }
    return currentStatus;
  }, [currentOrder?.status, currentOrder?.id]);
  
  const isCompleted = status === 'completed';

  useEffect(() => {
    if (currentOrder?.id) {
      loadOrderRating();
      
      if (isCompleted) {
        const interval = setInterval(() => {
          loadOrderRating();
        }, 3000);
        
        return () => clearInterval(interval);
      }
    }
  }, [currentOrder?.id, isCompleted, loadOrderRating]);
  
  // Permettre l'annulation pour les commandes en pending ou accepted
  const canCancel = React.useMemo(() => {
    const canCancelOrder = (status === 'pending' || status === 'accepted') && onCancel;
    if (__DEV__) {
      console.log('🔍 TrackingBottomSheet canCancel:', {
        status,
        hasOnCancel: !!onCancel,
        canCancel: canCancelOrder,
      });
    }
    return canCancelOrder;
  }, [status, onCancel]);

  const statusSteps = useMemo(() => [
    { label: "Livreur assigné", key: "accepted" },
    { label: "Livreur en route pour récupérer le colis", key: "enroute" },
    { label: "Colis pris en charge", key: "picked_up" },
    { label: "En cours de livraison", key: "delivering" },
    { label: "Colis livré", key: "completed" },
  ], []);

  const getActiveIndexes = useCallback(() => {
    switch (status) {
      case 'accepted':
        return [0];
      case 'enroute':
        return [0, 1];
      case 'picked_up':
      case 'delivering':
        return [0, 1, 2, 3];
      case 'completed':
        return [0, 1, 2, 3, 4];
      default:
        return [0];
    }
  }, [status]);

  const activeIndexes = React.useMemo(() => getActiveIndexes(), [getActiveIndexes]);

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

  useEffect(() => {
    const currentActiveIndexes = getActiveIndexes();
    const currentActiveIndex = Math.max(...currentActiveIndexes, 0);
    
    statusSteps.forEach((_, index) => {
      const isActive = currentActiveIndexes.includes(index);
      const targetColor = isActive ? 1 : 0;
      const targetOpacity = isActive ? 1 : 0.5;
      const isCurrentStep = index === currentActiveIndex;

      stepAnimations[index].color.stopAnimation();
      stepAnimations[index].scale.stopAnimation();
      stepAnimations[index].opacity.stopAnimation();

      Animated.spring(stepAnimations[index].color, {
        toValue: targetColor,
        useNativeDriver: false,
        tension: 65,
        friction: 8,
      }).start();

      if (isCurrentStep && isActive) {
        Animated.sequence([
          Animated.spring(stepAnimations[index].scale, {
            toValue: 1.25,
            useNativeDriver: false,
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

      Animated.timing(stepAnimations[index].opacity, {
        toValue: targetOpacity,
        duration: 400,
        useNativeDriver: false,
      }).start();
    });
  }, [status, currentOrder?.status, statusSteps, getActiveIndexes, stepAnimations]);

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
      <TouchableOpacity onPress={onToggle} style={styles.dragIndicator}>
        <View style={styles.dragHandle} />
      </TouchableOpacity>

      {!isExpanded && (
        <View style={styles.collapsedWrapper}>
          <View style={styles.collapsedContainer}>
            <View style={styles.driverAvatar} />

            {isCompleted ? (
              <View style={styles.completedBadge}>
                <Ionicons name="checkmark" size={16} color="#fff" />
                <Text style={styles.completedBadgeText}>Livré</Text>
              </View>
            ) : (
              <View style={styles.actionButtonsCollapsed}>
                {canCancel && (
                  <TouchableOpacity 
                    style={[styles.iconCircle, styles.cancelIconCircle]}
                    onPress={onCancel}
                  >
                    <Ionicons name="close-circle" size={20} color="#fff" />
                  </TouchableOpacity>
                )}
                <TouchableOpacity 
                  style={styles.iconCircle}
                  onPress={onMessage}
                >
                  <Ionicons name="chatbubble-ellipses-outline" size={20} color="#fff" />
                </TouchableOpacity>
                <TouchableOpacity 
                  style={styles.iconCircle}
                  onPress={() => setShowQRCode(true)}
                >
                  <Ionicons name="qr-code-outline" size={20} color="#fff" />
                </TouchableOpacity>
                <TouchableOpacity style={styles.iconCircle}>
                  <Ionicons name="call-outline" size={20} color="#fff" />
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      )}

      {isExpanded && (
        <View style={styles.expandedCard}>
          <Text style={styles.title}>Statut de la commande</Text>

          {isCompleted && (
            <View style={styles.completedBanner}>
              <Ionicons name="checkmark-circle" size={20} color="#fff" />
              <Text style={styles.completedBannerText}>
                Course terminée{currentOrder?.proof?.uploadedAt ? ' — preuve reçue' : ''}
              </Text>
            </View>
          )}

          <View style={styles.timelineContainer}>
            {statusSteps.map((step, index) => {
              const anim = stepAnimations[index];
              
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

          {currentOrder?.proof?.uploadedAt && (
            <View style={styles.proofRow}>
              <Ionicons name="checkmark-circle" size={18} color="#10B981" />
              <Text style={styles.proofText}>
                Preuve de livraison reçue
              </Text>
            </View>
          )}

          {isCompleted && (
            <View style={styles.ratingSection}>
              {isLoadingRating ? (
                <Text style={styles.loadingText}>Chargement de l&apos;évaluation...</Text>
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
              <TouchableOpacity 
                style={styles.actionButton}
                onPress={() => setShowQRCode(true)}
              >
                <Ionicons name="qr-code-outline" size={20} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionButton}>
                <Ionicons name="call-outline" size={20} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>

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

      {/* QR Code Display */}
      <QRCodeDisplay
        visible={showQRCode}
        qrCodeImage={qrCodeData?.qrCodeImage || null}
        orderNumber={qrCodeData?.qrCodeData?.orderNumber}
        expiresAt={qrCodeData?.qrCodeData?.expiresAt}
        onClose={() => {
          setShowQRCode(false);
          setQrCodeData(null); // Réinitialiser pour recharger au prochain affichage
        }}
      />
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
  cancelIconCircle: {
    backgroundColor: "#EF4444",
  },

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
