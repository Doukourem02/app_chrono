import React, { useState, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useDriverStore } from '../../store/useDriverStore';
import { useTempDriverStore } from '../../store/useTempDriverStore';
import { config } from '../../config/index';
import { logger } from '../../utils/logger';
import { showUserFriendlyError } from '../../utils/errorFormatter';

export default function VerificationScreen() {
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [isLoading, setIsLoading] = useState(false);
  const inputRefs = useRef<(TextInput | null)[]>([]);
  const { setUser, setProfile, setTokens } = useDriverStore();
  const { email, phoneNumber, otpMethod, setIsNewUser } = useTempDriverStore();

  const handleCodeChange = (text: string, index: number) => {
    const newCode = [...code];
    newCode[index] = text;
    setCode(newCode);

    if (text && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyPress = (key: string, index: number) => {
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
      const response = await fetch(`${config.apiUrl}/api/auth-simple/verify-otp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: email,
          phone: phoneNumber,
          otp: fullCode,
          method: otpMethod,
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
        throw new Error(data.error || data.message || 'Code de vérification incorrect');
      }

      logger.debug(`${otpMethod} OTP vérifié avec succès pour driver:`, undefined, data);

      setIsNewUser(data.data.isNewUser || false);

      if (data.data.user) {
        setUser({
          id: data.data.user.id,
          email: data.data.user.email,
          phone: data.data.user.phone,
          role: data.data.user.role,
          created_at: data.data.user.created_at || new Date().toISOString(),
          first_name: data.data.user.first_name || null,
          last_name: data.data.user.last_name || null,
        });
      }

      if (data.data.tokens && data.data.tokens.accessToken && data.data.tokens.refreshToken) {
        setTokens({
          accessToken: data.data.tokens.accessToken,
          refreshToken: data.data.tokens.refreshToken
        });
      }

      // Mettre à jour le profil dans le store (important pour écraser l'ancien profil persisté)
      if (data.data.profile) {
        setProfile(data.data.profile);
      }
      
      // ÉTAPE 1 : TOUS les utilisateurs (nouveaux et existants) doivent d'abord passer par driver-type-selection
      // si leur profil n'a pas de driver_type défini
      const currentProfile = data.data.profile;
      const needsDriverType = !currentProfile || !currentProfile.driver_type;
      
      if (needsDriverType) {
        // Pas de driver_type → TOUJOURS aller à driver-type-selection en premier
        router.push('./driver-type-selection' as any);
        return;
      }
      
      // Si driver_type existe, le profil est considéré comme complété
      // (les informations véhicule sont optionnelles et peuvent être complétées plus tard)
      router.push('./success' as any);
    } catch (error) {
      // Logger l'erreur technique (pour les développeurs, pas visible à l'utilisateur)
      logger.error('Erreur lors de la vérification:', undefined, error);
      
      // Afficher un message user-friendly (jamais les détails techniques)
      showUserFriendlyError(error, 'vérification du code', () => {
        handleConfirm();
      });
      
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
      <View style={styles.header}>
        <TouchableOpacity onPress={handleGoBack} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#1F2937" />
        </TouchableOpacity>
      </View>

      <View style={styles.contentContainer}>
        <Text style={styles.title}>Code de vérification</Text>
        <Text style={styles.subtitle}>
          Nous avons envoyé le code de vérification à votre {otpMethod === 'email' ? 'adresse email' : 'numéro de téléphone'}
        </Text>

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

        <TouchableOpacity 
          style={[styles.confirmButton, isLoading && styles.buttonDisabled]}
          onPress={handleConfirm}
          disabled={isLoading}
        >
          <Text style={styles.confirmButtonText}>
            {isLoading ? 'Vérification...' : 'Confirmer'}
          </Text>
        </TouchableOpacity>

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
    borderColor: '#8B5CF6',
  },
  confirmButton: {
    backgroundColor: '#8B5CF6',
    borderRadius: 25,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: '#8B5CF6',
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
    color: '#8B5CF6',
    fontWeight: '600',
  },
});