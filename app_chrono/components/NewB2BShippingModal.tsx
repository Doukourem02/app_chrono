import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../store/useAuthStore';
import { createB2BOrder } from '../services/partnerApi';
import MapboxAddressAutocomplete from './MapboxAddressAutocomplete';

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
  const [vehicleType, setVehicleType] = useState<'moto' | 'vehicule' | 'cargo'>('moto');
  const [isLoading, setIsLoading] = useState(false);
  const [successOrderId, setSuccessOrderId] = useState<string | null>(null);

  const canSubmit = pickup.length > 0 && dropoff.length > 0 && recipientName.trim().length > 0 && recipientPhone.trim().length > 0;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    if (!user?.partner_id) {
      Alert.alert('Compte non lié', "Votre compte n'est pas encore lié à un partenaire. Contactez votre gestionnaire Krono.");
      return;
    }

    setIsLoading(true);
    try {
      const result = await createB2BOrder({
        partnerId: user.partner_id,
        userId: user.id,
        pickup: { address: pickup, lat: pickupCoords?.lat, lng: pickupCoords?.lng },
        dropoff: { address: dropoff, lat: dropoffCoords?.lat, lng: dropoffCoords?.lng },
        recipient: { name: recipientName.trim(), phone: recipientPhone.trim() },
        vehicleType,
        notes: notes.trim() || undefined,
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
                      onPlaceSelected={(data) => {
                        setPickup(data.routingAddress ?? data.description);
                        if (data.coords) setPickupCoords({ lat: data.coords.latitude, lng: data.coords.longitude });
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
                      onPlaceSelected={(data) => {
                        setDropoff(data.routingAddress ?? data.description);
                        if (data.coords) setDropoffCoords({ lat: data.coords.latitude, lng: data.coords.longitude });
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
                <Text style={[styles.fieldLabel, { marginTop: 12 }]}>Notes</Text>
                <TextInput
                  style={[styles.input, { height: 72, textAlignVertical: 'top', paddingTop: 12 }]}
                  value={notes}
                  onChangeText={setNotes}
                  placeholder="Instructions pour le livreur…"
                  placeholderTextColor="#9CA3AF"
                  multiline
                />
              </View>

              <Text style={styles.sectionLabel}>Véhicule</Text>
              <View style={styles.vehicleRow}>
                {(['moto', 'vehicule', 'cargo'] as const).map((v) => (
                  <TouchableOpacity
                    key={v}
                    style={[styles.vehicleBtn, vehicleType === v && styles.vehicleBtnActive]}
                    onPress={() => setVehicleType(v)}
                  >
                    <Ionicons
                      name={v === 'moto' ? 'bicycle-outline' : v === 'vehicule' ? 'car-outline' : 'cube-outline'}
                      size={20}
                      color={vehicleType === v ? '#FFF' : '#6B7280'}
                    />
                    <Text style={[styles.vehicleBtnText, vehicleType === v && { color: '#FFF' }]}>
                      {v === 'moto' ? 'Moto' : v === 'vehicule' ? 'Voiture' : 'Cargo'}
                    </Text>
                  </TouchableOpacity>
                ))}
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
