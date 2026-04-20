import React, { useState } from 'react';
import {View,Text,StyleSheet,TouchableOpacity,TextInput,Alert,ActivityIndicator,} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { paymentApi, PaymentMethodType } from '../../services/paymentApi';

type MobileMethod = 'orange_money' | 'wave' | 'mtn_money';

const MOBILE_METHODS: { type: MobileMethod; label: string; hint: string }[] = [
  { type: 'orange_money', label: 'Orange Money', hint: 'Numéro Orange (07 ...)' },
  { type: 'wave', label: 'Wave', hint: 'Numéro Wave' },
  { type: 'mtn_money', label: 'MTN Money', hint: 'Numéro MTN (05 ...)' },
];

export default function AddPaymentMethodPage() {
  const [selectedMethod, setSelectedMethod] = useState<MobileMethod>('orange_money');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [isDefault, setIsDefault] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    const normalizedPhone = phoneNumber.trim();
    if (!normalizedPhone) {
      Alert.alert('Numéro requis', 'Veuillez saisir un numéro de téléphone.');
      return;
    }

    setIsSaving(true);
    try {
      const result = await paymentApi.createPaymentMethod({
        methodType: selectedMethod as PaymentMethodType,
        providerAccount: normalizedPhone,
        providerName:
          selectedMethod === 'orange_money'
            ? 'Orange Money'
            : selectedMethod === 'wave'
              ? 'Wave'
              : 'MTN Money',
        isDefault,
      });

      if (!result.success) {
        Alert.alert('Erreur', result.message || "Impossible d'ajouter la méthode de paiement.");
        return;
      }

      Alert.alert('Succès', 'Méthode de paiement ajoutée.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (error) {
      Alert.alert(
        'Erreur',
        error instanceof Error ? error.message : "Impossible d'ajouter la méthode de paiement."
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#1F2937" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Ajouter une méthode</Text>
        <View style={styles.placeholder} />
      </View>

      <View style={styles.content}>
        <Text style={styles.sectionTitle}>Choisir le moyen de paiement</Text>
        <View style={styles.methodList}>
          {MOBILE_METHODS.map((method) => {
            const selected = selectedMethod === method.type;
            return (
              <TouchableOpacity
                key={method.type}
                onPress={() => setSelectedMethod(method.type)}
                style={[styles.methodItem, selected && styles.methodItemActive]}
              >
                <View>
                  <Text style={[styles.methodLabel, selected && styles.methodLabelActive]}>
                    {method.label}
                  </Text>
                  <Text style={styles.methodHint}>{method.hint}</Text>
                </View>
                {selected ? <Ionicons name="checkmark-circle" size={22} color="#8B5CF6" /> : null}
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={styles.sectionTitle}>Numéro lié au compte</Text>
        <TextInput
          value={phoneNumber}
          onChangeText={setPhoneNumber}
          placeholder="Ex: +2250700000000"
          keyboardType="phone-pad"
          autoCapitalize="none"
          style={styles.input}
          placeholderTextColor="#9CA3AF"
        />

        <TouchableOpacity
          onPress={() => setIsDefault((v) => !v)}
          style={styles.defaultRow}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: isDefault }}
        >
          <Ionicons
            name={isDefault ? 'checkbox' : 'square-outline'}
            size={22}
            color={isDefault ? '#8B5CF6' : '#6B7280'}
          />
          <Text style={styles.defaultText}>Définir comme méthode par défaut</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.saveButton, isSaving && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={isSaving}
        >
          {isSaving ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.saveButtonText}>Enregistrer</Text>
          )}
        </TouchableOpacity>
      </View>
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
    padding: 20,
    gap: 12,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#374151',
    marginTop: 6,
  },
  methodList: {
    gap: 10,
  },
  methodItem: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  methodItemActive: {
    borderColor: '#8B5CF6',
    backgroundColor: '#F5F3FF',
  },
  methodLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1F2937',
  },
  methodLabelActive: {
    color: '#6D28D9',
  },
  methodHint: {
    marginTop: 2,
    fontSize: 12,
    color: '#6B7280',
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: '#1F2937',
  },
  defaultRow: {
    marginTop: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  defaultText: {
    fontSize: 14,
    color: '#374151',
  },
  saveButton: {
    marginTop: 12,
    backgroundColor: '#8B5CF6',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.7,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
