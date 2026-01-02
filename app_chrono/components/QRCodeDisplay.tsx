import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, Image, Share, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { logger } from '../utils/logger';

interface QRCodeDisplayProps {
  visible: boolean;
  qrCodeImage: string | null;
  orderNumber?: string;
  expiresAt?: string;
  onClose: () => void;
}

export const QRCodeDisplay: React.FC<QRCodeDisplayProps> = ({
  visible,
  qrCodeImage,
  orderNumber,
  expiresAt,
  onClose,
}) => {
  const insets = useSafeAreaInsets();
  const [timeRemaining, setTimeRemaining] = useState<string>('');

  useEffect(() => {
    if (!visible || !expiresAt) return;

    const updateTimeRemaining = () => {
      const now = new Date();
      const expiry = new Date(expiresAt);
      const diff = expiry.getTime() - now.getTime();

      if (diff <= 0) {
        setTimeRemaining('Expiré');
        return;
      }

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

      if (hours > 0) {
        setTimeRemaining(`${hours}h ${minutes}m`);
      } else {
        setTimeRemaining(`${minutes}m`);
      }
    };

    updateTimeRemaining();
    const interval = setInterval(updateTimeRemaining, 60000); // Mise à jour chaque minute

    return () => clearInterval(interval);
  }, [visible, expiresAt]);

  const handleShare = async () => {
    if (!qrCodeImage) {
      Alert.alert('Erreur', 'QR code non disponible');
      return;
    }

    try {
      await Share.share({
        message: `QR Code de livraison${orderNumber ? ` - ${orderNumber}` : ''}\nMontrez ce code au livreur lors de la livraison.`,
        title: 'QR Code de livraison',
      });
    } catch (error) {
      logger.error('Erreur lors du partage:', undefined, error);
    }
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={[styles.overlay, { paddingTop: insets.top }]}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>QR Code de livraison</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color="#1F2937" />
            </TouchableOpacity>
          </View>

          {/* Content */}
          <View style={styles.content}>
            {orderNumber && (
              <Text style={styles.orderNumber}>{orderNumber}</Text>
            )}

            {qrCodeImage ? (
              <View style={styles.qrCodeContainer}>
                <Image
                  source={{ uri: qrCodeImage }}
                  style={styles.qrCodeImage}
                  resizeMode="contain"
                />
              </View>
            ) : (
              <View style={styles.qrCodePlaceholder}>
                <Ionicons name="qr-code-outline" size={64} color="#9CA3AF" />
                <Text style={styles.placeholderText}>QR code en cours de génération...</Text>
              </View>
            )}

            <View style={styles.instructions}>
              <Ionicons name="information-circle-outline" size={20} color="#6366F1" />
              <Text style={styles.instructionsText}>
                Montrez ce QR code au livreur lors de la livraison
              </Text>
            </View>

            {expiresAt && (
              <View style={styles.expiryContainer}>
                <Ionicons name="time-outline" size={16} color="#6B7280" />
                <Text style={styles.expiryText}>
                  Expire dans : {timeRemaining}
                </Text>
              </View>
            )}
          </View>

          {/* Actions */}
          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.button, styles.shareButton]}
              onPress={handleShare}
            >
              <Ionicons name="share-outline" size={20} color="#6366F1" />
              <Text style={styles.shareButtonText}>Partager</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  container: {
    backgroundColor: '#fff',
    borderRadius: 20,
    width: '100%',
    maxWidth: 400,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
  },
  closeButton: {
    padding: 4,
  },
  content: {
    padding: 20,
    alignItems: 'center',
  },
  orderNumber: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6366F1',
    marginBottom: 20,
  },
  qrCodeContainer: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    marginBottom: 20,
  },
  qrCodeImage: {
    width: 250,
    height: 250,
  },
  qrCodePlaceholder: {
    width: 250,
    height: 250,
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  placeholderText: {
    marginTop: 12,
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
  },
  instructions: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EEF2FF',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
    width: '100%',
  },
  instructionsText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#6366F1',
    flex: 1,
  },
  expiryContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  expiryText: {
    marginLeft: 6,
    fontSize: 12,
    color: '#6B7280',
  },
  actions: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 10,
    gap: 8,
  },
  shareButton: {
    backgroundColor: '#EEF2FF',
  },
  shareButtonText: {
    color: '#6366F1',
    fontSize: 16,
    fontWeight: '600',
  },
});

