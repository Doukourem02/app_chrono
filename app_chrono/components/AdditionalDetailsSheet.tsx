import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Image,
  Alert,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';

interface AdditionalDetailsSheetProps {
  animatedHeight: Animated.Value;
  panResponder: any;
  isExpanded: boolean;
  onToggle: () => void;
  onConfirm: (details: {
    recipientPhone: string;
    recipientContactId?: string;
    packageImages: string[];
  }) => void;
  onBack: () => void;
}

interface SavedContact {
  id: string;
  name: string;
  phone: string;
}

// Contacts sauvegardés (pour l'instant statiques, à remplacer par un store/vraies données)
const savedContacts: SavedContact[] = [
  { id: '1', name: 'John Doe', phone: '+225 07 12 34 56 78' },
  { id: '2', name: 'John Doe', phone: '+225 07 98 76 54 32' },
  { id: '3', name: 'John Doe', phone: '+225 07 55 66 77 88' },
];

export const AdditionalDetailsSheet: React.FC<AdditionalDetailsSheetProps> = ({
  animatedHeight,
  panResponder,
  isExpanded,
  onToggle,
  onConfirm,
  onBack,
}) => {
  const [recipientPhone, setRecipientPhone] = useState('');
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);
  const [packageImages, setPackageImages] = useState<string[]>([]);

  const pickImage = async () => {
    // Demander les permissions
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission requise', 'Vous devez autoriser l\'accès à vos photos pour ajouter des images.');
      return;
    }

    // Ouvrir la galerie
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.8,
      allowsEditing: false,
    });

    if (!result.canceled && result.assets) {
      const newImages = result.assets.map(asset => asset.uri);
      setPackageImages(prev => [...prev, ...newImages]);
    }
  };

  const removeImage = (index: number) => {
    setPackageImages(prev => prev.filter((_, i) => i !== index));
  };

  const handleContactSelect = (contact: SavedContact) => {
    setSelectedContactId(contact.id);
    setRecipientPhone(contact.phone);
  };

  const handleConfirm = () => {
    if (!recipientPhone.trim()) {
      Alert.alert('Champ requis', 'Veuillez saisir le numéro de téléphone du destinataire.');
      return;
    }

    onConfirm({
      recipientPhone: recipientPhone.trim(),
      recipientContactId: selectedContactId || undefined,
      packageImages,
    });
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
          {/* Bouton retour */}
          <TouchableOpacity
            style={styles.backButton}
            onPress={onBack}
          >
            <Ionicons name="arrow-back" size={24} color="#333" />
          </TouchableOpacity>

          <Text style={styles.title}>Détails supplémentaires</Text>

          {/* Section Destinataire */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Destinataire</Text>
            <TextInput
              style={styles.phoneInput}
              placeholder="Saisir le numéro du destinataire"
              placeholderTextColor="#999"
              value={recipientPhone}
              onChangeText={setRecipientPhone}
              keyboardType="phone-pad"
              autoComplete="tel"
            />
          </View>

          {/* Section Contact */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Contact</Text>
            {savedContacts.map((contact) => (
              <TouchableOpacity
                key={contact.id}
                style={[
                  styles.contactItem,
                  selectedContactId === contact.id && styles.contactItemSelected,
                ]}
                onPress={() => handleContactSelect(contact)}
              >
                <View style={styles.contactInfo}>
                  <Text style={styles.contactName}>{contact.name}</Text>
                  <Text style={styles.contactPhone}>{contact.phone}</Text>
                </View>
                <View
                  style={[
                    styles.radioButton,
                    selectedContactId === contact.id && styles.radioButtonSelected,
                  ]}
                >
                  {selectedContactId === contact.id && (
                    <View style={styles.radioButtonInner} />
                  )}
                </View>
              </TouchableOpacity>
            ))}
          </View>

          {/* Section Images du colis */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Images du colis</Text>
            <TouchableOpacity
              style={styles.addImageButton}
              onPress={pickImage}
            >
              <Ionicons name="camera-outline" size={24} color="#8B5CF6" />
              <Text style={styles.addImageText}>Ajouter des photos</Text>
            </TouchableOpacity>

            {/* Afficher les images ajoutées */}
            {packageImages.length > 0 && (
              <View style={styles.imagesGrid}>
                {packageImages.map((uri, index) => (
                  <View key={index} style={styles.imageContainer}>
                    <Image source={{ uri }} style={styles.image} />
                    <TouchableOpacity
                      style={styles.removeImageButton}
                      onPress={() => removeImage(index)}
                    >
                      <Ionicons name="close-circle" size={24} color="#fff" />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}
          </View>

          {/* Bouton de validation */}
          <TouchableOpacity
            style={[
              styles.confirmButton,
              !recipientPhone.trim() && { opacity: 0.5 },
            ]}
            disabled={!recipientPhone.trim()}
            onPress={handleConfirm}
          >
            <Text style={styles.confirmButtonText}>
              Saisir les détails de la livraison
            </Text>
          </TouchableOpacity>
        </ScrollView>
      ) : (
        <TouchableOpacity
          style={styles.peekContainer}
          onPress={onToggle}
          activeOpacity={0.8}
        >
          <Text style={styles.peekText} numberOfLines={1}>
            Détails supplémentaires
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
  backButton: {
    position: 'absolute',
    top: 10,
    left: 0,
    zIndex: 10,
    padding: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 25,
    marginTop: 10,
    textAlign: 'left',
  },
  section: {
    marginBottom: 30,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
    marginBottom: 15,
  },
  phoneInput: {
    backgroundColor: '#f8f8f8',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#333',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f8f8f8',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  contactItemSelected: {
    borderColor: '#8B5CF6',
    backgroundColor: '#f5f0ff',
  },
  contactInfo: {
    flex: 1,
  },
  contactName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  contactPhone: {
    fontSize: 14,
    color: '#666',
  },
  radioButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#ccc',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioButtonSelected: {
    borderColor: '#8B5CF6',
  },
  radioButtonInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#8B5CF6',
  },
  addImageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f8f8f8',
    borderRadius: 12,
    padding: 16,
    borderWidth: 2,
    borderColor: '#e0e0e0',
    borderStyle: 'dashed',
  },
  addImageText: {
    marginLeft: 12,
    fontSize: 16,
    color: '#8B5CF6',
    fontWeight: '600',
  },
  imagesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 16,
    gap: 12,
  },
  imageContainer: {
    position: 'relative',
    width: 100,
    height: 100,
    borderRadius: 12,
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  removeImageButton: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 12,
  },
  confirmButton: {
    backgroundColor: '#8B5CF6',
    borderRadius: 15,
    paddingVertical: 18,
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 20,
  },
  confirmButtonText: {
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
});

