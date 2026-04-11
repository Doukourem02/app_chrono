import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator, TextInput, Modal, Platform, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { CameraView, useCameraPermissions } from 'expo-camera';
import Constants from 'expo-constants';
import { logger } from '../utils/logger';
import { getQRScanErrorAlert } from '../utils/qrScanUserMessage';

const isSimulator = Platform.OS === 'ios' && !Constants.isDevice;

interface QRCodeScannerProps {
  onScan: (data: string) => void;
  onClose: () => void;
  visible: boolean;
}

export const QRCodeScanner: React.FC<QRCodeScannerProps> = ({
  onScan,
  onClose,
  visible,
}) => {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [manualQRInput, setManualQRInput] = useState('');

  useEffect(() => {
    if (visible) {
      setScanned(false);
    }
  }, [visible]);

  const handleBarCodeScanned = async (result: { data: string }) => {
    if (scanned || isLoading) return;

    setScanned(true);
    setIsLoading(true);

    try {
      const { data } = result;
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onScan(data);
    } catch (error) {
      logger.error('Erreur lors du scan:', undefined, error);
      const { title, message } = getQRScanErrorAlert('CAMERA_READ_ERROR');
      Alert.alert(title, message);
    } finally {
      setIsLoading(false);
      setTimeout(() => {
        setScanned(false);
      }, 2000);
    }
  };

  if (!visible) return null;

  /** Hors du bottom sheet (~120px), sinon le scanner est rogné et invisible. */
  const wrapFullScreen = (children: React.ReactNode) => (
    <Modal
      visible
      animationType="slide"
      presentationStyle={Platform.OS === 'ios' ? 'fullScreen' : undefined}
      onRequestClose={onClose}
      statusBarTranslucent={Platform.OS === 'android'}
    >
      <View style={styles.modalRoot}>{children}</View>
    </Modal>
  );

  if (!permission) {
    return wrapFullScreen(
      <View style={styles.container}>
        <View style={styles.permissionContainer}>
          <ActivityIndicator size="large" color="#6366F1" />
          <Text style={styles.permissionText}>Chargement des permissions...</Text>
        </View>
        <TouchableOpacity style={styles.closeButton} onPress={onClose}>
          <Ionicons name="close" size={24} color="#fff" />
        </TouchableOpacity>
      </View>
    );
  }

  if (!permission.granted) {
    return wrapFullScreen(
      <View style={styles.container}>
        <View style={styles.permissionContainer}>
          <Ionicons name="camera-outline" size={64} color="#EF4444" />
          <Text style={styles.permissionText}>Permission caméra refusée</Text>
          <Text style={styles.permissionSubtext}>
            Veuillez autoriser l&apos;accès à la caméra dans les paramètres de l&apos;appareil
          </Text>
          <TouchableOpacity
            style={styles.permissionButton}
            onPress={requestPermission}
          >
            <Text style={styles.permissionButtonText}>Réessayer</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.permissionButton, { marginTop: 12, backgroundColor: '#374151' }]}
            onPress={() => Linking.openSettings().catch(() => {})}
          >
            <Text style={styles.permissionButtonText}>Ouvrir les réglages</Text>
          </TouchableOpacity>
          {/* Saisie manuelle quand caméra indisponible (simulateur ou permission refusée) */}
          {(isSimulator || __DEV__) && (
            <TouchableOpacity
              style={styles.manualEntryButtonPermission}
              onPress={() => setShowManualEntry(true)}
            >
              <Ionicons name="create-outline" size={18} color="#6366F1" />
              <Text style={styles.manualEntryText}>Saisie manuelle (test)</Text>
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity style={styles.closeButton} onPress={onClose}>
          <Ionicons name="close" size={24} color="#fff" />
        </TouchableOpacity>
        <Modal visible={showManualEntry} transparent animationType="fade">
          <View style={styles.manualOverlay}>
            <View style={styles.manualContainer}>
              <Text style={styles.manualTitle}>Saisie manuelle (mode test)</Text>
              <Text style={styles.manualHint}>
                Collez le JSON du QR code (depuis la base ou un test)
              </Text>
              <TextInput
                style={styles.manualInput}
                placeholder='{"orderId":"...","orderNumber":"...",...}'
                placeholderTextColor="#9CA3AF"
                value={manualQRInput}
                onChangeText={setManualQRInput}
                multiline
                numberOfLines={4}
              />
              <View style={styles.manualActions}>
                <TouchableOpacity style={styles.manualCancel} onPress={() => { setShowManualEntry(false); setManualQRInput(''); }}>
                  <Text style={styles.manualCancelText}>Annuler</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.manualSubmit}
                  onPress={() => {
                    const trimmed = manualQRInput.trim();
                    if (trimmed) {
                      setShowManualEntry(false);
                      setManualQRInput('');
                      onScan(trimmed);
                    } else {
                      Alert.alert('Erreur', 'Veuillez coller le contenu du QR code');
                    }
                  }}
                >
                  <Text style={styles.manualSubmitText}>Valider</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </View>
    );
  }

  return wrapFullScreen(
    <View style={styles.container}>
      <CameraView
        style={StyleSheet.absoluteFillObject}
        facing="back"
        onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
        barcodeScannerSettings={{
          barcodeTypes: ['qr'],
        }}
      />

      {/* Overlay avec zone de scan */}
      <View style={styles.overlay}>
        <View style={styles.scanArea}>
          <View style={styles.scanCorner} />
          <View style={[styles.scanCorner, styles.topRight]} />
          <View style={[styles.scanCorner, styles.bottomLeft]} />
          <View style={[styles.scanCorner, styles.bottomRight]} />
        </View>

        {isLoading && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color="#6366F1" />
            <Text style={styles.loadingText}>Traitement du QR code...</Text>
          </View>
        )}

        {scanned && !isLoading && (
          <View style={styles.successOverlay}>
            <Ionicons name="checkmark-circle" size={64} color="#10B981" />
            <Text style={styles.successText}>QR code scanné avec succès !</Text>
          </View>
        )}
      </View>

      {/* Instructions */}
      <View style={styles.instructionsContainer}>
        <Text style={styles.instructionsText}>
          Positionnez le QR code dans le cadre
        </Text>
      </View>

      {/* Saisie manuelle (simulateur / appareil sans caméra) */}
      {(isSimulator || __DEV__) && (
        <TouchableOpacity
          style={styles.manualEntryButton}
          onPress={() => setShowManualEntry(true)}
        >
          <Ionicons name="create-outline" size={18} color="#6366F1" />
          <Text style={styles.manualEntryText}>Saisie manuelle (test)</Text>
        </TouchableOpacity>
      )}

      {/* Bouton fermer */}
      <TouchableOpacity style={styles.closeButton} onPress={onClose}>
        <Ionicons name="close" size={24} color="#fff" />
      </TouchableOpacity>

      {/* Modal saisie manuelle */}
      <Modal visible={showManualEntry} transparent animationType="fade">
        <View style={styles.manualOverlay}>
          <View style={styles.manualContainer}>
            <Text style={styles.manualTitle}>Saisie manuelle (mode test)</Text>
            <Text style={styles.manualHint}>
              Collez le JSON du QR code (depuis la base ou un test)
            </Text>
            <TextInput
              style={styles.manualInput}
              placeholder='{"orderId":"...","orderNumber":"...",...}'
              placeholderTextColor="#9CA3AF"
              value={manualQRInput}
              onChangeText={setManualQRInput}
              multiline
              numberOfLines={4}
            />
            <View style={styles.manualActions}>
              <TouchableOpacity style={styles.manualCancel} onPress={() => { setShowManualEntry(false); setManualQRInput(''); }}>
                <Text style={styles.manualCancelText}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.manualSubmit}
                onPress={() => {
                  const trimmed = manualQRInput.trim();
                  if (trimmed) {
                    setShowManualEntry(false);
                    setManualQRInput('');
                    onScan(trimmed);
                  } else {
                    Alert.alert('Erreur', 'Veuillez coller le contenu du QR code');
                  }
                }}
              >
                <Text style={styles.manualSubmitText}>Valider</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
    backgroundColor: '#000',
  },
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanArea: {
    width: 250,
    height: 250,
    position: 'relative',
  },
  scanCorner: {
    position: 'absolute',
    width: 30,
    height: 30,
    borderColor: '#6366F1',
    borderWidth: 3,
    top: 0,
    left: 0,
    borderRightWidth: 0,
    borderBottomWidth: 0,
  },
  topRight: {
    top: 0,
    right: 0,
    left: 'auto',
    borderLeftWidth: 0,
    borderRightWidth: 3,
    borderBottomWidth: 0,
  },
  bottomLeft: {
    bottom: 0,
    top: 'auto',
    borderTopWidth: 0,
    borderRightWidth: 0,
    borderBottomWidth: 3,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    top: 'auto',
    left: 'auto',
    borderTopWidth: 0,
    borderLeftWidth: 0,
    borderRightWidth: 3,
    borderBottomWidth: 3,
  },
  instructionsContainer: {
    position: 'absolute',
    bottom: 100,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  instructionsText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
    textAlign: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  closeButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 25,
    width: 50,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#000',
  },
  permissionText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginTop: 20,
    textAlign: 'center',
  },
  permissionSubtext: {
    color: '#9CA3AF',
    fontSize: 14,
    marginTop: 10,
    textAlign: 'center',
  },
  permissionButton: {
    marginTop: 30,
    backgroundColor: '#6366F1',
    paddingHorizontal: 30,
    paddingVertical: 12,
    borderRadius: 8,
  },
  permissionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  manualEntryButtonPermission: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 20,
    backgroundColor: 'rgba(99, 102, 241, 0.2)',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
  },
  loadingText: {
    color: '#fff',
    fontSize: 16,
    marginTop: 15,
  },
  successOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
  },
  successText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginTop: 15,
  },
  manualEntryButton: {
    position: 'absolute',
    bottom: 50,
    left: 20,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
  },
  manualEntryText: {
    color: '#6366F1',
    fontSize: 14,
    fontWeight: '600',
  },
  manualOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    padding: 20,
  },
  manualContainer: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
  },
  manualTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 8,
  },
  manualHint: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 12,
  },
  manualInput: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    padding: 12,
    fontSize: 12,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    color: '#1F2937',
    minHeight: 100,
    textAlignVertical: 'top',
  },
  manualActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  manualCancel: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
  },
  manualCancelText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#6B7280',
  },
  manualSubmit: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#6366F1',
    alignItems: 'center',
  },
  manualSubmitText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
});
