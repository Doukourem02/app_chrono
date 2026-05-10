import React, { useCallback, useEffect, useRef, useState } from 'react';
import {View,Text,TouchableOpacity,StyleSheet,ScrollView,ActivityIndicator,Alert,Linking,Modal,TextInput,KeyboardAvoidingView,Platform,} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import { useBatchStore, type BatchStop } from '../../store/useBatchStore';
import { useOrderStore, type OrderRequest } from '../../store/useOrderStore';
import { getBatch, validateBatchOrder, confirmBatchPickup } from '../../services/batchApiService';
import { qrCodeService } from '../../services/qrCodeService';
import { QRCodeScanner } from '../../components/QRCodeScanner';
import { QRCodeScanResult } from '../../components/QRCodeScanResult';
import { getQRScanErrorAlert } from '../../utils/qrScanUserMessage';
import { logger } from '../../utils/logger';
import { MapboxNavigationScreen } from '../../components/MapboxNavigationScreen';
import { useDriverLocation } from '../../hooks/useDriverLocation';
import { useGeofencing } from '../../hooks/useGeofencing';
import { speakAnnouncement } from '../../utils/speechAnnouncement';

type ProofMethod = NonNullable<BatchStop['proofMethod']>;
type Coords = { latitude: number; longitude: number };

