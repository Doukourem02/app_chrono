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
  ScrollView,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../store/useAuthStore';
import { registerAsPartner } from '../../services/partnerApi';

type Step = 'question' | 'company' | 'plan';

const PLANS = [
  {
    key: 'starter',
    label: 'Starter',
    price: '15 000 FCFA / mois',
    quota: '50 livraisons incluses',
    inQuota: '3% de commission sur les livraisons incluses',
    excess: '20% sur les livraisons excédentaires',
    icon: 'rocket-outline' as const,
  },
  {
    key: 'pro',
    label: 'Pro',
    price: '40 000 FCFA / mois',
    quota: '200 livraisons incluses',
    inQuota: '3% de commission sur les livraisons incluses',
    excess: '15% sur les livraisons excédentaires',
    icon: 'trending-up-outline' as const,
  },
  {
    key: 'business',
    label: 'Business',
    price: '100 000 FCFA / mois',
    quota: 'Livraisons illimitées',
    inQuota: '0% de commission sur toutes les livraisons',
    excess: '10% sur dépassement de capacité',
    icon: 'business-outline' as const,
  },
];

export default function BusinessOnboardingScreen() {
  const insets = useSafeAreaInsets();
  const { user, setUser } = useAuthStore();
  const [step, setStep] = useState<Step>('question');
  const [companyName, setCompanyName] = useState('');
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [portalEmail, setPortalEmail] = useState(user?.email ?? '');
  const [isLoading, setIsLoading] = useState(false);
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  const isUpdate = mode === 'update';

  const next = (path: '/(tabs)' | '/(auth)/success') => {
    router.replace((isUpdate ? '/(tabs)' : path) as any);
  };

  const handleNo = () => {
    if (user) setUser({ ...user, is_business: false });
    next('/(auth)/success');
  };

  const handleYes = () => setStep('company');

  const handleCompanyNext = () => {
    if (companyName.trim().length < 1) return;
    setStep('plan');
  };

  const handleActivateBusiness = async () => {
    if (!selectedPlan) return;
    setIsLoading(true);
    try {
      const result = await registerAsPartner(companyName.trim(), selectedPlan, portalEmail.trim() || undefined);
      if (user) {
        setUser({
          ...user,
          is_business: true,
          company_name: companyName.trim(),
          partner_id: result.partner_id,
        });
      }
    } catch {
      if (user) {
        setUser({ ...user, is_business: true, company_name: companyName.trim(), partner_id: user.partner_id ?? null });
      }
    }
    setIsLoading(false);
    next('/(auth)/success');
  };

  // ─── Étape : choix de forfait + email portail ─────────────────────────────
  if (step === 'plan') {
    return (
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 16, paddingBottom: Math.max(insets.bottom, 16) + 24 }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <TouchableOpacity onPress={() => setStep('company')} style={styles.back}>
            <Ionicons name="arrow-back" size={22} color="#8B5CF6" />
          </TouchableOpacity>

          <Text style={styles.wordmark}>Krono</Text>

          <Text style={styles.headline}>Choisissez votre forfait</Text>
          <Text style={styles.subline}>
            La commission est prélevée sur vos livraisons selon le forfait souscrit. Vous pouvez changer de forfait à tout moment.
          </Text>

          {/* Cartes de plan */}
          {PLANS.map((plan) => {
            const isSelected = selectedPlan === plan.key;
            return (
              <TouchableOpacity
                key={plan.key}
                style={[styles.planCard, isSelected && styles.planCardSelected]}
                onPress={() => setSelectedPlan(plan.key)}
                activeOpacity={0.8}
              >
                <View style={styles.planHeader}>
                  <View style={[styles.planIconCircle, isSelected && styles.planIconCircleSelected]}>
                    <Ionicons name={plan.icon} size={20} color={isSelected ? '#fff' : '#8B5CF6'} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.planLabel, isSelected && styles.planLabelSelected]}>{plan.label}</Text>
                    <Text style={styles.planPrice}>{plan.price}</Text>
                  </View>
                  {isSelected && <Ionicons name="checkmark-circle" size={22} color="#8B5CF6" />}
                </View>
                <View style={styles.planDetails}>
                  <Text style={styles.planDetail}>• {plan.quota}</Text>
                  <Text style={styles.planDetail}>• {plan.inQuota}</Text>
                  <Text style={[styles.planDetail, styles.planDetailMuted]}>• {plan.excess}</Text>
                </View>
              </TouchableOpacity>
            );
          })}

          {/* Info "comment ça marche" */}
          <View style={styles.infoBox}>
            <Text style={styles.infoTitle}>Comment ça marche ?</Text>
            <Text style={styles.infoStep}>① Vous choisissez votre forfait ici</Text>
            <Text style={styles.infoStep}>② Un admin Krono valide votre demande</Text>
            <Text style={styles.infoStep}>③ Vous recevez un lien d{"'"}accès au portail partenaire</Text>
          </View>

          {/* Email portail */}
          <Text style={styles.label}>Email pour le portail partenaire</Text>
          <Text style={styles.emailHint}>Cet email recevra le lien d{"'"}accès au portail. Vous pouvez utiliser une adresse professionnelle.</Text>
          <TextInput
            style={styles.input}
            value={portalEmail}
            onChangeText={setPortalEmail}
            placeholder="votre@email-pro.com"
            placeholderTextColor="#9CA3AF"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            editable={!isLoading}
          />

          <TouchableOpacity
            style={[styles.cta, (!selectedPlan || isLoading) && styles.ctaDisabled]}
            onPress={handleActivateBusiness}
            disabled={!selectedPlan || isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.ctaText}>Envoyer ma demande</Text>
            )}
          </TouchableOpacity>

          <Text style={styles.hint}>
            Votre demande sera examinée par l{"'"}équipe Krono. Aucune facturation avant activation.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // ─── Étape : nom de l'entreprise ─────────────────────────────────────────
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
            autoFocus
          />

          <TouchableOpacity
            style={[styles.cta, !companyName.trim() && styles.ctaDisabled]}
            onPress={handleCompanyNext}
            disabled={!companyName.trim()}
          >
            <Text style={styles.ctaText}>Continuer</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    );
  }

  // ─── Étape : question pro / perso ─────────────────────────────────────────
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
              ? "Dites-nous comment vous utilisez l'app pour personnaliser votre expérience."
              : 'Si tu es e-commerce, boutique ou professionnel, active le mode business pour gérer tes livraisons en lot et bénéficier de tarifs partenaires.'}
          </Text>

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
  scrollContent: {
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
    marginBottom: 24,
  },
  // Plan cards
  planCard: {
    borderWidth: 2,
    borderColor: '#E5E7EB',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    backgroundColor: '#FAFAFA',
  },
  planCardSelected: {
    borderColor: '#8B5CF6',
    backgroundColor: '#FAF5FF',
  },
  planHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 10,
  },
  planIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#F5E8FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  planIconCircleSelected: {
    backgroundColor: '#8B5CF6',
  },
  planLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  planLabelSelected: {
    color: '#8B5CF6',
  },
  planPrice: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
  },
  planDetails: {
    gap: 4,
  },
  planDetail: {
    fontSize: 13,
    color: '#374151',
    lineHeight: 20,
  },
  planDetailMuted: {
    color: '#9CA3AF',
  },
  // Info box
  infoBox: {
    backgroundColor: '#F0FDF4',
    borderRadius: 12,
    padding: 16,
    marginVertical: 16,
    gap: 6,
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#15803D',
    marginBottom: 4,
  },
  infoStep: {
    fontSize: 13,
    color: '#166534',
    lineHeight: 20,
  },
  // Option cards (question step)
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
  // Form fields
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 6,
    marginTop: 4,
  },
  emailHint: {
    fontSize: 12,
    color: '#9CA3AF',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#F3F4F6',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    fontSize: 16,
    color: '#111827',
    marginBottom: 20,
  },
  cta: {
    backgroundColor: '#8B5CF6',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  ctaDisabled: {
    opacity: 0.45,
  },
  ctaText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '600',
  },
  hint: {
    fontSize: 12,
    color: '#9CA3AF',
    textAlign: 'center',
    lineHeight: 18,
    paddingTop: 8,
  },
});
