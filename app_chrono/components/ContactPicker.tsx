/**
 * Modal pour sélectionner un contact du répertoire du téléphone.
 * Affiche la liste des contacts avec numéro de téléphone.
 */
import React, { useEffect, useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  TextInput,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export interface PickedContact {
  name: string;
  phone: string;
}

interface ContactPickerProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (contact: PickedContact) => void;
}

function normalizePhoneForDisplay(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('225')) {
    const local = digits.slice(3);
    if (/^[157]\d{8}$/.test(local)) return `0${local}`;
  }
  if (digits.length === 9 && /^[157]\d{8}$/.test(digits)) {
    return `0${digits}`;
  }
  return phone;
}

export function ContactPicker({ visible, onClose, onSelect }: ContactPickerProps) {
  const [contacts, setContacts] = useState<{ id: string; name: string; phone: string }[]>([]);
  const [filtered, setFiltered] = useState<typeof contacts>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);

  const loadContacts = React.useCallback(async () => {
      setLoading(true);
      setError(null);
      try {
        const Contacts = await import('expo-contacts');
        const { status } = await Contacts.requestPermissionsAsync();
        if (status !== 'granted') {
          setError('Accès aux contacts refusé. Autorisez Chrono dans les paramètres.');
          setContacts([]);
          return;
        }

        const { data } = await Contacts.getContactsAsync({
          fields: [Contacts.Fields.PhoneNumbers],
          sort: Contacts.SortTypes.FirstName,
        });

        const withPhones: typeof contacts = [];
        for (const c of data) {
          const name = [c.firstName, c.lastName].filter(Boolean).join(' ') || '(Sans nom)';
          const numbers = c.phoneNumbers || [];
          for (const p of numbers) {
            const num = (p.number || '').trim();
            if (num) {
              withPhones.push({
                id: `${c.id}-${num}`,
                name,
                phone: normalizePhoneForDisplay(num),
              });
            }
          }
        }
        setContacts(withPhones);
        setFiltered(withPhones);
      } catch (err) {
        const msg = (err as Error)?.message || '';
        setError(
          msg.includes('ExpoContacts') || msg.includes('native module')
            ? 'Répertoire non disponible dans Expo Go. Lancez un build de développement : npx expo run:ios'
            : 'Impossible de charger les contacts.'
        );
        setContacts([]);
      } finally {
        setLoading(false);
      }
    }, []);

  useEffect(() => {
    if (!visible) return;
    loadContacts();
  }, [visible, retryKey, loadContacts]);

  useEffect(() => {
    if (!search.trim()) {
      setFiltered(contacts);
      return;
    }
    const q = search.toLowerCase().trim();
    setFiltered(
      contacts.filter(
        (c) =>
          c.name.toLowerCase().includes(q) || c.phone.replace(/\D/g, '').includes(q.replace(/\D/g, ''))
      )
    );
  }, [search, contacts]);

  const handleSelect = (item: (typeof filtered)[0]) => {
    onSelect({ name: item.name, phone: item.phone });
    setSearch('');
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <View style={styles.header}>
            <Text style={styles.title}>Choisir un contact</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={24} color="#374151" />
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={styles.center}>
              <ActivityIndicator size="large" color="#8B5CF6" />
              <Text style={styles.hint}>Chargement des contacts...</Text>
            </View>
          ) : error ? (
            <View style={styles.center}>
              <Ionicons name="alert-circle-outline" size={48} color="#EF4444" />
              <Text style={styles.errorText}>{error}</Text>
              <TouchableOpacity style={styles.retryBtn} onPress={() => setRetryKey((k) => k + 1)}>
                <Text style={styles.retryText}>Réessayer</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <View style={styles.searchBox}>
                <Ionicons name="search" size={20} color="#9CA3AF" />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Rechercher par nom ou numéro"
                  placeholderTextColor="#9CA3AF"
                  value={search}
                  onChangeText={setSearch}
                />
              </View>

              <FlatList
                data={filtered}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.contactRow}
                    onPress={() => handleSelect(item)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.avatar}>
                      <Text style={styles.avatarText}>
                        {(item.name[0] || '?').toUpperCase()}
                      </Text>
                    </View>
                    <View style={styles.contactInfo}>
                      <Text style={styles.contactName}>{item.name}</Text>
                      <Text style={styles.contactPhone}>{item.phone}</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
                  </TouchableOpacity>
                )}
                ListEmptyComponent={
                  <View style={styles.empty}>
                    <Text style={styles.emptyText}>
                      {search ? 'Aucun contact trouvé' : 'Aucun contact avec numéro'}
                    </Text>
                  </View>
                }
              />
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modal: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '85%',
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
  },
  closeBtn: {
    padding: 4,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    margin: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 16,
    color: '#1F2937',
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#8B5CF6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  contactInfo: {
    flex: 1,
  },
  contactName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1F2937',
  },
  contactPhone: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 2,
  },
  center: {
    padding: 40,
    alignItems: 'center',
    gap: 16,
  },
  hint: {
    fontSize: 14,
    color: '#6B7280',
  },
  errorText: {
    fontSize: 14,
    color: '#374151',
    textAlign: 'center',
  },
  retryBtn: {
    marginTop: 8,
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: '#8B5CF6',
    borderRadius: 8,
  },
  retryText: {
    color: '#fff',
    fontWeight: '600',
  },
  empty: {
    padding: 32,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: '#6B7280',
  },
});
