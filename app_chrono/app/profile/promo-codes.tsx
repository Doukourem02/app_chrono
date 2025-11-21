import React, { useState } from 'react';
import {View,Text,StyleSheet,TextInput,TouchableOpacity,ScrollView,Alert} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

interface PromoCode {
  id: string;
  code: string;
  discount: number;
  discountType: 'percentage' | 'fixed';
  validUntil: string;
  isUsed: boolean;
}

export default function PromoCodesPage() {
  const [promoCodes] = useState<PromoCode[]>([]);
  const [inputCode, setInputCode] = useState('');

  const handleApplyCode = () => {
    if (!inputCode.trim()) {
      Alert.alert('Erreur', 'Veuillez entrer un code promo');
      return;
    }

    // TODO: Valider et appliquer le code promo via l'API
    Alert.alert(
      'Code appliqué',
      `Le code "${inputCode}" a été appliqué avec succès !`,
      [{ text: 'OK' }]
    );
    setInputCode('');
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#1F2937" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Codes promo</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Zone de saisie */}
        <View style={styles.inputSection}>
          <Text style={styles.sectionTitle}>Ajouter un code promo</Text>
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              value={inputCode}
              onChangeText={setInputCode}
              placeholder="Entrez votre code promo"
              placeholderTextColor="#9CA3AF"
              autoCapitalize="characters"
            />
            <TouchableOpacity style={styles.applyButton} onPress={handleApplyCode}>
              <Text style={styles.applyButtonText}>Appliquer</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Codes disponibles */}
        <View style={styles.codesSection}>
          <Text style={styles.sectionTitle}>Mes codes disponibles</Text>
          {promoCodes.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="gift-outline" size={48} color="#9CA3AF" />
              <Text style={styles.emptyText}>Aucun code promo disponible</Text>
            </View>
          ) : (
            promoCodes.map((code) => (
              <View key={code.id} style={styles.codeCard}>
                <View style={styles.codeHeader}>
                  <View style={styles.codeInfo}>
                    <Text style={styles.codeText}>{code.code}</Text>
                    <Text style={styles.codeDiscount}>
                      {code.discountType === 'percentage'
                        ? `-${code.discount}%`
                        : `-${code.discount} FCFA`}
                    </Text>
                  </View>
                  {code.isUsed ? (
                    <View style={styles.usedBadge}>
                      <Text style={styles.usedBadgeText}>Utilisé</Text>
                    </View>
                  ) : (
                    <View style={styles.validBadge}>
                      <Text style={styles.validBadgeText}>Valide</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.codeExpiry}>
                  Valide jusqu&apos;au {new Date(code.validUntil).toLocaleDateString('fr-FR')}
                </Text>
              </View>
            ))
          )}
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
  inputSection: {
    backgroundColor: '#FFFFFF',
    marginTop: 20,
    marginHorizontal: 20,
    padding: 20,
    borderRadius: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 12,
  },
  inputContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  input: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#1F2937',
  },
  applyButton: {
    backgroundColor: '#8B5CF6',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    justifyContent: 'center',
  },
  applyButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  codesSection: {
    marginTop: 20,
    marginHorizontal: 20,
    marginBottom: 40,
  },
  emptyContainer: {
    backgroundColor: '#FFFFFF',
    padding: 40,
    borderRadius: 12,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 12,
  },
  codeCard: {
    backgroundColor: '#FFFFFF',
    marginTop: 12,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  codeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  codeInfo: {
    flex: 1,
  },
  codeText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#8B5CF6',
    marginBottom: 4,
  },
  codeDiscount: {
    fontSize: 14,
    color: '#10B981',
    fontWeight: '600',
  },
  usedBadge: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  usedBadgeText: {
    color: '#6B7280',
    fontSize: 12,
    fontWeight: '600',
  },
  validBadge: {
    backgroundColor: '#D1FAE5',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  validBadgeText: {
    color: '#10B981',
    fontSize: 12,
    fontWeight: '600',
  },
  codeExpiry: {
    fontSize: 12,
    color: '#9CA3AF',
  },
});

