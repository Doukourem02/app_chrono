import React, { useState, useMemo } from 'react';
import {View,Text,TouchableOpacity,ScrollView,StyleSheet,Animated,PanResponderInstance,Dimensions,Alert,Linking} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { OrderRequest } from '../store/useOrderStore';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { QRCodeScanner } from './QRCodeScanner';
import { QRCodeScanResult } from './QRCodeScanResult';
import { qrCodeService } from '../services/qrCodeService';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

const NAV_BAR_HEIGHT = 80;
const NAV_BAR_BOTTOM = 25;
const SPACING_ABOVE_NAV = 15;
const BOTTOM_OFFSET = NAV_BAR_HEIGHT + NAV_BAR_BOTTOM + SPACING_ABOVE_NAV; // 120px
const BOTTOM_SHEET_MAX_HEIGHT = SCREEN_HEIGHT - BOTTOM_OFFSET - 500; 

type TabType = 'details' | 'messages';

interface DriverOrderBottomSheetProps {
  currentOrder: OrderRequest | null;
  panResponder: PanResponderInstance;
  animatedHeight: Animated.Value;
  isExpanded: boolean;
  onToggle: () => void;
  onUpdateStatus: (status: string) => void;
  location?: { latitude: number; longitude: number } | null;
  onMessage?: () => void; // Callback pour ouvrir la messagerie
}

