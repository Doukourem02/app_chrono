import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface QRCodeScanResultProps {
  visible: boolean;
  data: {
    recipientName: string;
    recipientPhone: string;
    creatorName: string;
    orderNumber: string;
  } | null;
  onConfirm: () => void;
  onClose: () => void;
}

export const QRCodeScanResult: React.FC<QRCodeScanResultProps> = ({
  visible,
  data,
  onConfirm,
  onClose,
}) => {
  if (!visible || !data) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          <View style={styles.header}>
            <Ionicons name="checkmark-circle" size={48} color="#10B981" />
            <Text style={styles.title}>QR Code validé</Text>
          </View>

          <View style={styles.content}>
            <View style={styles.infoSection}>
              <Text style={styles.sectionTitle}>Informations du destinataire</Text>
              
              <View style={styles.infoRow}>
                <Ionicons name="person-outline" size={20} color="#6366F1" />
                <Text style={styles.infoLabel}>Nom :</Text>
                <Text style={styles.infoValue}>{data.recipientName}</Text>
              </View>

              <View style={styles.infoRow}>
                <Ionicons name="call-outline" size={20} color="#6366F1" />
                <Text style={styles.infoLabel}>Téléphone :</Text>
                <Text style={styles.infoValue}>{data.recipientPhone}</Text>
              </View>
            </View>

            <View style={styles.divider} />

            <View style={styles.infoSection}>
              <Text style={styles.sectionTitle}>Informations de la commande</Text>
              
              <View style={styles.infoRow}>
                <Ionicons name="document-text-outline" size={20} color="#6366F1" />
                <Text style={styles.infoLabel}>Numéro :</Text>
                <Text style={styles.infoValue}>{data.orderNumber}</Text>
              </View>

              <View style={styles.infoRow}>
                <Ionicons name="person-circle-outline" size={20} color="#6366F1" />
                <Text style={styles.infoLabel}>Créateur :</Text>
                <Text style={styles.infoValue}>{data.creatorName}</Text>
              </View>
            </View>
          </View>

          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.button, styles.cancelButton]}
              onPress={onClose}
            >
              <Text style={styles.cancelButtonText}>Annuler</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.button, styles.confirmButton]}
              onPress={onConfirm}
            >
              <Ionicons name="checkmark" size={20} color="#fff" />
              <Text style={styles.confirmButtonText}>Confirmer la livraison</Text>
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
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#F0FDF4',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
    marginTop: 10,
  },
  content: {
    padding: 20,
  },
  infoSection: {
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  infoLabel: {
    fontSize: 14,
    color: '#6B7280',
    marginLeft: 8,
    minWidth: 80,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
    flex: 1,
  },
  divider: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginVertical: 20,
  },
  actions: {
    flexDirection: 'row',
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    gap: 12,
  },
  button: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  cancelButton: {
    backgroundColor: '#F3F4F6',
  },
  cancelButtonText: {
    color: '#6B7280',
    fontSize: 16,
    fontWeight: '600',
  },
  confirmButton: {
    backgroundColor: '#10B981',
  },
  confirmButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

