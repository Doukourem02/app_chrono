import React, { useState, useRef } from 'react';
import {StyleSheet,View,Text,TextInput,TouchableOpacity,ScrollView,Image,Animated,Dimensions,Alert,PanResponder,Switch} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import PaymentMethodSelector from './PaymentMethodSelector';
import { PaymentMethodType } from '../services/paymentApi';
import { usePaymentStore } from '../store/usePaymentStore';
import { logger } from '../utils/logger';


interface AddressDetails {
  phone?: string;
  entrance?: string;
  apartment?: string;
  floor?: string;
  intercom?: string;
  details?: string;
  photos?: string[];
}

interface OrderDetailsSheetProps {
  animatedHeight: Animated.Value;
  panResponder: any;
  isExpanded: boolean;
  onToggle: () => void;
  pickupLocation: string;
  deliveryLocation: string;
  selectedMethod: string;
  price: number;
  onBack: () => void;
  onConfirm: (
    pickupDetails: AddressDetails,
    dropoffDetails: AddressDetails,
    payerType?: 'client' | 'recipient',
    isPartialPayment?: boolean,
    partialAmount?: number,
    paymentMethodType?: PaymentMethodType, 
    paymentMethodId?: string | null 
  ) => void;
}

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const ORDER_DETAILS_MAX_HEIGHT = SCREEN_HEIGHT * 0.9;
const ORDER_DETAILS_MIN_HEIGHT = 100;

