import React from 'react';
import { StyleSheet, View,Text,TouchableOpacity, Animated,ScrollView,Image,Alert} from 'react-native';
import PlacesAutocomplete from './PlacesAutocomplete';
import { useShipmentStore } from '../store/useShipmentStore';

type Coordinates = {
  latitude: number;
  longitude: number;
};

interface DeliveryBottomSheetProps {
  animatedHeight: Animated.Value;
  panResponder: any;
  isExpanded: boolean;
  onToggle: () => void;
  pickupLocation: string;
  deliveryLocation: string;
  selectedMethod: string;
  onPickupSelected: (data: { description: string; coords?: Coordinates }) => void;
  onDeliverySelected: (data: { description: string; coords?: Coordinates }) => void;
  onMethodSelected: (method: 'moto' | 'vehicule' | 'cargo') => void;
  onConfirm: () => void;
}

const deliveryMethods = [
  { id: 'moto', name: 'Moto', icon: require('../assets/images/motoo.png') },
  { id: 'vehicule', name: 'Véhicule', icon: require('../assets/images/carrss.png') },
  { id: 'cargo', name: 'Cargo', icon: require('../assets/images/ccargo.png') },
];

export const DeliveryBottomSheet: React.FC<DeliveryBottomSheetProps> = ({
  animatedHeight,
  panResponder,
  isExpanded,
  onToggle,
  pickupLocation,
  deliveryLocation,
  selectedMethod,
  onPickupSelected,
  onDeliverySelected,
  onMethodSelected,
  onConfirm,
}) => {
  const { createShipment } = useShipmentStore();


  const handleConfirm = () => {
    if (!pickupLocation || !deliveryLocation) {
      Alert.alert('Champs requis', 'Veuillez renseigner les deux adresses.');
      return;
    }
    
    createShipment();
    onConfirm();
  };


  

  

  return (
    <Animated.View 
      style={[styles.bottomSheet, { height: animatedHeight }]}
      {...panResponder.panHandlers}
    >
  
      <TouchableOpacity 
        style={styles.dragIndicator} 
        onPress={onToggle} 
        activeOpacity={0.8}
      >
        <View style={styles.dragHandle} />
      </TouchableOpacity>

      {isExpanded ? (
        <ScrollView 
          showsVerticalScrollIndicator={false}
          style={styles.scrollContent}
          scrollEnabled={isExpanded}
        >
          <Text style={styles.title}>ENVOYER UN COLIS</Text>

          <View style={styles.inputContainer}>
            <PlacesAutocomplete
              placeholder="Où récupérer"
              country="ci"
              initialValue={pickupLocation}
              onPlaceSelected={onPickupSelected}
            />

            <View style={styles.inputSeparator} />

            <PlacesAutocomplete
              placeholder="Où livrer"
              country="ci"
              initialValue={deliveryLocation}
              onPlaceSelected={onDeliverySelected}
            />
          </View>

          
          <View style={styles.deliveryMethodsContainer}>
            <Text style={styles.deliveryMethodsTitle}>Méthode de livraison</Text>
            <View style={styles.deliveryOptions}>
              {deliveryMethods.map((method) => (
                <TouchableOpacity
                  key={method.id}
                  style={[
                    styles.deliveryOption,
                    selectedMethod === method.id && styles.selectedOption,
                  ]}
                  onPress={() => onMethodSelected(method.id as 'moto' | 'vehicule' | 'cargo')}
                  activeOpacity={0.7}
                >
                  <Image source={method.icon} style={styles.methodIcon} />
                  <Text
                    style={[
                      styles.methodName,
                      selectedMethod === method.id && styles.methodNameSelected,
                    ]}
                  >
                    {method.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

      
          <TouchableOpacity
            style={[
              styles.chooseButton,
              (!pickupLocation || !deliveryLocation) && { opacity: 0.5 },
            ]}
            disabled={!pickupLocation || !deliveryLocation}
            onPress={handleConfirm}
          >
            <Text style={styles.chooseButtonText}>Choix de la méthode de livraison</Text>
          </TouchableOpacity>
        </ScrollView>
      ) : (
        <TouchableOpacity 
          style={styles.peekContainer} 
          onPress={onToggle} 
          activeOpacity={0.8}
        >
          <Text style={styles.peekText} numberOfLines={1}>
            {pickupLocation ? `De: ${pickupLocation}` : 'De: Ma position'} → {deliveryLocation ? `À: ${deliveryLocation}` : 'Choisissez une destination'}
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
    elevation: 5,
    zIndex: 100,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
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
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 25,
    textAlign: 'left',
  },
  inputContainer: {
    backgroundColor: '#f8f8f8',
    borderRadius: 15,
    marginBottom: 25,
    paddingVertical: 5,
  },
  inputSeparator: {
    height: 1,
    backgroundColor: '#e0e0e0',
    marginHorizontal: 20,
  },
  deliveryMethodsContainer: {
    marginBottom: 25,
  },
  deliveryMethodsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 15,
  },
  deliveryOptions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  deliveryOption: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: '#f8f8f8',
    borderRadius: 15,
    paddingVertical: 15,
    paddingHorizontal: 10,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  selectedOption: {
    backgroundColor: '#F5F0FF',
    borderColor: '#8B5CF6',
  },
  methodIcon: {
    width: 40,
    height: 40,
    marginBottom: 8,
    resizeMode: 'contain',
  },
  methodName: {
    fontSize: 13,
    textAlign: 'center',
    color: '#666',
    fontWeight: '500',
  },
  methodNameSelected: {
    color: '#8B5CF6',
    fontWeight: '600',
  },
  chooseButton: {
    backgroundColor: '#8B5CF6',
    borderRadius: 15,
    paddingVertical: 18,
    alignItems: 'center',
    marginTop: 0,
  },
  chooseButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
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
  
  
  tripInfo: {
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  tripInfoHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  tripInfoTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B',
  },
  tripInfoDuration: {
    fontSize: 16,
    fontWeight: '700',
    color: '#6366F1',
  },
  tripInfoRoute: {
    fontSize: 13,
    color: '#475569',
    lineHeight: 18,
  },

  pillWrapper: {
    position: 'absolute',
    left: 20,
    right: 20,
    bottom: 28,
    alignItems: 'center',
    zIndex: 50,
  },
  compactPill: {
    width: '100%',
    backgroundColor: '#7B61FF',
    borderRadius: 28,
    paddingVertical: 12,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 6,
  },
  expandedSheet: {
    position: 'absolute',
    left: 20,
    right: 20,
    bottom: 80,
    top: 80,
    backgroundColor: '#fff',
    borderRadius: 16,
    zIndex: 60,
    elevation: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    overflow: 'hidden',
  },
  expandedHeader: {
    alignItems: 'center',
    paddingVertical: 8,
    backgroundColor: 'transparent',
  },
  expandedContent: {
    paddingHorizontal: 18,
    paddingBottom: 120,
  },
  expandedTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 12,
  },
  timelineContainer: {
    paddingVertical: 6,
  },
  timelineRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 18,
  },
  timelineLeft: {
    width: 36,
    alignItems: 'center',
  },
  timelineBullet: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginBottom: 6,
  },
  timelineBulletActive: {
    backgroundColor: '#7B61FF',
  },
  timelineBulletInactive: {
    backgroundColor: '#E5E7EB',
  },
  timelineLine: {
    width: 2,
    flex: 1,
  },
  timelineLineActive: {
    backgroundColor: '#C7B7FF',
  },
  timelineLineInactive: {
    backgroundColor: '#F1F5F9',
  },
  timelineRight: {
    flex: 1,
    paddingLeft: 12,
  },
  timelineText: {
    fontSize: 14,
    color: '#374151',
  },
  timelineTextActive: {
    color: '#111827',
    fontWeight: '700',
  },
  timelineTextInactive: {
    color: '#6B7280',
  },
  expandedPillContainer: {
    position: 'absolute',
    left: 20,
    right: 20,
    bottom: 18,
    alignItems: 'center',
  },
  outerPill: {
    backgroundColor: '#fff',
    borderRadius: 40,
    padding: 10,
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 8,
  },
  topBarWrapper: {
    position: 'absolute',
    top: 12,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 10,
  
    paddingTop: 0,
  },
  topBar: {
    width: 60,
    height: 4,
    backgroundColor: '#c8c8c8ff',
    borderRadius: 2,
    marginTop: -9,
  },
  rightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },

  leftAvatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#D9D9D9',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarImage: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  avatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#E6E6E6',
  },
  actionCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
  },
});