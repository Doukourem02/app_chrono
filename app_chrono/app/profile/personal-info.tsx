import React, { useState, useEffect } from 'react';
import {View,Text,StyleSheet,TextInput,TouchableOpacity,ScrollView,Alert,ActivityIndicator} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useAuthStore } from '../../store/useAuthStore';
import { userApiService } from '../../services/userApiService';
import { logger } from '../../utils/logger';
import { captureError } from '../../utils/sentry';

export default function PersonalInfoPage() {
  const { user } = useAuthStore();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    phone: user?.phone || '',
  });

  // Ne pas dépendre de `user` (référence) : l’onglet Profil appelle souvent setUser après
  // getUserProfile, ce qui réinitialisait le formulaire à chaque frappe.
  useEffect(() => {
    if (!user?.id) return;
    setFormData({
      firstName: user.first_name || '',
      lastName: user.last_name || '',
      phone: user.phone || '',
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- hydratation au changement de compte uniquement (évite reset si setUser depuis l’onglet Profil)
  }, [user?.id]);

  const handleSave = async () => {
    if (!formData.firstName.trim() || !formData.lastName.trim()) {
      Alert.alert('Erreur', 'Le prénom et le nom sont requis');
      return;
    }

    if (!user?.id) {
      Alert.alert('Erreur', 'Utilisateur non identifié');
      return;
    }

    setIsLoading(true);
    try {
      const result = await userApiService.updateProfile(user.id, {
        first_name: formData.firstName.trim(),
        last_name: formData.lastName.trim(),
        phone: formData.phone.trim() || undefined,
      });

      if (result.success && result.data) {
        // Mettre à jour le store avec les nouvelles données
        useAuthStore.getState().setUser({
          ...user,
          first_name: result.data.first_name,
          last_name: result.data.last_name,
          phone: result.data.phone || user.phone,
        });

        Alert.alert('Succès', 'Vos informations ont été mises à jour', [
          { text: 'OK', onPress: () => router.back() },
        ]);
      } else {
        const msg = result.message || 'Impossible de mettre à jour vos informations';
        console.warn('[app_chrono/personal-info] updateProfile success:false', { userId: user.id, message: msg });
        logger.warn('updateProfile success:false', 'personal-info', { userId: user.id, message: msg });
        captureError(new Error(msg), { screen: 'personal-info', userId: user.id, source: 'updateProfile_result' });
        Alert.alert('Erreur', msg);
      }
    } catch (error) {
      console.warn('[app_chrono/personal-info] updateProfile exception', error);
      logger.error('Erreur mise à jour profil:', undefined, error);
      captureError(
        error instanceof Error ? error : new Error(String(error)),
        { screen: 'personal-info', userId: user?.id, source: 'updateProfile_catch' }
      );
      Alert.alert(
        'Erreur',
        error instanceof Error ? error.message : 'Impossible de mettre à jour vos informations'
      );
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
        <Text style={styles.headerTitle}>Informations personnelles</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.form}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Prénom</Text>
            <TextInput
              style={styles.input}
              value={formData.firstName}
              onChangeText={(text) =>
                setFormData((prev) => ({ ...prev, firstName: text }))
              }
              placeholder="Votre prénom"
              placeholderTextColor="#9CA3AF"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Nom</Text>
            <TextInput
              style={styles.input}
              value={formData.lastName}
              onChangeText={(text) =>
                setFormData((prev) => ({ ...prev, lastName: text }))
              }
              placeholder="Votre nom"
              placeholderTextColor="#9CA3AF"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Téléphone</Text>
            <TextInput
              style={styles.input}
              value={formData.phone}
              onChangeText={(text) =>
                setFormData((prev) => ({ ...prev, phone: text }))
              }
              placeholder="Votre numéro de téléphone"
              placeholderTextColor="#9CA3AF"
              keyboardType="phone-pad"
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