export default function BatchScreen() {
  const { batchId } = useLocalSearchParams<{ batchId: string }>();
  const insets = useSafeAreaInsets();
  const { activeBatch, updateStop } = useBatchStore();
  const getOrderById = useOrderStore((s) => s.getOrderById);

  const [isLoadingFull, setIsLoadingFull] = useState(false);
  const [validatingId, setValidatingId] = useState<string | null>(null);
  const [allDone, setAllDone] = useState(false);
  const allDoneRef = useRef(false);
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
  const [ficheData, setFicheData] = useState<{ order: OrderRequest | null; stop: BatchStop } | null>(null);

  const batch = activeBatch?.id === batchId ? activeBatch : null;
  const { location: driverLocation } = useDriverLocation(true);
  const [navigationStop, setNavigationStop] = useState<BatchStop | null>(null);
  const [navigationOrigin, setNavigationOrigin] = useState<Coords | null>(null);
  const [mapboxVoiceMuted, setMapboxVoiceMuted] = useState(false);
  const [showArrivalActions, setShowArrivalActions] = useState(false);
  const arrivedStopIdRef = useRef<string | null>(null);
  const lastEtaAnnouncedMinRef = useRef(99);
  const cancelledByUserRef = useRef(false);
  const { navigationStopOrderId } = useBatchStore();

  // Phase collecte (pickup)
  const [pickupNavActive, setPickupNavActive] = useState(false);
  const [pickupNavOrigin, setPickupNavOrigin] = useState<Coords | null>(null);
  const [showPickupArrivalBtn, setShowPickupArrivalBtn] = useState(false);
  const [isConfirmingPickup, setIsConfirmingPickup] = useState(false);
  const arrivedAtPickupRef = useRef(false);
  const pickupNavCancelledRef = useRef(false);
  const lastPickupEtaAnnouncedMinRef = useRef(99);

  const speakWithMapboxMuted = useCallback((text: string) => {
    setMapboxVoiceMuted(true);
    speakAnnouncement(text, {
      onDone: () => setMapboxVoiceMuted(false),
    });
  }, []);

  const getCurrentLocation = useCallback(async (accuracy = Location.Accuracy.Balanced) => {
    try {
      const current = await Location.getCurrentPositionAsync({ accuracy });
      return {
        latitude: current.coords.latitude,
        longitude: current.coords.longitude,
      };
    } catch (err) {
      logger.warn('[BatchScreen] location unavailable', 'BatchScreen', err);
      return undefined;
    }
  }, []);

  const markArrivedAtStop = useCallback(() => {
    if (!navigationStop) return;
    if (arrivedStopIdRef.current === navigationStop.orderId) return;
    arrivedStopIdRef.current = navigationStop.orderId;
    setShowArrivalActions(true);
    const instructionText = navigationStop.notes
      ? ` Consigne: ${navigationStop.notes.replace(/\n+/g, '. ').replace(/\s{2,}/g, ' ')}.`
      : '';
    speakWithMapboxMuted(`Vous êtes arrivés chez ${navigationStop.recipientName}.${instructionText} Validez cette livraison dans l'application.`);
  }, [navigationStop, speakWithMapboxMuted]);

  useGeofencing({
    driverPosition: driverLocation,
    targetPosition: navigationStop?.coordinates ?? null,
    orderId: navigationStop?.orderId ?? null,
    orderStatus: navigationStop ? 'delivering' : null,
    enabled: !!navigationStop && !!driverLocation && !!navigationStop.coordinates,
    onEnteredDropoffZone: markArrivedAtStop,
  });

  const startNavigationToStop = useCallback(async (stop: BatchStop) => {
    if (!stop.coordinates) {
      if (!stop.address) {
        Alert.alert('GPS manquant', "Cet arrêt n'a ni coordonnées GPS ni adresse exploitable.");
        return;
      }
      const encoded = encodeURIComponent(stop.address);
      const candidates = Platform.OS === 'ios'
        ? [`maps://?q=${encoded}`, `https://maps.apple.com/?q=${encoded}`]
        : [`geo:0,0?q=${encoded}`, `https://www.google.com/maps/search/?api=1&query=${encoded}`];
      let target = candidates[candidates.length - 1];
      for (const url of candidates) {
        if (await Linking.canOpenURL(url)) {
          target = url;
          break;
        }
      }
      Linking.openURL(target).catch(() => {
        Alert.alert('GPS manquant', "Impossible d'ouvrir une application de navigation avec cette adresse.");
      });
      return;
    }

    const origin = driverLocation ?? await getCurrentLocation(Location.Accuracy.High);
    if (!origin) {
      Alert.alert('Localisation indisponible', 'Impossible de récupérer votre position actuelle pour lancer la navigation.');
      return;
    }

    arrivedStopIdRef.current = null;
    lastEtaAnnouncedMinRef.current = 99;
    setShowArrivalActions(false);
    cancelledByUserRef.current = false;
    setNavigationOrigin(origin);
    setNavigationStop(stop);
    useBatchStore.getState().setNavigationStopOrderId(stop.orderId);
  }, [driverLocation, getCurrentLocation]);

  const stopNavigation = useCallback(() => {
    arrivedStopIdRef.current = null;
    lastEtaAnnouncedMinRef.current = 99;
    cancelledByUserRef.current = false;
    setShowArrivalActions(false);
    setNavigationStop(null);
    setNavigationOrigin(null);
    setMapboxVoiceMuted(false);
    useBatchStore.getState().setNavigationStopOrderId(null);
    useBatchStore.getState().setLastEtaMinutes(null);
  }, []);

  const handleMapboxCancelNavigation = useCallback(() => {
    if (cancelledByUserRef.current) {
      stopNavigation();
    } else {
      logger.warn('[BatchScreen] onCancelNavigation SDK (non-user) — ignoré', 'BatchScreen');
    }
  }, [stopNavigation]);

  const startPickupNavigation = useCallback(async () => {
    if (!batch?.pickupCoordinates) return;
    const origin = driverLocation ?? await getCurrentLocation(Location.Accuracy.High);
    if (!origin) {
      Alert.alert('Localisation indisponible', 'Impossible de récupérer votre position actuelle.');
      return;
    }
    arrivedAtPickupRef.current = false;
    pickupNavCancelledRef.current = false;
    lastPickupEtaAnnouncedMinRef.current = 99;
    setShowPickupArrivalBtn(false);
    setPickupNavOrigin(origin);
    setPickupNavActive(true);
    speakWithMapboxMuted('Commande groupée prise en charge, nous pouvons entamer la course.');
  }, [batch?.pickupCoordinates, driverLocation, getCurrentLocation, speakWithMapboxMuted]);

  const stopPickupNavigation = useCallback(() => {
    setPickupNavActive(false);
    setPickupNavOrigin(null);
    setShowPickupArrivalBtn(false);
    arrivedAtPickupRef.current = false;
    lastPickupEtaAnnouncedMinRef.current = 99;
    useBatchStore.getState().setLastEtaMinutes(null);
  }, []);

  const markArrivedAtPickup = useCallback(() => {
    if (arrivedAtPickupRef.current) return;
    arrivedAtPickupRef.current = true;
    setShowPickupArrivalBtn(true);
    speakWithMapboxMuted('Vous êtes arrivés au point de collecte. Récupérez tous les colis.');
  }, [speakWithMapboxMuted]);

  const handlePickupRouteProgressChange = useCallback(
    (event: { nativeEvent?: { durationRemaining?: number } }) => {
      const durationRemaining = event?.nativeEvent?.durationRemaining;
      if (durationRemaining == null || durationRemaining <= 0) return;
      const minsRemaining = Math.ceil(durationRemaining / 60);
      useBatchStore.getState().setLastEtaMinutes(minsRemaining);
      if (minsRemaining <= 1 && lastPickupEtaAnnouncedMinRef.current > 1) {
        lastPickupEtaAnnouncedMinRef.current = 1;
        speakWithMapboxMuted('Tu arrives au point de collecte dans environ une minute.');
      }
    },
    [speakWithMapboxMuted]
  );

  const handleConfirmPickup = useCallback(async () => {
    if (!batchId || isConfirmingPickup) return;
    setIsConfirmingPickup(true);
    try {
      await confirmBatchPickup(batchId);
      useBatchStore.getState().setPickedUp(batchId);
      stopPickupNavigation();
      speakWithMapboxMuted('Tous les colis pris en charge. Vous pouvez commencer vos livraisons.');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } catch (err: any) {
      Alert.alert('Erreur', err?.message ?? 'Impossible de confirmer la collecte.');
    } finally {
      setIsConfirmingPickup(false);
    }
  }, [batchId, isConfirmingPickup, stopPickupNavigation, speakWithMapboxMuted]);

  const handleRouteProgressChange = useCallback(
    (event: { nativeEvent?: { durationRemaining?: number } }) => {
      if (!navigationStop) return;
      const durationRemaining = event?.nativeEvent?.durationRemaining;
      if (durationRemaining == null || durationRemaining <= 0) return;
      const minsRemaining = Math.ceil(durationRemaining / 60);
      useBatchStore.getState().setLastEtaMinutes(minsRemaining);
      const last = lastEtaAnnouncedMinRef.current;

      if (minsRemaining <= 1 && last > 1) {
        lastEtaAnnouncedMinRef.current = 1;
        speakWithMapboxMuted('Tu arrives à destination dans environ une minute.');
      }
    },
    [navigationStop, speakWithMapboxMuted]
  );

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
      useBatchStore.getState().setActiveBatch(data);
    } catch (err: any) {
      logger.warn('[BatchScreen] getBatch error', 'BatchScreen', err);
      Alert.alert('Erreur', err?.message ?? 'Impossible de charger la tournée.');
    } finally {
      setIsLoadingFull(false);
    }
  }, [batchId]);

  useEffect(() => {
    // Charger les détails complets si les stops sont vides (arrivée depuis push/socket)
    if (!batch || batch.stops.length === 0) {
      void loadBatch();
    }
  }, [batch, loadBatch]);

  useEffect(() => {
    if (batch && batch.stops.length > 0) {
      const remaining = batch.stops.filter((s) => s.status === 'pending').length;
      const done = remaining === 0;
      setAllDone(done);
      allDoneRef.current = done;
    }
  }, [batch]);

  // Si le livreur revient via la flèche "retour" sans passer par "Retour à l'accueil",
  // on vide quand même le store pour que le FAB et les tracés disparaissent.
  useEffect(() => {
    return () => {
      if (allDoneRef.current) {
        useBatchStore.getState().clearBatch();
      }
    };
  }, []);

  // Garder une ref stable de startNavigationToStop pour éviter que les deps GPS
  // (driverLocation) ne re-déclenchent l'effet de restauration à chaque position update.
  const startNavigationToStopRef = useRef(startNavigationToStop);
  useEffect(() => { startNavigationToStopRef.current = startNavigationToStop; });

  // Ref stable pour startPickupNavigation (même raison).
  const startPickupNavigationRef = useRef(startPickupNavigation);
  useEffect(() => { startPickupNavigationRef.current = startPickupNavigation; });

  // Auto-démarrage de la navigation vers le point de collecte dès que le batch est chargé.
  const autoStartedPickupNavRef = useRef(false);
  useEffect(() => {
    if (
      batch &&
      !batch.pickedUp &&
      batch.pickupCoordinates &&
      !pickupNavActive &&
      !autoStartedPickupNavRef.current
    ) {
      autoStartedPickupNavRef.current = true;
      void startPickupNavigationRef.current();
    }
  }, [batch, pickupNavActive]);

  // Restaurer la navigation active si l'app est revenue de l'arrière-plan.
  useEffect(() => {
    if (!batch || batch.stops.length === 0 || navigationStop || !navigationStopOrderId) return;
    const storedStop = batch.stops.find(
      (s) => s.orderId === navigationStopOrderId && s.status === 'pending'
    );
    if (storedStop) void startNavigationToStopRef.current(storedStop);
  }, [batch, navigationStopOrderId, navigationStop]);

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
      if (navigationStop?.orderId === stop.orderId) {
        stopNavigation();
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      const nextStop = (batch?.stops ?? [])
        .filter((s) => s.status === 'pending' && s.orderId !== stop.orderId)
        .sort((a, b) => a.position - b.position)[0];
      if (nextStop) {
        void startNavigationToStop(nextStop);
      }
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
      Alert.alert('Code invalide', "Entrez les 6 chiffres affichés sur l'écran du destinataire.");
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
              if (navigationStop?.orderId === stop.orderId) {
                stopNavigation();
              }
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
  const cancelledCount = batch?.stops.filter((s) => s.status === 'cancelled').length ?? 0;
  const terminalCount = completedCount + cancelledCount;
  const totalCount = batch?.stops.length ?? 0;
  const remainingCount = Math.max(totalCount - terminalCount, 0);
  const progress = totalCount > 0 ? terminalCount / totalCount : 0;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#374151" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>{batch?.partner_name ?? 'Tournée groupée'}</Text>
          {batchId && (
            <Text style={styles.headerSub}>#{batchId.slice(-8).toUpperCase()}</Text>
          )}
        </View>
        <TouchableOpacity onPress={loadBatch} style={styles.refreshBtn}>
          <Ionicons name="refresh-outline" size={20} color="#6B7280" />
        </TouchableOpacity>
      </View>

      {/* Barre de progression — phase livraison uniquement */}
      {!isLoadingFull && batch?.pickedUp && totalCount > 0 && (
        <View style={styles.progressContainer}>
          <View style={styles.progressRow}>
            <Text style={styles.progressLabel}>{terminalCount}/{totalCount} arrêts traités</Text>
            <Text style={[styles.progressLabel, { color: allDone ? '#10B981' : '#6B7280' }]}>
              {allDone ? 'Tournée terminée ✓' : `${remainingCount} restant${remainingCount > 1 ? 's' : ''}`}
            </Text>
          </View>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${Math.round(progress * 100)}%`, backgroundColor: allDone ? '#10B981' : '#8B5CF6' }]} />
          </View>
          <Text style={styles.orderHint}>
            {"Ordre conseillé. Choisis l'arrêt le plus logique selon le terrain."}
          </Text>
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
          <Text style={styles.doneTitle}>
            {cancelledCount > 0 && completedCount > 0 ? 'Tournée partiellement terminée' : 'Tournée terminée !'}
          </Text>
          <Text style={styles.doneSub}>
            {completedCount} livrée{completedCount > 1 ? 's' : ''}{cancelledCount > 0 ? `, ${cancelledCount} annulée${cancelledCount > 1 ? 's' : ''}` : ''}
          </Text>
          <TouchableOpacity style={styles.doneCta} onPress={() => { useBatchStore.getState().clearBatch(); router.replace('/(tabs)' as any); }}>
            <Text style={styles.doneCtaText}>{"Retour à l'accueil"}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView style={styles.list} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}>
          {/* Fallback collecte manuelle : affiché uniquement si le batch n'a pas de coordonnées GPS (pas de geofencing possible) */}
          {batch && !batch.pickedUp && !batch.pickupCoordinates && (
            <View style={styles.pickupFallbackCard}>
              <View style={styles.pickupAddressCard}>
                <Ionicons name="location-outline" size={18} color="#6B7280" />
                <Text style={styles.pickupAddressText} numberOfLines={3}>
                  {batch.pickupAddress || batch.partner_name || 'Point de collecte partenaire'}
                </Text>
              </View>
              <TouchableOpacity
                style={[styles.pickupConfirmBtn, isConfirmingPickup && styles.validateBtnDisabled]}
                onPress={handleConfirmPickup}
                disabled={isConfirmingPickup}
              >
                {isConfirmingPickup ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Ionicons name="checkmark-circle-outline" size={20} color="#FFFFFF" />
                    <Text style={styles.pickupConfirmBtnText}>Tous les colis récupérés</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          )}
          {(batch?.stops ?? []).map((stop) => {
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
                  navigationStop?.orderId === stop.orderId && styles.stopCardNavigating,
                ]}
              >
                {/* Position + statut */}
                <View style={[styles.positionBadge, isDone && styles.positionBadgeDone, isCancelled && styles.positionBadgeCancelled]}>
                  {isDone ? (
                    <Ionicons name="checkmark" size={16} color="#FFF" />
                  ) : isCancelled ? (
                    <Ionicons name="close" size={16} color="#FFF" />
                  ) : (
                    <Text style={styles.positionText}>{stop.position}</Text>
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
                    styles.statusPill,
                    isDone && styles.statusPillDone,
                    isCancelled && styles.statusPillCancelled,
                  ]}>
                    <Text style={[
                      styles.statusPillText,
                      isDone && styles.statusPillTextDone,
                      isCancelled && styles.statusPillTextCancelled,
                    ]}>
                      {isDone ? 'Livré' : isCancelled ? 'Annulé' : 'À faire'}
                    </Text>
                  </View>
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
                  <TouchableOpacity
                    style={styles.ficheBtn}
                    onPress={() => setFicheData({ order: getOrderById(stop.orderId) ?? null, stop })}
                  >
                    <Ionicons name="information-circle-outline" size={14} color="#6B7280" />
                    <Text style={styles.ficheBtnText}>Fiche</Text>
                  </TouchableOpacity>
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
                      style={[
                        styles.actionBtn,
                        styles.navBtn,
                        navigationStop?.orderId === stop.orderId && styles.validateBtnDisabled,
                      ]}
                      onPress={() => startNavigationToStop(stop)}
                      disabled={!!validatingId || navigationStop?.orderId === stop.orderId}
                    >
                      <Ionicons name="navigate-outline" size={14} color="#FFFFFF" />
                      <Text style={styles.navBtnText}>
                        {!stop.coordinates ? 'GPS absent' : navigationStop?.orderId === stop.orderId ? 'En cours' : 'Démarrer'}
                      </Text>
                    </TouchableOpacity>
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
                    <Text style={styles.altHint}>Appui long pour annuler</Text>
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

      {batch?.pickedUp && navigationStop && navigationOrigin && navigationStop.coordinates ? (
        <View style={StyleSheet.absoluteFill}>
          <MapboxNavigationScreen
            key={`batch-nav-${navigationStop.orderId}`}
            origin={navigationOrigin}
            destination={navigationStop.coordinates}
            mute={mapboxVoiceMuted}
            onArrive={markArrivedAtStop}
            onCancel={handleMapboxCancelNavigation}
            onBackPress={() => {
              cancelledByUserRef.current = true;
              stopNavigation();
            }}
            onRouteProgressChange={handleRouteProgressChange}
          />
          {showArrivalActions ? (
            <View style={[styles.arrivalActions, { paddingBottom: Math.max(insets.bottom, 14) }]}>
              <TouchableOpacity
                style={[styles.arrivalButton, styles.arrivalScanButton]}
                onPress={() => setScanStop(navigationStop)}
                disabled={!!validatingId}
              >
                <Ionicons name="qr-code-outline" size={17} color="#FFFFFF" />
                <Text style={styles.arrivalScanText}>Scanner QR</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.arrivalButton, styles.arrivalCodeButton]}
                onPress={() => {
                  setManualStop(navigationStop);
                  setManualCode('');
                }}
                disabled={!!validatingId}
              >
                <Ionicons name="keypad-outline" size={17} color="#4C1D95" />
                <Text style={styles.arrivalCodeText}>Code</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.arrivalButton, styles.arrivalProofButton]}
                onPress={() => {
                  setAlternativeStop(navigationStop);
                  setSignatureName(navigationStop.recipientName === 'Destinataire' ? '' : navigationStop.recipientName);
                  setPhotoBase64(null);
                  setPhotoReady(false);
                }}
                disabled={!!validatingId}
              >
                <Ionicons name="camera-outline" size={17} color="#065F46" />
                <Text style={styles.arrivalProofText}>Preuve</Text>
              </TouchableOpacity>
            </View>
          ) : null}
        </View>
      ) : null}

      {pickupNavActive && pickupNavOrigin && batch?.pickupCoordinates ? (
        <View style={StyleSheet.absoluteFill}>
          <MapboxNavigationScreen
            key="batch-pickup-nav"
            origin={pickupNavOrigin}
            destination={batch.pickupCoordinates}
            mute={mapboxVoiceMuted}
            onArrive={markArrivedAtPickup}
            onCancel={stopPickupNavigation}
            onBackPress={() => {
              pickupNavCancelledRef.current = true;
              stopPickupNavigation();
            }}
            onRouteProgressChange={handlePickupRouteProgressChange}
          />
          {showPickupArrivalBtn ? (
            <TouchableOpacity
              style={[styles.pickupFloatingBtn, { bottom: Math.max(insets.bottom + 110, 130) }]}
              onPress={handleConfirmPickup}
              disabled={isConfirmingPickup}
              activeOpacity={0.85}
            >
              {isConfirmingPickup ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <>
                  <Ionicons name="checkmark-circle-outline" size={20} color="#FFF" />
                  <Text style={styles.pickupFloatingBtnText}>Tous les colis récupérés</Text>
                </>
              )}
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}

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

      <Modal
        visible={!!ficheData}
        transparent
        animationType="slide"
        onRequestClose={() => setFicheData(null)}
      >
        <View style={styles.ficheModal}>
          <View style={[styles.ficheSheet, { paddingBottom: Math.max(insets.bottom + 16, 32) }]}>
            <View style={styles.ficheHandle} />
            <View style={styles.ficheHeaderRow}>
              <Text style={styles.ficheTitle} numberOfLines={1}>
                {ficheData?.stop.recipientName ?? '—'}
              </Text>
              <TouchableOpacity style={styles.ficheCloseBtn} onPress={() => setFicheData(null)}>
                <Ionicons name="close" size={22} color="#6B7280" />
              </TouchableOpacity>
            </View>

            {!ficheData?.order && (
              <View style={styles.ficheFallbackBadge}>
                <Ionicons name="warning-outline" size={13} color="#92400E" />
                <Text style={styles.ficheFallbackText}>Données limitées — commande non chargée</Text>
              </View>
            )}

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Notes opérateur */}
              {(ficheData?.order?.operatorCourseNotes || ficheData?.order?.dropoff?.details?.operator_course_notes) ? (
                <>
                  <View style={styles.ficheSection}>
                    <Text style={styles.ficheSectionLabel}>Notes opérateur</Text>
                    <Text style={styles.ficheSectionValue}>
                      {ficheData.order?.operatorCourseNotes ?? ficheData.order?.dropoff?.details?.operator_course_notes}
                    </Text>
                  </View>
                  <View style={styles.ficheDivider} />
                </>
              ) : null}

              {/* Notes livreur */}
              {(ficheData?.order?.driverNotes || ficheData?.order?.dropoff?.details?.driver_notes) ? (
                <>
                  <View style={styles.ficheSection}>
                    <Text style={styles.ficheSectionLabel}>Notes livreur</Text>
                    <Text style={styles.ficheSectionValue}>
                      {ficheData.order?.driverNotes ?? ficheData.order?.dropoff?.details?.driver_notes}
                    </Text>
                  </View>
                  <View style={styles.ficheDivider} />
                </>
              ) : null}

              {/* Notes générales */}
              {ficheData?.order?.notes ? (
                <>
                  <View style={styles.ficheSection}>
                    <Text style={styles.ficheSectionLabel}>Notes</Text>
                    <Text style={styles.ficheSectionValue}>{ficheData.order.notes}</Text>
                  </View>
                  <View style={styles.ficheDivider} />
                </>
              ) : null}

              {/* Consignes client */}
              {(ficheData?.order?.dropoff?.details?.courier_note ||
                ficheData?.order?.dropoff?.details?.thermal_bag ||
                ficheData?.order?.dropoff?.details?.scheduled_window_note ||
                ficheData?.order?.dropoff?.details?.recipient_message) ? (
                <>
                  <View style={styles.ficheSection}>
                    <Text style={styles.ficheSectionLabel}>Consignes client</Text>
                    {ficheData.order?.dropoff?.details?.thermal_bag ? (
                      <Text style={styles.ficheSectionValue}>• Sac thermique requis</Text>
                    ) : null}
                    {ficheData.order?.dropoff?.details?.scheduled_window_note ? (
                      <Text style={styles.ficheSectionValue}>• Créneau : {ficheData.order.dropoff.details.scheduled_window_note}</Text>
                    ) : null}
                    {ficheData.order?.dropoff?.details?.courier_note ? (
                      <Text style={styles.ficheSectionValue}>• {ficheData.order.dropoff.details.courier_note}</Text>
                    ) : null}
                    {ficheData.order?.dropoff?.details?.recipient_message ? (
                      <Text style={styles.ficheSectionValue}>• Message destinataire : {ficheData.order.dropoff.details.recipient_message}</Text>
                    ) : null}
                  </View>
                  <View style={styles.ficheDivider} />
                </>
              ) : null}

              {/* Mode de service */}
              {ficheData?.order?.speedOptionId ? (
                <>
                  <View style={styles.ficheSection}>
                    <Text style={styles.ficheSectionLabel}>Mode de service</Text>
                    <Text style={styles.ficheSectionValue}>{ficheData.order.speedOptionId}</Text>
                  </View>
                  <View style={styles.ficheDivider} />
                </>
              ) : null}

              {/* Partenaire B2B */}
              {ficheData?.order?.partner_name ? (
                <>
                  <View style={styles.ficheSection}>
                    <Text style={styles.ficheSectionLabel}>Partenaire</Text>
                    <Text style={styles.ficheSectionValue}>{ficheData.order.partner_name}</Text>
                  </View>
                  <View style={styles.ficheDivider} />
                </>
              ) : null}

              {/* Fallback : données BatchStop */}
              {ficheData?.stop.notes ? (
                <View style={styles.ficheSection}>
                  <Text style={styles.ficheSectionLabel}>Consignes (depuis tournée)</Text>
                  <Text style={styles.ficheSectionValue}>{ficheData.stop.notes}</Text>
                </View>
              ) : null}

              {!ficheData?.order &&
                !ficheData?.stop.notes && (
                  <Text style={[styles.ficheSectionValue, { color: '#9CA3AF', fontStyle: 'italic' }]}>
                    Aucune information complémentaire disponible.
                  </Text>
                )}
            </ScrollView>
          </View>
        </View>
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
  orderHint: {
    marginTop: 8,
    fontSize: 12,
    color: '#6B7280',
    lineHeight: 16,
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
  stopCardNavigating: {
    borderColor: '#2563EB',
    borderWidth: 2,
    backgroundColor: '#EFF6FF',
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
  statusPill: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginTop: 4,
  },
  statusPillDone: {
    backgroundColor: '#D1FAE5',
  },
  statusPillCancelled: {
    backgroundColor: '#FEE2E2',
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#92400E',
  },
  statusPillTextDone: {
    color: '#047857',
  },
  statusPillTextCancelled: {
    color: '#B91C1C',
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
  navBtn: {
    backgroundColor: '#2563EB',
  },
  navBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFFFFF',
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
  altHint: {
    fontSize: 10,
    color: '#9CA3AF',
    textAlign: 'center',
    marginTop: -2,
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
  navStopBanner: {
    position: 'absolute',
    left: 16,
    right: 16,
    borderRadius: 14,
    backgroundColor: 'rgba(17, 24, 39, 0.92)',
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  navStopEyebrow: {
    color: '#93C5FD',
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 3,
  },
  navStopTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  navStopAddress: {
    color: '#D1D5DB',
    fontSize: 12,
    lineHeight: 17,
    marginTop: 3,
  },
  arrivalActions: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 0,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    backgroundColor: '#FFFFFF',
    paddingTop: 12,
    paddingHorizontal: 12,
    flexDirection: 'row',
    gap: 8,
  },
  arrivalButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  arrivalScanButton: {
    backgroundColor: '#8B5CF6',
  },
  arrivalCodeButton: {
    backgroundColor: '#EDE9FE',
  },
  arrivalProofButton: {
    backgroundColor: '#D1FAE5',
  },
  arrivalScanText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  arrivalCodeText: {
    color: '#4C1D95',
    fontSize: 13,
    fontWeight: '800',
  },
  arrivalProofText: {
    color: '#065F46',
    fontSize: 13,
    fontWeight: '800',
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
  ficheBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 6,
    alignSelf: 'flex-start',
  },
  ficheBtnText: {
    fontSize: 11,
    color: '#6B7280',
  },
  ficheModal: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  ficheSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 32,
    maxHeight: '80%',
  },
  ficheHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E5E7EB',
    alignSelf: 'center',
    marginBottom: 14,
  },
  ficheHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  ficheTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    flex: 1,
  },
  ficheCloseBtn: {
    padding: 4,
  },
  ficheSection: {
    marginBottom: 14,
  },
  ficheSectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#8B5CF6',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 4,
  },
  ficheSectionValue: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 20,
  },
  ficheDivider: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginVertical: 10,
  },
  ficheFallbackBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FEF3C7',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    alignSelf: 'flex-start',
    marginBottom: 10,
  },
  ficheFallbackText: {
    fontSize: 11,
    color: '#92400E',
  },
  pickupFallbackCard: {
    marginBottom: 16,
    gap: 10,
  },
  pickupFloatingBtn: {
    position: 'absolute',
    left: 16,
    right: 16,
    backgroundColor: '#8B5CF6',
    borderRadius: 16,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 8,
  },
  pickupFloatingBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  pickupAddressCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  pickupAddressText: {
    flex: 1,
    fontSize: 14,
    color: '#374151',
    lineHeight: 20,
  },
  pickupConfirmBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#10B981',
    borderRadius: 14,
    paddingVertical: 16,
    marginBottom: 12,
  },
  pickupConfirmBtnText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
  },
});
