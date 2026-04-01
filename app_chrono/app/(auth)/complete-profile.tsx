import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '../../store/useAuthStore';
import { userApiService } from '../../services/userApiService';
import { logger } from '../../utils/logger';

export default function CompleteProfileScreen() {
  const insets = useSafeAreaInsets();
  const { user, setUser } = useAuthStore();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!user?.id) {
      router.replace('/(auth)' as any);
    }
  }, [user?.id]);

  const handleContinue = async () => {
    const fn = firstName.trim();
    const ln = lastName.trim();
    if (fn.length < 1 || ln.length < 1) {
      Alert.alert(
        'Champs requis',
        'Veuillez renseigner votre prénom et votre nom.'
      );
      return;
    }

    if (!user?.id) return;

    setIsLoading(true);
    try {
      const result = await userApiService.updateProfile(user.id, {
        first_name: fn,
        last_name: ln,
      });

      if (!result.success || !result.data) {
        throw new Error(result.message || 'Impossible d’enregistrer le profil');
      }

      setUser({
        ...user,
        first_name: result.data.first_name,
        last_name: result.data.last_name,
        phone: result.data.phone || user.phone,
      });

      router.replace('/(auth)/success' as any);
    } catch (error: any) {
      logger.error('Erreur complete-profile', 'CompleteProfile', error);
      Alert.alert(
        'Erreur',
        error?.message || 'Une erreur est survenue. Réessayez.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  if (!user?.id) {
    return null;
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={[styles.inner, { paddingTop: insets.top + 24 }]}>
        <Text style={styles.wordmark}>Krono</Text>

        <Text style={styles.headline}>Comment vous appeler ?</Text>
        <Text style={styles.subline}>
          Renseignez votre prénom et votre nom pour personnaliser votre profil.
        </Text>

        <Text style={styles.label}>Prénom</Text>
        <TextInput
          style={styles.input}
          value={firstName}
          onChangeText={setFirstName}
          placeholder="Votre prénom"
          placeholderTextColor="#9CA3AF"
          autoCapitalize="words"
          autoCorrect={false}
          textContentType="givenName"
          editable={!isLoading}
        />

        <Text style={styles.label}>Nom</Text>
        <TextInput
          style={styles.input}
          value={lastName}
          onChangeText={setLastName}
          placeholder="Votre nom"
          placeholderTextColor="#9CA3AF"
          autoCapitalize="words"
          autoCorrect={false}
          textContentType="familyName"
          editable={!isLoading}
        />

        <TouchableOpacity
          style={[styles.cta, isLoading && styles.ctaDisabled]}
          onPress={handleContinue}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.ctaText}>Continuer</Text>
          )}
        </TouchableOpacity>
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
    color: '#8B7CF6',
    textAlign: 'center',
    letterSpacing: 1,
    marginBottom: 32,
  },
  headline: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 10,
  },
  subline: {
    fontSize: 15,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 28,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#F3F4F6',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    fontSize: 17,
    color: '#111827',
    marginBottom: 18,
  },
  cta: {
    backgroundColor: '#8B7CF6',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  ctaDisabled: {
    opacity: 0.6,
  },
  ctaText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '600',
  },
});
