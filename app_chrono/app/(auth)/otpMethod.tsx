import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTempAuthStore } from '../../store/useTempAuthStore';

export default function OTPMethodScreen() {
  const [selectedMethod, setSelectedMethod] = useState<'email' | 'sms'>('email');
  const [isLoading, setIsLoading] = useState(false);
  const { email, phoneNumber, setTempData } = useTempAuthStore();

  const handleContinue = async () => {
    if (!email || !phoneNumber) {
      Alert.alert('Erreur', 'Données manquantes. Veuillez recommencer l\'inscription.');
      router.back();
      return;
    }

    setIsLoading(true);

    try {
      // Appeler l'API backend pour envoyer l'OTP
      const response = await fetch(`${process.env.EXPO_PUBLIC_API_URL}/api/auth-simple/send-otp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          phone: phoneNumber,
          email: email,
          otpMethod: selectedMethod,
          role: 'client', // Toujours client pour cette app
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erreur lors de l\'envoi de l\'OTP');
      }

      console.log('OTP envoyé avec succès:', data);
      
      // Sauvegarder la méthode choisie pour la vérification
      setTempData(email, phoneNumber, selectedMethod, 'client');
      
      // Naviguer vers l'écran de vérification
      router.push('./verification' as any);
    } catch (error) {
      console.error('Erreur lors de l\'envoi OTP:', error);
      Alert.alert('Erreur', (error as Error).message || 'Une erreur est survenue. Veuillez réessayer.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoBack = () => {
    router.back();
  };

  return (
    <View style={styles.container}>
      {/* Header avec bouton retour */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleGoBack} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#1F2937" />
        </TouchableOpacity>
      </View>

      {/* Contenu */}
      <View style={styles.contentContainer}>
        <Text style={styles.title}>Choisissez la méthode de vérification</Text>
        <Text style={styles.subtitle}>
          Comment souhaitez-vous recevoir votre code de vérification ?
        </Text>

        {/* Options de méthode */}
        <View style={styles.methodsContainer}>
          {/* Email Option */}
          <TouchableOpacity
            style={[
              styles.methodOption,
              selectedMethod === 'email' && styles.methodOptionSelected
            ]}
            onPress={() => setSelectedMethod('email')}
          >
            <View style={styles.methodHeader}>
              <View style={styles.methodIconContainer}>
                <Ionicons name="mail" size={24} color={selectedMethod === 'email' ? '#8B7CF6' : '#6B7280'} />
              </View>
              <View style={styles.methodInfo}>
                <Text style={[
                  styles.methodTitle,
                  selectedMethod === 'email' && styles.methodTitleSelected
                ]}>
                  Email
                </Text>
                <Text style={styles.methodSubtitle}>Free • Recommended</Text>
              </View>
              <View style={styles.radioContainer}>
                <View style={[
                  styles.radio,
                  selectedMethod === 'email' && styles.radioSelected
                ]}>
                  {selectedMethod === 'email' && (
                    <View style={styles.radioInner} />
                  )}
                </View>
              </View>
            </View>
            <Text style={styles.methodDescription}>
              We&apos;ll send a 6-digit code to {email}
            </Text>
          </TouchableOpacity>

          {/* SMS Option */}
          <TouchableOpacity
            style={[
              styles.methodOption,
              selectedMethod === 'sms' && styles.methodOptionSelected
            ]}
            onPress={() => setSelectedMethod('sms')}
          >
            <View style={styles.methodHeader}>
              <View style={styles.methodIconContainer}>
                <Ionicons name="chatbubble" size={24} color={selectedMethod === 'sms' ? '#8B7CF6' : '#6B7280'} />
              </View>
              <View style={styles.methodInfo}>
                <Text style={[
                  styles.methodTitle,
                  selectedMethod === 'sms' && styles.methodTitleSelected
                ]}>
                  SMS
                </Text>
                <Text style={styles.methodSubtitle}>Paid • ~€0.06 per SMS</Text>
              </View>
              <View style={styles.radioContainer}>
                <View style={[
                  styles.radio,
                  selectedMethod === 'sms' && styles.radioSelected
                ]}>
                  {selectedMethod === 'sms' && (
                    <View style={styles.radioInner} />
                  )}
                </View>
              </View>
            </View>
            <Text style={styles.methodDescription}>
              We&apos;ll send a 6-digit code to {phoneNumber}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Continue Button */}
        <TouchableOpacity 
          style={[styles.continueButton, isLoading && styles.buttonDisabled]}
          onPress={handleContinue}
          disabled={isLoading}
        >
          <Text style={styles.continueButtonText}>
            {isLoading ? 'Sending...' : `Send Code via ${selectedMethod === 'email' ? 'Email' : 'SMS'}`}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    paddingTop: 60,
    paddingHorizontal: 24,
    paddingBottom: 20,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F9FAFB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  contentContainer: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1F2937',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 40,
  },
  methodsContainer: {
    gap: 16,
    marginBottom: 40,
  },
  methodOption: {
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    padding: 20,
    borderWidth: 2,
    borderColor: '#E5E7EB',
  },
  methodOptionSelected: {
    backgroundColor: '#F3F0FF',
    borderColor: '#8B7CF6',
  },
  methodHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  methodIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  methodInfo: {
    flex: 1,
  },
  methodTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 2,
  },
  methodTitleSelected: {
    color: '#8B7CF6',
  },
  methodSubtitle: {
    fontSize: 14,
    color: '#6B7280',
  },
  radioContainer: {
    marginLeft: 12,
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioSelected: {
    borderColor: '#8B7CF6',
  },
  radioInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#8B7CF6',
  },
  methodDescription: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
  },
  continueButton: {
    backgroundColor: '#8B7CF6',
    borderRadius: 25,
    paddingVertical: 16,
    alignItems: 'center',
    shadowColor: '#8B7CF6',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  continueButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});