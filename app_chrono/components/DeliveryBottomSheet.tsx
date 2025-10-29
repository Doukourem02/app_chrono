import React from 'react';
import { 
  StyleSheet, 
  View, 
  Text, 
  TouchableOpacity, 
  Animated, 
  ScrollView,
  Image,
  Alert 
} from 'react-native';
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
  { id: 'moto', name: 'Livraison par moto', icon: require('../assets/images/motoo.png') },
  { id: 'vehicule', name: 'Livraison par véhicule', icon: require('../assets/images/carrss.png') },
  { id: 'cargo', name: 'Livraison par cargo', icon: require('../assets/images/ccargo.png') },
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
      {/* Indicateur de glissement */}
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

          {/* Champs de saisie avec autocomplete */}
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

          {/* Options de livraison */}
          <View style={styles.deliveryOptions}>
            {deliveryMethods.map((method) => (
              <TouchableOpacity
                key={method.id}
                style={[
                  styles.deliveryOption,
                  selectedMethod === method.id && styles.selectedOption,
                ]}
                onPress={() => onMethodSelected(method.id as 'moto' | 'vehicule' | 'cargo')}
              >
                <Image source={method.icon} style={styles.methodIcon} />
                <Text style={styles.methodName}>{method.name}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Bouton de validation */}
          <TouchableOpacity
            style={[
              styles.chooseButton,
              (!pickupLocation || !deliveryLocation) && { opacity: 0.5 },
            ]}
            disabled={!pickupLocation || !deliveryLocation}
            onPress={handleConfirm}
          >
            <Text style={styles.chooseButtonText}>Choix de la méthode</Text>
            <Text style={styles.chooseButtonText}>de Livraison</Text>
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
    elevation: 10,
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
  deliveryOptions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 25,
  },
  deliveryOption: {
    alignItems: 'center',
    backgroundColor: '#f8f8f8',
    borderRadius: 15,
    paddingVertical: 15,
    paddingHorizontal: 10,
    width: '30%',
  },
  selectedOption: {
    backgroundColor: '#e8e0ff',
    borderWidth: 2,
    borderColor: '#8B5CF6',
  },
  methodIcon: {
    width: 30,
    height: 30,
    marginBottom: 8,
    resizeMode: 'contain',
  },
  methodName: {
    fontSize: 12,
    textAlign: 'center',
    color: '#666',
    fontWeight: '500',
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
  
  // Nouvelles informations de trajet
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
});