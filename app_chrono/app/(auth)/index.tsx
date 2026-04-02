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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTempAuthStore } from '../../store/useTempAuthStore';
import { toE164CI } from '../../utils/e164Phone';
import { getPhoneValidationError } from '../../utils/phoneValidation';
import { formatNationalIvorian, parseNationalIvorianInput } from '../../utils/formatNationalPhone';
import { logger } from '../../utils/logger';

/**
 * Entrée unique par téléphone (OTP) : pas de « login » vs « inscription » côté UI —
 * le backend rattache un compte existant ou en crée un après validation du code.
 */
export default function PhoneAuthScreen() {
  const insets = useSafeAreaInsets();
  const [nationalDigits, setNationalDigits] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const setTempData = useTempAuthStore((state) => state.setTempData);

  const displayValue = formatNationalIvorian(nationalDigits);
  const fullPhone = nationalDigits.length === 10 ? `+225${nationalDigits}` : '';
  const canSubmit =
    nationalDigits.length === 10 && !getPhoneValidationError(fullPhone) && !!toE164CI(fullPhone);

  const onChangeNational = (text: string) => {
    setNationalDigits(parseNationalIvorianInput(text));
  };

  const handleContinue = async () => {
    const phoneE164 = toE164CI(fullPhone);
    const err = getPhoneValidationError(fullPhone);
    if (!phoneE164 || err) {
      Alert.alert('Numéro invalide', 'Vérifiez votre numéro.');
      return;
    }

    setIsLoading(true);
    const TIMEOUT_MS = 30000;

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
        router.push('/(auth)/verification' as any);
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
      const msg = error?.message || 'Impossible d’envoyer le code SMS.';
      if (msg.includes('trop de temps')) {
        logger.warn('Envoi OTP : délai dépassé (vérifier que le backend est joignable depuis l’appareil / EXPO_PUBLIC_API_URL).', 'PhoneAuth', msg);
      } else {
        logger.error('Erreur envoi OTP', 'PhoneAuth', error);
      }
      Alert.alert('Erreur', msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={[styles.inner, { paddingTop: insets.top + 24 }]}>
        <Text style={styles.wordmark}>Krono</Text>

        <Text
          style={styles.headline}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.72}
        >
          Entrez votre numéro de téléphone
        </Text>
        <Text style={styles.subline}>Nous vous enverrons un code de confirmation.</Text>

        <View style={styles.fieldRow}>
          <Text style={styles.flag} accessibilityLabel="Côte d&apos;Ivoire">
            🇨🇮
          </Text>
          <Text style={styles.prefix}>+225</Text>
          <TextInput
            style={styles.input}
            value={displayValue}
            onChangeText={onChangeNational}
            placeholder="00 00 0 00000"
            placeholderTextColor="#9CA3AF"
            keyboardType="phone-pad"
            autoComplete="tel-national"
            textContentType="telephoneNumber"
            maxLength={14}
          />
          {nationalDigits.length > 0 ? (
            <TouchableOpacity
              onPress={() => setNationalDigits('')}
              hitSlop={12}
              accessibilityLabel="Effacer"
            >
              <Ionicons name="close-circle" size={22} color="#9CA3AF" />
            </TouchableOpacity>
          ) : null}
        </View>

        <TouchableOpacity
          style={[styles.cta, (!canSubmit || isLoading) && styles.ctaDisabled]}
          onPress={handleContinue}
          disabled={!canSubmit || isLoading}
        >
          <Text style={styles.ctaText}>{isLoading ? 'Envoi...' : 'Continuer'}</Text>
        </TouchableOpacity>
      </View>

      <View style={[styles.legal, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        <Text style={styles.legalText}>
          En continuant, vous acceptez les{' '}
          <Text
            style={styles.legalLink}
            onPress={() => Alert.alert('Conditions', 'Lien à configurer (URL des CGU).')}
          >
            conditions d&apos;utilisation
          </Text>{' '}
          et la{' '}
          <Text
            style={styles.legalLink}
            onPress={() => Alert.alert('Confidentialité', 'Lien à configurer (politique de confidentialité).')}
          >
            politique de confidentialité
          </Text>
          .
        </Text>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  inner: {
    flex: 1,
    paddingHorizontal: 24,
  },
  wordmark: {
    fontSize: 28,
    fontWeight: '800',
    fontStyle: 'italic',
    color: '#8B5CF6',
    textAlign: 'center',
    letterSpacing: 0.5,
    marginBottom: 40,
  },
  headline: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 10,
    width: '100%',
  },
  subline: {
    fontSize: 15,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 28,
  },
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 14,
    gap: 8,
  },
  flag: {
    fontSize: 26,
  },
  prefix: {
    fontSize: 17,
    fontWeight: '600',
    color: '#111827',
  },
  input: {
    flex: 1,
    fontSize: 17,
    color: '#111827',
    paddingVertical: 0,
  },
  cta: {
    backgroundColor: '#8B7CF6',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 24,
  },
  ctaDisabled: {
    opacity: 0.45,
  },
  ctaText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '600',
  },
  legal: {
    paddingHorizontal: 20,
  },
  legalText: {
    fontSize: 11,
    color: '#9CA3AF',
    textAlign: 'center',
    lineHeight: 16,
  },
  legalLink: {
    color: '#0D9488',
    textDecorationLine: 'underline',
    fontSize: 11,
  },
});
