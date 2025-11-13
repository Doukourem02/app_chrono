import React, { useRef, useState, useEffect } from 'react';
import {StyleSheet,View,Text,TouchableOpacity,ScrollView,Image,Animated,Dimensions,PanResponder,Linking,Alert,} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { OrderRequest } from '../store/useOrderStore';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const RECIPIENT_DETAILS_MAX_HEIGHT = SCREEN_HEIGHT * 0.85;
const RECIPIENT_DETAILS_MIN_HEIGHT = 100;

interface RecipientDetailsSheetProps {
  animatedHeight: Animated.Value;
  panResponder: any;
  isExpanded: boolean;
  onToggle: () => void;
  order: OrderRequest | null;
}

export const RecipientDetailsSheet: React.FC<RecipientDetailsSheetProps> = ({
  animatedHeight,
  panResponder: externalPanResponder,
  isExpanded,
  onToggle,
  order,
}) => {
  const dragHandleRef = useRef<View>(null);
  const [dragHandleLayout, setDragHandleLayout] = useState({ x: 0, y: 0, width: 0, height: 0 });
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const startHeightRef = useRef<number>(RECIPIENT_DETAILS_MAX_HEIGHT);
  const currentAnimationRef = useRef<Animated.CompositeAnimation | null>(null);

  const recipientPhone = order?.recipient?.phone || order?.dropoff?.details?.phone || null;
  const dropoffDetails = order?.dropoff?.details || {};
  const packageImages = order?.packageImages || order?.dropoff?.details?.photos || [];

  useEffect(() => {
    if (isExpanded) {
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
    } else {
      fadeAnim.setValue(0);
    }
  }, [isExpanded, fadeAnim]);

  const customPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_evt, gestureState) => {
        const { moveX, moveY } = gestureState;
        const { x, y, width, height } = dragHandleLayout;
        
        const handleZone = {
          x: x - 50,
          y: y - 40,
          width: width + 100,
          height: height + 80,
        };
        
        const isInHandleZone = 
          moveX >= handleZone.x &&
          moveX <= handleZone.x + handleZone.width &&
          moveY >= handleZone.y &&
          moveY <= handleZone.y + handleZone.height;
        
        const isVerticalSwipeDown = Math.abs(gestureState.dy) > Math.abs(gestureState.dx) && gestureState.dy > 5;
        return isInHandleZone && isVerticalSwipeDown;
      },
      onPanResponderGrant: () => {
        if (currentAnimationRef.current) {
          currentAnimationRef.current.stop();
          currentAnimationRef.current = null;
        }
        animatedHeight.stopAnimation((currentValue) => {
          startHeightRef.current = currentValue || RECIPIENT_DETAILS_MAX_HEIGHT;
        });
      },
      onPanResponderMove: (_event, gestureState) => {
        if (!isExpanded) return;
        if (currentAnimationRef.current) {
          currentAnimationRef.current.stop();
          currentAnimationRef.current = null;
        }
        const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
        const newHeight = clamp(startHeightRef.current - gestureState.dy, RECIPIENT_DETAILS_MIN_HEIGHT, RECIPIENT_DETAILS_MAX_HEIGHT);
        animatedHeight.setValue(newHeight);
      },
      onPanResponderRelease: (_event, gestureState) => {
        if (gestureState.vy > 0.5 || gestureState.dy > 50) {
          onToggle();
        } else {
          const animation = Animated.spring(animatedHeight, {
            toValue: RECIPIENT_DETAILS_MAX_HEIGHT,
            useNativeDriver: false,
            tension: 65,
            friction: 8,
          });
          currentAnimationRef.current = animation;
          animation.start(() => {
            currentAnimationRef.current = null;
          });
        }
      },
    })
  ).current;

  useEffect(() => {
    if (isExpanded) {
      if (currentAnimationRef.current) {
        currentAnimationRef.current.stop();
        currentAnimationRef.current = null;
      }
      const animation = Animated.spring(animatedHeight, {
        toValue: RECIPIENT_DETAILS_MAX_HEIGHT,
        useNativeDriver: false,
        tension: 65,
        friction: 8,
      });
      currentAnimationRef.current = animation;
      animation.start(() => {
        currentAnimationRef.current = null;
      });
    }
  }, [isExpanded, animatedHeight]);

  const handleCall = () => {
    if (!recipientPhone) {
      Alert.alert('Information', 'Numéro de téléphone non disponible');
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const phoneNumber = recipientPhone.startsWith('+') ? recipientPhone : `+${recipientPhone}`;
    Linking.openURL(`tel:${phoneNumber}`).catch(() => {
      Alert.alert('Erreur', 'Impossible d\'ouvrir l\'application téléphone');
    });
  };

  const handleNavigate = () => {
    if (!order?.dropoff?.coordinates) {
      Alert.alert('Information', 'Coordonnées non disponibles');
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const { latitude, longitude } = order.dropoff.coordinates;
    const url = `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`;
    Linking.openURL(url).catch(() => {
      Alert.alert('Erreur', 'Impossible d\'ouvrir l\'application de navigation');
    });
  };

  if (!order) return null;

  return (
    <Animated.View
      style={[styles.bottomSheet, { height: animatedHeight }]}
    >
      <View
        ref={dragHandleRef}
        style={styles.dragIndicatorContainer}
        onLayout={(event) => {
          const { x, y, width, height } = event.nativeEvent.layout;
          setDragHandleLayout({ x, y, width, height });
        }}
        {...customPanResponder.panHandlers}
      >
        <TouchableOpacity style={styles.dragIndicator} onPress={onToggle}>
          <View style={styles.dragHandle} />
        </TouchableOpacity>
      </View>

      {isExpanded ? (
        <ScrollView
          showsVerticalScrollIndicator={false}
          style={styles.scrollContent}
          scrollEnabled={isExpanded}
          nestedScrollEnabled={true}
          bounces={false}
        >
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View style={styles.headerIconContainer}>
                <Ionicons name="person-circle" size={28} color="#8B5CF6" />
              </View>
              <View style={styles.headerTextContainer}>
                <Text style={styles.headerTitle}>Informations destinataire</Text>
                <Text style={styles.headerSubtitle}>Détails de livraison</Text>
              </View>
            </View>
            <TouchableOpacity 
              style={styles.closeButton}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                onToggle();
              }}
              activeOpacity={0.7}
            >
              <Ionicons name="close" size={24} color="#666" />
            </TouchableOpacity>
          </View>

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionIconContainer}>
                <Ionicons name="location" size={20} color="#8B5CF6" />
              </View>
              <Text style={styles.sectionTitle}>Adresse de livraison</Text>
            </View>
            <View style={styles.addressCard}>
              <View style={styles.addressIconWrapper}>
                <Ionicons name="location-outline" size={24} color="#8B5CF6" />
              </View>
              <Text style={styles.addressText}>{order.dropoff.address}</Text>
            </View>

            <TouchableOpacity 
              style={styles.actionButton} 
              onPress={handleNavigate}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={['#8B5CF6', '#7C3AED']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.actionButtonGradient}
              >
                <Ionicons name="navigate" size={20} color="#fff" />
                <Text style={styles.actionButtonText}>Ouvrir la navigation</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>

          {recipientPhone && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <View style={styles.sectionIconContainer}>
                  <Ionicons name="call-outline" size={20} color="#8B5CF6" />
                </View>
                <Text style={styles.sectionTitle}>Téléphone</Text>
              </View>
              <View style={styles.phoneCard}>
                <View style={styles.phoneIconWrapper}>
                  <Ionicons name="call" size={24} color="#10B981" />
                </View>
                <Text style={styles.phoneText}>{recipientPhone}</Text>
              </View>

              <TouchableOpacity 
                style={[styles.actionButton, styles.callButton]} 
                onPress={handleCall}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={['#10B981', '#059669']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.actionButtonGradient}
                >
                  <Ionicons name="call" size={20} color="#fff" />
                  <Text style={styles.actionButtonText}>Appeler maintenant</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          )}

          {(dropoffDetails.entrance || dropoffDetails.apartment || dropoffDetails.floor || dropoffDetails.intercom) && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <View style={styles.sectionIconContainer}>
                  <Ionicons name="information-circle-outline" size={20} color="#8B5CF6" />
                </View>
                <Text style={styles.sectionTitle}>Détails de l&apos;adresse</Text>
              </View>
              <View style={styles.detailsCard}>
                {dropoffDetails.entrance && (
                  <View style={[styles.detailRow, styles.detailRowLast]}>
                    <View style={styles.detailLabelContainer}>
                      <Ionicons name="enter-outline" size={16} color="#8B5CF6" />
                      <Text style={styles.detailLabel}>Entrée</Text>
                    </View>
                    <Text style={styles.detailValue}>{dropoffDetails.entrance}</Text>
                  </View>
                )}
                {dropoffDetails.apartment && (
                  <View style={[styles.detailRow, styles.detailRowLast]}>
                    <View style={styles.detailLabelContainer}>
                      <Ionicons name="home-outline" size={16} color="#8B5CF6" />
                      <Text style={styles.detailLabel}>Appartement</Text>
                    </View>
                    <Text style={styles.detailValue}>{dropoffDetails.apartment}</Text>
                  </View>
                )}
                {dropoffDetails.floor && (
                  <View style={[styles.detailRow, styles.detailRowLast]}>
                    <View style={styles.detailLabelContainer}>
                      <Ionicons name="layers-outline" size={16} color="#8B5CF6" />
                      <Text style={styles.detailLabel}>Étage</Text>
                    </View>
                    <Text style={styles.detailValue}>{dropoffDetails.floor}</Text>
                  </View>
                )}
                {dropoffDetails.intercom && (
                  <View style={styles.detailRow}>
                    <View style={styles.detailLabelContainer}>
                      <Ionicons name="call-outline" size={16} color="#8B5CF6" />
                      <Text style={styles.detailLabel}>Interphone</Text>
                    </View>
                    <Text style={styles.detailValue}>{dropoffDetails.intercom}</Text>
                  </View>
                )}
              </View>
            </View>
          )}

          {packageImages.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <View style={styles.sectionIconContainer}>
                  <Ionicons name="images-outline" size={20} color="#8B5CF6" />
                </View>
                <Text style={styles.sectionTitle}>Photos du colis ({packageImages.length})</Text>
              </View>
              <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false} 
                style={styles.photosContainer}
                contentContainerStyle={styles.photosContentContainer}
              >
                {packageImages.map((uri, index) => (
                  <View key={index} style={styles.photoItem}>
                    <Image source={{ uri }} style={styles.photo} resizeMode="cover" />
                    <View style={styles.photoBadge}>
                      <Text style={styles.photoBadgeText}>{index + 1}/{packageImages.length}</Text>
                    </View>
                  </View>
                ))}
              </ScrollView>
            </View>
          )}

          {!recipientPhone && packageImages.length === 0 && !dropoffDetails.entrance && !dropoffDetails.apartment && !dropoffDetails.floor && !dropoffDetails.intercom && (
            <View style={styles.emptyState}>
              <Ionicons name="information-circle-outline" size={48} color="#9CA3AF" />
              <Text style={styles.emptyStateText}>Aucune information supplémentaire disponible</Text>
            </View>
          )}
        </ScrollView>
      ) : (
        <TouchableOpacity
          style={styles.peekContainer}
          onPress={onToggle}
          activeOpacity={0.8}
        >
          <Text style={styles.peekText} numberOfLines={1}>
            Informations destinataire
          </Text>
        </TouchableOpacity>
      )}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  bottomSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
    paddingHorizontal: 20,
    paddingTop: 5,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  dragIndicatorContainer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  dragIndicator: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  dragHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#ccc',
    borderRadius: 2,
  },
  scrollContent: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  headerIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F5F0FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTextContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#000',
    marginBottom: 2,
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '500',
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 14,
  },
  sectionIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F5F0FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  addressCard: {
    backgroundColor: '#F8F9FA',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  addressIconWrapper: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E9D5FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  addressText: {
    fontSize: 15,
    color: '#1F2937',
    lineHeight: 22,
    flex: 1,
    fontWeight: '500',
  },
  phoneCard: {
    backgroundColor: '#F5F0FF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: '#E9D5FF',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  phoneIconWrapper: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#D1FAE5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  phoneText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#059669',
    flex: 1,
  },
  actionButton: {
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  actionButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
    gap: 10,
  },
  callButton: {
    // Le gradient sera appliqué via actionButtonGradient
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  detailsCard: {
    backgroundColor: '#F8F9FA',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  detailRowLast: {
    borderBottomWidth: 0,
  },
  detailLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  detailLabel: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },
  detailValue: {
    fontSize: 15,
    color: '#1F2937',
    fontWeight: '600',
  },
  photosContainer: {
    marginTop: 12,
  },
  photosContentContainer: {
    paddingRight: 20,
  },
  photoItem: {
    marginRight: 12,
    position: 'relative',
  },
  photo: {
    width: 140,
    height: 140,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
    borderWidth: 2,
    borderColor: '#E5E7EB',
  },
  photoBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  photoBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyStateText: {
    fontSize: 14,
    color: '#9CA3AF',
    marginTop: 12,
    textAlign: 'center',
  },
  peekContainer: {
    backgroundColor: '#fff',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  peekText: {
    fontSize: 14,
    color: '#333',
  },
});

