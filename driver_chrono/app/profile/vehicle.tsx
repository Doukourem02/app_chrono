import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useDriverStore } from '../../store/useDriverStore';
import { apiService } from '../../services/apiService';

export default function VehiclePage() {
  const { profile, user } = useDriverStore();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    vehicleType: '',
    vehiclePlate: '',
    vehicleBrand: '',
    vehicleModel: '',
    vehicleColor: '',
    licenseNumber: '',
  });

  useEffect(() => {
    if (profile) {
      setFormData({
        vehicleType: profile.vehicle_type || '',
        vehiclePlate: profile.vehicle_plate || '',
        vehicleBrand: (profile as any).vehicle_brand || '',
        vehicleModel: profile.vehicle_model || '',
        vehicleColor: (profile as any).vehicle_color || '',
        licenseNumber: profile.license_number || '',
      });
    }
  }, [profile]);

  const handleSave = async () => {
    if (!formData.vehicleType.trim() || !formData.vehiclePlate.trim()) {
      Alert.alert('Erreur', 'Le type de véhicule et la plaque sont requis');
      return;
    }

    if (!user?.id) {
      Alert.alert('Erreur', 'Utilisateur non identifié');
      return;
    }

    setIsLoading(true);
    try {
      const result = await apiService.updateDriverVehicle(user.id, {
        vehicle_type: formData.vehicleType as 'moto' | 'vehicule' | 'cargo',
        vehicle_plate: formData.vehiclePlate.trim(),
        vehicle_brand: formData.vehicleBrand.trim() || undefined,
        vehicle_model: formData.vehicleModel.trim() || undefined,
        vehicle_color: formData.vehicleColor.trim() || undefined,
        license_number: formData.licenseNumber.trim() || undefined,
      });

      if (result.success && result.data) {
        // Mettre à jour le store avec les nouvelles données
        const currentState = useDriverStore.getState();
        if (currentState.profile) {
          useDriverStore.getState().updateProfile({
            vehicle_type: result.data.vehicle_type,
            vehicle_plate: result.data.vehicle_plate,
            vehicle_brand: result.data.vehicle_brand,
            vehicle_model: result.data.vehicle_model,
            vehicle_color: result.data.vehicle_color,
            license_number: result.data.license_number,
          });
        }

        Alert.alert('Succès', 'Les informations du véhicule ont été mises à jour', [
          { text: 'OK', onPress: () => router.back() },
        ]);
      } else {
        Alert.alert('Erreur', result.message || 'Impossible de mettre à jour les informations');
      }
    } catch (error) {
      console.error('Erreur mise à jour véhicule:', error);
      Alert.alert('Erreur', 'Impossible de mettre à jour les informations');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#1F2937" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Mon véhicule</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.form}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Type de véhicule</Text>
            <View style={styles.vehicleTypeContainer}>
              {['moto', 'vehicule', 'cargo'].map((type) => (
                <TouchableOpacity
                  key={type}
                  style={[
                    styles.vehicleTypeButton,
                    formData.vehicleType === type && styles.vehicleTypeButtonActive,
                  ]}
                  onPress={() => setFormData({ ...formData, vehicleType: type })}
                >
                  <Text
                    style={[
                      styles.vehicleTypeText,
                      formData.vehicleType === type && styles.vehicleTypeTextActive,
                    ]}
                  >
                    {type === 'moto' ? 'Moto' : type === 'vehicule' ? 'Véhicule' : 'Cargo'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Plaque d&apos;immatriculation</Text>
            <TextInput
              style={styles.input}
              value={formData.vehiclePlate}
              onChangeText={(text) => setFormData({ ...formData, vehiclePlate: text.toUpperCase() })}
              placeholder="Ex: AB-123-CD"
              placeholderTextColor="#9CA3AF"
              autoCapitalize="characters"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Marque</Text>
            <TextInput
              style={styles.input}
              value={formData.vehicleBrand}
              onChangeText={(text) => setFormData({ ...formData, vehicleBrand: text })}
              placeholder="Ex: Yamaha, Toyota"
              placeholderTextColor="#9CA3AF"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Modèle</Text>
            <TextInput
              style={styles.input}
              value={formData.vehicleModel}
              onChangeText={(text) => setFormData({ ...formData, vehicleModel: text })}
              placeholder="Ex: MT-07, Corolla"
              placeholderTextColor="#9CA3AF"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Couleur</Text>
            <TextInput
              style={styles.input}
              value={formData.vehicleColor}
              onChangeText={(text) => setFormData({ ...formData, vehicleColor: text })}
              placeholder="Ex: Rouge, Bleu"
              placeholderTextColor="#9CA3AF"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Numéro de permis</Text>
            <TextInput
              style={styles.input}
              value={formData.licenseNumber}
              onChangeText={(text) => setFormData({ ...formData, licenseNumber: text })}
              placeholder="Votre numéro de permis de conduire"
              placeholderTextColor="#9CA3AF"
              autoCapitalize="characters"
            />
          </View>
        </View>

        <TouchableOpacity
          style={[styles.saveButton, isLoading && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <>
              <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" />
              <Text style={styles.saveButtonText}>Enregistrer</Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 20,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
  },
  placeholder: {
    width: 40,
  },
  content: {
    flex: 1,
  },
  form: {
    backgroundColor: '#FFFFFF',
    marginTop: 20,
    marginHorizontal: 20,
    borderRadius: 12,
    padding: 20,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  vehicleTypeContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  vehicleTypeButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
  },
  vehicleTypeButtonActive: {
    backgroundColor: '#F3F0FF',
    borderColor: '#8B5CF6',
  },
  vehicleTypeText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  vehicleTypeTextActive: {
    color: '#8B5CF6',
  },
  input: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#1F2937',
  },
  saveButton: {
    backgroundColor: '#8B5CF6',
    marginHorizontal: 20,
    marginTop: 20,
    marginBottom: 40,
    paddingVertical: 16,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});

