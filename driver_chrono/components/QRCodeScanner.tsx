import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator, Modal, Platform, Linking, TextInput, KeyboardAvoidingView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { logger } from '../utils/logger';
import { getQRScanErrorAlert } from '../utils/qrScanUserMessage';

interface QRCodeScannerProps {
  onScan: (data: string) => void;
  onManualEntry?: (code: string) => void;
  onClose: () => void;
  visible: boolean;
}

export const QRCodeScanner: React.FC<QRCodeScannerProps> = ({
  onScan,
  onManualEntry,
  onClose,
  visible,
}) => {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showManualInput, setShowManualInput] = useState(false);
  const [manualCode, setManualCode] = useState('');

  useEffect(() => {
    if (visible) {
      setScanned(false);
      setShowManualInput(false);
      setManualCode('');
    }
  }, [visible]);

  const handleManualSubmit = () => {
    const trimmed = manualCode.trim();
    if (trimmed.length !== 6 || !/^\d{6}$/.test(trimmed)) {
      Alert.alert('Code invalide', 'Le code doit être composé de 6 chiffres.');
      return;
    }
    setShowManualInput(false);
    setManualCode('');
    onManualEntry?.(trimmed);
  };

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
        </View>
        <TouchableOpacity style={styles.closeButton} onPress={onClose}>
          <Ionicons name="close" size={24} color="#fff" />
        </TouchableOpacity>
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

      {/* Bouton saisie manuelle */}
      {onManualEntry && (
        <TouchableOpacity style={styles.manualButton} onPress={() => setShowManualInput(true)}>
          <Ionicons name="keypad-outline" size={18} color="#fff" />
          <Text style={styles.manualButtonText}>Saisie manuelle</Text>
        </TouchableOpacity>
      )}

      {/* Bouton fermer */}
      <TouchableOpacity style={styles.closeButton} onPress={onClose}>
        <Ionicons name="close" size={24} color="#fff" />
      </TouchableOpacity>

      {/* Modal saisie manuelle */}
      <Modal visible={showManualInput} transparent animationType="slide" onRequestClose={() => setShowManualInput(false)}>
        <KeyboardAvoidingView style={styles.manualOverlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={styles.manualContainer}>
            <Text style={styles.manualTitle}>Saisie manuelle</Text>
            <Text style={styles.manualSubtitle}>
              Entrez le code à 6 chiffres affiché sur l&apos;écran du client
            </Text>
            <TextInput
              style={styles.manualInput}
              value={manualCode}
              onChangeText={(t) => setManualCode(t.replace(/[^0-9]/g, '').slice(0, 6))}
              keyboardType="number-pad"
              maxLength={6}
              placeholder="_ _ _ _ _ _"
              placeholderTextColor="#9CA3AF"
              autoFocus
            />
            <View style={styles.manualActions}>
              <TouchableOpacity style={styles.manualCancelBtn} onPress={() => { setShowManualInput(false); setManualCode(''); }}>
                <Text style={styles.manualCancelText}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.manualConfirmBtn} onPress={handleManualSubmit}>
                <Text style={styles.manualConfirmText}>Valider</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
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
  manualButton: {
    position: 'absolute',
    bottom: 160,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(99, 102, 241, 0.85)',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  manualButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  manualOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  manualContainer: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 28,
    paddingBottom: 40,
  },
  manualTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
  },
  manualSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 24,
  },
  manualInput: {
    borderWidth: 2,
    borderColor: '#6366F1',
    borderRadius: 12,
    fontSize: 32,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
    letterSpacing: 12,
    paddingVertical: 14,
    marginBottom: 24,
  },
  manualActions: {
    flexDirection: 'row',
    gap: 12,
  },
  manualCancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
  },
  manualCancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
  manualConfirmBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: '#6366F1',
    alignItems: 'center',
  },
  manualConfirmText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
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
});