const DriverOrderBottomSheet: React.FC<DriverOrderBottomSheetProps> = ({
  currentOrder,
  panResponder,
  animatedHeight,
  isExpanded,
  onToggle,
  onUpdateStatus,
  location,
  onMessage,
}) => {
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<TabType>('details');
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [scanResult, setScanResult] = useState<{
    recipientName: string;
    recipientPhone: string;
    creatorName: string;
    orderNumber: string;
  } | null>(null);

  // Handler pour scanner le QR code
  const handleScanQRCode = async (qrCodeData: string) => {
    try {
      const result = await qrCodeService.scanQRCode(qrCodeData, location || undefined);
      
      if (result.success && result.isValid && result.data) {
        // Extraire uniquement les champs nécessaires pour le composant QRCodeScanResult
        const { orderId, ...scanData } = result.data;
        setScanResult(scanData);
        setShowQRScanner(false);
      } else {
        Alert.alert(
          'QR Code invalide',
          result.error || 'Le QR code scanné n\'est pas valide pour cette commande',
          [{ text: 'OK', onPress: () => setShowQRScanner(false) }]
        );
      }
    } catch (error: any) {
      Alert.alert('Erreur', error.message || 'Erreur lors du scan du QR code');
    }
  };

  // Handler pour confirmer la livraison après scan
  const handleConfirmDelivery = () => {
    if (scanResult) {
      setScanResult(null);
      onUpdateStatus('completed');
    }
  };

  // Déterminer les actions disponibles selon le statut
  // Doit être appelé avant tout return conditionnel pour respecter les règles des hooks
  const availableActions = useMemo(() => {
    if (!currentOrder) return [];
    
    const status = String(currentOrder.status);
    const actions = [];
    
    // Étape 1: "Je pars" - disponible uniquement si statut est 'accepted'
    if (status === 'accepted') {
      actions.push({
        id: 'enroute',
        label: 'Je pars',
        icon: 'car-outline',
        color: '#6366F1',
        onPress: () => onUpdateStatus('enroute'),
      });
    }

    // Étape 2: "Colis récupéré" - disponible uniquement si statut est 'enroute' (pas 'accepted')
    // Cela force le livreur à cliquer sur "Je pars" avant de pouvoir récupérer le colis
    if (status === 'enroute' || status === 'in_progress') {
      actions.push({
        id: 'picked_up',
        label: 'Colis récupéré',
        icon: 'cube-outline',
        color: '#F59E0B',
        onPress: () => onUpdateStatus('picked_up'),
      });
    }

    // Étape 3: "En cours de livraison" - disponible si statut est 'picked_up'
    // Cette étape intermédiaire est nécessaire avant de terminer
    if (status === 'picked_up') {
      actions.push({
        id: 'delivering',
        label: 'En cours de livraison',
        icon: 'bicycle-outline',
        color: '#8B5CF6',
        onPress: () => onUpdateStatus('delivering'),
      });
    }

    // Scanner QR Code - disponible si statut est 'picked_up' ou 'delivering'
    if (status === 'picked_up' || status === 'delivering') {
      actions.push({
        id: 'scan_qr',
        label: 'Scanner QR Code',
        icon: 'qr-code-outline',
        color: '#6366F1',
        onPress: () => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          setShowQRScanner(true);
        },
      });
    }

    // Étape 4: "Terminé" - disponible uniquement si statut est 'delivering'
    // Cela force le livreur à passer par l'étape "En cours de livraison" avant de terminer
    // Note: Le scan QR code met automatiquement le statut à 'completed'
    if (status === 'delivering' || status === 'in_progress') {
      actions.push({
        id: 'completed',
        label: 'Terminé',
        icon: 'checkmark-circle-outline',
        color: '#10B981',
        onPress: () => onUpdateStatus('completed'),
      });
    }

    return actions;
  }, [currentOrder, onUpdateStatus]);

  if (!currentOrder) return null;

  const recipientPhone = currentOrder?.recipient?.phone || currentOrder?.dropoff?.details?.phone || currentOrder?.user?.phone || null;
  const dropoffDetails = currentOrder?.dropoff?.details || {};
  const packageImages = currentOrder?.packageImages || currentOrder?.dropoff?.details?.photos || [];
  const isPhoneOrder = currentOrder?.isPhoneOrder || false;
  const driverNotes = currentOrder?.driverNotes || '';

  const handleCall = () => {
    if (!recipientPhone && !currentOrder?.user?.phone) {
      Alert.alert('Information', 'Numéro de téléphone non disponible');
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const phoneNumber = (recipientPhone || currentOrder?.user?.phone || '').startsWith('+') 
      ? (recipientPhone || currentOrder?.user?.phone || '') 
      : `+${recipientPhone || currentOrder?.user?.phone || ''}`;
    Linking.openURL(`tel:${phoneNumber}`).catch(() => {
      Alert.alert('Erreur', 'Impossible d\'ouvrir l\'application téléphone');
    });
  };

  const handleNavigate = () => {
    if (!currentOrder?.dropoff?.coordinates) {
      Alert.alert('Information', 'Coordonnées non disponibles');
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const { latitude, longitude } = currentOrder.dropoff.coordinates;
    const url = `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`;
    Linking.openURL(url).catch(() => {
      Alert.alert('Erreur', 'Impossible d\'ouvrir l\'application de navigation');
    });
  };

  const handleOpenMessage = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (onMessage) {
      onMessage();
    }
  };

  return (
    <Animated.View
      {...panResponder.panHandlers}
      style={[
        styles.sheetContainer,
        {
          height: animatedHeight,
          bottom: Math.max(insets.bottom, BOTTOM_OFFSET),
        },
      ]}
    >
      {/* Handle */}
      <TouchableOpacity onPress={onToggle} style={styles.dragIndicator}>
        <View style={styles.dragHandle} />
      </TouchableOpacity>

      {/* ✅ COLLAPSÉ */}
      {!isExpanded && (
        <View style={styles.collapsedWrapper}>
          <View style={styles.collapsedContainer}>
            <View style={styles.collapsedLeft}>
              <View style={styles.collapsedIcon}>
                <Ionicons name="cube" size={24} color="#7C3AED" />
              </View>
              <View style={styles.collapsedTextContainer}>
                <Text style={styles.collapsedTitle} numberOfLines={1}>
                  {currentOrder.dropoff.address || 'Adresse de livraison'}
                </Text>
                <Text style={styles.collapsedSubtitle}>
                  {availableActions.length > 0 
                    ? `${availableActions.length} action${availableActions.length > 1 ? 's' : ''} pour cette commande`
                    : 'Livraison en cours'}
                </Text>
              </View>
            </View>
            <View style={styles.collapsedActions}>
              {availableActions.slice(0, 2).map((action) => (
                <TouchableOpacity
                  key={action.id}
                  style={[styles.collapsedActionButton, { backgroundColor: action.color }]}
                  onPress={action.onPress}
                >
                  <Ionicons name={action.icon as any} size={18} color="#fff" />
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      )}

      {/* ✅ EXPANDÉ */}
      {isExpanded && (
        <View style={styles.expandedCard}>
          {/* Header avec onglets */}
          <View style={styles.header}>
            <View style={styles.titleContainer}>
              <Text style={styles.title}>Commande en cours</Text>
              {isPhoneOrder && (
                <View style={styles.offlineBadge}>
                  <Ionicons name="phone-portrait-outline" size={14} color="#F59E0B" />
                  <Text style={styles.offlineBadgeText}>Hors ligne</Text>
                </View>
              )}
            </View>
            <View style={styles.tabsContainer}>
              <TouchableOpacity
                style={[styles.tab, activeTab === 'details' && styles.tabActive]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setActiveTab('details');
                }}
              >
                <Ionicons
                  name="information-circle-outline"
                  size={18}
                  color={activeTab === 'details' ? '#7C3AED' : '#9CA3AF'}
                />
                <Text
                  style={[styles.tabText, activeTab === 'details' && styles.tabTextActive]}
                >
                  Détails de livraison
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.tab, activeTab === 'messages' && styles.tabActive]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  // Ouvrir directement la messagerie quand on clique sur l'onglet "Messages client"
                  handleOpenMessage();
                }}
              >
                <Ionicons
                  name="chatbubble-ellipses-outline"
                  size={18}
                  color={activeTab === 'messages' ? '#7C3AED' : '#9CA3AF'}
                />
                <Text
                  style={[styles.tabText, activeTab === 'messages' && styles.tabTextActive]}
                >
                  Messages client
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Contenu selon l'onglet actif */}
          <ScrollView
            showsVerticalScrollIndicator={false}
            style={styles.scrollContent}
            nestedScrollEnabled={true}
          >
            {activeTab === 'details' ? (
              <View style={styles.detailsContent}>
                {/* Badge et bouton pour commandes hors ligne */}
                {isPhoneOrder && (
                  <View style={styles.offlineSection}>
                    <View style={styles.offlineAlert}>
                      <Ionicons name="warning-outline" size={20} color="#F59E0B" />
                      <View style={styles.offlineAlertText}>
                        <Text style={styles.offlineAlertTitle}>Commande hors ligne</Text>
                        <Text style={styles.offlineAlertSubtitle}>
                          Cette commande a été créée par téléphone. Les coordonnées GPS peuvent être approximatives.
                        </Text>
                        {driverNotes && (
                          <Text style={styles.driverNotesText}>
                            <Text style={styles.driverNotesLabel}>Note: </Text>
                            {driverNotes}
                          </Text>
                        )}
                      </View>
                    </View>
                    <TouchableOpacity style={styles.callClientButton} onPress={handleCall}>
                      <Ionicons name="call" size={20} color="#FFFFFF" />
                      <Text style={styles.callClientButtonText}>
                        Appeler le client pour position exacte
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}

                {/* Actions de statut */}
                {availableActions.length > 0 && (
                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Actions</Text>
                    <View style={styles.actionsGrid}>
                      {availableActions.map((action) => (
                        <TouchableOpacity
                          key={action.id}
                          style={[styles.actionCard, { borderColor: action.color }]}
                          onPress={action.onPress}
                        >
                          <View style={[styles.actionIconContainer, { backgroundColor: `${action.color}15` }]}>
                            <Ionicons name={action.icon as any} size={24} color={action.color} />
                          </View>
                          <Text style={[styles.actionLabel, { color: action.color }]}>
                            {action.label}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                )}

                {/* Adresse de livraison */}
                <View style={styles.section}>
                  <View style={styles.sectionHeader}>
                    <Ionicons name="location" size={20} color="#7C3AED" />
                    <Text style={styles.sectionTitle}>Adresse de livraison</Text>
                  </View>
                  <View style={styles.addressCard}>
                    <Text style={styles.addressText}>{currentOrder.dropoff.address}</Text>
                  </View>
                  {currentOrder.dropoff.coordinates ? (
                    <TouchableOpacity style={styles.navigateButton} onPress={handleNavigate}>
                      <LinearGradient
                        colors={['#7C3AED', '#6366F1']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.navigateButtonGradient}
                      >
                        <Ionicons name="navigate" size={20} color="#fff" />
                        <Text style={styles.navigateButtonText}>Ouvrir la navigation</Text>
                      </LinearGradient>
                    </TouchableOpacity>
                  ) : isPhoneOrder ? (
                    <View style={styles.noCoordinatesWarning}>
                      <Ionicons name="information-circle-outline" size={20} color="#F59E0B" />
                      <Text style={styles.noCoordinatesText}>
                        Coordonnées GPS non disponibles. Appelez le client pour obtenir sa position exacte.
                      </Text>
                    </View>
                  ) : null}
                </View>

                {/* Téléphone */}
                {recipientPhone && (
                  <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                      <Ionicons name="call-outline" size={20} color="#7C3AED" />
                      <Text style={styles.sectionTitle}>Téléphone</Text>
                    </View>
                    <View style={styles.phoneCard}>
                      <Text style={styles.phoneText}>{recipientPhone}</Text>
                    </View>
                    <TouchableOpacity style={styles.callButton} onPress={handleCall}>
                      <LinearGradient
                        colors={['#10B981', '#059669']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.callButtonGradient}
                      >
                        <Ionicons name="call" size={20} color="#fff" />
                        <Text style={styles.callButtonText}>Appeler maintenant</Text>
                      </LinearGradient>
                    </TouchableOpacity>
                  </View>
                )}

                {/* Détails supplémentaires */}
                {(dropoffDetails.entrance || dropoffDetails.apartment || dropoffDetails.floor || dropoffDetails.intercom) && (
                  <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                      <Ionicons name="information-circle-outline" size={20} color="#7C3AED" />
                      <Text style={styles.sectionTitle}>Détails de l&apos;adresse</Text>
                    </View>
                    <View style={styles.detailsCard}>
                      {dropoffDetails.entrance && (
                        <View style={styles.detailRow}>
                          <Text style={styles.detailLabel}>Entrée</Text>
                          <Text style={styles.detailValue}>{dropoffDetails.entrance}</Text>
                        </View>
                      )}
                      {dropoffDetails.apartment && (
                        <View style={styles.detailRow}>
                          <Text style={styles.detailLabel}>Appartement</Text>
                          <Text style={styles.detailValue}>{dropoffDetails.apartment}</Text>
                        </View>
                      )}
                      {dropoffDetails.floor && (
                        <View style={styles.detailRow}>
                          <Text style={styles.detailLabel}>Étage</Text>
                          <Text style={styles.detailValue}>{dropoffDetails.floor}</Text>
                        </View>
                      )}
                      {dropoffDetails.intercom && (
                        <View style={styles.detailRow}>
                          <Text style={styles.detailLabel}>Interphone</Text>
                          <Text style={styles.detailValue}>{dropoffDetails.intercom}</Text>
                        </View>
                      )}
                    </View>
                  </View>
                )}

                {/* Photos du colis */}
                {packageImages.length > 0 && (
                  <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                      <Ionicons name="images-outline" size={20} color="#7C3AED" />
                      <Text style={styles.sectionTitle}>Photos du colis ({packageImages.length})</Text>
                    </View>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photosContainer}>
                      {packageImages.map((uri, index) => (
                        <View key={index} style={styles.photoItem}>
                          <Text style={styles.photoPlaceholder}>{index + 1}</Text>
                        </View>
                      ))}
                    </ScrollView>
                  </View>
                )}
              </View>
            ) : (
              <View style={styles.messagesContent}>
                <View style={styles.emptyMessagesState}>
                  <Ionicons name="chatbubble-ellipses-outline" size={64} color="#D1D5DB" />
                  <Text style={styles.emptyMessagesTitle}>Messagerie</Text>
                  <Text style={styles.emptyMessagesText}>
                    Communiquez directement avec le client depuis ici.
                  </Text>
                  <TouchableOpacity
                    style={styles.comingSoonButton}
                    onPress={handleOpenMessage}
                  >
                    <Text style={styles.comingSoonButtonText}>Ouvrir la messagerie</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </ScrollView>
        </View>
      )}

      {/* Scanner QR Code */}
      <QRCodeScanner
        visible={showQRScanner}
        onScan={handleScanQRCode}
        onClose={() => setShowQRScanner(false)}
      />

      {/* Résultat du scan QR Code */}
      <QRCodeScanResult
        visible={!!scanResult}
        data={scanResult}
        onConfirm={handleConfirmDelivery}
        onClose={() => setScanResult(null)}
      />
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  sheetContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    backgroundColor: 'transparent',
    alignItems: 'center',
  },
  dragIndicator: {
    alignItems: 'center',
    marginTop: 6,
    marginBottom: 0, // Réduit pour que le handle touche le container blanc
  },
  dragHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#D1D5DB',
  },
  collapsedWrapper: {
    alignSelf: 'center',
    width: '92%',
    backgroundColor: '#fff',
    padding: 12,
    paddingTop: 0, // Réduit pour que le handle touche le container
    borderRadius: 20,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  collapsedContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  collapsedLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  collapsedIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F5F0FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  collapsedTextContainer: {
    flex: 1,
  },
  collapsedTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 4,
  },
  collapsedSubtitle: {
    fontSize: 12,
    color: '#6B7280',
  },
  collapsedActions: {
    flexDirection: 'row',
    gap: 8,
  },
  collapsedActionButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  expandedCard: {
    width: '92%',
    backgroundColor: '#fff',
    borderRadius: 24,
    paddingTop: 0, // Réduit pour que le handle touche le container
    paddingHorizontal: 20,
    paddingBottom: 20,
    alignSelf: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 15,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
    maxHeight: BOTTOM_SHEET_MAX_HEIGHT - 40,
  },
  header: {
    marginTop: 16, // Ajouté pour compenser le paddingTop supprimé
    marginBottom: 20,
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
  },
  offlineBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F59E0B',
  },
  offlineBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#92400E',
  },
  tabsContainer: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    padding: 4,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    gap: 8,
  },
  tabActive: {
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#9CA3AF',
  },
  tabTextActive: {
    color: '#7C3AED',
  },
  scrollContent: {
    flex: 1,
  },
  detailsContent: {
    paddingBottom: 20,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  actionCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 2,
  },
  actionIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  actionLabel: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  addressCard: {
    backgroundColor: '#F9FAFB',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  addressText: {
    fontSize: 15,
    color: '#1F2937',
    lineHeight: 22,
    fontWeight: '500',
  },
  navigateButton: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  navigateButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 8,
  },
  navigateButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  phoneCard: {
    backgroundColor: '#F5F0FF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: '#E9D5FF',
  },
  phoneText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#059669',
  },
  callButton: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  callButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 8,
  },
  callButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  offlineSection: {
    marginBottom: 24,
  },
  offlineAlert: {
    flexDirection: 'row',
    backgroundColor: '#FEF3C7',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FCD34D',
    marginBottom: 12,
    gap: 12,
  },
  offlineAlertText: {
    flex: 1,
  },
  offlineAlertTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#92400E',
    marginBottom: 4,
  },
  offlineAlertSubtitle: {
    fontSize: 13,
    color: '#78350F',
    lineHeight: 18,
  },
  driverNotesText: {
    marginTop: 8,
    fontSize: 13,
    color: '#78350F',
    lineHeight: 18,
  },
  driverNotesLabel: {
    fontWeight: '600',
  },
  callClientButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F59E0B',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    gap: 8,
  },
  callClientButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  noCoordinatesWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    padding: 12,
    borderRadius: 8,
    gap: 8,
    borderWidth: 1,
    borderColor: '#FCD34D',
  },
  noCoordinatesText: {
    flex: 1,
    fontSize: 13,
    color: '#92400E',
    lineHeight: 18,
  },
  detailsCard: {
    backgroundColor: '#F9FAFB',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  detailLabel: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },
  detailValue: {
    fontSize: 15,
    color: '#1F2937',
    fontWeight: '600',
  },
  photosContainer: {
    marginTop: 12,
  },
  photoItem: {
    width: 100,
    height: 100,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  photoPlaceholder: {
    fontSize: 24,
    color: '#9CA3AF',
    fontWeight: '600',
  },
  messagesContent: {
    paddingBottom: 20,
  },
  emptyMessagesState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 20,
  },
  emptyMessagesTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyMessagesText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  comingSoonButton: {
    backgroundColor: '#7C3AED',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
  },
  comingSoonButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
});

export default DriverOrderBottomSheet;

