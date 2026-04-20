import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {Alert,KeyboardAvoidingView,Platform,ScrollView,StyleSheet,Text,TextInput,TouchableOpacity,View,} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MapboxAddressAutocomplete from '../../components/MapboxAddressAutocomplete';
import { useSavedAddressesStore } from '../../store/useSavedAddressesStore';
import { sanitizeGeocodeDisplayString, singleLineAddressInput } from '../../utils/sanitizeGeocodeDisplay';

const PRESETS = [
  { id: 'domicile', label: 'Domicile' },
  { id: 'travail', label: 'Travail' },
] as const;

export default function AddAddressPage() {
  const insets = useSafeAreaInsets();
  const addAddress = useSavedAddressesStore((s) => s.addAddress);
  const [addressLine, setAddressLine] = useState('');
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [label, setLabel] = useState('');

  const onPlaceSelected = useCallback(
    (data: { description: string; coords?: { latitude: number; longitude: number } }) => {
      const clean = sanitizeGeocodeDisplayString(singleLineAddressInput(data.description));
      setAddressLine(clean);
      setCoords(data.coords ?? null);
    },
    []
  );

  const handleSave = () => {
    const name = label.trim();
    if (!name) {
      Alert.alert('Nom requis', 'Indiquez un nom court (ex. Domicile, Travail).');
      return;
    }
    if (!addressLine.trim() || !coords) {
      Alert.alert('Adresse requise', 'Recherchez puis choisissez une suggestion dans la liste.');
      return;
    }
    addAddress({
      label: name,
      addressLine: addressLine.trim(),
      latitude: coords.latitude,
      longitude: coords.longitude,
    });
    Alert.alert('Adresse enregistrée', 'Elle apparaîtra dans l’écran d’envoi de colis.', [
      { text: 'OK', onPress: () => router.back() },
    ]);
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 12) + 8 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#1F2937" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Nouvelle adresse</Text>
        <View style={styles.headerSpacer} />
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top + 8 : 0}
      >
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={{ paddingBottom: Math.max(24, insets.bottom + 16) }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.sectionTitle}>Comment l’appeler ?</Text>
          <View style={styles.presetRow}>
            {PRESETS.map((p) => (
              <TouchableOpacity
                key={p.id}
                style={[styles.presetChip, label === p.label && styles.presetChipActive]}
                onPress={() => setLabel(p.label)}
                activeOpacity={0.8}
              >
                <Text
                  style={[styles.presetChipText, label === p.label && styles.presetChipTextActive]}
                >
                  {p.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <TextInput
            style={styles.labelInput}
            value={label}
            onChangeText={setLabel}
            placeholder="Ou un nom personnalisé (ex. Chez maman)"
            placeholderTextColor="#9CA3AF"
          />

          <Text style={[styles.sectionTitle, styles.sectionTitleSpaced]}>Adresse</Text>
          <Text style={styles.hint}>
            Tapez une rue ou un lieu, puis touchez une suggestion pour fixer le point sur la carte.
          </Text>
          <View style={styles.autocompleteWrap}>
            <MapboxAddressAutocomplete
              placeholder="Rechercher une adresse"
              country="ci"
              initialValue=""
              onPlaceSelected={onPlaceSelected}
            />
          </View>
          {addressLine ? (
            <View style={styles.preview}>
              <Ionicons
                name="bookmark-outline"
                size={18}
                color="#6B7280"
                style={styles.previewIcon}
              />
              <Text style={styles.previewText}>{addressLine}</Text>
            </View>
          ) : null}

          <TouchableOpacity
            style={[styles.saveButton, (!label.trim() || !addressLine || !coords) && styles.saveButtonDisabled]}
            onPress={handleSave}
            disabled={!label.trim() || !addressLine || !coords}
            activeOpacity={0.85}
          >
            <Text style={styles.saveButtonText}>Enregistrer</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 16,
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
  headerSpacer: {
    width: 40,
  },
  scroll: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#374151',
  },
  sectionTitleSpaced: {
    marginTop: 28,
  },
  hint: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 6,
    marginBottom: 12,
    lineHeight: 18,
  },
  presetRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 12,
  },
  presetChip: {
    marginRight: 10,
    marginBottom: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  presetChipActive: {
    backgroundColor: '#F3F0FF',
    borderColor: '#8B5CF6',
  },
  presetChipText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4B5563',
  },
  presetChipTextActive: {
    color: '#5B21B6',
  },
  labelInput: {
    marginTop: 14,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: '#111827',
  },
  autocompleteWrap: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 4,
    paddingVertical: 4,
    overflow: 'visible',
  },
  preview: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 14,
    padding: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  previewIcon: {
    marginRight: 8,
    marginTop: 2,
  },
  previewText: {
    flex: 1,
    fontSize: 14,
    color: '#374151',
    lineHeight: 20,
  },
  saveButton: {
    marginTop: 28,
    backgroundColor: '#8B5CF6',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.45,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
