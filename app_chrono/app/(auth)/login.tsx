import React, { useState } from 'react';
import {View,Text,TextInput,StyleSheet,Alert} from 'react-native';
import { router } from 'expo-router';
import { useTempAuthStore } from '../../store/useTempAuthStore';
import { AnimatedButton, ScreenTransition } from '../../components/animations';
import { logger } from '../../utils/logger';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const setTempData = useTempAuthStore((state) => state.setTempData);

  const handleSendOTP = async () => {
    if (!email || !phone) {
      Alert.alert('Erreur', 'Veuillez entrer votre email et téléphone');
      return;
    }

    // Validation email basique
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      Alert.alert('Erreur', 'Veuillez entrer un email valide');
      return;
    }

    setIsLoading(true);

    try {
      // Pour un utilisateur existant, envoyer OTP directement
      const response = await fetch(`${process.env.EXPO_PUBLIC_API_URL}/api/auth-simple/send-otp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: email,
          phone: phone,
          otpMethod: 'email',
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erreur lors de l\'envoi de l\'OTP');
      }

      // Sauvegarder temporairement pour la vérification
      setTempData(email, phone, 'email', 'client');
      
      // Naviguer vers la vérification
      router.push('/(auth)/verification' as any);
      
    } catch (error) {
      logger.error('Erreur lors de l\'envoi OTP:', error);
      Alert.alert('Erreur', (error as Error).message || 'Erreur lors de l\'envoi de l\'OTP');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoToRegister = () => {
    router.push('/(auth)/register' as any);
  };

  return (
    <ScreenTransition direction="fade" duration={400}>
      <View style={styles.container}>
        <View style={styles.contentContainer}>
          <Text style={styles.title}>Bon retour !</Text>
          <Text style={styles.subtitle}>
            Entrez votre email pour recevoir un code de vérification
          </Text>

          {/* Email Input */}
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Email</Text>
            <TextInput
              style={styles.input}
              placeholder="votre@email.com"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              placeholderTextColor="#9CA3AF"
            />
          </View>

          {/* Phone Input */}
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Téléphone</Text>
            <TextInput
              style={styles.input}
              placeholder="+225 XX XX XX XX XX"
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              placeholderTextColor="#9CA3AF"
            />
          </View>

          {/* Send OTP Button */}
          <AnimatedButton
            style={[styles.sendButton, isLoading && styles.buttonDisabled]}
            onPress={handleSendOTP}
            disabled={isLoading}
            variant="primary"
          >
            <Text style={styles.sendButtonText}>
              {isLoading ? 'Envoi...' : 'Envoyer le code'}
            </Text>
          </AnimatedButton>

          {/* Divider */}
          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>ou</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Register Link */}
          <AnimatedButton
            style={styles.registerButton}
            onPress={handleGoToRegister}
            variant="outline"
          >
            <Text style={styles.registerButtonText}>Créer un compte</Text>
          </AnimatedButton>
        </View>
      </View>
    </ScreenTransition>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  contentContainer: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 100,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1F2937',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 40,
  },
  inputContainer: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#1F2937',
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
  },
  passwordInput: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#1F2937',
  },
  passwordToggle: {
    paddingHorizontal: 16,
  },
  sendButton: {
    backgroundColor: '#8B7CF6',
    borderRadius: 25,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 20,
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
  sendButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  forgotPassword: {
    alignItems: 'center',
    marginTop: 20,
  },
  forgotPasswordText: {
    fontSize: 14,
    color: '#8B7CF6',
    fontWeight: '500',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 30,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E5E7EB',
  },
  dividerText: {
    marginHorizontal: 16,
    fontSize: 14,
    color: '#6B7280',
  },
  registerButton: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 25,
    paddingVertical: 16,
    alignItems: 'center',
  },
  registerButtonText: {
    color: '#8B7CF6',
    fontSize: 16,
    fontWeight: '600',
  },
});