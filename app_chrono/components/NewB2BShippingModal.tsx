import React, { useState } from 'react';
import {Modal,View,Text,TouchableOpacity,StyleSheet,TextInput,ScrollView,ActivityIndicator,Alert,KeyboardAvoidingView,Platform,} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../store/useAuthStore';
import { createB2BOrder } from '../services/partnerApi';
import MapboxAddressAutocomplete from './MapboxAddressAutocomplete';

const B2B_INSTRUCTION_PRESETS = [
  'Appeler le client avant d’arriver',
  'Voir le responsable sur place',
  'Déposer à l’accueil',
  'Demander le code de livraison',
  'Colis fragile, manipuler doucement',
  'Compter les colis avec le client',
];

interface NewB2BShippingModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess?: (orderId: string) => void;
}

export default function NewB2BShippingModal({ visible, onClose, onSuccess }: NewB2BShippingModalProps) {
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();

  const [pickup, setPickup] = useState('');
  const [pickupCoords, setPickupCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [dropoff, setDropoff] = useState('');
  const [dropoffCoords, setDropoffCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [recipientName, setRecipientName] = useState('');
  const [recipientPhone, setRecipientPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [selectedInstructions, setSelectedInstructions] = useState<string[]>([]);
  const [vehicleType, setVehicleType] = useState<'moto' | 'vehicule' | 'cargo'>('moto');
  const [isLoading, setIsLoading] = useState(false);
  const [successOrderId, setSuccessOrderId] = useState<string | null>(null);

  const canSubmit = pickup.length > 0
    && !!pickupCoords
    && dropoff.length > 0
    && !!dropoffCoords
    && recipientName.trim().length > 0
    && recipientPhone.trim().length > 0;

  const toggleInstruction = (instruction: string) => {
    setSelectedInstructions((current) =>
      current.includes(instruction)
        ? current.filter((item) => item !== instruction)
        : [...current, instruction]
    );
  };

  const handleSubmit = async () => {
    if (!canSubmit || !user?.id) return;
    if (!pickupCoords || !dropoffCoords) {
      Alert.alert('Adresse à sélectionner', 'Choisissez le point de départ et l’adresse du client dans les suggestions pour fixer les quartiers, rues et points GPS.');
      return;
    }

    setIsLoading(true);
    try {
      const result = await createB2BOrder({
        partnerId: user.partner_id ?? null,
        userId: user.id,
        pickup: { address: pickup, lat: pickupCoords?.lat, lng: pickupCoords?.lng },
        dropoff: { address: dropoff, lat: dropoffCoords?.lat, lng: dropoffCoords?.lng },
        recipient: { name: recipientName.trim(), phone: recipientPhone.trim() },
        vehicleType,
        notes: [...selectedInstructions, notes.trim()].filter(Boolean).join('\n') || undefined,
      });
      setSuccessOrderId(result.orderId);
      onSuccess?.(result.orderId);
    } catch (err: any) {
      Alert.alert('Erreur', err?.message ?? 'Impossible de créer la commande.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setPickup('');
    setPickupCoords(null);
    setDropoff('');
    setDropoffCoords(null);
    setRecipientName('');
    setRecipientPhone('');
    setNotes('');
    setSelectedInstructions([]);
    setVehicleType('moto');
    setSuccessOrderId(null);
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={handleClose}>
      <KeyboardAvoidingView style={{ flex: 1, backgroundColor: '#FFF' }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
          <TouchableOpacity onPress={handleClose} style={styles.closeBtn}>
            <Ionicons name="close" size={20} color="#374151" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Livraison client</Text>
          <View style={{ width: 36 }} />
        </View>

        {successOrderId ? (
          <View style={styles.successContainer}>
            <View style={styles.successCircle}>
              <Ionicons name="checkmark" size={40} color="#10B981" />
            </View>
            <Text style={styles.successTitle}>Commande envoyée !</Text>
            <Text style={styles.successSub}>La livraison a été créée avec succès.</Text>
            <Text style={styles.successId}>#{successOrderId.slice(-8).toUpperCase()}</Text>
            <TouchableOpacity style={styles.cta} onPress={handleClose}>
              <Text style={styles.ctaText}>Fermer</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <ScrollView style={styles.body} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <Text style={styles.sectionLabel}>Adresses</Text>
              <View style={styles.addressBlock}>
                <View style={styles.addressRow}>
                  <View style={[styles.dot, { backgroundColor: '#8B5CF6' }]} />
                  <View style={{ flex: 1 }}>
                    <MapboxAddressAutocomplete
                      placeholder="Adresse de départ"
                      initialValue={pickup}
                      embedded
                      onQueryChange={(text) => {
                        setPickup(text);
                        setPickupCoords(null);
                      }}
                      onPlaceSelected={(data) => {
                        setPickup(data.routingAddress ?? data.description);
                        setPickupCoords(data.coords ? { lat: data.coords.latitude, lng: data.coords.longitude } : null);
                      }}
                    />
                  </View>
                </View>
                <View style={styles.dividerLine} />
                <View style={styles.addressRow}>
                  <View style={[styles.dot, { backgroundColor: '#10B981' }]} />
                  <View style={{ flex: 1 }}>
                    <MapboxAddressAutocomplete
                      placeholder="Adresse de livraison"
                      initialValue={dropoff}
                      embedded
                      proximityCoords={
                        pickupCoords
                          ? { latitude: pickupCoords.lat, longitude: pickupCoords.lng }
                          : null
                      }
                      onQueryChange={(text) => {
                        setDropoff(text);
                        setDropoffCoords(null);
                      }}
                      onPlaceSelected={(data) => {
                        setDropoff(data.routingAddress ?? data.description);
                        setDropoffCoords(data.coords ? { lat: data.coords.latitude, lng: data.coords.longitude } : null);
                      }}
                    />
                  </View>
                </View>
              </View>

              <Text style={styles.sectionLabel}>Destinataire</Text>
              <View style={styles.card}>
                <Text style={styles.fieldLabel}>Nom complet *</Text>
                <TextInput
                  style={styles.input}
                  value={recipientName}
                  onChangeText={setRecipientName}
                  placeholder="Ex: Koné Fatima"
                  placeholderTextColor="#9CA3AF"
                  autoCapitalize="words"
                />
                <Text style={[styles.fieldLabel, { marginTop: 12 }]}>Téléphone *</Text>
                <TextInput
                  style={styles.input}
                  value={recipientPhone}
                  onChangeText={setRecipientPhone}
                  placeholder="Ex: 0700000000"
                  placeholderTextColor="#9CA3AF"
                  keyboardType="phone-pad"
                />
                <Text style={[styles.fieldLabel, { marginTop: 12 }]}>Précision libre pour le livreur</Text>
                <TextInput
                  style={[styles.input, { height: 72, textAlignVertical: 'top', paddingTop: 12 }]}
                  value={notes}
                  onChangeText={setNotes}
                  placeholder="Ex: code portail, colis fragile…"
                  placeholderTextColor="#9CA3AF"
                  multiline
                />
                <View style={styles.presetBlock}>
                  <Text style={styles.fieldLabel}>Consignes pour le livreur</Text>
                  <View style={styles.presetGrid}>
                    {B2B_INSTRUCTION_PRESETS.map((instruction) => {
                      const selected = selectedInstructions.includes(instruction);
                      return (
                        <TouchableOpacity
                          key={instruction}
                          style={[styles.presetChip, selected && styles.presetChipSelected]}
                          onPress={() => toggleInstruction(instruction)}
                        >
                          <Ionicons
                            name={selected ? 'checkmark-circle' : 'ellipse-outline'}
                            size={15}
                            color={selected ? '#8B5CF6' : '#9CA3AF'}
                          />
                          <Text style={[styles.presetChipText, selected && styles.presetChipTextSelected]}>
                            {instruction}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              </View>

              <Text style={styles.sectionLabel}>Service disponible</Text>
              <View style={styles.vehicleRow}>
                <TouchableOpacity
                  style={[styles.vehicleBtn, styles.vehicleBtnActive]}
                  onPress={() => setVehicleType('moto')}
                >
                  <Ionicons name="bicycle-outline" size={20} color="#FFF" />
                  <Text style={[styles.vehicleBtnText, { color: '#FFF' }]}>Moto</Text>
                </TouchableOpacity>
              </View>

              <View style={{ height: 24 }} />
            </ScrollView>

            <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
              <TouchableOpacity
                style={[styles.cta, (!canSubmit || isLoading) && styles.ctaDisabled]}
                onPress={handleSubmit}
                disabled={!canSubmit || isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <Text style={styles.ctaText}>Envoyer la commande</Text>
                )}
              </TouchableOpacity>
            </View>
          </>
        )}
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  body: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#9CA3AF',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 8,
    marginTop: 18,
  },
  addressBlock: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FAFAFA',
    overflow: 'hidden',
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 4,
    gap: 10,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  dividerLine: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginLeft: 32,
  },
  card: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FAFAFA',
    padding: 14,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#F3F4F6',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    fontSize: 15,
    color: '#111827',
  },
  presetBlock: {
    marginTop: 12,
  },
  presetGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  presetChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  presetChipSelected: {
    borderColor: '#8B5CF6',
    backgroundColor: '#F5F3FF',
  },
  presetChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
  },
  presetChipTextSelected: {
    color: '#8B5CF6',
  },
  vehicleRow: {
    flexDirection: 'row',
    gap: 10,
  },
  vehicleBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    backgroundColor: '#FAFAFA',
  },
  vehicleBtnActive: {
    backgroundColor: '#8B5CF6',
    borderColor: '#8B5CF6',
  },
  vehicleBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
  },
  footer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
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
  successContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  successCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: '#D1FAE5',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  successTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
  },
  successSub: {
    fontSize: 15,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 12,
  },
  successId: {
    fontSize: 14,
    fontWeight: '600',
    color: '#8B5CF6',
    marginBottom: 32,
  },
});
