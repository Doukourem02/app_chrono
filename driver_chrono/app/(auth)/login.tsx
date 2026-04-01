import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTempDriverStore } from '../../store/useTempDriverStore';
import { config } from '../../config/index';
import { logger } from '../../utils/logger';
import { showUserFriendlyError } from '../../utils/errorFormatter';
import { toE164CI } from '../../utils/e164Phone';
import { getPhoneValidationError } from '../../utils/phoneValidation';

export default function Login() {
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const setTempData = useTempDriverStore((state) => state.setTempData);

  const handleSendOTP = async () => {
    const phoneError = getPhoneValidationError(phone);
    if (phoneError) {
      Alert.alert('Numéro invalide', phoneError);
      return;
    }
    const phoneE164 = toE164CI(phone);
    if (!phoneE164) {
      Alert.alert('Numéro invalide', 'Format attendu : +2250504343424');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`${config.apiUrl}/api/auth-simple/send-otp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          phone: phoneE164,
          otpMethod: 'sms',
          role: 'driver',
        }),
      });

      let data;
      try {
        data = await response.json();
      } catch {
        // Si la réponse n'est pas du JSON valide, c'est probablement une erreur serveur
        throw new Error(`Erreur serveur (${response.status}). Le backend est peut-être inaccessible.`);
      }

      if (!response.ok) {
        throw new Error(data.error || data.message || 'Erreur lors de l\'envoi de l\'OTP');
      }

      setTempData('', phoneE164, 'sms');
      router.push('/(auth)/verification' as any);
      
    } catch (error) {
      // Logger l'erreur technique (pour les développeurs, pas visible à l'utilisateur)
      logger.error('Erreur lors de l\'envoi OTP:', undefined, error);
      
      // Afficher un message user-friendly (jamais les détails techniques)
      showUserFriendlyError(error, 'envoi du code OTP', () => {
        handleSendOTP();
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.header}>
        <View style={styles.iconContainer}>
          <Ionicons name="car-sport" size={40} color="#8B5CF6" />
        </View>
        <Text style={styles.title}>Connexion Chauffeur</Text>
        <Text style={styles.subtitle}>Entrez votre numéro pour recevoir un code par SMS</Text>
      </View>

      <View style={styles.form}>
        <View style={styles.inputContainer}>
          <Ionicons name="call" size={20} color="#666" style={styles.inputIcon} />
          <TextInput
            style={styles.input}
            placeholder="+2250504343424"
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            placeholderTextColor="#999"
          />
        </View>

        <TouchableOpacity
          style={[styles.loginButton, loading && styles.loginButtonDisabled]}
          onPress={handleSendOTP}
          disabled={loading}
        >
          <Text style={styles.loginButtonText}>
            {loading ? 'Envoi...' : 'Envoyer le code OTP'}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.footer}>
        <Text style={styles.registerText}>Nouveau chauffeur ?</Text>
        <TouchableOpacity onPress={() => router.push('/(auth)/register' as any)}>
          <Text style={styles.registerLink}>S&apos;inscrire</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    alignItems: 'center',
    marginBottom: 30,
    marginTop: 100,
    paddingHorizontal: 20,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  form: {
    paddingHorizontal: 20,
    marginBottom: 30,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 16,
    paddingHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    height: 50,
    fontSize: 16,
    color: '#333',
  },
  loginButton: {
    backgroundColor: '#8B5CF6',
    borderRadius: 12,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },
  loginButtonDisabled: {
    opacity: 0.6,
  },
  loginButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  registerText: {
    color: '#666',
    fontSize: 14,
  },
  registerLink: {
    color: '#8B5CF6',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 4,
  },
});