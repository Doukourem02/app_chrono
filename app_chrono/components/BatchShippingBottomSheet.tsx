import React, { useEffect, useState } from 'react';
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
import { useBusinessStore } from '../store/useBusinessStore';
import { createBatch, getPartnerDrivers, type PartnerDriver } from '../services/partnerApi';
import MapboxAddressAutocomplete from './MapboxAddressAutocomplete';

type Step = 'recipients' | 'driver' | 'confirm' | 'success';

interface BatchShippingBottomSheetProps {
  visible: boolean;
  onClose: () => void;
}

export default function BatchShippingBottomSheet({ visible, onClose }: BatchShippingBottomSheetProps) {
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();
  const { batchPickupAddress, batchRecipients, batchDriverId, batchOptimizedOrder,
    setBatchPickup, addRecipient, removeRecipient, setBatchDriver, setOptimizedOrder, resetBatch } = useBusinessStore();

  const [step, setStep] = useState<Step>('recipients');
  const [drivers, setDrivers] = useState<PartnerDriver[]>([]);
  const [driversLoading, setDriversLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [batchId, setBatchId] = useState<string | null>(null);

  // Formulaire d'ajout de destinataire
  const [draftName, setDraftName] = useState('');
  const [draftPhone, setDraftPhone] = useState('');
  const [draftAddress, setDraftAddress] = useState('');
  const [draftNotes, setDraftNotes] = useState('');

  useEffect(() => {
    if (visible && step === 'driver' && user?.partner_id) {
      setDriversLoading(true);
      getPartnerDrivers(user.partner_id)
        .then(setDrivers)
        .finally(() => setDriversLoading(false));
    }
  }, [visible, step, user?.partner_id]);

  const handleAddRecipient = () => {
    if (!draftName.trim() || !draftPhone.trim() || !draftAddress.trim()) {
      Alert.alert('Champs requis', 'Nom, téléphone et adresse sont obligatoires.');
      return;
    }
    addRecipient({ name: draftName.trim(), phone: draftPhone.trim(), address: draftAddress.trim(), notes: draftNotes.trim() || undefined });
    setDraftName('');
    setDraftPhone('');
    setDraftAddress('');
    setDraftNotes('');
  };

  const handleSubmit = async () => {
    if (!user?.partner_id || batchRecipients.length === 0 || !batchPickupAddress) return;

    setIsSubmitting(true);
    try {
      const result = await createBatch({
        partnerId: user.partner_id,
        userId: user.id,
        driverId: batchDriverId ?? undefined,
        pickupAddress: batchPickupAddress,
        orders: batchRecipients.map((r) => ({
          recipient: { name: r.name, phone: r.phone, address: r.address },
          notes: r.notes,
        })),
      });
      setBatchId(result.batchId);
      if (result.orders.length > 0) {
        setOptimizedOrder(result.orders.map((_, i) => i));
      }
      setStep('success');
    } catch (err: any) {
      Alert.alert('Erreur', err?.message ?? 'Impossible de créer la tournée.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    resetBatch();
    setStep('recipients');
    setBatchId(null);
    setDraftName('');
    setDraftPhone('');
    setDraftAddress('');
    setDraftNotes('');
    onClose();
  };

  const selectedDriver = drivers.find((d) => d.id === batchDriverId);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={handleClose}>
      <KeyboardAvoidingView style={{ flex: 1, backgroundColor: '#FFF' }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>

        {/* Header */}
        <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
          <TouchableOpacity
            onPress={step === 'recipients' ? handleClose : () => setStep(step === 'driver' ? 'recipients' : step === 'confirm' ? 'driver' : 'recipients')}
            style={styles.closeBtn}
          >
            <Ionicons name={step === 'recipients' || step === 'success' ? 'close' : 'arrow-back'} size={20} color="#374151" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>
            {step === 'recipients' ? 'Destinataires' : step === 'driver' ? 'Livreur attitré' : step === 'confirm' ? 'Récapitulatif' : 'Tournée créée'}
          </Text>
          <View style={{ width: 36 }} />
        </View>

        {/* Step indicators */}
        {step !== 'success' && (
          <View style={styles.stepRow}>
            {(['recipients', 'driver', 'confirm'] as Step[]).map((s, i) => (
              <View key={s} style={styles.stepItem}>
                <View style={[styles.stepDot, (step === s || (i < ['recipients', 'driver', 'confirm'].indexOf(step))) && styles.stepDotActive]}>
                  <Text style={[styles.stepNum, (step === s || (i < ['recipients', 'driver', 'confirm'].indexOf(step))) && { color: '#FFF' }]}>{i + 1}</Text>
                </View>
                {i < 2 && <View style={[styles.stepLine, i < ['recipients', 'driver', 'confirm'].indexOf(step) && styles.stepLineActive]} />}
              </View>
            ))}
          </View>
        )}

        {/* ─── STEP: RECIPIENTS ─── */}
        {step === 'recipients' && (
          <>
            <ScrollView style={styles.body} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <Text style={styles.sectionLabel}>Adresse de départ</Text>
              <View style={styles.addressBlock}>
                <View style={styles.addressRow}>
                  <View style={[styles.dot, { backgroundColor: '#8B5CF6' }]} />
                  <View style={{ flex: 1 }}>
                    <MapboxAddressAutocomplete
                      placeholder="Point de collecte commun"
                      initialValue={batchPickupAddress}
                      embedded
                      onPlaceSelected={(data) => {
                        const addr = data.routingAddress ?? data.description;
                        const coords = data.coords ? { lat: data.coords.latitude, lng: data.coords.longitude } : undefined;
                        setBatchPickup(addr, coords);
                      }}
                    />
                  </View>
                </View>
              </View>

              {/* Liste des destinataires */}
              {batchRecipients.length > 0 && (
                <>
                  <Text style={styles.sectionLabel}>Destinataires ({batchRecipients.length})</Text>
                  {batchRecipients.map((r, idx) => (
                    <View key={r.id} style={styles.recipientCard}>
                      <View style={styles.recipientIndex}>
                        <Text style={styles.recipientIndexText}>{idx + 1}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.recipientName}>{r.name}</Text>
                        <Text style={styles.recipientSub}>{r.phone} · {r.address}</Text>
                        {r.notes ? <Text style={styles.recipientNotes}>{r.notes}</Text> : null}
                      </View>
                      <TouchableOpacity onPress={() => removeRecipient(r.id)} style={styles.removeBtn}>
                        <Ionicons name="trash-outline" size={16} color="#EF4444" />
                      </TouchableOpacity>
                    </View>
                  ))}
                </>
              )}

              {/* Formulaire ajout */}
              <Text style={styles.sectionLabel}>Ajouter un destinataire</Text>
              <View style={styles.card}>
                <TextInput
                  style={styles.input}
                  value={draftName}
                  onChangeText={setDraftName}
                  placeholder="Nom *"
                  placeholderTextColor="#9CA3AF"
                  autoCapitalize="words"
                />
                <TextInput
                  style={[styles.input, { marginTop: 8 }]}
                  value={draftPhone}
                  onChangeText={setDraftPhone}
                  placeholder="Téléphone *"
                  placeholderTextColor="#9CA3AF"
                  keyboardType="phone-pad"
                />
                <TextInput
                  style={[styles.input, { marginTop: 8 }]}
                  value={draftAddress}
                  onChangeText={setDraftAddress}
                  placeholder="Adresse de livraison *"
                  placeholderTextColor="#9CA3AF"
                />
                <TextInput
                  style={[styles.input, { marginTop: 8 }]}
                  value={draftNotes}
                  onChangeText={setDraftNotes}
                  placeholder="Notes (facultatif)"
                  placeholderTextColor="#9CA3AF"
                />
                <TouchableOpacity
                  style={[styles.addBtn, (!draftName.trim() || !draftPhone.trim() || !draftAddress.trim()) && styles.addBtnDisabled]}
                  onPress={handleAddRecipient}
                  disabled={!draftName.trim() || !draftPhone.trim() || !draftAddress.trim()}
                >
                  <Ionicons name="add" size={18} color="#8B5CF6" />
                  <Text style={styles.addBtnText}>Ajouter à la tournée</Text>
                </TouchableOpacity>
              </View>
              <View style={{ height: 24 }} />
            </ScrollView>
            <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
              <TouchableOpacity
                style={[styles.cta, (batchRecipients.length === 0 || !batchPickupAddress) && styles.ctaDisabled]}
                onPress={() => setStep('driver')}
                disabled={batchRecipients.length === 0 || !batchPickupAddress}
              >
                <Text style={styles.ctaText}>Suivant · {batchRecipients.length} destinataire{batchRecipients.length > 1 ? 's' : ''}</Text>
              </TouchableOpacity>
            </View>
          </>
        )}

        {/* ─── STEP: DRIVER ─── */}
        {step === 'driver' && (
          <>
            <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
              <Text style={styles.sectionLabel}>Livreur attitré (facultatif)</Text>
              {driversLoading ? (
                <ActivityIndicator color="#8B5CF6" style={{ marginTop: 32 }} />
              ) : drivers.length === 0 ? (
                <View style={styles.emptyCard}>
                  <Ionicons name="person-outline" size={28} color="#9CA3AF" />
                  <Text style={styles.emptyText}>Aucun livreur attitré</Text>
                  <Text style={styles.emptySub}>Krono assignera un livreur disponible automatiquement.</Text>
                </View>
              ) : (
                <>
                  <TouchableOpacity
                    style={[styles.driverCard, batchDriverId === null && styles.driverCardActive]}
                    onPress={() => setBatchDriver(null)}
                  >
                    <View style={[styles.driverAvatar, { backgroundColor: '#F3F4F6' }]}>
                      <Ionicons name="flash-outline" size={20} color="#6B7280" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.driverName}>Assignation automatique</Text>
                      <Text style={styles.driverSub}>Premier livreur disponible</Text>
                    </View>
                    {batchDriverId === null && <Ionicons name="checkmark-circle" size={22} color="#8B5CF6" />}
                  </TouchableOpacity>

                  {drivers.map((d) => (
                    <TouchableOpacity
                      key={d.id}
                      style={[styles.driverCard, batchDriverId === d.id && styles.driverCardActive]}
                      onPress={() => setBatchDriver(d.id)}
                    >
                      <View style={styles.driverAvatar}>
                        <Text style={styles.driverAvatarText}>
                          {(d.first_name ?? '?').charAt(0).toUpperCase()}
                        </Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.driverName}>{d.first_name ?? ''} {d.last_name ?? ''}</Text>
                        <Text style={styles.driverSub}>{d.phone ?? ''}{d.vehicle_type ? ` · ${d.vehicle_type}` : ''}</Text>
                      </View>
                      {batchDriverId === d.id && <Ionicons name="checkmark-circle" size={22} color="#8B5CF6" />}
                    </TouchableOpacity>
                  ))}
                </>
              )}
              <View style={{ height: 24 }} />
            </ScrollView>
            <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
              <TouchableOpacity style={styles.cta} onPress={() => setStep('confirm')}>
                <Text style={styles.ctaText}>Suivant</Text>
              </TouchableOpacity>
            </View>
          </>
        )}

        {/* ─── STEP: CONFIRM ─── */}
        {step === 'confirm' && (
          <>
            <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
              <Text style={styles.sectionLabel}>Départ</Text>
              <View style={styles.summaryRow}>
                <Ionicons name="location" size={16} color="#8B5CF6" />
                <Text style={styles.summaryText}>{batchPickupAddress}</Text>
              </View>

              <Text style={styles.sectionLabel}>Livreur</Text>
              <View style={styles.summaryRow}>
                <Ionicons name="person-circle-outline" size={16} color="#6B7280" />
                <Text style={styles.summaryText}>
                  {selectedDriver ? `${selectedDriver.first_name ?? ''} ${selectedDriver.last_name ?? ''}`.trim() : 'Automatique'}
                </Text>
              </View>

              <Text style={styles.sectionLabel}>{batchRecipients.length} livraison{batchRecipients.length > 1 ? 's' : ''}</Text>
              {batchRecipients.map((r, i) => (
                <View key={r.id} style={styles.confirmRecipient}>
                  <Text style={styles.confirmIndex}>{i + 1}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.confirmName}>{r.name}</Text>
                    <Text style={styles.confirmAddr}>{r.address}</Text>
                  </View>
                </View>
              ))}
              <View style={{ height: 24 }} />
            </ScrollView>
            <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
              <TouchableOpacity
                style={[styles.cta, isSubmitting && styles.ctaDisabled]}
                onPress={handleSubmit}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <Text style={styles.ctaText}>Lancer la tournée</Text>
                )}
              </TouchableOpacity>
            </View>
          </>
        )}

        {/* ─── STEP: SUCCESS ─── */}
        {step === 'success' && (
          <View style={styles.successContainer}>
            <View style={styles.successCircle}>
              <Ionicons name="checkmark" size={40} color="#10B981" />
            </View>
            <Text style={styles.successTitle}>Tournée lancée !</Text>
            <Text style={styles.successSub}>{batchRecipients.length} livraison{batchRecipients.length > 1 ? 's' : ''} en cours de traitement.</Text>
            {batchId && <Text style={styles.successId}>#{batchId.slice(-8).toUpperCase()}</Text>}
            {batchOptimizedOrder && batchOptimizedOrder.length > 0 && (
              <View style={styles.routePreview}>
                <Text style={styles.routeTitle}>Ordre optimisé</Text>
                {batchOptimizedOrder.map((idx, pos) => {
                  const r = batchRecipients[idx];
                  if (!r) return null;
                  return (
                    <View key={idx} style={styles.routeRow}>
                      <Text style={styles.routePos}>{pos + 1}</Text>
                      <Text style={styles.routeName}>{r.name}</Text>
                    </View>
                  );
                })}
              </View>
            )}
            <TouchableOpacity style={[styles.cta, { marginTop: 32, width: '100%' }]} onPress={handleClose}>
              <Text style={styles.ctaText}>Fermer</Text>
            </TouchableOpacity>
          </View>
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
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 40,
    gap: 0,
  },
  stepItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stepDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#E5E7EB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepDotActive: {
    backgroundColor: '#8B5CF6',
  },
  stepNum: {
    fontSize: 12,
    fontWeight: '700',
    color: '#9CA3AF',
  },
  stepLine: {
    width: 40,
    height: 2,
    backgroundColor: '#E5E7EB',
    marginHorizontal: 2,
  },
  stepLineActive: {
    backgroundColor: '#8B5CF6',
  },
  body: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 4,
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
  recipientCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FAFAFA',
    marginBottom: 8,
  },
  recipientIndex: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#EDE9FE',
    justifyContent: 'center',
    alignItems: 'center',
  },
  recipientIndexText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#8B5CF6',
  },
  recipientName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  recipientSub: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  recipientNotes: {
    fontSize: 12,
    color: '#9CA3AF',
    fontStyle: 'italic',
    marginTop: 2,
  },
  removeBtn: {
    padding: 6,
  },
  card: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FAFAFA',
    padding: 14,
  },
  input: {
    backgroundColor: '#F3F4F6',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    fontSize: 15,
    color: '#111827',
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 12,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#8B5CF6',
    backgroundColor: '#F5F3FF',
  },
  addBtnDisabled: {
    opacity: 0.45,
  },
  addBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#8B5CF6',
  },
  driverCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    backgroundColor: '#FAFAFA',
    marginBottom: 10,
  },
  driverCardActive: {
    borderColor: '#8B5CF6',
    backgroundColor: '#F5F3FF',
  },
  driverAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#EDE9FE',
    justifyContent: 'center',
    alignItems: 'center',
  },
  driverAvatarText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#8B5CF6',
  },
  driverName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  driverSub: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  emptyCard: {
    padding: 32,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
    gap: 8,
  },
  emptyText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#374151',
  },
  emptySub: {
    fontSize: 13,
    color: '#9CA3AF',
    textAlign: 'center',
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FAFAFA',
    marginBottom: 4,
  },
  summaryText: {
    flex: 1,
    fontSize: 14,
    color: '#374151',
  },
  confirmRecipient: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  confirmIndex: {
    fontSize: 13,
    fontWeight: '700',
    color: '#8B5CF6',
    width: 20,
    textAlign: 'center',
  },
  confirmName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  confirmAddr: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
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
    marginBottom: 16,
  },
  routePreview: {
    width: '100%',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FAFAFA',
    padding: 14,
  },
  routeTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#6B7280',
    marginBottom: 10,
  },
  routeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  routePos: {
    fontSize: 13,
    fontWeight: '700',
    color: '#8B5CF6',
    width: 20,
    textAlign: 'center',
  },
  routeName: {
    fontSize: 14,
    color: '#374151',
  },
});
