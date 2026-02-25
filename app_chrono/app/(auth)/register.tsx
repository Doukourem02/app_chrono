import React, { useState } from 'react';
import {View,Text,TextInput,TouchableOpacity,StyleSheet,KeyboardAvoidingView,Platform,Alert} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTempAuthStore } from '../../store/useTempAuthStore';
import { getPhoneValidationError } from '../../utils/phoneValidation';

export default function RegisterScreen() {
  const [email, setEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const setTempData = useTempAuthStore((state) => state.setTempData);

  const handleContinue = async () => {
    if (!email || !phoneNumber) {
      Alert.alert('Erreur', 'Veuillez remplir tous les champs');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      Alert.alert('Erreur', 'Veuillez entrer un email valide');
      return;
    }

  
    const phoneError = getPhoneValidationError(phoneNumber);
    if (phoneError) {
      Alert.alert('Numéro invalide', phoneError);
      return;
    }

    setIsLoading(true);

    setTempData(email, phoneNumber);
    
  
    router.push('./otpMethod' as any);
    setIsLoading(false);
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
    
      <View style={styles.illustrationContainer}>
        <View style={styles.illustrationPlaceholder}>
          <Ionicons name="mail-outline" size={80} color="#8B7CF6" />
        </View>
      </View>

      <View style={styles.contentContainer}>
        <Text style={styles.title}>Email OTP Verification</Text>
        <Text style={styles.subtitle}>
          Enter your email and phone number. We&apos;ll send a verification code to your email address.
        </Text>

        <View style={styles.formContainer}>
      
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              placeholder="Email"
              placeholderTextColor="#9CA3AF"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Ionicons name="mail-outline" size={20} color="#8B7CF6" style={styles.inputIcon} />
          </View>

        
          <View style={styles.inputContainer}>
            <Text style={styles.phoneLabel}>Phone Number</Text>
            <TextInput
              style={[styles.input, styles.phoneInput]}
              placeholder="+225 0778733971"
              placeholderTextColor="#9CA3AF"
              value={phoneNumber}
              onChangeText={setPhoneNumber}
              keyboardType="phone-pad"
            />
          </View>

          
                    <TouchableOpacity 
            style={[styles.continueButton, (!email || !phoneNumber || isLoading) && styles.buttonDisabled]}
            onPress={handleContinue}
            disabled={!email || !phoneNumber || isLoading}
          >
            <Text style={styles.continueButtonText}>
              Continue
            </Text>
          </TouchableOpacity>

          <View style={styles.loginLinkContainer}>
            <Text style={styles.loginLinkText}>Déjà un compte ? </Text>
            <TouchableOpacity onPress={() => router.push('/(auth)/login' as any)}>
              <Text style={styles.loginLink}>Recevoir un code</Text>
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
  inputIcon: {
    position: 'absolute',
    right: 16,
    top: 16,
  },
  continueButton: {
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