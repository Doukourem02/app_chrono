import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  Linking,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useBatchStore, type BatchStop } from '../../store/useBatchStore';
import { getBatch, validateBatchOrder } from '../../services/batchApiService';
import { logger } from '../../utils/logger';

export default function BatchScreen() {
  const { batchId } = useLocalSearchParams<{ batchId: string }>();
  const insets = useSafeAreaInsets();
  const { activeBatch, setActiveBatch, updateStop } = useBatchStore();

  const [isLoadingFull, setIsLoadingFull] = useState(false);
  const [validatingId, setValidatingId] = useState<string | null>(null);
  const [allDone, setAllDone] = useState(false);

  const batch = activeBatch?.id === batchId ? activeBatch : null;

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

  const handleValidate = async (stop: BatchStop) => {
    if (!batchId || validatingId) return;
    setValidatingId(stop.orderId);
    try {
      await validateBatchOrder(batchId, stop.orderId, 'completed');
      updateStop(stop.orderId, 'completed');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } catch (err: any) {
      Alert.alert('Erreur', err?.message ?? 'Impossible de valider la livraison.');
    } finally {
      setValidatingId(null);
    }
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
          <Text style={styles.headerTitle}>Tournée B2B</Text>
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
                      style={[styles.validateBtn, isValidating && styles.validateBtnDisabled]}
                      onPress={() => handleValidate(stop)}
                      onLongPress={() => handleCancel(stop)}
                      disabled={!!validatingId}
                    >
                      {isValidating ? (
                        <ActivityIndicator size="small" color="#FFF" />
                      ) : (
                        <Text style={styles.validateBtnText}>Livré ✓</Text>
                      )}
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
            Appui long sur « Livré ✓ » pour annuler une livraison.
          </Text>
        </ScrollView>
      )}
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
    alignItems: 'center',
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
});
