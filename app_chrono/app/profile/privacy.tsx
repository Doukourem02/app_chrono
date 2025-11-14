import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

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
            Nous ne vendons pas vos données personnelles. Nous pouvons partager certaines informations avec nos partenaires de livraison uniquement dans le cadre de l'exécution de vos commandes.
          </Text>

          <Text style={styles.sectionTitle}>4. Sécurité</Text>
          <Text style={styles.text}>
            Nous mettons en œuvre des mesures de sécurité appropriées pour protéger vos données personnelles contre tout accès non autorisé.
          </Text>

          <Text style={styles.sectionTitle}>5. Vos droits</Text>
          <Text style={styles.text}>
            Vous avez le droit d'accéder, de modifier ou de supprimer vos données personnelles à tout moment en contactant notre service client.
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

