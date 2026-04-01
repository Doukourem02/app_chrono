import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTempAuthStore } from '../../store/useTempAuthStore';
import { toE164CI } from '../../utils/e164Phone';
import { getPhoneValidationError } from '../../utils/phoneValidation';
import { logger } from '../../utils/logger';

export default function RegisterScreen() {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const setTempData = useTempAuthStore((state) => state.setTempData);

  const handleContinue = async () => {
    const phoneError = getPhoneValidationError(phoneNumber);
    if (phoneError) {
      Alert.alert('Numéro invalide', phoneError);
      return;
    }
    const phoneE164 = toE164CI(phoneNumber);
    if (!phoneE164) {
      Alert.alert('Numéro invalide', 'Format attendu : +2250504343424');
      return;
    }

    setIsLoading(true);
    const TIMEOUT_MS = 15000;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

      try {
        const response = await fetch(
          `${process.env.EXPO_PUBLIC_API_URL}/api/auth-simple/send-otp`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              phone: phoneE164,
              otpMethod: 'sms',
              role: 'client',
            }),
            signal: controller.signal,
          }
        );

        clearTimeout(timeoutId);

        const data = await response.json();
        if (!response.ok) {
          throw new Error(
            (data.errors && data.errors[0]) || data.message || data.error || 'Erreur envoi OTP'
          );
        }

        setTempData('', phoneE164, 'sms', 'client');
        router.push('./verification' as any);
      } catch (fetchError: any) {
        clearTimeout(timeoutId);
        if (fetchError.name === 'AbortError' || controller.signal.aborted) {
          throw new Error(
            'La requête a pris trop de temps. Vérifiez votre connexion internet et réessayez.'
          );
        }
        throw fetchError;
      }
    } catch (error: any) {
      logger.error('Erreur envoi OTP inscription:', error);
      Alert.alert('Erreur', error?.message || 'Impossible d’envoyer le code SMS.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.illustrationContainer}>
        <View style={styles.illustrationPlaceholder}>
          <Ionicons name="phone-portrait-outline" size={80} color="#8B7CF6" />
        </View>
      </View>

      <View style={styles.contentContainer}>
        <Text style={styles.title}>Inscription</Text>
        <Text style={styles.subtitle}>
          Numéro mobile CI (01, 05 ou 07), au format +2250504343424 ou 0504343424.
        </Text>

        <View style={styles.formContainer}>
          <View style={styles.inputContainer}>
            <Text style={styles.phoneLabel}>Téléphone</Text>
            <TextInput
              style={[styles.input, styles.phoneInput]}
              placeholder="+2250504343424"
              placeholderTextColor="#9CA3AF"
              value={phoneNumber}
              onChangeText={setPhoneNumber}
              keyboardType="phone-pad"
            />
          </View>

          <TouchableOpacity
            style={[styles.continueButton, (!phoneNumber || isLoading) && styles.buttonDisabled]}
            onPress={handleContinue}
            disabled={!phoneNumber || isLoading}
          >
            <Text style={styles.continueButtonText}>
              {isLoading ? 'Envoi...' : 'Recevoir le code'}
            </Text>
          </TouchableOpacity>

          <View style={styles.loginLinkContainer}>
            <Text style={styles.loginLinkText}>Déjà un compte ? </Text>
            <TouchableOpacity onPress={() => router.push('/(auth)/login' as any)}>
              <Text style={styles.loginLink}>Se connecter</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  illustrationContainer: {
    flex: 0.4,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 60,
  },
  illustrationPlaceholder: {
    width: 200,
    height: 150,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 20,
  },
  contentContainer: {
    flex: 0.6,
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
  formContainer: {
    gap: 20,
  },
  inputContainer: {
    position: 'relative',
  },
  phoneLabel: {
    fontSize: 14,
    color: '#8B7CF6',
    marginBottom: 8,
    fontWeight: '500',
  },
  input: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 20,
    fontSize: 16,
    color: '#1F2937',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  phoneInput: {
    paddingLeft: 20,
  },
  continueButton: {
    backgroundColor: '#8B7CF6',
    borderRadius: 25,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 20,
    shadowColor: '#8B7CF6',
    shadowOffset: { width: 0, height: 4 },
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
  loginLinkContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
  },
  loginLinkText: {
    fontSize: 14,
    color: '#6B7280',
  },
  loginLink: {
    fontSize: 14,
    color: '#8B7CF6',
    fontWeight: '600',
  },
});
