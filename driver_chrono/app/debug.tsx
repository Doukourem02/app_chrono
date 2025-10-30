import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useDriverStore } from '../store/useDriverStore';
import { Ionicons } from '@expo/vector-icons';

export default function DebugScreen() {
  const { logout, user, validateUserExists } = useDriverStore();

  const clearAllData = async () => {
    try {
      await AsyncStorage.clear();
      logout();
      Alert.alert('✅ Succès', 'Toutes les données ont été supprimées');
    } catch {
      Alert.alert('❌ Erreur', 'Impossible de vider le cache');
    }
  };

  const checkUserStatus = async () => {
    try {
      const isValid = await validateUserExists();
      Alert.alert(
        '🔍 Statut Utilisateur', 
        isValid ? '✅ Utilisateur existe dans la base' : '❌ Utilisateur supprimé de la base'
      );
    } catch {
      Alert.alert('❌ Erreur', 'Impossible de vérifier le statut');
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>🛠️ Debug Driver</Text>
      
      <View style={styles.section}>
        <Text style={styles.subtitle}>Utilisateur Actuel:</Text>
        <Text style={styles.info}>
          {user ? `📧 ${user.email}` : '❌ Aucun utilisateur connecté'}
        </Text>
      </View>

      <TouchableOpacity style={styles.button} onPress={checkUserStatus}>
        <Ionicons name="search" size={20} color="#fff" />
        <Text style={styles.buttonText}>Vérifier Statut dans Base</Text>
      </TouchableOpacity>

      <TouchableOpacity style={[styles.button, styles.dangerButton]} onPress={clearAllData}>
        <Ionicons name="trash" size={20} color="#fff" />
        <Text style={styles.buttonText}>Vider Cache & Déconnecter</Text>
      </TouchableOpacity>

      <View style={styles.note}>
        <Text style={styles.noteText}>
          💡 Si vous avez supprimé ce driver de Supabase, 
          la vérification devrait automatiquement le déconnecter.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 30,
  },
  section: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 10,
    marginBottom: 20,
  },
  subtitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 10,
  },
  info: {
    fontSize: 14,
    color: '#666',
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#8B5CF6',
    padding: 15,
    borderRadius: 10,
    marginBottom: 15,
    gap: 10,
  },
  dangerButton: {
    backgroundColor: '#EF4444',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  note: {
    backgroundColor: '#FEF3C7',
    padding: 15,
    borderRadius: 10,
    marginTop: 20,
  },
  noteText: {
    fontSize: 12,
    color: '#92400E',
    textAlign: 'center',
  },
});