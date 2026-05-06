import React, { useCallback, useEffect, useState } from 'react';
import {View,Text,TouchableOpacity,StyleSheet,ScrollView,ActivityIndicator,Alert,Linking,Modal,TextInput,KeyboardAvoidingView,Platform,} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import { useBatchStore, type BatchStop } from '../../store/useBatchStore';
import { getBatch, validateBatchOrder } from '../../services/batchApiService';
import { qrCodeService } from '../../services/qrCodeService';
import { QRCodeScanner } from '../../components/QRCodeScanner';
import { QRCodeScanResult } from '../../components/QRCodeScanResult';
import { getQRScanErrorAlert } from '../../utils/qrScanUserMessage';
import { logger } from '../../utils/logger';

type ProofMethod = NonNullable<BatchStop['proofMethod']>;

export default function BatchScreen() {
  const { batchId } = useLocalSearchParams<{ batchId: string }>();
  const insets = useSafeAreaInsets();
  const { activeBatch, setActiveBatch, updateStop } = useBatchStore();

  const [isLoadingFull, setIsLoadingFull] = useState(false);
  const [validatingId, setValidatingId] = useState<string | null>(null);
  const [allDone, setAllDone] = useState(false);
  const [scanStop, setScanStop] = useState<BatchStop | null>(null);
  const [scanResult, setScanResult] = useState<{
    recipientName: string;
    recipientPhone: string;
    creatorName: string;
    orderNumber: string;
  } | null>(null);
  const [scanProof, setScanProof] = useState<{ orderId: string; method: ProofMethod } | null>(null);
  const [manualStop, setManualStop] = useState<BatchStop | null>(null);
  const [manualCode, setManualCode] = useState('');
  const [alternativeStop, setAlternativeStop] = useState<BatchStop | null>(null);
  const [signatureName, setSignatureName] = useState('');
  const [photoBase64, setPhotoBase64] = useState<string | null>(null);
  const [photoReady, setPhotoReady] = useState(false);

  const batch = activeBatch?.id === batchId ? activeBatch : null;

  const getCurrentLocation = useCallback(async () => {
    try {
      const current = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      return {
        latitude: current.coords.latitude,
        longitude: current.coords.longitude,
      };
    } catch (err) {
      logger.warn('[BatchScreen] location unavailable', 'BatchScreen', err);
      return undefined;
    }
  }, []);

  const proofLabel = (method?: BatchStop['proofMethod'] | null) => {
    switch (method) {
      case 'qr_scan':
        return 'QR validé';
      case 'manual_code':
        return 'Code validé';
      case 'photo_signature':
        return 'Preuve alternative';
      case 'batch_driver_confirmation':
        return 'Confirmation livreur';
      default:
        return 'À valider';
    }
  };

  const loadBatch = useCallback(async () => {
    if (!batchId) return;
    setIsLoadingFull(true);
    try {
      const data = await getBatch(batchId);
      setActiveBatch(data);
    } catch (err: any) {
      logger.warn('[BatchScreen] getBatch error', 'BatchScreen', err);
      Alert.alert('Erreur', err?.message ?? 'Impossible de charger la tournée.');
    } finally {
      setIsLoadingFull(false);
    }
  }, [batchId, setActiveBatch]);

  useEffect(() => {
    // Charger les détails complets si les stops sont vides (arrivée depuis push/socket)
    if (!batch || batch.stops.length === 0) {
      void loadBatch();
    }
  }, [batch, loadBatch]);

  useEffect(() => {
    if (batch && batch.stops.length > 0) {
      const remaining = batch.stops.filter((s) => s.status === 'pending').length;
      setAllDone(remaining === 0);
    }
  }, [batch]);

  const finalizeProofDelivery = async (stop: BatchStop, method: ProofMethod, extra?: {
    location?: { latitude: number; longitude: number };
    alternativeProof?: {
      photoBase64?: string | null;
      signatureName?: string | null;
      timestamp?: string;
    };
  }) => {
    if (!batchId || validatingId) return;
    setValidatingId(stop.orderId);
    try {
      await validateBatchOrder(batchId, stop.orderId, 'completed', {
        proofMethod: method,
        ...extra,
      });
      updateStop(stop.orderId, 'completed', {
        proofMethod: method,
        proofValidatedAt: new Date().toISOString(),
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } catch (err: any) {
      Alert.alert('Erreur', err?.message ?? 'Impossible de valider la livraison.');
    } finally {
      setValidatingId(null);
    }
  };

  const handleScanQRCode = async (qrCodeData: string) => {
    if (!scanStop) return;
    try {
      const location = await getCurrentLocation();
      const result = await qrCodeService.scanQRCode(qrCodeData, location, scanStop.orderId);
      if (result.success && result.isValid && result.data) {
        const { orderId, ...scanData } = result.data;
        if (orderId !== scanStop.orderId) {
          Alert.alert('Mauvais arrêt', 'Ce QR correspond à une autre commande de la tournée.');
          return;
        }
        setScanProof({ orderId, method: 'qr_scan' });
        setScanResult(scanData);
        setScanStop(null);
      } else {
        const { title, message } = getQRScanErrorAlert(result.code, result.error);
        Alert.alert(title, message);
      }
    } catch (error: any) {
      const { title, message } = getQRScanErrorAlert('SCAN_UNKNOWN', error?.message);
      Alert.alert(title, message);
    }
  };

  const handleManualSubmit = async () => {
    if (!manualStop) return;
    const code = manualCode.trim();
    if (!/^\d{6}$/.test(code)) {
      Alert.alert('Code invalide', 'Entrez les 6 chiffres affichés sur l’écran du destinataire.');
      return;
    }
    setValidatingId(manualStop.orderId);
    try {
      const location = await getCurrentLocation();
      const result = await qrCodeService.manualVerify(manualStop.orderId, code, location);
      if (result.success && result.isValid && result.data) {
        const { orderId, ...scanData } = result.data;
        setManualStop(null);
        setManualCode('');
        setScanProof({ orderId, method: 'manual_code' });
        setScanResult(scanData);
      } else {
        const { title, message } = getQRScanErrorAlert(result.code, result.error);
        Alert.alert(title, message);
      }
    } catch (error: any) {
      const { title, message } = getQRScanErrorAlert('SCAN_UNKNOWN', error?.message);
      Alert.alert(title, message);
    } finally {
      setValidatingId(null);
    }
  };

  const handleConfirmDeliveryProof = async () => {
    if (!scanProof || !batch) return;
    const stop = batch.stops.find((item) => item.orderId === scanProof.orderId);
    if (!stop) return;
    setScanResult(null);
    await finalizeProofDelivery(stop, scanProof.method, {
      location: await getCurrentLocation(),
    });
    setScanProof(null);
  };

  const resetAlternativeProof = () => {
    setAlternativeStop(null);
    setSignatureName('');
    setPhotoBase64(null);
    setPhotoReady(false);
  };

  const handleTakeProofPhoto = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Caméra requise', 'Autorisez la caméra pour joindre une photo de remise.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      base64: true,
      quality: 0.45,
      allowsEditing: false,
    });
    if (!result.canceled && result.assets[0]?.base64) {
      setPhotoBase64(result.assets[0].base64);
      setPhotoReady(true);
    }
  };

  const handleAlternativeSubmit = async () => {
    if (!alternativeStop) return;
    const trimmedSignature = signatureName.trim();
    if (!photoBase64 || !trimmedSignature) {
      Alert.alert('Preuve incomplète', 'Ajoutez une photo et le nom/signature du destinataire.');
      return;
    }
    const location = await getCurrentLocation();
    await finalizeProofDelivery(alternativeStop, 'photo_signature', {
      location,
      alternativeProof: {
        photoBase64,
        signatureName: trimmedSignature,
        timestamp: new Date().toISOString(),
      },
    });
    resetAlternativeProof();
  };

  const handleCancel = (stop: BatchStop) => {
    Alert.alert(
      'Annuler cette livraison',
      `Confirmer l'annulation pour ${stop.recipientName} ?`,
      [
        { text: 'Retour', style: 'cancel' },
        {
          text: 'Annuler la livraison',
          style: 'destructive',
          onPress: async () => {
            if (!batchId) return;
            setValidatingId(stop.orderId);
            try {
              await validateBatchOrder(batchId, stop.orderId, 'cancelled');
              updateStop(stop.orderId, 'cancelled');
            } catch (err: any) {
              Alert.alert('Erreur', err?.message ?? 'Impossible d\'annuler.');
            } finally {
              setValidatingId(null);
            }
          },
        },
      ]
    );
  };

  const handleCall = (phone: string) => {
    const url = `tel:${phone.replace(/\s/g, '')}`;
    Linking.canOpenURL(url).then((ok) => {
      if (ok) Linking.openURL(url);
    });
  };

  const completedCount = batch?.stops.filter((s) => s.status === 'completed').length ?? 0;
  const totalCount = batch?.stops.length ?? 0;
  const progress = totalCount > 0 ? completedCount / totalCount : 0;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#374151" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>{batch?.partner_name ?? 'Tournée B2B'}</Text>
          {batchId && (
            <Text style={styles.headerSub}>#{batchId.slice(-8).toUpperCase()}</Text>
          )}
        </View>
        <TouchableOpacity onPress={loadBatch} style={styles.refreshBtn}>
          <Ionicons name="refresh-outline" size={20} color="#6B7280" />
        </TouchableOpacity>
      </View>

      {/* Barre de progression */}
      {totalCount > 0 && (
        <View style={styles.progressContainer}>
          <View style={styles.progressRow}>
            <Text style={styles.progressLabel}>{completedCount}/{totalCount} livraisons</Text>
            <Text style={[styles.progressLabel, { color: allDone ? '#10B981' : '#6B7280' }]}>
              {allDone ? 'Tournée terminée ✓' : `${totalCount - completedCount} restante${totalCount - completedCount > 1 ? 's' : ''}`}
            </Text>
          </View>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${Math.round(progress * 100)}%`, backgroundColor: allDone ? '#10B981' : '#8B5CF6' }]} />
          </View>
        </View>
      )}

      {isLoadingFull ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#8B5CF6" />
          <Text style={styles.loadingText}>Chargement de la tournée…</Text>
        </View>
      ) : allDone ? (
        <View style={styles.centered}>
          <View style={styles.doneCircle}>
            <Ionicons name="checkmark-done" size={48} color="#10B981" />
          </View>
          <Text style={styles.doneTitle}>Tournée terminée !</Text>
          <Text style={styles.doneSub}>{completedCount} livraison{completedCount > 1 ? 's' : ''} effectuée{completedCount > 1 ? 's' : ''}</Text>
          <TouchableOpacity style={styles.doneCta} onPress={() => router.replace('/(tabs)' as any)}>
            <Text style={styles.doneCtaText}>{"Retour à l'accueil"}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView style={styles.list} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}>
          {(batch?.stops ?? []).map((stop, idx) => {
            const isValidating = validatingId === stop.orderId;
            const isDone = stop.status === 'completed';
            const isCancelled = stop.status === 'cancelled';

            return (
              <View
                key={stop.orderId}
                style={[
                  styles.stopCard,
                  isDone && styles.stopCardDone,
                  isCancelled && styles.stopCardCancelled,
                ]}
              >
                {/* Position + statut */}
                <View style={[styles.positionBadge, isDone && styles.positionBadgeDone, isCancelled && styles.positionBadgeCancelled]}>
                  {isDone ? (
                    <Ionicons name="checkmark" size={16} color="#FFF" />
                  ) : isCancelled ? (
                    <Ionicons name="close" size={16} color="#FFF" />
                  ) : (
                    <Text style={styles.positionText}>{idx + 1}</Text>
                  )}
                </View>

                {/* Infos destinataire */}
                <View style={styles.stopInfo}>
                  <Text style={[styles.recipientName, (isDone || isCancelled) && styles.textMuted]}>
                    {stop.recipientName}
                  </Text>
                  <Text style={[styles.addressText, (isDone || isCancelled) && styles.textMuted]}>
                    {stop.address}
                  </Text>
                  {stop.notes ? (
                    <Text style={styles.notesText}>{stop.notes}</Text>
                  ) : null}
                  <View style={[
                    styles.proofBadge,
                    stop.proofMethod && styles.proofBadgeValid,
                    stop.proofMethod === 'photo_signature' && styles.proofBadgeAlternative,
                  ]}>
                    <Ionicons
                      name={
                        stop.proofMethod === 'qr_scan'
                          ? 'qr-code-outline'
                          : stop.proofMethod === 'manual_code'
                          ? 'keypad-outline'
                          : stop.proofMethod === 'photo_signature'
                          ? 'camera-outline'
                          : 'shield-checkmark-outline'
                      }
                      size={13}
                      color={stop.proofMethod ? '#047857' : '#92400E'}
                    />
                    <Text style={[
                      styles.proofBadgeText,
                      stop.proofMethod && styles.proofBadgeTextValid,
                    ]}>
                      {proofLabel(stop.proofMethod)}
                    </Text>
                  </View>
                </View>

                {/* Actions droite */}
                {!isDone && !isCancelled && (
                  <View style={styles.actions}>
                    {stop.phone ? (
                      <TouchableOpacity
                        style={styles.callBtn}
                        onPress={() => handleCall(stop.phone)}
                      >
                        <Ionicons name="call-outline" size={18} color="#8B5CF6" />
                      </TouchableOpacity>
                    ) : null}
                    <TouchableOpacity
                      style={[styles.actionBtn, styles.scanBtn, isValidating && styles.validateBtnDisabled]}
                      onPress={() => setScanStop(stop)}
                      disabled={!!validatingId}
                    >
                      {isValidating ? (
                        <ActivityIndicator size="small" color="#FFF" />
                      ) : (
                        <>
                          <Ionicons name="qr-code-outline" size={14} color="#FFF" />
                          <Text style={styles.validateBtnText}>Scanner QR</Text>
                        </>
                      )}
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.actionBtn, styles.codeBtn]}
                      onPress={() => {
                        setManualStop(stop);
                        setManualCode('');
                      }}
                      disabled={!!validatingId}
                    >
                      <Ionicons name="keypad-outline" size={14} color="#4C1D95" />
                      <Text style={styles.codeBtnText}>Entrer le code</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.actionBtn, styles.altBtn]}
                      onPress={() => {
                        setAlternativeStop(stop);
                        setSignatureName(stop.recipientName === 'Destinataire' ? '' : stop.recipientName);
                        setPhotoBase64(null);
                        setPhotoReady(false);
                      }}
                      onLongPress={() => handleCancel(stop)}
                      disabled={!!validatingId}
                    >
                      <Ionicons name="camera-outline" size={14} color="#065F46" />
                      <Text style={styles.altBtnText}>Preuve alternative</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {isDone && (
                  <View style={styles.doneTag}>
                    <Text style={styles.doneTagText}>Livré</Text>
                  </View>
                )}
                {isCancelled && (
                  <View style={styles.cancelledTag}>
                    <Text style={styles.cancelledTagText}>Annulé</Text>
                  </View>
                )}
              </View>
            );
          })}

          <Text style={styles.hint}>
            Chaque arrêt doit avoir sa propre preuve. Appui long sur « Preuve alternative » pour annuler une livraison.
          </Text>
        </ScrollView>
      )}

      <QRCodeScanner
        visible={!!scanStop}
        onScan={handleScanQRCode}
        onClose={() => setScanStop(null)}
      />

      <QRCodeScanResult
        visible={!!scanResult}
        data={scanResult}
        onConfirm={handleConfirmDeliveryProof}
        onClose={() => {
          setScanResult(null);
          setScanProof(null);
        }}
      />

      <Modal visible={!!manualStop} transparent animationType="slide" onRequestClose={() => setManualStop(null)}>
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Code de livraison</Text>
            <Text style={styles.modalSubtitle}>{manualStop?.recipientName}</Text>
            <TextInput
              style={styles.codeInput}
              value={manualCode}
              onChangeText={(text) => setManualCode(text.replace(/[^0-9]/g, '').slice(0, 6))}
              keyboardType="number-pad"
              maxLength={6}
              placeholder="_ _ _ _ _ _"
              placeholderTextColor="#9CA3AF"
              autoFocus
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setManualStop(null)}>
                <Text style={styles.modalCancelText}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalConfirmBtn} onPress={handleManualSubmit}>
                <Text style={styles.modalConfirmText}>Valider</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={!!alternativeStop} transparent animationType="slide" onRequestClose={resetAlternativeProof}>
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Preuve alternative</Text>
            <Text style={styles.modalSubtitle}>{alternativeStop?.recipientName}</Text>
            <TouchableOpacity style={[styles.photoBtn, photoReady && styles.photoBtnReady]} onPress={handleTakeProofPhoto}>
              <Ionicons name={photoReady ? 'checkmark-circle-outline' : 'camera-outline'} size={18} color={photoReady ? '#047857' : '#6D28D9'} />
              <Text style={[styles.photoBtnText, photoReady && styles.photoBtnTextReady]}>
                {photoReady ? 'Photo ajoutée' : 'Prendre une photo'}
              </Text>
            </TouchableOpacity>
            <TextInput
              style={styles.signatureInput}
              value={signatureName}
              onChangeText={setSignatureName}
              placeholder="Nom / signature du destinataire"
              placeholderTextColor="#9CA3AF"
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={resetAlternativeProof}>
                <Text style={styles.modalCancelText}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalConfirmBtn} onPress={handleAlternativeSubmit}>
                <Text style={styles.modalConfirmText}>Enregistrer</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
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
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    gap: 12,
  },
  backBtn: {
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
  headerSub: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 1,
  },
  refreshBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressContainer: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  progressRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  progressLabel: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '600',
  },
  progressBar: {
    height: 6,
    borderRadius: 3,
    backgroundColor: '#E5E7EB',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#6B7280',
  },
  doneCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#D1FAE5',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  doneTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
  },
  doneSub: {
    fontSize: 15,
    color: '#6B7280',
    marginBottom: 32,
  },
  doneCta: {
    backgroundColor: '#8B5CF6',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 32,
  },
  doneCtaText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  list: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  stopCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  stopCardDone: {
    backgroundColor: '#F0FDF4',
    borderColor: '#BBF7D0',
  },
  stopCardCancelled: {
    backgroundColor: '#FFF7F7',
    borderColor: '#FECACA',
    opacity: 0.7,
  },
  positionBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#8B5CF6',
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  positionBadgeDone: {
    backgroundColor: '#10B981',
  },
  positionBadgeCancelled: {
    backgroundColor: '#EF4444',
  },
  positionText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  stopInfo: {
    flex: 1,
    gap: 3,
  },
  recipientName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
  },
  addressText: {
    fontSize: 13,
    color: '#6B7280',
    lineHeight: 18,
  },
  notesText: {
    fontSize: 12,
    color: '#9CA3AF',
    fontStyle: 'italic',
    marginTop: 2,
  },
  textMuted: {
    color: '#9CA3AF',
  },
  actions: {
    flexDirection: 'column',
    alignItems: 'flex-end',
    gap: 6,
    flexShrink: 0,
    width: 132,
  },
  callBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#EDE9FE',
    justifyContent: 'center',
    alignItems: 'center',
  },
  validateBtn: {
    backgroundColor: '#8B5CF6',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 14,
    minWidth: 70,
    alignItems: 'center',
  },
  validateBtnDisabled: {
    opacity: 0.55,
  },
  validateBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  actionBtn: {
    minHeight: 34,
    borderRadius: 9,
    paddingVertical: 7,
    paddingHorizontal: 9,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 5,
    width: '100%',
  },
  scanBtn: {
    backgroundColor: '#8B5CF6',
  },
  codeBtn: {
    backgroundColor: '#EDE9FE',
  },
  codeBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#4C1D95',
  },
  altBtn: {
    backgroundColor: '#D1FAE5',
  },
  altBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#065F46',
  },
  proofBadge: {
    alignSelf: 'flex-start',
    marginTop: 6,
    borderRadius: 999,
    paddingVertical: 4,
    paddingHorizontal: 8,
    backgroundColor: '#FEF3C7',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  proofBadgeValid: {
    backgroundColor: '#D1FAE5',
  },
  proofBadgeAlternative: {
    backgroundColor: '#DBEAFE',
  },
  proofBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#92400E',
  },
  proofBadgeTextValid: {
    color: '#047857',
  },
  doneTag: {
    backgroundColor: '#D1FAE5',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  doneTagText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#059669',
  },
  cancelledTag: {
    backgroundColor: '#FEE2E2',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  cancelledTagText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#EF4444',
  },
  hint: {
    fontSize: 12,
    color: '#9CA3AF',
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(17, 24, 39, 0.55)',
    justifyContent: 'flex-end',
    padding: 16,
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 18,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111827',
  },
  modalSubtitle: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 4,
    marginBottom: 16,
  },
  codeInput: {
    height: 54,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    textAlign: 'center',
    fontSize: 24,
    fontWeight: '800',
    color: '#111827',
    letterSpacing: 4,
  },
  signatureInput: {
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    paddingHorizontal: 14,
    fontSize: 15,
    color: '#111827',
  },
  photoBtn: {
    minHeight: 46,
    borderRadius: 12,
    backgroundColor: '#F5F3FF',
    borderWidth: 1,
    borderColor: '#DDD6FE',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 12,
  },
  photoBtnReady: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
  },
  photoBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#6D28D9',
  },
  photoBtnTextReady: {
    color: '#047857',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 18,
  },
  modalCancelBtn: {
    flex: 1,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
    paddingVertical: 13,
    alignItems: 'center',
  },
  modalConfirmBtn: {
    flex: 1,
    borderRadius: 12,
    backgroundColor: '#8B5CF6',
    paddingVertical: 13,
    alignItems: 'center',
  },
  modalCancelText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#6B7280',
  },
  modalConfirmText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },
});
