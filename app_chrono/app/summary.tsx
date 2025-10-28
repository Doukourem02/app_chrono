import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useShipmentStore } from '../store/useShipmentStore';

export default function SummaryPage() {
  const {
    pickupLocation,
    deliveryLocation,
    selectedMethod,
    currentShipment,
    resetShipment,
  } = useShipmentStore();

  const handleNewOrder = () => {
    resetShipment();
    router.push('/(tabs)/map');
  };

  const getMethodIcon = () => {
    switch (selectedMethod) {
      case 'moto': return '🏍️';
      case 'vehicule': return '🚗';
      case 'cargo': return '🚛';
      default: return '🚗';
    }
  };

  const getStatusColor = () => {
    switch (currentShipment.status) {
      case 'pending': return '#FFA500';
      case 'confirmed': return '#00AA00';
      case 'in_progress': return '#0066CC';
      case 'delivered': return '#00DD00';
      default: return '#666';
    }
  };

  const getStatusText = () => {
    switch (currentShipment.status) {
      case 'pending': return 'En attente';
      case 'confirmed': return 'Confirmée';
      case 'in_progress': return 'En cours';
      case 'delivered': return 'Livrée';
      default: return 'Inconnu';
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Résumé de livraison</Text>
      </View>

      <ScrollView style={styles.content}>
        {/* Status Card */}
        <View style={styles.statusCard}>
          <View style={styles.statusHeader}>
            <Text style={styles.statusTitle}>État de la livraison</Text>
            <View style={[styles.statusBadge, { backgroundColor: getStatusColor() }]}>
              <Text style={styles.statusText}>{getStatusText()}</Text>
            </View>
          </View>
          
          {currentShipment.id && (
            <Text style={styles.shipmentId}>ID: {currentShipment.id}</Text>
          )}
          
          {currentShipment.estimatedTime && (
            <Text style={styles.estimatedTime}>
              Temps estimé: {currentShipment.estimatedTime}
            </Text>
          )}
        </View>

        {/* Shipment Details */}
        <View style={styles.detailsCard}>
          <Text style={styles.sectionTitle}>Détails de la livraison</Text>
          
          <View style={styles.detailRow}>
            <Ionicons name="location-outline" size={20} color="#8B5CF6" />
            <View style={styles.detailContent}>
              <Text style={styles.detailLabel}>Point de récupération</Text>
              <Text style={styles.detailValue}>
                {pickupLocation || 'Non spécifié'}
              </Text>
            </View>
          </View>

          <View style={styles.detailRow}>
            <Ionicons name="flag-outline" size={20} color="#8B5CF6" />
            <View style={styles.detailContent}>
              <Text style={styles.detailLabel}>Destination</Text>
              <Text style={styles.detailValue}>
                {deliveryLocation || 'Non spécifiée'}
              </Text>
            </View>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.methodIcon}>{getMethodIcon()}</Text>
            <View style={styles.detailContent}>
              <Text style={styles.detailLabel}>Méthode de livraison</Text>
              <Text style={styles.detailValue}>
                {selectedMethod === 'moto' ? 'Livraison par moto' :
                 selectedMethod === 'vehicule' ? 'Livraison par véhicule' :
                 'Livraison par cargo'}
              </Text>
            </View>
          </View>
        </View>

        {/* Actions */}
        <View style={styles.actionsCard}>
          <TouchableOpacity style={styles.primaryButton}>
            <Text style={styles.primaryButtonText}>Suivre ma livraison</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.secondaryButton}
            onPress={handleNewOrder}
          >
            <Text style={styles.secondaryButtonText}>Nouvelle commande</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 20,
    backgroundColor: '#fff',
    elevation: 2,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f0f0f0',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginLeft: 15,
    color: '#333',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  statusCard: {
    backgroundColor: '#fff',
    borderRadius: 15,
    padding: 20,
    marginBottom: 20,
    elevation: 2,
  },
  statusHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  statusTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  statusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  shipmentId: {
    fontSize: 14,
    color: '#666',
    marginBottom: 5,
  },
  estimatedTime: {
    fontSize: 14,
    color: '#8B5CF6',
    fontWeight: '500',
  },
  detailsCard: {
    backgroundColor: '#fff',
    borderRadius: 15,
    padding: 20,
    marginBottom: 20,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 20,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  detailContent: {
    marginLeft: 15,
    flex: 1,
  },
  detailLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 3,
  },
  detailValue: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  methodIcon: {
    fontSize: 20,
    width: 20,
    textAlign: 'center',
  },
  actionsCard: {
    backgroundColor: '#fff',
    borderRadius: 15,
    padding: 20,
    elevation: 2,
  },
  primaryButton: {
    backgroundColor: '#8B5CF6',
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
    marginBottom: 15,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    backgroundColor: '#f0f0f0',
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: '#333',
    fontSize: 16,
    fontWeight: '500',
  },
});