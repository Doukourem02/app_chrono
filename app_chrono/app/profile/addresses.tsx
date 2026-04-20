import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React from 'react';
import {Alert,ScrollView,StyleSheet,Text,TouchableOpacity,View,} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {useSavedAddressesStore,type SavedClientAddress,} from '../../store/useSavedAddressesStore';

export default function AddressesPage() {
  const insets = useSafeAreaInsets();
  const addresses = useSavedAddressesStore((s) => s.addresses);
  const defaultAddressId = useSavedAddressesStore((s) => s.defaultAddressId);
  const removeAddress = useSavedAddressesStore((s) => s.removeAddress);
  const setDefaultAddress = useSavedAddressesStore((s) => s.setDefaultAddress);

  const handleSetDefault = (addressId: string) => {
    setDefaultAddress(addressId);
    Alert.alert('Succès', 'Adresse utilisée par défaut pour les raccourcis.');
  };

  const handleDelete = (row: SavedClientAddress) => {
    Alert.alert(
      'Supprimer l’adresse',
      `Retirer « ${row.label} » ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: () => removeAddress(row.id),
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 12) + 8 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#1F2937" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Mes adresses</Text>
        <TouchableOpacity
          onPress={() => router.push('/profile/add-address' as any)}
          style={styles.addButton}
        >
          <Ionicons name="add" size={24} color="#8B5CF6" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {addresses.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="location-outline" size={64} color="#9CA3AF" />
            <Text style={styles.emptyText}>Aucune adresse enregistrée</Text>
            <Text style={styles.emptySub}>
              Enregistrez un nom court (ex. Domicile) lié à une adresse précise : vous la choisirez
              en un geste sur l’écran d’envoi.
            </Text>
            <TouchableOpacity
              style={styles.addFirstButton}
              onPress={() => router.push('/profile/add-address' as any)}
            >
              <Text style={styles.addFirstButtonText}>Ajouter une adresse</Text>
            </TouchableOpacity>
          </View>
        ) : (
          addresses.map((address) => (
            <View key={address.id} style={styles.addressCard}>
              <View style={styles.addressHeader}>
                <View style={styles.addressInfo}>
                  <Text style={styles.addressLabel}>{address.label}</Text>
                  {defaultAddressId === address.id ? (
                    <View style={styles.defaultBadge}>
                      <Text style={styles.defaultBadgeText}>Par défaut</Text>
                    </View>
                  ) : null}
                </View>
                <TouchableOpacity
                  onPress={() => handleDelete(address)}
                  style={styles.actionButton}
                >
                  <Ionicons name="trash-outline" size={20} color="#EF4444" />
                </TouchableOpacity>
              </View>
              <Text style={styles.addressText}>{address.addressLine}</Text>
              {defaultAddressId !== address.id ? (
                <TouchableOpacity
                  style={styles.setDefaultButton}
                  onPress={() => handleSetDefault(address.id)}
                >
                  <Text style={styles.setDefaultButtonText}>Définir par défaut</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          ))
        )}
      </ScrollView>
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
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
  },
  addButton: {
    padding: 8,
  },
  content: {
    flex: 1,
  },
  emptyContainer: {
    paddingHorizontal: 28,
    paddingTop: 48,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#4B5563',
    marginTop: 16,
    textAlign: 'center',
  },
  emptySub: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 10,
    textAlign: 'center',
    lineHeight: 20,
  },
  addFirstButton: {
    marginTop: 24,
    backgroundColor: '#8B5CF6',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  addFirstButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  addressCard: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 20,
    marginTop: 16,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  addressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  addressInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  addressLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginRight: 8,
  },
  defaultBadge: {
    backgroundColor: '#10B981',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  defaultBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '600',
  },
  actionButton: {
    padding: 4,
  },
  addressText: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 12,
    lineHeight: 20,
  },
  setDefaultButton: {
    alignSelf: 'flex-start',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    backgroundColor: '#F3F0FF',
  },
  setDefaultButtonText: {
    color: '#8B5CF6',
    fontSize: 12,
    fontWeight: '600',
  },
});
