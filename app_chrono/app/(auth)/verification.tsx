import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../store/useAuthStore';
import { useTempAuthStore } from '../../store/useTempAuthStore';

export default function VerificationScreen() {
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [isLoading, setIsLoading] = useState(false);
  const inputRefs = useRef<(TextInput | null)[]>([]);
  const setUser = useAuthStore((state) => state.setUser);
  const { email, phoneNumber, otpMethod, clearTempData } = useTempAuthStore();

  const handleCodeChange = (text: string, index: number) => {
    const newCode = [...code];
    newCode[index] = text;
    setCode(newCode);

    // Auto-focus next input
    if (text && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyPress = (key: string, index: number) => {
    // Auto-focus previous input on backspace
    if (key === 'Backspace' && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleConfirm = async () => {
    const fullCode = code.join('');
    
    if (fullCode.length !== 6) {
      Alert.alert('Erreur', 'Veuillez entrer le code complet à 6 chiffres');
      return;
    }

    setIsLoading(true);
    
    try {
      // Appeler l'API backend pour vérifier l'OTP (email ou SMS)
      const response = await fetch(`${process.env.EXPO_PUBLIC_API_URL}/api/auth/verify-otp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: email,
          phone: phoneNumber,
          otp: fullCode,
          method: otpMethod,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Code de vérification incorrect');
      }

      console.log(`${otpMethod} OTP vérifié avec succès:`, data);

      // Sauvegarder l'utilisateur dans le store
      const userData = {
        id: data.user.id,
        email: data.user.email,
        phone: data.user.phone,
        isVerified: data.user.isVerified,
      };
      
      setUser(userData);
      
      // Nettoyer les données temporaires
      clearTempData();
      
      // Naviguer vers l'écran de succès
      router.push('./success' as any);
    } catch (error) {
      console.error('Erreur lors de la vérification:', error);
      Alert.alert('Erreur', (error as Error).message || 'Code de vérification incorrect. Veuillez réessayer.');
      setCode(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
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
        <Text style={styles.title}>Verification Code</Text>
        <Text style={styles.subtitle}>
          We have sent the verification code to your {otpMethod === 'email' ? 'email address' : 'phone number'}
        </Text>

        {/* Code Inputs */}
        <View style={styles.codeContainer}>
          {code.map((digit, index) => (
            <TextInput
              key={index}
              ref={(ref) => { inputRefs.current[index] = ref; }}
              style={[
                styles.codeInput,
                digit ? styles.codeInputFilled : styles.codeInputEmpty
              ]}
              value={digit}
              onChangeText={(text) => handleCodeChange(text.slice(-1), index)}
              onKeyPress={({ nativeEvent }) => handleKeyPress(nativeEvent.key, index)}
              keyboardType="numeric"
              maxLength={1}
              selectTextOnFocus
            />
          ))}
        </View>

        {/* Confirm Button */}
        <TouchableOpacity 
          style={[styles.confirmButton, isLoading && styles.buttonDisabled]}
          onPress={handleConfirm}
          disabled={isLoading}
        >
          <Text style={styles.confirmButtonText}>
            {isLoading ? 'Vérification...' : 'Confirm'}
          </Text>
        </TouchableOpacity>

        {/* Resend Code */}
        <View style={styles.resendContainer}>
          <Text style={styles.resendText}>Vous n&apos;avez pas reçu le code ? </Text>
          <TouchableOpacity>
            <Text style={styles.resendLink}>Renvoyer</Text>
          </TouchableOpacity>
        </View>
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
    paddingTop: 40,
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
    marginBottom: 50,
  },
  codeContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 40,
    flexWrap: 'wrap',
  },
  codeInput: {
    width: 45,
    height: 50,
    borderRadius: 12,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
  },
  codeInputEmpty: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  codeInputFilled: {
    backgroundColor: '#F3F0FF',
    borderWidth: 2,
    borderColor: '#8B7CF6',
  },
  confirmButton: {
    backgroundColor: '#8B7CF6',
    borderRadius: 25,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 20,
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
  confirmButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  resendContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  resendText: {
    fontSize: 14,
    color: '#6B7280',
  },
  resendLink: {
    fontSize: 14,
    color: '#8B7CF6',
    fontWeight: '600',
  },
});