export const OrderDetailsSheet: React.FC<OrderDetailsSheetProps> = ({
  animatedHeight,
  panResponder,
  isExpanded,
  onToggle,
  pickupLocation,
  deliveryLocation,
  selectedMethod,
  price,
  onBack,
  onConfirm,
}) => {
  const [pickupDetails, setPickupDetails] = useState<AddressDetails>({
    phone: '',
    entrance: '',
    apartment: '',
    floor: '',
    intercom: '',
    details: '',
    photos: [],
  });

  const [dropoffDetails, setDropoffDetails] = useState<AddressDetails>({
    phone: '',
    entrance: '',
    apartment: '',
    floor: '',
    intercom: '',
    details: '',
    photos: [],
  });

  const [pickupSender] = useState('Moi');
  
  const [payerType, setPayerType] = useState<'client' | 'recipient'>('client');
  const [isPartialPayment, setIsPartialPayment] = useState(false);
  const [partialAmount, setPartialAmount] = useState<string>('');
  const [selectedPaymentMethodType, setSelectedPaymentMethodType] = useState<PaymentMethodType | null>(null);
  
  const { loadPaymentMethods, paymentMethods, selectedPaymentMethod } = usePaymentStore();
  
  React.useEffect(() => {
    loadPaymentMethods();
  }, [loadPaymentMethods]);

  const updatePickupDetails = (field: keyof AddressDetails, value: string | string[]) => {
    setPickupDetails((prev) => ({ ...prev, [field]: value }));
  };

  const updateDropoffDetails = (field: keyof AddressDetails, value: string | string[]) => {
    setDropoffDetails((prev) => ({ ...prev, [field]: value }));
  };

  const pickImage = async (type: 'pickup' | 'dropoff') => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission requise', 'Veuillez autoriser l\'accès à vos photos');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        quality: 0.8,
      });

      if (!result.canceled && result.assets) {
        const imageUris = result.assets.map((asset) => asset.uri);
        if (type === 'pickup') {
          updatePickupDetails('photos', [...(pickupDetails.photos || []), ...imageUris]);
        } else {
          updateDropoffDetails('photos', [...(dropoffDetails.photos || []), ...imageUris]);
        }
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    } catch (error) {
      logger.error('Error picking image:', error);
      Alert.alert('Erreur', 'Impossible de sélectionner l\'image');
    }
  };

  const handleConfirm = () => {
    if (!dropoffDetails.phone || dropoffDetails.phone.trim() === '') {
      Alert.alert('Champ requis', 'Veuillez renseigner le numéro de téléphone du destinataire');
      return;
    }

    if (payerType === 'client' && !selectedPaymentMethodType) {
      Alert.alert('Méthode de paiement requise', 'Veuillez sélectionner une méthode de paiement');
      return;
    }

  
    if (isPartialPayment && partialAmount) {
      const partial = parseFloat(partialAmount);
      if (isNaN(partial) || partial <= 0 || partial > price) {
        Alert.alert('Erreur', 'Montant partiel invalide');
        return;
      }
    }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    
    // Récupérer l'ID de la méthode de paiement sélectionnée
    // Si une méthode est sélectionnée dans le store, utiliser son ID
    // Sinon, chercher la méthode correspondante au type sélectionné
    let paymentMethodId: string | null = null;
    if (selectedPaymentMethodType) {
      if (selectedPaymentMethod && selectedPaymentMethod.method_type === selectedPaymentMethodType) {
        paymentMethodId = selectedPaymentMethod.id;
      } else {
        // Chercher la méthode correspondante au type sélectionné
        const method = paymentMethods.find((m) => m.method_type === selectedPaymentMethodType);
        if (method) {
          paymentMethodId = method.id;
        }
      }
    }
    
    onConfirm(
      pickupDetails,
      dropoffDetails,
      payerType,
      isPartialPayment,
      isPartialPayment && partialAmount ? parseFloat(partialAmount) : undefined,
      selectedPaymentMethodType || undefined, 
      paymentMethodId || null 
    );
  };

  const [showPickupOptional, setShowPickupOptional] = useState(false);
  const [showDropoffOptional, setShowDropoffOptional] = useState(false);

  const renderAddressSection = (
    title: string,
    address: string,
    details: AddressDetails,
    updateDetails: (field: keyof AddressDetails, value: string | string[]) => void,
    type: 'pickup' | 'dropoff'
  ) => (
    <View style={styles.addressSection}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {type === 'pickup' && (
          <TouchableOpacity style={styles.senderButton}>
            <Text style={styles.senderText}>{pickupSender}</Text>
            <Ionicons name="chevron-forward" size={16} color="#666" />
          </TouchableOpacity>
        )}
      </View>

  
      <View style={styles.addressDisplay}>
        <Ionicons name="location" size={18} color="#8B5CF6" />
        <Text style={styles.addressText} numberOfLines={2}>{address}</Text>
      </View>

      <TouchableOpacity
        style={styles.attachmentButton}
        onPress={() => pickImage(type)}
      >
        <View style={styles.attachmentButtonContent}>
          <Ionicons name="attach-outline" size={20} color="#8B5CF6" />
          <Text style={styles.attachmentButtonText}>Pièce jointe</Text>
        </View>
        {details.photos && details.photos.length > 0 && (
          <View style={styles.photoCount}>
            <Text style={styles.photoCountText}>{details.photos.length}</Text>
          </View>
        )}
      </TouchableOpacity>

      {details.photos && details.photos.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photosContainer}>
          {details.photos.map((uri, index) => (
            <View key={index} style={styles.photoItem}>
              <Image source={{ uri }} style={styles.photo} />
              <TouchableOpacity
                style={styles.removePhotoButton}
                onPress={() => {
                  const newPhotos = details.photos?.filter((_, i) => i !== index) || [];
                  updateDetails('photos', newPhotos);
                }}
              >
                <Ionicons name="close-circle" size={20} color="#fff" />
              </TouchableOpacity>
            </View>
          ))}
        </ScrollView>
      )}

      {type === 'dropoff' && (
        <View style={styles.requiredField}>
          <Text style={styles.inputLabel}>Téléphone destinataire *</Text>
          <TextInput
            style={[styles.input, styles.requiredInput]}
            placeholder="Numéro de téléphone"
            value={details.phone}
            onChangeText={(text) => updateDetails('phone', text)}
            keyboardType="phone-pad"
          />
        </View>
      )}

      <TouchableOpacity
        style={styles.optionalToggle}
        onPress={() => type === 'pickup' ? setShowPickupOptional(!showPickupOptional) : setShowDropoffOptional(!showDropoffOptional)}
      >
        <Text style={styles.optionalToggleText}>
          {type === 'pickup' ? (showPickupOptional ? 'Masquer' : 'Afficher') : (showDropoffOptional ? 'Masquer' : 'Afficher')} les détails (optionnel)
        </Text>
        <Ionicons 
          name={type === 'pickup' ? (showPickupOptional ? 'chevron-up' : 'chevron-down') : (showDropoffOptional ? 'chevron-up' : 'chevron-down')} 
          size={18} 
          color="#666" 
        />
      </TouchableOpacity>

      {(type === 'pickup' ? showPickupOptional : showDropoffOptional) && (
        <View style={styles.optionalFields}>
          <View style={styles.inputRow}>
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Entrée</Text>
              <TextInput
                style={styles.input}
                placeholder="Entrée"
                value={details.entrance}
                onChangeText={(text) => updateDetails('entrance', text)}
              />
            </View>
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Appart</Text>
              <TextInput
                style={styles.input}
                placeholder="Appart"
                value={details.apartment}
                onChangeText={(text) => updateDetails('apartment', text)}
              />
            </View>
          </View>

          <View style={styles.inputRow}>
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Etage</Text>
              <TextInput
                style={styles.input}
                placeholder="Etage"
                value={details.floor}
                onChangeText={(text) => updateDetails('floor', text)}
                keyboardType="numeric"
              />
            </View>
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Interphone</Text>
              <TextInput
                style={styles.input}
                placeholder="Interphone"
                value={details.intercom}
                onChangeText={(text) => updateDetails('intercom', text)}
              />
            </View>
          </View>
        </View>
      )}
    </View>
  );

  const dragHandleRef = useRef<View>(null);
  const [dragHandleLayout, setDragHandleLayout] = useState({ x: 0, y: 0, width: 0, height: 0 });

  const customPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_evt, gestureState) => {
        const { moveX, moveY } = gestureState;
        const { x, y, width, height } = dragHandleLayout;
        
        const handleZone = {
          x: x - 20,
          y: y - 30,
          width: width + 40,
          height: height + 60,
        };
        
        const isInHandleZone = 
          moveX >= handleZone.x &&
          moveX <= handleZone.x + handleZone.width &&
          moveY >= handleZone.y &&
          moveY <= handleZone.y + handleZone.height;
        
        const isVerticalSwipe = Math.abs(gestureState.dy) > Math.abs(gestureState.dx);
        return isInHandleZone && isVerticalSwipe && Math.abs(gestureState.dy) > 5;
      },
      onPanResponderMove: (_event, gestureState) => {
        if (!isExpanded) return;
        const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
        const newHeight = clamp(ORDER_DETAILS_MAX_HEIGHT - gestureState.dy, ORDER_DETAILS_MIN_HEIGHT, ORDER_DETAILS_MAX_HEIGHT);
        animatedHeight.setValue(newHeight);
      },
      onPanResponderRelease: (_event, gestureState) => {
        if (gestureState.vy > 0.5 || gestureState.dy > 50) {
          // Swipe down -> collapse
          onToggle();
        } else {
          // Retour à la hauteur maximale
          Animated.spring(animatedHeight, {
            toValue: ORDER_DETAILS_MAX_HEIGHT,
            useNativeDriver: false,
            tension: 65,
            friction: 8,
          }).start();
        }
      },
    })
  ).current;

  return (
    <Animated.View
      style={[styles.bottomSheet, { height: animatedHeight }]}
    >
      {/* Drag handle avec PanResponder */}
      <View
        ref={dragHandleRef}
        onLayout={(event) => {
          const { x, y, width, height } = event.nativeEvent.layout;
          setDragHandleLayout({ x, y, width, height });
        }}
        style={styles.dragIndicatorContainer}
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
          scrollEventThrottle={16}
          onScrollBeginDrag={() => {
            // Désactiver le panResponder pendant le scroll
          }}
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View style={styles.methodBadge}>
                <Ionicons name="cube-outline" size={16} color="#8B5CF6" />
                <Text style={styles.methodText}>{selectedMethod === 'moto' ? 'Livraison à moto' : selectedMethod === 'vehicule' ? 'Livraison en voiture' : 'Express Cargo'}</Text>
              </View>
              <TouchableOpacity onPress={onBack} style={styles.backButton}>
                <Ionicons name="arrow-forward" size={24} color="#000" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Pickup section */}
          {renderAddressSection('Prise en charge', pickupLocation, pickupDetails, updatePickupDetails, 'pickup')}

          {/* Dropoff section */}
          {renderAddressSection('Livraison', deliveryLocation, dropoffDetails, updateDropoffDetails, 'dropoff')}

          {/* Section Paiement */}
          <View style={styles.paymentSection}>
            <Text style={styles.sectionTitle}>Paiement</Text>
            
            {/* Qui paie */}
            <View style={styles.payerSelector}>
              <Text style={styles.inputLabel}>Qui paie ?</Text>
              <View style={styles.payerOptions}>
                <TouchableOpacity
                  style={[
                    styles.payerOption,
                    payerType === 'client' && styles.payerOptionSelected,
                  ]}
                  onPress={() => setPayerType('client')}
                >
                  <Ionicons
                    name={payerType === 'client' ? 'radio-button-on' : 'radio-button-off'}
                    size={20}
                    color={payerType === 'client' ? '#8B5CF6' : '#999'}
                  />
                  <Text
                    style={[
                      styles.payerOptionText,
                      payerType === 'client' && styles.payerOptionTextSelected,
                    ]}
                  >
                    Moi (client)
                  </Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[
                    styles.payerOption,
                    payerType === 'recipient' && styles.payerOptionSelected,
                  ]}
                  onPress={() => {
                    setPayerType('recipient');
                    setIsPartialPayment(false); // Désactiver le paiement partiel si le destinataire paie
                  }}
                >
                  <Ionicons
                    name={payerType === 'recipient' ? 'radio-button-on' : 'radio-button-off'}
                    size={20}
                    color={payerType === 'recipient' ? '#8B5CF6' : '#999'}
                  />
                  <Text
                    style={[
                      styles.payerOptionText,
                      payerType === 'recipient' && styles.payerOptionTextSelected,
                    ]}
                  >
                    Destinataire
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Paiement partiel (uniquement si le client paie) */}
            {payerType === 'client' && (
              <View style={styles.partialPaymentSection}>
                <View style={styles.partialPaymentHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.inputLabel}>Paiement partiel</Text>
                    <Text style={styles.partialPaymentHint}>
                      Payer une partie maintenant, le reste plus tard
                    </Text>
                  </View>
                  <Switch
                    value={isPartialPayment}
                    onValueChange={setIsPartialPayment}
                    trackColor={{ false: '#CCC', true: '#8B5CF6' }}
                    thumbColor="#FFF"
                  />
                </View>
                {isPartialPayment && (
                  <View style={styles.partialAmountContainer}>
                    <Text style={styles.inputLabel}>Montant à payer maintenant</Text>
                    <TextInput
                      style={styles.partialAmountInput}
                      value={partialAmount}
                      onChangeText={setPartialAmount}
                      placeholder="0"
                      keyboardType="numeric"
                      placeholderTextColor="#999"
                    />
                    <Text style={styles.partialAmountHint}>
                      Montant restant:{' '}
                      {partialAmount
                        ? (price - parseFloat(partialAmount || '0')).toLocaleString()
                        : price.toLocaleString()}{' '}
                      XOF
                    </Text>
                  </View>
                )}
              </View>
            )}

            {/* Information si le destinataire paie */}
            {payerType === 'recipient' && (
              <View style={styles.recipientPaymentInfo}>
                <Ionicons name="information-circle" size={18} color="#8B5CF6" />
                <Text style={styles.recipientPaymentInfoText}>
                  Le destinataire paiera à la livraison. Si le destinataire est enregistré dans l&apos;app, il pourra opter pour le paiement différé.
                </Text>
              </View>
            )}

            {/* Sélection de la méthode de paiement (uniquement si le client paie) */}
            {payerType === 'client' && (
              <View style={styles.paymentMethodSection}>
                <Text style={styles.inputLabel}>Méthode de paiement *</Text>
                <PaymentMethodSelector
                  selectedMethod={selectedPaymentMethodType}
                  onSelect={setSelectedPaymentMethodType}
                  showAddNew={false}
                />
              </View>
            )}
          </View>

          {/* Confirm button */}
          <TouchableOpacity style={styles.confirmButton} onPress={handleConfirm}>
            <View style={styles.confirmButtonContent}>
              <Text style={styles.confirmButtonText}>Commander</Text>
              <Text style={styles.confirmButtonPrice}>{price} FCFA</Text>
            </View>
          </TouchableOpacity>
        </ScrollView>
      ) : (
        <TouchableOpacity style={styles.peekContainer} onPress={onToggle}>
          <Text style={styles.peekText} numberOfLines={1}>
            Saisir les informations de livraison
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
    // Zone élargie pour faciliter le drag
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
    marginBottom: 20,
  },
  headerLeft: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  methodBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  methodText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  backButton: {
    padding: 4,
  },
  addressSection: {
    marginBottom: 30,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
  },
  senderButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
  },
  senderText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  inputRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  inputContainer: {
    flex: 1,
  },
  inputLabel: {
    fontSize: 13,
    color: '#666',
    marginBottom: 6,
    fontWeight: '500',
  },
  input: {
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    paddingVertical: 8,
    fontSize: 16,
    color: '#000',
  },
  addressDisplay: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#F8F9FA',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    gap: 10,
  },
  addressText: {
    flex: 1,
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
  },
  attachmentButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 12,
    backgroundColor: '#F5F0FF',
    borderRadius: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E9D5FF',
  },
  attachmentButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  attachmentButtonText: {
    fontSize: 15,
    color: '#8B5CF6',
    fontWeight: '600',
  },
  requiredField: {
    marginBottom: 16,
  },
  requiredInput: {
    borderBottomColor: '#8B5CF6',
    borderBottomWidth: 2,
  },
  optionalToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    marginTop: 8,
    marginBottom: 12,
  },
  optionalToggleText: {
    fontSize: 13,
    color: '#666',
    fontWeight: '500',
  },
  optionalFields: {
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  photoCount: {
    backgroundColor: '#8B5CF6',
    borderRadius: 12,
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoCountText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  photosContainer: {
    marginTop: 12,
    marginBottom: 8,
  },
  photoItem: {
    position: 'relative',
    marginRight: 12,
  },
  photo: {
    width: 80,
    height: 80,
    borderRadius: 8,
  },
  removePhotoButton: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: '#FF3B30',
    borderRadius: 10,
  },
  confirmButton: {
    backgroundColor: '#8B5CF6',
    borderRadius: 15,
    paddingVertical: 18,
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 20,
  },
  confirmButtonContent: {
    alignItems: 'center',
  },
  confirmButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  confirmButtonPrice: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    opacity: 0.9,
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
  paymentMethodSection: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  paymentSection: {
    marginTop: 20,
    marginBottom: 20,
    padding: 16,
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
  },
  payerSelector: {
    marginBottom: 16,
  },
  payerOptions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  payerOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    backgroundColor: '#FFF',
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#E5E7EB',
  },
  payerOptionSelected: {
    borderColor: '#8B5CF6',
    backgroundColor: '#F5F0FF',
  },
  payerOptionText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  payerOptionTextSelected: {
    color: '#8B5CF6',
    fontWeight: '600',
  },
  partialPaymentSection: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  partialPaymentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  partialPaymentHint: {
    fontSize: 11,
    color: '#666',
    marginTop: 4,
    flex: 1,
  },
  partialAmountContainer: {
    marginTop: 8,
  },
  partialAmountInput: {
    backgroundColor: '#FFF',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginTop: 8,
    marginBottom: 8,
  },
  partialAmountHint: {
    fontSize: 12,
    color: '#666',
  },
  recipientPaymentInfo: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginTop: 12,
    padding: 12,
    backgroundColor: '#E3F2FD',
    borderRadius: 8,
  },
  recipientPaymentInfoText: {
    flex: 1,
    fontSize: 12,
    color: '#1976D2',
    lineHeight: 18,
  },
});

