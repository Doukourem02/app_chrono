import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Image, Alert, Switch, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { useDriverStore } from '../../store/useDriverStore';
import { formatUserName } from '../../utils/formatName';
import { apiService } from '../../services/apiService';
import { logger } from '../../utils/logger';

interface DriverStatistics {
  completedDeliveries: number;
  averageRating: number;
  totalEarnings?: number;
}

export default function ProfilePage() {
  const { user, profile, isOnline, logout, setOnlineStatus, setUser, updateProfile } = useDriverStore();
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [statistics, setStatistics] = useState<DriverStatistics>({
    completedDeliveries: 0,
    averageRating: 5.0,
    totalEarnings: 0
  });
  const [isLoadingStats, setIsLoadingStats] = useState(true);
  const [avatarUrl, setAvatarUrl] = useState<string | null>((user as any)?.avatar_url || profile?.profile_image_url || null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const formatCurrency = (amount: number) => {
    const formatted = new Intl.NumberFormat('fr-FR', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount ?? 0);

    return `${formatted.replace(/\u00A0/g, ' ')} FCFA`;
  };

  // Charger les statistiques depuis le backend (note calculée dynamiquement)
  const loadStatistics = useCallback(async () => {
    if (!user?.id) return;

    setIsLoadingStats(true);
    try {
      const result = await apiService.getDriverStatistics(user.id);
      if (result.success && result.data) {
        // La note moyenne est calculée dynamiquement depuis la table ratings
        // Elle est mise à jour automatiquement à chaque nouvelle évaluation
        setStatistics(result.data);
        if (__DEV__) {
          logger.debug('[Profile] Statistiques chargées:', undefined, {
            completedDeliveries: result.data.completedDeliveries,
            averageRating: result.data.averageRating,
            totalEarnings: result.data.totalEarnings
          });
        }
      }
    } catch (error) {
      logger.error('[Profile] Erreur chargement statistiques:', undefined, error);
    } finally {
      setIsLoadingStats(false);
    }
  }, [user?.id]);

  useEffect(() => {
    loadStatistics();
  }, [loadStatistics]);

  // Charger les données utilisateur complètes si first_name/last_name manquent
  useEffect(() => {
    const loadUserProfile = async () => {
      if (!user?.id) return;
      
      // Si first_name et last_name sont déjà disponibles, ne pas recharger
      if (user.first_name || user.last_name) return;

      try {
        const result = await apiService.getUserProfile(user.id);
        if (result.success && result.data) {
          setUser({
            ...user,
            first_name: result.data.first_name,
            last_name: result.data.last_name,
            phone: result.data.phone || user.phone,
          });
        }
      } catch (error) {
        logger.error('Erreur chargement profil utilisateur:', undefined, error);
      }
    };

    loadUserProfile();
  }, [user, setUser]);

  // Mettre à jour l'avatar quand l'utilisateur ou le profil change
  useEffect(() => {
    setAvatarUrl((user as any)?.avatar_url || profile?.profile_image_url || null);
  }, [user, profile]);

  const handleAvatarPress = async () => {
    if (!user?.id) {
      Alert.alert('Erreur', 'Vous devez être connecté pour changer votre avatar');
      return;
    }

    try {
      // Demander les permissions
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission requise', 'Nous avons besoin de l\'accès à vos photos pour changer votre avatar');
        return;
      }

      // Afficher les options
      Alert.alert(
        'Changer l\'avatar',
        'Choisissez une option',
        [
          { text: 'Annuler', style: 'cancel' },
          {
            text: 'Prendre une photo',
            onPress: async () => {
              const result = await ImagePicker.launchCameraAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: true,
                aspect: [1, 1],
                quality: 0.8,
              });

              if (!result.canceled && result.assets[0]) {
                await uploadAvatar(result.assets[0].uri, result.assets[0].mimeType || 'image/jpeg');
              }
            },
          },
          {
            text: 'Choisir depuis la galerie',
            onPress: async () => {
              const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: true,
                aspect: [1, 1],
                quality: 0.8,
              });

              if (!result.canceled && result.assets[0]) {
                await uploadAvatar(result.assets[0].uri, result.assets[0].mimeType || 'image/jpeg');
              }
            },
          },
        ]
      );
    } catch (error) {
      logger.error('Erreur sélection image:', undefined, error);
      Alert.alert('Erreur', 'Impossible d\'accéder à vos photos');
    }
  };

  const uploadAvatar = async (imageUri: string, mimeType: string) => {
    if (!user?.id) return;

    try {
      setUploadingAvatar(true);

      // Lire l'image en base64 avec expo-file-system/legacy
      const base64 = await FileSystem.readAsStringAsync(imageUri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      const base64DataUri = `data:${mimeType};base64,${base64}`;

      // Uploader vers le backend
      const result = await apiService.uploadAvatar(user.id, base64DataUri, mimeType);

      if (result.success && result.data) {
        // Mettre à jour l'avatar localement
        setAvatarUrl(result.data.avatar_url);
        
        // Mettre à jour le store
        if (user) {
          setUser({
            ...user,
            avatar_url: result.data.avatar_url,
          } as any);
        }

        // Mettre à jour le profil si disponible
        if (profile) {
          updateProfile({
            profile_image_url: result.data.avatar_url,
          } as any);
        }

        Alert.alert('Succès', 'Votre avatar a été mis à jour');
      } else {
        Alert.alert('Erreur', result.message || 'Impossible de mettre à jour l\'avatar');
      }
    } catch (error) {
      logger.error('Erreur upload avatar:', undefined, error);
      Alert.alert('Erreur', 'Impossible de mettre à jour l\'avatar');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleLogout = () => {
    Alert.alert(
      'Déconnexion',
      'Êtes-vous sûr de vouloir vous déconnecter ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Déconnexion',
          style: 'destructive',
          onPress: () => {
            logout();
            router.replace('/(auth)/register' as any);
          },
        },
      ]
    );
  };

  const menuItems = [
    {
      icon: 'person-outline',
      title: 'Informations personnelles',
      subtitle: 'Gérer vos données personnelles',
      onPress: () => router.push('/profile/personal-info'),
    },
    {
      icon: 'car-outline',
      title: 'Mon véhicule',
      subtitle: 'Gérer les informations du véhicule',
      onPress: () => router.push('/profile/vehicle'),
    },
    ...(profile?.driver_type === 'partner' ? [{
      icon: 'wallet-outline',
      title: 'Commission',
      subtitle: 'Gérer votre solde commission',
      onPress: () => router.push('/commission' as any),
    }] : []),
    {
      icon: 'card-outline',
      title: 'Paiements',
      subtitle: 'Gérer vos moyens de paiement',
      onPress: () => router.push('/profile/payments'),
    },
    {
      icon: 'stats-chart-outline',
      title: 'Statistiques',
      subtitle: 'Voir vos performances',
      onPress: () => router.push('/profile/statistics'),
    },
    {
      icon: 'star-outline',
      title: 'Ma note',
      subtitle: 'Votre évaluation par les clients',
      onPress: () => {
        Alert.alert(
          'Ma note moyenne',
          `Vous avez une note de ${statistics.averageRating.toFixed(1)}/5.0\n\n` +
          `• Basée sur ${statistics.completedDeliveries} livraison${statistics.completedDeliveries > 1 ? 's' : ''} complétée${statistics.completedDeliveries > 1 ? 's' : ''}\n` +
          `• Cette note est calculée dynamiquement à partir de toutes vos évaluations\n` +
          `• Elle se met à jour automatiquement après chaque nouvelle évaluation\n\n` +
          `Continuez à offrir un excellent service pour maintenir une note élevée !`,
          [
            { text: 'Rafraîchir', onPress: () => loadStatistics() },
            { text: 'OK' }
          ]
        );
      },
    },
    {
      icon: 'settings-outline',
      title: 'Paramètres',
      subtitle: 'Préférences de l\'application',
      onPress: () => router.push('/profile/settings' as any),
    },
    {
      icon: 'help-circle-outline',
      title: 'Aide et support',
      subtitle: 'Besoin d\'aide ?',
      onPress: () => router.push('/profile/support' as any),
    },
  ];

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Header avec profil */}
      <View style={styles.header}>
        <View style={styles.profileSection}>
          <View style={styles.avatarContainer}>
            {uploadingAvatar ? (
              <View style={styles.avatarPlaceholder}>
                <ActivityIndicator size="large" color="#8B5CF6" />
              </View>
            ) : avatarUrl ? (
              <Image source={{ uri: avatarUrl }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Ionicons name="person" size={40} color="#8B5CF6" />
              </View>
            )}
            <TouchableOpacity 
              style={styles.cameraButton}
              onPress={handleAvatarPress}
              disabled={uploadingAvatar}
            >
              {uploadingAvatar ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Ionicons name="camera" size={16} color="#FFFFFF" />
              )}
            </TouchableOpacity>
            <View style={[styles.statusBadge, isOnline ? styles.onlineBadge : styles.offlineBadge]}>
              <Text style={styles.statusText}>{isOnline ? 'En ligne' : 'Hors ligne'}</Text>
            </View>
          </View>
          
          <View style={styles.userInfo}>
            <Text style={styles.userName}>
              {(user?.first_name || user?.last_name || profile?.first_name || profile?.last_name)
                ? formatUserName(user as any) || formatUserName(profile as any) || 'Utilisateur'
                : 'Compléter votre profil'}
            </Text>
            <Text style={styles.userEmail}>{user?.email}</Text>
            <Text style={styles.userPhone}>{user?.phone}</Text>
            {!(user?.first_name || user?.last_name || profile?.first_name || profile?.last_name) && (
              <TouchableOpacity 
                style={styles.completeProfileButton}
                onPress={() => router.push('/profile/personal-info')}
              >
                <Text style={styles.completeProfileText}>
                  Ajouter votre nom et prénom
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Statistiques rapides */}
        <View style={styles.statsContainer}>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>
              {isLoadingStats ? '...' : statistics.completedDeliveries}
            </Text>
            <Text style={styles.statLabel}>Livraisons</Text>
            <Text style={styles.statSubLabel}>Complétées</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>
              {isLoadingStats ? '...' : statistics.averageRating.toFixed(1)}
            </Text>
            <Text style={styles.statLabel}>Note moyenne</Text>
            <Text style={styles.statSubLabel}>
              {statistics.completedDeliveries > 0 
                ? `${statistics.completedDeliveries} évaluation${statistics.completedDeliveries > 1 ? 's' : ''}` 
                : 'Aucune évaluation'}
            </Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>
              {isLoadingStats ? '...' : formatCurrency(statistics.totalEarnings ?? profile?.total_earnings ?? 0)}
            </Text>
            <Text style={styles.statLabel}>Gains</Text>
            <Text style={styles.statSubLabel}>Total</Text>
          </View>
        </View>
      </View>

      {/* Toggle statut en ligne */}
      <View style={styles.onlineToggleContainer}>
        <View style={styles.onlineToggleInfo}>
          <Ionicons name="radio" size={24} color="#8B5CF6" />
          <View style={styles.onlineToggleText}>
            <Text style={styles.onlineToggleTitle}>Statut en ligne</Text>
            <Text style={styles.onlineToggleSubtitle}>
              {isOnline ? 'Vous pouvez recevoir des commandes' : 'Vous ne recevez pas de commandes'}
            </Text>
          </View>
        </View>
        <Switch
          value={isOnline}
          onValueChange={async (value) => {
            // Mettre à jour le store directement (sera synchronisé avec index.tsx)
            setOnlineStatus(value);
            
            // Synchroniser avec le backend si l'utilisateur est connecté
            const currentState = useDriverStore.getState();
            if (currentState.user?.id) {
              try {
                const { apiService } = await import('../../services/apiService');
                const result = await apiService.updateDriverStatus(currentState.user.id, {
                  is_online: value,
                  is_available: value,
                  current_latitude: currentState.currentLocation?.latitude,
                  current_longitude: currentState.currentLocation?.longitude,
                });
                
                // Si la session est expirée, le logout() a déjà été appelé
                // Le système de redirection gérera la navigation vers la page de connexion
                if (!result.success && result.message?.includes('Session expirée')) {
                  // Ne pas afficher d'alerte, laisser le système de redirection faire son travail
                  return;
                }
                
                if (!result.success) {
                  // Rollback en cas d'erreur
                  setOnlineStatus(!value);
                  Alert.alert(
                    'Erreur',
                    result.message || 'Impossible de synchroniser votre statut avec le serveur.',
                    [{ text: 'OK' }]
                  );
                }
              } catch (error) {
                logger.error('Erreur synchronisation statut depuis profile:', undefined, error);
                // Rollback en cas d'erreur
                setOnlineStatus(!value);
                
                // Ne pas afficher d'erreur si c'est une session expirée (déjà géré par logout)
                const errorMessage = error instanceof Error ? error.message : '';
                if (!errorMessage.includes('Session expirée')) {
                  Alert.alert(
                    'Erreur',
                    'Impossible de synchroniser votre statut avec le serveur.',
                    [{ text: 'OK' }]
                  );
                }
              }
            }
          }}
          trackColor={{ false: '#E5E7EB', true: '#8B5CF6' }}
          thumbColor={isOnline ? '#FFFFFF' : '#9CA3AF'}
        />
      </View>

      {/* Menu items */}
      <View style={styles.menuContainer}>
        {menuItems.map((item, index) => (
          <TouchableOpacity
            key={index}
            style={styles.menuItem}
            onPress={item.onPress}
          >
            <View style={styles.menuItemLeft}>
              <View style={styles.menuIcon}>
                <Ionicons name={item.icon as any} size={24} color="#8B5CF6" />
              </View>
              <View style={styles.menuItemText}>
                <Text style={styles.menuItemTitle}>{item.title}</Text>
                <Text style={styles.menuItemSubtitle}>{item.subtitle}</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
          </TouchableOpacity>
        ))}

        {/* Notifications toggle */}
        <View style={styles.menuItem}>
          <View style={styles.menuItemLeft}>
            <View style={styles.menuIcon}>
              <Ionicons name="notifications-outline" size={24} color="#8B5CF6" />
            </View>
            <View style={styles.menuItemText}>
              <Text style={styles.menuItemTitle}>Notifications</Text>
              <Text style={styles.menuItemSubtitle}>Recevoir les notifications push</Text>
            </View>
          </View>
          <Switch
            value={notificationsEnabled}
            onValueChange={setNotificationsEnabled}
            trackColor={{ false: '#E5E7EB', true: '#8B5CF6' }}
            thumbColor={notificationsEnabled ? '#FFFFFF' : '#9CA3AF'}
          />
        </View>
      </View>

      {/* Bouton déconnexion */}
      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Ionicons name="log-out-outline" size={24} color="#EF4444" />
        <Text style={styles.logoutText}>Se déconnecter</Text>
      </TouchableOpacity>

      {/* Version de l'app */}
      <View style={styles.versionContainer}>
        <Text style={styles.versionText}>Version 1.0.0</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    backgroundColor: '#FFFFFF',
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 20,
    marginBottom: 10,
  },
  profileSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 15,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  avatarPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#F3F0FF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#8B5CF6',
  },
  cameraButton: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#8B5CF6',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    zIndex: 2,
  },
  statusBadge: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  onlineBadge: {
    backgroundColor: '#10B981',
  },
  offlineBadge: {
    backgroundColor: '#EF4444',
  },
  statusText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '600',
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 2,
  },
  userPhone: {
    fontSize: 14,
    color: '#6B7280',
  },
  completeProfileButton: {
    marginTop: 8,
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: '#F3F0FF',
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  completeProfileText: {
    fontSize: 12,
    color: '#8B5CF6',
    fontWeight: '600',
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 20,
    fontWeight: '700',
    color: '#8B5CF6',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#6B7280',
    textTransform: 'uppercase',
    fontWeight: '500',
    marginTop: 2,
  },
  statSubLabel: {
    fontSize: 10,
    color: '#9CA3AF',
    marginTop: 2,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
  },
  ratingMax: {
    fontSize: 14,
    fontWeight: '600',
    color: '#9CA3AF',
    marginLeft: 2,
  },
  onlineToggleContainer: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 20,
    marginBottom: 10,
    padding: 16,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  onlineToggleInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  onlineToggleText: {
    marginLeft: 12,
    flex: 1,
  },
  onlineToggleTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 2,
  },
  onlineToggleSubtitle: {
    fontSize: 14,
    color: '#6B7280',
  },
  menuContainer: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 20,
    borderRadius: 12,
    marginBottom: 20,
  },
  menuItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  menuIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F0FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  menuItemText: {
    flex: 1,
  },
  menuItemTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 2,
  },
  menuItemSubtitle: {
    fontSize: 14,
    color: '#6B7280',
  },
  logoutButton: {
    backgroundColor: '#FEF2F2',
    marginHorizontal: 20,
    padding: 16,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  logoutText: {
    marginLeft: 8,
    fontSize: 16,
    fontWeight: '600',
    color: '#EF4444',
  },
  versionContainer: {
    alignItems: 'center',
    paddingBottom: 40,
  },
  versionText: {
    fontSize: 12,
    color: '#9CA3AF',
  },
});
