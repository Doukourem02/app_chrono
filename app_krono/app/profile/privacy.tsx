import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { config } from '../../config';
import { openLegalUrl } from '../../utils/openLegalUrl';

export default function PrivacyPage() {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#1F2937" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Politique de confidentialité</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.contentContainer}>
          <Text style={styles.lastUpdated}>Dernière mise à jour : {new Date().toLocaleDateString('fr-FR')}</Text>

          {config.legal.privacyUrl?.trim() ? (
            <TouchableOpacity
              style={styles.officialDocBanner}
              onPress={() =>
                openLegalUrl(
                  config.legal.privacyUrl,
                  'URL de la politique complète non configurée.'
                )
              }
              accessibilityRole="link"
              accessibilityLabel="Ouvrir la politique de confidentialité officielle en ligne"
            >
              <Ionicons name="open-outline" size={20} color="#7C3AED" />
              <Text style={styles.officialDocBannerText}>
                Document officiel en ligne (même politique que pour les stores)
              </Text>
              <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
            </TouchableOpacity>
          ) : null}

          <Text style={styles.summaryHint}>
            {config.legal.privacyUrl?.trim()
              ? 'Résumé dans l’app — la version faisant foi est le document officiel en ligne (lien ci-dessus).'
              : 'Résumé dans l’app — pour la soumission stores, publiez la politique complète sur une URL stable et renseignez EXPO_PUBLIC_LEGAL_PRIVACY_URL.'}
          </Text>
          
          <Text style={styles.sectionTitle}>1. Collecte des données</Text>
          <Text style={styles.text}>
            Nous collectons les informations que vous nous fournissez directement, notamment lorsque vous créez un compte, passez une commande ou contactez notre service client.
          </Text>

          <Text style={styles.sectionTitle}>2. Utilisation des données</Text>
          <Text style={styles.text}>
            Vos données sont utilisées pour traiter vos commandes, améliorer nos services et vous contacter concernant votre compte.
          </Text>

          <Text style={styles.sectionTitle}>3. Partage des données</Text>
          <Text style={styles.text}>
            Nous ne vendons pas vos données personnelles. Nous pouvons partager certaines informations avec nos partenaires de livraison uniquement dans le cadre de l&apos;exécution de vos commandes.
          </Text>

          <Text style={styles.sectionTitle}>4. Sécurité</Text>
          <Text style={styles.text}>
            Nous mettons en œuvre des mesures de sécurité appropriées pour protéger vos données personnelles contre tout accès non autorisé.
          </Text>

          <Text style={styles.sectionTitle}>5. Vos droits</Text>
          <Text style={styles.text}>
            Vous avez le droit d&apos;accéder, de modifier ou de supprimer vos données personnelles à tout moment en contactant notre service client.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 20,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
  },
  placeholder: {
    width: 40,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    backgroundColor: '#FFFFFF',
    margin: 20,
    padding: 20,
    borderRadius: 12,
  },
  officialDocBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#F5F3FF',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#DDD6FE',
  },
  officialDocBannerText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#5B21B6',
  },
  summaryHint: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 16,
    lineHeight: 18,
  },
  lastUpdated: {
    fontSize: 12,
    color: '#9CA3AF',
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
    marginTop: 24,
    marginBottom: 12,
  },
  text: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 22,
    marginBottom: 16,
  },
});

