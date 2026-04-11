import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useDriverStore } from '../../store/useDriverStore';
import { apiService } from '../../services/apiService';
import { logger } from '../../utils/logger';
import { showUserFriendlyError } from '../../utils/errorFormatter';
import { isDriverVehicleTypeSelectableOnKrono } from '../../constants/driverVehicle';


export default function PartnerOnboardingScreen() {
  const { user, profile, setProfile } = useDriverStore();
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  // Informations véhicule
  const [vehicleType, setVehicleType] = useState<'moto' | 'vehicule' | 'cargo'>('moto');
  const [vehiclePlate, setVehiclePlate] = useState('');
  const [vehicleBrand, setVehicleBrand] = useState('');
  const [vehicleModel, setVehicleModel] = useState('');
  const [vehicleColor, setVehicleColor] = useState('');
  const [licenseNumber, setLicenseNumber] = useState('');

  const handleComplete = async () => {
    // Seule l'acceptation des conditions est requise
    if (!acceptedTerms) {
      Alert.alert('Erreur', 'Veuillez accepter les conditions de commission prépayée');
      return;
    }

    setIsLoading(true);

    try {
      // Mettre à jour le profil driver avec les informations complémentaires (si fournies)
      if (!user?.id) {
        throw new Error('Utilisateur non connecté');
      }

      // Mettre à jour uniquement si des informations véhicule ont été fournies
      if (vehiclePlate || licenseNumber || vehicleBrand || vehicleModel || vehicleColor) {
        const response = await apiService.updateDriverVehicle(user.id, {
          vehicle_type: vehicleType,
          vehicle_plate: vehiclePlate || undefined,
          vehicle_brand: vehicleBrand || undefined,
          vehicle_model: vehicleModel || undefined,
          vehicle_color: vehicleColor || undefined,
          license_number: licenseNumber || undefined,
        });

        if (response.success) {
          // Mettre à jour le profil local avec les nouvelles données
          if (profile) {
            setProfile({
              ...profile,
              vehicle_type: vehicleType,
              vehicle_plate: vehiclePlate || undefined,
              vehicle_brand: vehicleBrand || undefined,
              vehicle_model: vehicleModel || undefined,
              vehicle_color: vehicleColor || undefined,
              license_number: licenseNumber || undefined,
            });
          }
        } else {
          throw new Error(response.message || 'Erreur lors de la mise à jour du profil');
        }
      }

      // Même sans informations véhicule, le profil est considéré comme complété
      // (acceptation des conditions suffit)
      Alert.alert(
        'Profil complété !',
        'Votre profil partenaire a été créé avec succès. Vous pouvez compléter les informations de votre véhicule plus tard dans votre profil.',
        [
          {
            text: 'Commencer',
            onPress: () => {
              router.replace('/(tabs)' as any);
            },
          },
        ]
      );
    } catch (error: any) {
      // Logger l'erreur technique (pour les développeurs, pas visible à l'utilisateur)
      logger.error('Erreur complétion profil:', undefined, error);
      // Afficher un message user-friendly (jamais les détails techniques)
      showUserFriendlyError(error, 'complétion du profil');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View style={styles.iconContainer}>
            <Ionicons name="car-sport" size={48} color="#8B5CF6" />
          </View>
          <Text style={styles.title}>Devenir Livreur Partenaire</Text>
          <Text style={styles.subtitle}>
            Complétez votre profil pour commencer à recevoir des commandes
          </Text>
        </View>

        {/* Conditions Commission Prépayée */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>💳 Système de Commission Prépayée</Text>
          <View style={styles.termsContainer}>
            <Text style={styles.termsText}>
              En tant que livreur partenaire indépendant, vous devez disposer d&apos;un crédit commission pour recevoir des commandes.
            </Text>
            <View style={styles.termsList}>
              <View style={styles.termItem}>
                <Ionicons name="checkmark-circle" size={20} color="#10B981" />
                <Text style={styles.termItemText}>
                  Recharge minimale : 10 000 FCFA
                </Text>
              </View>
              <View style={styles.termItem}>
                <Ionicons name="checkmark-circle" size={20} color="#10B981" />
                <Text style={styles.termItemText}>
                  Commission : 10% à 20% par livraison
                </Text>
              </View>
              <View style={styles.termItem}>
                <Ionicons name="checkmark-circle" size={20} color="#10B981" />
                <Text style={styles.termItemText}>
                  Prélèvement automatique à chaque livraison terminée
                </Text>
              </View>
              <View style={styles.termItem}>
                <Ionicons name="checkmark-circle" size={20} color="#10B981" />
                <Text style={styles.termItemText}>
                  Suspension automatique si solde = 0
                </Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.checkboxContainer}
              onPress={() => setAcceptedTerms(!acceptedTerms)}
            >
              <View style={[styles.checkbox, acceptedTerms && styles.checkboxChecked]}>
                {acceptedTerms && <Ionicons name="checkmark" size={16} color="#FFFFFF" />}
              </View>
              <Text style={styles.checkboxLabel}>
                J&apos;accepte les conditions de commission prépayée
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Informations Véhicule */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🚗 Informations Véhicule (optionnel)</Text>
          <Text style={styles.optionalNote}>
            Vous pouvez compléter ces informations plus tard dans votre profil
          </Text>
          
          {/* Type de véhicule */}
          <Text style={styles.label}>Type de véhicule</Text>
          <View style={styles.vehicleTypeContainer}>
            {(['moto', 'vehicule', 'cargo'] as const).map((type) => {
              const enabled = isDriverVehicleTypeSelectableOnKrono(type);
              const selected = vehicleType === type;
              return (
                <TouchableOpacity
                  key={type}
                  style={[
                    styles.vehicleTypeButton,
                    selected && enabled && styles.vehicleTypeButtonActive,
                    !enabled && styles.vehicleTypeButtonDisabled,
                  ]}
                  onPress={() => {
                    if (!enabled) {
                      Alert.alert(
                        'Bientôt disponible',
                        'Pour l’instant, Krono ne propose que la livraison à moto.',
                      );
                      return;
                    }
                    setVehicleType(type);
                  }}
                  activeOpacity={enabled ? 0.7 : 1}
                >
                  <Ionicons
                    name={type === 'moto' ? 'bicycle' : type === 'vehicule' ? 'car' : 'cube'}
                    size={24}
                    color={
                      selected && enabled
                        ? '#FFFFFF'
                        : !enabled
                          ? '#9CA3AF'
                          : '#6B7280'
                    }
                  />
                  <Text
                    style={[
                      styles.vehicleTypeText,
                      selected && enabled && styles.vehicleTypeTextActive,
                      !enabled && styles.vehicleTypeTextDisabled,
                    ]}
                  >
                    {type === 'moto' ? 'Moto' : type === 'vehicule' ? 'Véhicule' : 'Cargo'}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Numéro de plaque */}
          <Text style={styles.label}>Numéro de plaque</Text>
          <TextInput
            style={styles.input}
            placeholder="Ex: AB-123-CD"
            placeholderTextColor="#9CA3AF"
            value={vehiclePlate}
            onChangeText={setVehiclePlate}
            autoCapitalize="characters"
          />

          {/* Marque */}
          <Text style={styles.label}>Marque (optionnel)</Text>
          <TextInput
            style={styles.input}
            placeholder="Ex: Yamaha, Toyota..."
            placeholderTextColor="#9CA3AF"
            value={vehicleBrand}
            onChangeText={setVehicleBrand}
          />

          {/* Modèle */}
          <Text style={styles.label}>Modèle (optionnel)</Text>
          <TextInput
            style={styles.input}
            placeholder="Ex: MT-07, Corolla..."
            placeholderTextColor="#9CA3AF"
            value={vehicleModel}
            onChangeText={setVehicleModel}
          />

          {/* Couleur */}
          <Text style={styles.label}>Couleur (optionnel)</Text>
          <TextInput
            style={styles.input}
            placeholder="Ex: Rouge, Bleu..."
            placeholderTextColor="#9CA3AF"
            value={vehicleColor}
            onChangeText={setVehicleColor}
          />
        </View>

        {/* Permis */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📄 Permis de Conduire (optionnel)</Text>
          <Text style={styles.label}>Numéro de permis</Text>
          <TextInput
            style={styles.input}
            placeholder="Ex: AB123456"
            placeholderTextColor="#9CA3AF"
            value={licenseNumber}
            onChangeText={setLicenseNumber}
            autoCapitalize="characters"
          />
        </View>

        {/* Bouton Valider */}
        <TouchableOpacity
          style={[styles.submitButton, (!acceptedTerms || isLoading) && styles.submitButtonDisabled]}
          onPress={handleComplete}
          disabled={!acceptedTerms || isLoading}
        >
          <Text style={styles.submitButtonText}>
            {isLoading ? 'Enregistrement...' : 'Compléter mon profil'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  iconContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#F3F0FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 24,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 16,
  },
  termsContainer: {
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  termsText: {
    fontSize: 14,
    color: '#4B5563',
    lineHeight: 22,
    marginBottom: 16,
  },
  termsList: {
    gap: 12,
    marginBottom: 20,
  },
  termItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  termItemText: {
    fontSize: 14,
    color: '#374151',
    flex: 1,
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#8B5CF6',
    borderColor: '#8B5CF6',
  },
  checkboxLabel: {
    fontSize: 14,
    color: '#374151',
    flex: 1,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
    marginTop: 12,
  },
  optionalNote: {
    fontSize: 13,
    color: '#6B7280',
    fontStyle: 'italic',
    marginBottom: 16,
  },
  vehicleTypeContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  vehicleTypeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  vehicleTypeButtonActive: {
    backgroundColor: '#8B5CF6',
    borderColor: '#8B5CF6',
  },
  vehicleTypeButtonDisabled: {
    opacity: 0.45,
    backgroundColor: '#E5E7EB',
    borderColor: '#D1D5DB',
  },
  vehicleTypeText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  vehicleTypeTextActive: {
    color: '#FFFFFF',
  },
  vehicleTypeTextDisabled: {
    color: '#9CA3AF',
  },
  input: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#1F2937',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  submitButton: {
    backgroundColor: '#8B5CF6',
    borderRadius: 25,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
    shadowColor: '#8B5CF6',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});

