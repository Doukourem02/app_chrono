import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../store/useAuthStore';
import { registerAsPartner } from '../../services/partnerApi';

type Step = 'question' | 'company';

export default function BusinessOnboardingScreen() {
  const insets = useSafeAreaInsets();
  const { user, setUser } = useAuthStore();
  const [step, setStep] = useState<Step>('question');
  const [companyName, setCompanyName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  const isUpdate = mode === 'update';

  const next = (path: '/(tabs)' | '/(auth)/success') => {
    router.replace((isUpdate ? '/(tabs)' : path) as any);
  };

  const handleNo = () => {
    if (user) {
      setUser({ ...user, is_business: false });
    }
    next('/(auth)/success');
  };

  const handleYes = () => {
    setStep('company');
  };

  const handleActivateBusiness = async () => {
    const name = companyName.trim();
    if (name.length < 1) return;

    setIsLoading(true);

    try {
      const result = await registerAsPartner(name);
      if (user) {
        setUser({
          ...user,
          is_business: true,
          company_name: name,
          partner_id: result.partner_id,
        });
      }
    } catch {
      // En cas d'erreur réseau, on enregistre quand même localement
      if (user) {
        setUser({ ...user, is_business: true, company_name: name, partner_id: user.partner_id ?? null });
      }
    }

    setIsLoading(false);
    next('/(auth)/success');
  };

  if (step === 'company') {
    return (
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={[styles.inner, { paddingTop: insets.top + 24 }]}>
          <TouchableOpacity onPress={() => setStep('question')} style={styles.back}>
            <Ionicons name="arrow-back" size={22} color="#8B5CF6" />
          </TouchableOpacity>

          <Text style={styles.wordmark}>Krono</Text>

          <View style={styles.iconCircle}>
            <Ionicons name="business-outline" size={36} color="#8B5CF6" />
          </View>

          <Text style={styles.headline}>Nom de votre entreprise</Text>
          <Text style={styles.subline}>
            Ce nom sera visible sur vos commandes et factures.
          </Text>

          <Text style={styles.label}>{"Nom de l'entreprise"}</Text>
          <TextInput
            style={styles.input}
            value={companyName}
            onChangeText={setCompanyName}
            placeholder="Ex: Acme Express, BnB Shop…"
            placeholderTextColor="#9CA3AF"
            autoCapitalize="words"
            autoCorrect={false}
            editable={!isLoading}
            autoFocus
          />

          <TouchableOpacity
            style={[styles.cta, (!companyName.trim() || isLoading) && styles.ctaDisabled]}
            onPress={handleActivateBusiness}
            disabled={!companyName.trim() || isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.ctaText}>Activer le mode business</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    );
  }

  return (
    <View
      style={[
        styles.container,
        { paddingTop: insets.top + 40, paddingBottom: Math.max(insets.bottom, 16) + 8 },
      ]}
    >
      <View style={[styles.inner, styles.questionInner]}>
        <View style={styles.questionBody}>
          <Text style={styles.wordmark}>Krono</Text>

          <View style={styles.iconCircle}>
            <Ionicons name="cube-outline" size={40} color="#8B5CF6" />
          </View>

          <Text style={styles.headline}>
            {isUpdate ? 'Comment utilisez-vous Krono ?' : 'Tu vends des colis à des clients ?'}
          </Text>
          <Text style={styles.subline}>
            {isUpdate
              ? 'Dites-nous comment vous utilisez l\'app pour personnaliser votre expérience.'
              : 'Si tu es e-commerce, boutique ou professionnel, active le mode business pour gérer tes livraisons en lot et bénéficier de tarifs partenaires.'}
          </Text>

          {/* Oui */}
          <TouchableOpacity style={styles.optionCard} onPress={handleYes}>
            <View style={styles.optionIcon}>
              <Ionicons name="storefront-outline" size={26} color="#8B5CF6" />
            </View>
            <View style={styles.optionTextCol}>
              <Text style={styles.optionTitle}>
                {isUpdate ? 'Oui, activité professionnelle' : 'Oui, pour mon activité pro'}
              </Text>
              <Text style={styles.optionSub}>
                {isUpdate
                  ? 'Commerce physique ou en ligne, livraisons pour vos clients…'
                  : 'Boutique, site web, resto : tu livres pour des clients…'}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#9CA3AF" style={styles.optionChevron} />
          </TouchableOpacity>

          {/* Non */}
          <TouchableOpacity style={[styles.optionCard, styles.optionCardMuted]} onPress={handleNo}>
            <View style={[styles.optionIcon, styles.optionIconMuted]}>
              <Ionicons name="person-outline" size={26} color="#6B7280" />
            </View>
            <View style={styles.optionTextCol}>
              <Text style={styles.optionTitle}>
                {isUpdate ? 'Non, usage personnel' : 'Non, pour un usage perso'}
              </Text>
              <Text style={styles.optionSub}>
                {isUpdate
                  ? 'Colis pour vous ou votre entourage, sans clientèle commerciale.'
                  : 'Colis pour toi ou ton entourage, pas pour des clients.'}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#9CA3AF" style={styles.optionChevron} />
          </TouchableOpacity>
        </View>

        <Text style={styles.hint}>
          {isUpdate
            ? 'Vous pouvez changer ce paramètre à tout moment depuis votre profil.'
            : 'Tu pourras activer ou désactiver le mode business à tout moment depuis ton profil.'}
        </Text>
      </View>
    </View>
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
  questionInner: {
    flex: 1,
    justifyContent: 'space-between',
  },
  questionBody: {
    width: '100%',
  },
  back: {
    marginBottom: 12,
  },
  wordmark: {
    fontSize: 28,
    fontWeight: '800',
    fontStyle: 'italic',
    color: '#8B5CF6',
    textAlign: 'center',
    letterSpacing: 0.5,
    marginBottom: 24,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#F5E8FF',
    alignSelf: 'center',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
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
    marginBottom: 32,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 16,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#8B5CF6',
    backgroundColor: '#FAFAFA',
    marginBottom: 14,
  },
  optionCardMuted: {
    borderColor: '#E5E7EB',
  },
  optionIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#F5E8FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  optionIconMuted: {
    backgroundColor: '#F3F4F6',
  },
  optionTextCol: {
    flex: 1,
    minWidth: 0,
  },
  optionChevron: {
    alignSelf: 'center',
  },
  optionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 2,
  },
  optionSub: {
    fontSize: 13,
    color: '#6B7280',
  },
  hint: {
    fontSize: 12,
    color: '#9CA3AF',
    textAlign: 'center',
    lineHeight: 18,
    paddingTop: 16,
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
    marginBottom: 24,
  },
  cta: {
    backgroundColor: '#8B5CF6',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  ctaDisabled: {
    opacity: 0.45,
  },
  ctaText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '600',
  },
});
