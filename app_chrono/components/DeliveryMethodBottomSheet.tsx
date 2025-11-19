import React, { useState, useEffect, useRef, useMemo } from 'react';
import {StyleSheet,View,Text,TouchableOpacity,ScrollView,Image,Animated,Switch,Dimensions,PanResponder} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { calculatePrice, getDistanceInKm, estimateDurationMinutes, formatDurationLabel, BASE_PRICES } from '../services/orderApi';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const DELIVERY_METHOD_MAX_HEIGHT = SCREEN_HEIGHT * 0.85; 
const DELIVERY_METHOD_MIN_HEIGHT = 100;

interface DeliveryMethodBottomSheetProps {
  animatedHeight: Animated.Value;
  panResponder: any;
  isExpanded: boolean;
  onToggle: () => void;
  selectedMethod: string;
  pickupLocation: string;
  deliveryLocation: string;
  price: number;
  estimatedTime: string;
  pickupCoords?: { latitude: number; longitude: number };
  dropoffCoords?: { latitude: number; longitude: number };
  onMethodSelected: (method: 'moto' | 'vehicule' | 'cargo') => void;
  onConfirm: () => void;
  onBack: () => void;
}

const deliveryMethods = [
  {
    id: 'moto',
    name: 'Livraison à moto',
    icon: require('../assets/images/motoo.png'),
    price: 300,
    largeImage: require('../assets/images/motoo.png'),
    popular: true, 
    avgTime: '15-20 min',
    badge: '⭐ Populaire',
  },
  {
    id: 'cargo',
    name: 'Express Cargo',
    icon: require('../assets/images/ccargo.png'),
    price: 3400,
    largeImage: require('../assets/images/ccargo.png'),
    popular: false,
    avgTime: '30-45 min',
    badge: '🚚 Grand volume',
  },
  {
    id: 'vehicule',
    name: 'Livraison en voiture',
    icon: require('../assets/images/carrss.png'),
    price: 700,
    largeImage: require('../assets/images/carrss.png'),
    popular: false,
    avgTime: '20-25 min',
    badge: '🚗 Confortable',
  },
];

const getDeliveryOptions = (method: string) => {
  switch (method) {
    case 'vehicule':
      return [
        {
          id: 'pickup_service',
          name: 'Service de récupération',
          icon: 'location',
          price: 700,
          description: 'Récupération de votre colis à l\'adresse indiquée',
          time: '15-20 min',
        },
        {
          id: 'full_service',
          name: 'Service complet',
          icon: 'cube',
          price: 1000,
          description: 'Récupération et livraison complètes avec suivi en temps réel',
          time: '20-25 min',
        },
      ];
    case 'cargo':
      return [];
    case 'moto':
    default:
      return [
        {
          id: 'express',
          name: 'Express',
          icon: 'rocket',
          price: 300,
          description: 'Livraison rapide en ville',
          time: '15-20 min',
        },
        {
          id: 'standard',
          name: 'Standard',
          icon: 'bicycle',
          price: 250,
          description: 'Livraison standard optimisée',
          time: '25-30 min',
        },
        {
          id: 'scheduled',
          name: 'Programmée',
          icon: 'calendar',
          price: 280,
          description: 'Planifiez votre livraison à l\'avance',
          time: 'Selon planning',
        },
      ];
  }
};

