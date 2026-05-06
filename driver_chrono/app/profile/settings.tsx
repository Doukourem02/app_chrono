import React, { useState, useEffect } from 'react';
import {Alert,View,Text,StyleSheet,ScrollView,Switch,TouchableOpacity} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { soundService } from '../../services/soundService';
import { apiService } from '../../services/apiService';
import { useDriverStore } from '../../store/useDriverStore';

export default function SettingsPage() {
  const { user, profile, updateProfile } = useDriverStore();
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [vibrationEnabled, setVibrationEnabled] = useState(true);
  const [acceptsB2BOrders, setAcceptsB2BOrders] = useState(profile?.accepts_b2b_orders === true);
  const [savingB2BPreference, setSavingB2BPreference] = useState(false);

  useEffect(() => {
    // Charger la préférence de son au montage
    soundService.isSoundEnabled().then((enabled) => {
      setSoundEnabled(enabled);
    });
  }, []);

  useEffect(() => {
    setAcceptsB2BOrders(profile?.accepts_b2b_orders === true);
  }, [profile?.accepts_b2b_orders]);

  const handleSoundToggle = async (value: boolean) => {
    setSoundEnabled(value);
    await soundService.setSoundEnabled(value);
  };

  const handleB2BToggle = async (value: boolean) => {
    if (!user?.id || savingB2BPreference) return;
    const previous = acceptsB2BOrders;
    setAcceptsB2BOrders(value);
    setSavingB2BPreference(true);
    const result = await apiService.updateDriverB2BPreference(user.id, value);
    setSavingB2BPreference(false);

    if (result.success) {
      updateProfile({ accepts_b2b_orders: result.data?.accepts_b2b_orders ?? value });
      return;
    }

    setAcceptsB2BOrders(previous);
    Alert.alert('Préférence non enregistrée', result.message || 'Réessayez dans quelques instants.');
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#1F2937" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Paramètres</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Notifications</Text>
          
          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <Ionicons name="notifications" size={24} color="#8B5CF6" />
              <View style={styles.settingText}>
                <Text style={styles.settingTitle}>Notifications push</Text>
                <Text style={styles.settingSubtitle}>Recevoir les alertes</Text>
              </View>
            </View>
            <Switch
              value={notificationsEnabled}
              onValueChange={setNotificationsEnabled}
              trackColor={{ false: '#E5E7EB', true: '#8B5CF6' }}
              thumbColor={notificationsEnabled ? '#FFFFFF' : '#9CA3AF'}
            />
          </View>

          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <Ionicons name="volume-high" size={24} color="#8B5CF6" />
              <View style={styles.settingText}>
                <Text style={styles.settingTitle}>Son</Text>
                <Text style={styles.settingSubtitle}>Activer les sons</Text>
              </View>
            </View>
            <Switch
              value={soundEnabled}
              onValueChange={handleSoundToggle}
              trackColor={{ false: '#E5E7EB', true: '#8B5CF6' }}
              thumbColor={soundEnabled ? '#FFFFFF' : '#9CA3AF'}
            />
          </View>

          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <Ionicons name="phone-portrait" size={24} color="#8B5CF6" />
              <View style={styles.settingText}>
                <Text style={styles.settingTitle}>Vibration</Text>
                <Text style={styles.settingSubtitle}>Activer les vibrations</Text>
              </View>
            </View>
            <Switch
              value={vibrationEnabled}
              onValueChange={setVibrationEnabled}
              trackColor={{ false: '#E5E7EB', true: '#8B5CF6' }}
              thumbColor={vibrationEnabled ? '#FFFFFF' : '#9CA3AF'}
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Commandes B2B</Text>

          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <Ionicons name="briefcase" size={24} color="#8B5CF6" />
              <View style={styles.settingText}>
                <Text style={styles.settingTitle}>Recevoir le B2B</Text>
                <Text style={styles.settingSubtitle}>Commandes partenaires et livreur attitré</Text>
              </View>
            </View>
            <Switch
              value={acceptsB2BOrders}
              disabled={savingB2BPreference}
              onValueChange={handleB2BToggle}
              trackColor={{ false: '#E5E7EB', true: '#8B5CF6' }}
              thumbColor={acceptsB2BOrders ? '#FFFFFF' : '#9CA3AF'}
            />
          </View>
        </View>
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
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 20,
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
  placeholder: {
    width: 40,
  },
  content: {
    flex: 1,
  },
  section: {
    backgroundColor: '#FFFFFF',
    marginTop: 20,
    marginHorizontal: 20,
    borderRadius: 12,
    paddingVertical: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  settingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  settingText: {
    marginLeft: 12,
    flex: 1,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 2,
  },
  settingSubtitle: {
    fontSize: 14,
    color: '#6B7280',
  },
});
