import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTempDriverStore } from '../../store/useTempDriverStore';
import { useDriverStore } from '../../store/useDriverStore';
import { apiService } from '../../services/apiService';
import { logger } from '../../utils/logger';

export default function DriverTypeSelectionScreen() {
  const [selectedType, setSelectedType] = useState<'partner' | 'internal' | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { setDriverType } = useTempDriverStore();
  const { user, setProfile } = useDriverStore();

  const handleContinue = async () => {
    if (!selectedType) {
      return;
    }

    if (!user?.id) {
      Alert.alert('Erreur', 'Utilisateur non connecté');
      return;
    }

    setIsLoading(true);

    try {
  
      const response = await apiService.updateDriverType(user.id, selectedType);

      if (response.success) {
      
        setDriverType(selectedType);
        

        try {
          const profileResult = await apiService.getDriverProfile(user.id);
          if (profileResult.success && profileResult.data) {
        
            setProfile(profileResult.data);
            
        
            await new Promise(resolve => setTimeout(resolve, 100));
          } else {
            logger.warn('Profil non trouvé après mise à jour du type');
          }
        } catch (profileError) {
          logger.warn('Erreur rechargement profil après mise à jour type:', undefined, profileError);
        
        }

        if (selectedType === 'partner') {
      
          router.replace('/(auth)/partner-onboarding' as any);
        } else {
        
          router.replace('/(tabs)' as any);
        }
      } else {
        throw new Error(response.message || 'Erreur lors de la mise à jour du type de livreur');
      }
    } catch (error: any) {
      logger.error('Erreur mise à jour type livreur:', undefined, error);
      Alert.alert('Erreur', error.message || 'Une erreur est survenue lors de la sélection du type de livreur');
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
          <Text style={styles.title}>Choisissez votre type de livreur</Text>
          <Text style={styles.subtitle}>
            Sélectionnez le type de livreur qui correspond à votre situation
          </Text>
        </View>

        {/* Option 1 : Livreur Partenaire Indépendant */}
        <TouchableOpacity
          style={[
            styles.optionCard,
            selectedType === 'partner' && styles.optionCardSelected,
          ]}
          onPress={() => setSelectedType('partner')}
          activeOpacity={0.7}
        >
          <View style={styles.optionHeader}>
            <View
              style={[
                styles.optionIconContainer,
                selectedType === 'partner' && styles.optionIconContainerSelected,
              ]}
            >
              <Ionicons
                name="person"
                size={32}
                color={selectedType === 'partner' ? '#FFFFFF' : '#8B5CF6'}
              />
            </View>
            <View style={styles.optionContent}>
              <Text
                style={[
                  styles.optionTitle,
                  selectedType === 'partner' && styles.optionTitleSelected,
                ]}
              >
                Livreur Partenaire Indépendant
              </Text>
              <Text style={styles.optionSubtitle}>
                Je suis un livreur indépendant
              </Text>
            </View>
            {selectedType === 'partner' && (
              <View style={styles.checkIcon}>
                <Ionicons name="checkmark-circle" size={28} color="#10B981" />
              </View>
            )}
          </View>

          <View style={styles.optionDetails}>
            <View style={styles.detailItem}>
              <Ionicons name="checkmark-circle" size={16} color="#10B981" />
              <Text style={styles.detailText}>
                Commission prépayée (10 000 FCFA minimum)
              </Text>
            </View>
            <View style={styles.detailItem}>
              <Ionicons name="checkmark-circle" size={16} color="#10B981" />
              <Text style={styles.detailText}>
                Commission : 10% à 20% par livraison
              </Text>
            </View>
            <View style={styles.detailItem}>
              <Ionicons name="checkmark-circle" size={16} color="#10B981" />
              <Text style={styles.detailText}>
                Flexibilité horaire totale
              </Text>
            </View>
            <View style={styles.detailItem}>
              <Ionicons name="checkmark-circle" size={16} color="#10B981" />
              <Text style={styles.detailText}>
                Vous utilisez votre propre véhicule
              </Text>
            </View>
          </View>
        </TouchableOpacity>

        {/* Option 2 : Livreur Interne Chrono */}
        <TouchableOpacity
          style={[
            styles.optionCard,
            selectedType === 'internal' && styles.optionCardSelected,
          ]}
          onPress={() => setSelectedType('internal')}
          activeOpacity={0.7}
        >
          <View style={styles.optionHeader}>
            <View
              style={[
                styles.optionIconContainer,
                selectedType === 'internal' && styles.optionIconContainerSelected,
                !selectedType && styles.optionIconContainerDefault,
              ]}
            >
              <Ionicons
                name="business"
                size={32}
                color={selectedType === 'internal' ? '#FFFFFF' : '#8B5CF6'}
              />
            </View>
            <View style={styles.optionContent}>
              <Text
                style={[
                  styles.optionTitle,
                  selectedType === 'internal' && styles.optionTitleSelected,
                ]}
              >
                Livreur Interne Chrono
              </Text>
              <Text style={styles.optionSubtitle}>
                Livreur affilié à Chrono Livraison
              </Text>
            </View>
            {selectedType === 'internal' && (
              <View style={styles.checkIcon}>
                <Ionicons name="checkmark-circle" size={28} color="#10B981" />
              </View>
            )}
          </View>

          <View style={styles.optionDetails}>
            <View style={styles.detailItem}>
              <Ionicons name="checkmark-circle" size={16} color="#10B981" />
              <Text style={styles.detailText}>
                Pas de commission prépayée
              </Text>
            </View>
            <View style={styles.detailItem}>
              <Ionicons name="checkmark-circle" size={16} color="#10B981" />
              <Text style={styles.detailText}>
                Priorité sur les commandes B2B et planifiées
              </Text>
            </View>
            <View style={styles.detailItem}>
              <Ionicons name="checkmark-circle" size={16} color="#10B981" />
              <Text style={styles.detailText}>
                Rémunération : salaire fixe ou à la course
              </Text>
            </View>
            <View style={styles.detailItem}>
              <Ionicons name="checkmark-circle" size={16} color="#10B981" />
              <Text style={styles.detailText}>
                Formation et suivi régulier
              </Text>
            </View>
          </View>
        </TouchableOpacity>

        {/* Bouton Continuer */}
        <TouchableOpacity
          style={[
            styles.continueButton,
            (!selectedType || isLoading) && styles.continueButtonDisabled,
          ]}
          onPress={handleContinue}
          disabled={!selectedType || isLoading}
        >
          <Text style={styles.continueButtonText}>
            {isLoading ? 'Mise à jour...' : 'Continuer'}
          </Text>
          {!isLoading && (
            <Ionicons name="arrow-forward" size={20} color="#FFFFFF" style={styles.continueButtonIcon} />
          )}
        </TouchableOpacity>

        <View style={styles.infoBox}>
          <Ionicons name="information-circle" size={20} color="#6B7280" />
          <Text style={styles.infoText}>
            Vous pourrez compléter votre profil après avoir choisi votre type de livreur.
          </Text>
        </View>
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
  optionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    shadowColor: '#000000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  optionCardSelected: {
    borderColor: '#8B5CF6',
    backgroundColor: '#F9FAFB',
  },
  optionCardDisabled: {
    opacity: 0.6,
    borderColor: '#E5E7EB',
  },
  optionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  optionIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#F3F0FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  optionIconContainerSelected: {
    backgroundColor: '#8B5CF6',
  },
  optionIconContainerDisabled: {
    backgroundColor: '#F3F4F6',
  },
  optionIconContainerDefault: {
    backgroundColor: '#F3F0FF',
  },
  optionContent: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 4,
  },
  optionTitleSelected: {
    color: '#8B5CF6',
  },
  optionTitleDisabled: {
    color: '#9CA3AF',
  },
  optionSubtitle: {
    fontSize: 14,
    color: '#6B7280',
  },
  optionSubtitleDisabled: {
    color: '#9CA3AF',
  },
  checkIcon: {
    marginLeft: 8,
  },
  badgeContainer: {
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
  },
  optionDetails: {
    gap: 12,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  detailText: {
    fontSize: 14,
    color: '#374151',
    flex: 1,
    lineHeight: 20,
  },
  detailTextDisabled: {
    fontSize: 14,
    color: '#9CA3AF',
    flex: 1,
    lineHeight: 20,
  },
  continueButton: {
    backgroundColor: '#8B5CF6',
    borderRadius: 25,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
    shadowColor: '#8B5CF6',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  continueButtonDisabled: {
    opacity: 0.5,
  },
  continueButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginRight: 8,
  },
  continueButtonIcon: {
    marginLeft: 4,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    marginTop: 24,
    gap: 12,
  },
  infoText: {
    fontSize: 14,
    color: '#6B7280',
    flex: 1,
    lineHeight: 20,
  },
});

