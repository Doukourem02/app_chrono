import React, { useEffect, useRef, useMemo, useState, useCallback } from "react";
import {View,Text,Animated,PanResponderInstance,TouchableOpacity,StyleSheet,Image} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { userApiService } from "../services/userApiService";
import { QRCodeDisplay } from "./QRCodeDisplay";
import { formatUserName } from "../utils/formatName";
import { logger } from "../utils/logger";

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

  // Helper pour obtenir les initiales du livreur
  const getDriverInitials = useCallback(() => {
    if (!currentOrder?.driver) return 'L';
    const driverName = formatUserName(currentOrder.driver, 'Livreur');
    return driverName
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2) || 'L';
  }, [currentOrder?.driver]);

  // Helper pour obtenir l'avatar du livreur
  const getDriverAvatar = useCallback(() => {
    return currentOrder?.driver?.avatar || currentOrder?.driver?.avatar_url || null;
  }, [currentOrder?.driver]);

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
      logger.error('Erreur chargement rating:', undefined, error);
      setOrderRating(null);
    } finally {
      setIsLoadingRating(false);
    }
  }, [currentOrder?.id]);

  const status: string = React.useMemo(() => {
    // Ne pas utiliser de valeur par défaut, utiliser le statut réel de la commande
    const currentStatus = currentOrder?.status ? String(currentOrder.status) : "pending";
    if (__DEV__) {
      logger.debug('🔍 TrackingBottomSheet status:', undefined, {
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
      logger.debug('🔍 TrackingBottomSheet canCancel:', undefined, {
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
        // Colis pris en charge = déjà en cours de livraison (même étape pour le suivi)
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
            {isCompleted ? (
              <View style={styles.completedBadge}>
                <Ionicons name="checkmark" size={16} color="#fff" />
                <Text style={styles.completedBadgeText}>Livré</Text>
              </View>
            ) : (
              <>
                {/* Avatar du livreur à l'extrémité gauche */}
                {currentOrder?.driver && (
                  <View style={styles.driverAvatarContainer}>
                    {getDriverAvatar() ? (
                      <Image 
                        source={{ uri: getDriverAvatar() }} 
                        style={styles.driverAvatar}
                        resizeMode="cover"
                      />
                    ) : (
                      <View style={styles.driverAvatarPlaceholder}>
                        <Text style={styles.driverAvatarText}>{getDriverInitials()}</Text>
                      </View>
                    )}
                  </View>
                )}
                {/* Actions contextuelles selon le statut - version collapsed */}
                <View style={styles.actionButtonsCollapsed}>
                  {status === 'pending' || status === 'accepted' ? (
                    <>
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
                    </>
                  ) : status === 'enroute' || status === 'picked_up' || status === 'delivering' ? (
                    <>
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
                    </>
                  ) : (
                    <TouchableOpacity 
                      style={styles.iconCircle}
                      onPress={onMessage}
                    >
                      <Ionicons name="chatbubble-ellipses-outline" size={20} color="#fff" />
                    </TouchableOpacity>
                  )}
                </View>
              </>
            )}
          </View>
        </View>
      )}

      {isExpanded && (
        <View style={styles.expandedCard}>
          {/* Afficher la timeline uniquement pour les commandes en cours */}
          {!isCompleted && status !== 'cancelled' && status !== 'declined' && (
            <>
              <Text style={styles.title}>Statut de la commande</Text>

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
            </>
          )}

          {/* Pour les commandes terminées/annulées, afficher un message de statut */}
          {(isCompleted || status === 'cancelled' || status === 'declined') && (
            <View style={styles.completedBanner}>
              <Ionicons 
                name={isCompleted ? "checkmark-circle" : "close-circle"} 
                size={20} 
                color="#fff" 
              />
              <Text style={styles.completedBannerText}>
                {isCompleted 
                  ? `Course terminée${currentOrder?.proof?.uploadedAt ? ' — preuve reçue' : ''}`
                  : status === 'cancelled' 
                  ? 'Commande annulée'
                  : 'Commande refusée'}
              </Text>
            </View>
          )}

          {/* Section Détails de la commande pour les commandes terminées/annulées */}
          {(isCompleted || status === 'cancelled' || status === 'declined') && (
            <View style={styles.orderDetailsSection}>
              <Text style={styles.sectionTitle}>Détails de la commande</Text>
              
              {/* Informations de livraison */}
              <View style={styles.detailRow}>
                <Ionicons name="location" size={16} color="#8B5CF6" />
                <View style={styles.detailContent}>
                  <Text style={styles.detailLabel}>Point de collecte</Text>
                  <Text style={styles.detailValue} numberOfLines={2}>
                    {currentOrder?.pickup?.address || 'Adresse non disponible'}
                  </Text>
                </View>
              </View>
              
              <View style={styles.detailRow}>
                <Ionicons name="location-outline" size={16} color="#10B981" />
                <View style={styles.detailContent}>
                  <Text style={styles.detailLabel}>Point de livraison</Text>
                  <Text style={styles.detailValue} numberOfLines={2}>
                    {currentOrder?.dropoff?.address || 'Adresse non disponible'}
                  </Text>
                </View>
              </View>
              
              {/* Informations du livreur */}
              {currentOrder?.driver && (
                <View style={styles.detailRow}>
                  <Ionicons name="person" size={16} color="#6B7280" />
                  <View style={styles.detailContent}>
                    <Text style={styles.detailLabel}>Livreur</Text>
                    <Text style={styles.detailValue}>
                      {formatUserName(currentOrder.driver, 'Livreur')}
                    </Text>
                  </View>
                </View>
              )}
              
              {/* Informations financières */}
              {currentOrder?.price && typeof currentOrder.price === 'number' && (
                <View style={styles.detailRow}>
                  <Ionicons name="cash" size={16} color="#10B981" />
                  <View style={styles.detailContent}>
                    <Text style={styles.detailLabel}>Montant</Text>
                    <Text style={styles.detailValue}>
                      {currentOrder.price.toLocaleString('fr-FR')} FCFA
                    </Text>
                  </View>
                </View>
              )}
              
              {/* Distance */}
              {currentOrder?.distance && typeof currentOrder.distance === 'number' && (
                <View style={styles.detailRow}>
                  <Ionicons name="map" size={16} color="#3B82F6" />
                  <View style={styles.detailContent}>
                    <Text style={styles.detailLabel}>Distance</Text>
                    <Text style={styles.detailValue}>
                      {currentOrder.distance.toFixed(1)} km
                    </Text>
                  </View>
                </View>
              )}
              
              {/* Méthode de livraison */}
              {currentOrder?.deliveryMethod && (
                <View style={styles.detailRow}>
                  <Ionicons name="car" size={16} color="#F59E0B" />
                  <View style={styles.detailContent}>
                    <Text style={styles.detailLabel}>Méthode</Text>
                    <Text style={[styles.detailValue, { textTransform: 'capitalize' }]}>
                      {currentOrder.deliveryMethod === 'moto' ? 'Moto' : 
                       currentOrder.deliveryMethod === 'vehicule' ? 'Véhicule' : 
                       currentOrder.deliveryMethod === 'cargo' ? 'Cargo' : 
                       currentOrder.deliveryMethod}
                    </Text>
                  </View>
                </View>
              )}
              
              {/* Dates */}
              {currentOrder?.createdAt && (
                <View style={styles.detailRow}>
                  <Ionicons name="calendar" size={16} color="#6B7280" />
                  <View style={styles.detailContent}>
                    <Text style={styles.detailLabel}>Créée le</Text>
                    <Text style={styles.detailValue}>
                      {new Date(currentOrder.createdAt).toLocaleDateString('fr-FR', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </Text>
                  </View>
                </View>
              )}
              
              {currentOrder?.completed_at && (
                <View style={styles.detailRow}>
                  <Ionicons name="checkmark-circle" size={16} color="#10B981" />
                  <View style={styles.detailContent}>
                    <Text style={styles.detailLabel}>Terminée le</Text>
                    <Text style={styles.detailValue}>
                      {new Date(currentOrder.completed_at).toLocaleDateString('fr-FR', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </Text>
                  </View>
                </View>
              )}
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


          {/* Afficher le bouton "Nouvelle commande" uniquement pour les commandes en cours */}
          {onNewOrder && !isCompleted && status !== 'cancelled' && status !== 'declined' && (
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
    justifyContent: "space-between",
    paddingVertical: 12,
    paddingHorizontal: 16,
  },

  actionButtonsCollapsed: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginLeft: "auto",
  },

  driverAvatarContainer: {
    marginRight: 0,
  },

  driverAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    overflow: "hidden",
    backgroundColor: "transparent",
  },

  driverAvatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "transparent",
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },

  driverAvatarText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
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
    justifyContent: "flex-start",
    shadowColor: "#7C3AED",
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },

  actionButtons: {
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
    justifyContent: "flex-end",
    marginLeft: "auto",
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
  orderDetailsSection: {
    marginTop: 16,
    marginBottom: 16,
    padding: 16,
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  detailContent: {
    flex: 1,
    marginLeft: 12,
  },
  detailLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: '#6B7280',
    marginBottom: 4,
  },
  detailValue: {
    fontSize: 14,
    color: '#1F2937',
    lineHeight: 20,
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