export const DeliveryMethodBottomSheet: React.FC<DeliveryMethodBottomSheetProps> = ({
  animatedHeight,
  panResponder: externalPanResponder,
  isExpanded,
  onToggle,
  selectedMethod,
  pickupLocation,
  deliveryLocation,
  price,
  estimatedTime,
  pickupCoords,
  dropoffCoords,
  onMethodSelected,
  onConfirm,
  onBack,
}) => {
  const [selectedSpeed, setSelectedSpeed] = useState<string>(
    selectedMethod === 'vehicule' ? 'pickup_service' : 'express'
  );
  const [isThermalBag, setIsThermalBag] = useState(false);
  const dragHandleRef = useRef<View>(null);

  const selectedMethodData = deliveryMethods.find(m => m.id === selectedMethod) || deliveryMethods[0];
  
  const selectedSpeedOption = getDeliveryOptions(selectedMethod).find(opt => opt.id === selectedSpeed);

  const calculatedPrice = useMemo(() => {
    if (pickupCoords && dropoffCoords) {
      const distanceKm = getDistanceInKm(pickupCoords, dropoffCoords);
      
      if (selectedSpeedOption && selectedSpeedOption.price) {
        const pricing = BASE_PRICES[selectedMethod as 'moto' | 'vehicule' | 'cargo'] ?? BASE_PRICES.vehicule;
        const realPrice = Math.max(0, Math.round(selectedSpeedOption.price + distanceKm * pricing.perKm));
        return realPrice;
      }

      const realPrice = calculatePrice(distanceKm, selectedMethod as 'moto' | 'vehicule' | 'cargo');
      return realPrice;
    }
  
    return price || selectedMethodData?.price || 0;
  }, [pickupCoords, dropoffCoords, selectedMethod, selectedSpeedOption, price, selectedMethodData]);


  const calculatedTime = useMemo(() => {
    if (pickupCoords && dropoffCoords) {
      const distanceKm = getDistanceInKm(pickupCoords, dropoffCoords);
      const durationMinutes = estimateDurationMinutes(distanceKm, selectedMethod as 'moto' | 'vehicule' | 'cargo');
      return formatDurationLabel(durationMinutes) || estimatedTime || selectedMethodData?.avgTime || '';
    }
    return estimatedTime || selectedMethodData?.avgTime || '';
  }, [pickupCoords, dropoffCoords, selectedMethod, estimatedTime, selectedMethodData]);


  const basePrice = selectedMethodData?.price || 0;

  const displayPrice = calculatedPrice;


  const scaleAnimation = useRef(new Animated.Value(1)).current;


  useEffect(() => {
    const options = getDeliveryOptions(selectedMethod);
    if (options.length > 0) {
      setSelectedSpeed(options[0].id);
    }
  }, [selectedMethod]);

 
  useEffect(() => {
    Animated.sequence([
      Animated.timing(scaleAnimation, {
        toValue: 1.1,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnimation, {
        toValue: 1,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start();
  }, [calculatedPrice, selectedMethod, scaleAnimation]);

const customPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false, 
      onMoveShouldSetPanResponder: (evt, gestureState) => {
        const { locationX, locationY } = evt.nativeEvent;
    
        const DRAG_HANDLE_HEIGHT = 60;
        const DRAG_HANDLE_WIDTH = 200; 
        
      const isInDragHandle = 
          locationY >= 0 && 
          locationY <= DRAG_HANDLE_HEIGHT &&
          Math.abs(locationX) < DRAG_HANDLE_WIDTH;
        
      
        if (isInDragHandle && gestureState.dy > 0 && Math.abs(gestureState.dy) > Math.abs(gestureState.dx) && gestureState.dy > 15) {
          return true;
        }
        
        return false;
      },
      onPanResponderMove: (evt, gestureState) => {
        const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
        const newHeight = clamp(DELIVERY_METHOD_MAX_HEIGHT - gestureState.dy, DELIVERY_METHOD_MIN_HEIGHT, DELIVERY_METHOD_MAX_HEIGHT);
        animatedHeight.setValue(newHeight);
      },
      onPanResponderRelease: (evt, gestureState) => {
        if (gestureState.vy > 0.8 || gestureState.dy > 100) {
       
          onToggle();
        } else {
      
          Animated.spring(animatedHeight, {
            toValue: DELIVERY_METHOD_MAX_HEIGHT,
            useNativeDriver: false,
            tension: 65,
            friction: 8,
          }).start();
        }
      },
    })
  ).current;

useEffect(() => {
    if (isExpanded) {
      Animated.spring(animatedHeight, {
        toValue: DELIVERY_METHOD_MAX_HEIGHT,
        useNativeDriver: false,
        tension: 65,
        friction: 8,
      }).start();
    }
  }, [isExpanded, animatedHeight]);

  return (
    <Animated.View
      style={[styles.bottomSheet, { height: animatedHeight }]}
    >
    <View
        ref={dragHandleRef}
        style={styles.dragIndicatorContainer}
        {...customPanResponder.panHandlers}
      >
        <TouchableOpacity
          style={styles.dragIndicator}
          onPress={onToggle}
          activeOpacity={0.8}
        >
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
          scrollEventThrottle={16}
          onScrollBeginDrag={() => {
            
          }}
        >
      
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Text style={styles.headerTitle}>{selectedMethodData.name}</Text>
              {selectedMethodData.badge && (
                <View style={styles.badgeContainer}>
                  <Text style={styles.badgeText}>{selectedMethodData.badge}</Text>
                </View>
              )}
            </View>
            <View style={styles.headerRight}>
              <Animated.View style={{ transform: [{ scale: scaleAnimation }] }}>
                <Text style={styles.headerPrice}>à partir de {basePrice} F</Text>
              </Animated.View>
              <View style={styles.timeContainer}>
                <Ionicons name="time-outline" size={14} color="#8B5CF6" />
                <Text style={styles.headerTime}>{calculatedTime}</Text>
              </View>
            </View>
            <TouchableOpacity onPress={onBack} style={styles.backButton}>
              <Ionicons name="arrow-forward" size={24} color="#000" />
            </TouchableOpacity>
          </View>

      
          <View style={styles.largeVehicleContainer}>
            <Image
              source={selectedMethodData.largeImage}
              style={styles.largeVehicleImage}
              resizeMode="contain"
            />
          </View>

  
          <View style={styles.methodOptionsContainer}>
            {deliveryMethods.map((method) => (
              <TouchableOpacity
                key={method.id}
                style={[
                  styles.methodCard,
                  selectedMethod === method.id && styles.methodCardSelected,
                  method.popular && styles.methodCardPopular,
                ]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  onMethodSelected(method.id as 'moto' | 'vehicule' | 'cargo');
                }}
                activeOpacity={0.7}
              >
                {method.popular && (
                  <View style={styles.popularBadge}>
                    <Text style={styles.popularBadgeText}>⭐</Text>
                  </View>
                )}
                <View style={[
                  styles.methodCardIconContainer,
                  selectedMethod === method.id && styles.methodCardIconContainerSelected,
                ]}>
                  <Image source={method.icon} style={styles.methodCardIcon} />
                </View>
                <Text style={[
                  styles.methodCardName,
                  selectedMethod === method.id && styles.methodCardNameSelected,
                ]} numberOfLines={1}>{method.name}</Text>
                <Text style={[
                  styles.methodCardPrice,
                  selectedMethod === method.id && styles.methodCardPriceSelected,
                ]} numberOfLines={1}>à partir de {method.price} F</Text>
                {selectedMethod === method.id && pickupCoords && dropoffCoords && (
                  <Text style={styles.methodCardPriceCalculated}>
                    {(() => {
                      const distanceKm = getDistanceInKm(pickupCoords, dropoffCoords);
                      const options = getDeliveryOptions(method.id);
                      const selectedOption = options.find(opt => opt.id === selectedSpeed);
                      if (selectedOption && selectedOption.price) {
                        const pricing = BASE_PRICES[method.id as 'moto' | 'vehicule' | 'cargo'] ?? BASE_PRICES.vehicule;
                        const realPrice = Math.max(0, Math.round(selectedOption.price + distanceKm * pricing.perKm));
                        return `${realPrice} F`;
                      }
                      const realPrice = calculatePrice(distanceKm, method.id as 'moto' | 'vehicule' | 'cargo');
                      return `${realPrice} F`;
                    })()}
                  </Text>
                )}
                {selectedMethod === method.id && (
                  <View style={styles.selectedIndicator}>
                    <Ionicons name="checkmark-circle" size={16} color="#8B5CF6" />
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </View>

        {selectedMethod !== 'cargo' && getDeliveryOptions(selectedMethod).length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>
                {selectedMethod === 'vehicule' ? 'Type de service' : 'Mode de livraison'}
              </Text>
              {getDeliveryOptions(selectedMethod).map((option) => (
                <TouchableOpacity
                  key={option.id}
                  style={[
                    styles.speedOption,
                    selectedSpeed === option.id && styles.speedOptionSelected,
                  ]}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setSelectedSpeed(option.id);
                  }}
                  activeOpacity={0.7}
                >
                  <View style={styles.speedOptionLeft}>
                    <View style={styles.speedOptionIconContainer}>
                      <Ionicons name={option.icon as any} size={24} color="#666" />
                    </View>
                    <View style={styles.speedOptionInfo}>
                      <Text style={styles.speedOptionName}>{option.name}</Text>
                      {option.description ? (
                        <Text style={styles.speedOptionDescription}>{option.description}</Text>
                      ) : null}
                      {option.time ? (
                        <Text style={styles.speedOptionTime}>{option.time}</Text>
                      ) : null}
                    </View>
                  </View>
                  <View style={styles.speedOptionRight}>
                    <Text style={styles.speedOptionPrice}>à partir de {option.price}F</Text>
                    <View
                      style={[
                        styles.radioButton,
                        selectedSpeed === option.id && styles.radioButtonSelected,
                      ]}
                    >
                      {selectedSpeed === option.id && <View style={styles.radioButtonInner} />}
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {selectedMethod === 'cargo' && (
            <>
              <TouchableOpacity style={styles.specialSection}>
                <View style={styles.specialSectionLeft}>
                  <Ionicons name="bicycle" size={24} color="#8B5CF6" style={{ marginRight: 12 }} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.specialSectionTitle}>Nos tricycles cargo disponibles</Text>
                    <Text style={styles.specialSectionSubtitle}>Idéal pour les colis volumineux et lourds</Text>
                  </View>
                </View>
                <Ionicons name="arrow-forward" size={20} color="#666" />
              </TouchableOpacity>

              <TouchableOpacity style={styles.specialSection}>
                <View style={styles.specialSectionLeft}>
                  <Ionicons name="calendar-outline" size={24} color="#8B5CF6" style={{ marginRight: 12 }} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.specialSectionTitle}>Réserver à l&apos;avance</Text>
                    <Text style={styles.specialSectionSubtitle}>Programmez votre livraison pour plus de flexibilité</Text>
                  </View>
                </View>
                <Ionicons name="arrow-forward" size={20} color="#666" />
              </TouchableOpacity>

              <View style={styles.knowSection}>
                <View style={styles.knowSectionHeader}>
                  <Ionicons name="information-circle" size={20} color="#8B5CF6" style={{ marginRight: 8 }} />
                  <Text style={styles.knowSectionTitle}>Comment ça fonctionne</Text>
                </View>
                <View style={styles.knowItem}>
                  <View style={styles.knowIconContainer}>
                    <Ionicons name="map" size={16} color="#8B5CF6" />
                  </View>
                  <View style={styles.knowContent}>
                    <Text style={styles.knowText}>Définissez vos points de collecte et de livraison</Text>
                    <Text style={styles.knowSubtext}>Sélectionnez les adresses précises sur la carte</Text>
                  </View>
                </View>
                <View style={styles.knowItem}>
                  <View style={styles.knowIconContainer}>
                    <Ionicons name="cube" size={16} color="#8B5CF6" />
                  </View>
                  <View style={styles.knowContent}>
                    <Text style={styles.knowText}>Indiquez les détails de votre colis</Text>
                    <Text style={styles.knowSubtext}>Dimensions, poids et type de marchandise</Text>
                  </View>
                </View>
                <View style={styles.knowItem}>
                  <View style={styles.knowIconContainer}>
                    <Ionicons name="checkmark-circle" size={16} color="#8B5CF6" />
                  </View>
                  <View style={styles.knowContent}>
                    <Text style={styles.knowText}>Validez et suivez votre livraison</Text>
                    <Text style={styles.knowSubtext}>Suivi en temps réel et notification à la livraison</Text>
                  </View>
                </View>
              </View>
            </>
          )}

          {/* Options supplémentaires - UNIQUEMENT pour moto */}
          {selectedMethod === 'moto' && (
            <View style={styles.additionalOptions}>
              {/* Sac de livraison isotherme - Uniquement pour moto */}
              <View style={styles.additionalOption}>
                <Text style={styles.additionalOptionText}>Sac de livraison isotherme</Text>
                <Switch
                  value={isThermalBag}
                  onValueChange={setIsThermalBag}
                  trackColor={{ false: '#D1D5DB', true: '#8B5CF6' }}
                  thumbColor={isThermalBag ? '#FFFFFF' : '#F3F4F6'}
                />
              </View>

              {/* Commentaire à l'attention du livreur - Uniquement pour moto */}
              <TouchableOpacity style={styles.additionalOption}>
                <Text style={styles.additionalOptionText}>Commentaire à l&apos;attention du livreur</Text>
                <Ionicons name="arrow-forward" size={20} color="#666" />
              </TouchableOpacity>

              {/* Message pour le destinataire - Uniquement pour moto */}
              <TouchableOpacity style={styles.additionalOption}>
                <Text style={styles.additionalOptionText}>Message pour le destinataire</Text>
                <Ionicons name="arrow-forward" size={20} color="#666" />
              </TouchableOpacity>
            </View>
          )}

          {/* Bouton de confirmation avec gradient */}
          <TouchableOpacity 
            style={styles.confirmButton} 
            onPress={() => {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              onConfirm();
            }}
            activeOpacity={0.8}
          >
            <View style={styles.confirmButtonGradient}>
              <Text style={styles.confirmButtonText}>Saisir les informations</Text>
            </View>
          </TouchableOpacity>
          
          {/* Prévisualisation du coût total - Prix réel calculé */}
          <View style={styles.totalPreview}>
            <View style={styles.totalPreviewRow}>
              <Text style={styles.totalPreviewLabel}>Coût estimé</Text>
              <Text style={styles.totalPreviewValue}>{displayPrice} FCFA</Text>
            </View>
            <View style={styles.totalPreviewRow}>
              <Text style={styles.totalPreviewLabel}>Temps estimé</Text>
              <Text style={styles.totalPreviewValue}>{calculatedTime}</Text>
            </View>
            {pickupCoords && dropoffCoords && (
              <View style={styles.totalPreviewRow}>
                <Text style={styles.totalPreviewLabel}>Distance</Text>
                <Text style={styles.totalPreviewValue}>
                  {getDistanceInKm(pickupCoords, dropoffCoords).toFixed(2)} km
                </Text>
              </View>
            )}
          </View>
        </ScrollView>
      ) : (
        <TouchableOpacity
          style={styles.peekContainer}
          onPress={onToggle}
          activeOpacity={0.8}
        >
          <Text style={styles.peekText} numberOfLines={1}>
            Méthode de livraison
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
    paddingVertical: 10,
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
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
    paddingTop: 10,
  },
  headerLeft: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#000',
    marginBottom: 6,
  },
  badgeContainer: {
    backgroundColor: '#F5F0FF',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#8B5CF6',
  },
  headerRight: {
    alignItems: 'flex-end',
    marginRight: 12,
  },
  headerPrice: {
    fontSize: 18,
    fontWeight: '700',
    color: '#8B5CF6',
    marginBottom: 4,
  },
  timeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  headerTime: {
    fontSize: 14,
    color: '#666',
  },
  backButton: {
    padding: 4,
  },
  largeVehicleContainer: {
    alignItems: 'center',
    marginVertical: 15,
    height: 150,
    justifyContent: 'center',
  },
  largeVehicleImage: {
    width: '100%',
    height: '100%',
    maxHeight: 150,
  },
  methodOptionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 25,
    gap: 12,
  },
  methodCard: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    padding: 12,
    borderWidth: 2,
    borderColor: 'transparent',
    minHeight: 100,
    justifyContent: 'center',
  },
  methodCardSelected: {
    backgroundColor: '#F5F0FF',
    borderColor: '#8B5CF6',
    shadowColor: '#8B5CF6',
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  methodCardPopular: {
    borderColor: '#FFD700',
    borderWidth: 2,
  },
  popularBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: '#FFD700',
    borderRadius: 10,
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  popularBadgeText: {
    fontSize: 10,
  },
  methodCardIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  methodCardIconContainerSelected: {
    backgroundColor: '#8B5CF6',
    shadowColor: '#8B5CF6',
    shadowOpacity: 0.3,
  },
  methodCardIcon: {
    width: 40,
    height: 40,
  },
  selectedIndicator: {
    position: 'absolute',
    bottom: 6,
    right: 6,
  },
  methodCardName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#000',
    marginBottom: 4,
    textAlign: 'center',
  },
  methodCardNameSelected: {
    color: '#8B5CF6',
  },
  methodCardPrice: {
    fontSize: 11,
    color: '#666',
    textAlign: 'center',
  },
  methodCardPriceSelected: {
    color: '#8B5CF6',
    fontWeight: '700',
  },
  methodCardPriceCalculated: {
    fontSize: 13,
    fontWeight: '700',
    color: '#8B5CF6',
    marginTop: 2,
    textAlign: 'center',
  },
  section: {
    marginBottom: 30,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginBottom: 16,
  },
  speedOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginBottom: 8,
    backgroundColor: '#FAFAFA',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  speedOptionSelected: {
    backgroundColor: '#F5F0FF',
    borderColor: '#8B5CF6',
  },
  speedOptionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  speedOptionIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  speedOptionIcon: {
    width: 24,
    height: 24,
    marginRight: 12,
  },
  speedOptionInfo: {
    flex: 1,
  },
  speedOptionName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#000',
    marginBottom: 4,
  },
  speedOptionDescription: {
    fontSize: 12,
    color: '#666',
  },
  speedOptionTime: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  speedOptionRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  speedOptionPrice: {
    fontSize: 14,
    color: '#666',
  },
  radioButton: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioButtonSelected: {
    borderColor: '#8B5CF6',
  },
  radioButtonInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#8B5CF6',
  },
  additionalOptions: {
    marginBottom: 30,
  },
  additionalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  additionalOptionText: {
    fontSize: 16,
    color: '#000',
    fontWeight: '500',
  },
  confirmButton: {
    borderRadius: 16,
    paddingVertical: 18,
    paddingHorizontal: 20,
    marginBottom: 12,
    shadowColor: '#8B5CF6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
    overflow: 'hidden',
  },
  confirmButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#8B5CF6',
    borderRadius: 16,
    paddingVertical: 18,
    paddingHorizontal: 20,
  },
  confirmButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
    marginRight: 8,
  },
  confirmButtonIcon: {
    marginLeft: 4,
  },
  totalPreview: {
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  totalPreviewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  totalPreviewLabel: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  totalPreviewValue: {
    fontSize: 16,
    color: '#8B5CF6',
    fontWeight: '700',
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
  specialSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 16,
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    marginBottom: 12,
  },
  specialSectionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  specialSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 4,
  },
  specialSectionSubtitle: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
  },
  knowSection: {
    marginTop: 20,
    marginBottom: 20,
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 16,
  },
  knowSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  knowSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },
  knowItem: {
    flexDirection: 'row',
    marginBottom: 16,
    alignItems: 'flex-start',
  },
  knowIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F5F0FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  knowNumber: {
    fontSize: 16,
    fontWeight: '600',
    color: '#8B5CF6',
    marginRight: 12,
    width: 20,
  },
  knowContent: {
    flex: 1,
  },
  knowText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#000',
    marginBottom: 4,
  },
  knowSubtext: {
    fontSize: 12,
    color: '#666',
  },
});

