import { Ionicons } from "@expo/vector-icons";
import * as FileSystem from "expo-file-system/legacy";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import {ActivityIndicator,Alert,Image,ScrollView,StatusBar,StyleSheet,Switch,Text,TouchableOpacity,View,} from "react-native";
import { userApiService } from "../../services/userApiService";
import { useAuthStore } from "../../store/useAuthStore";
import { formatUserName } from "../../utils/formatName";
import { logger } from "../../utils/logger";

interface UserStatistics {
  completedOrders: number;
  loyaltyPoints: number;
  totalSaved: number;
}

export default function ProfilePage() {
  const { user, logout, setUser } = useAuthStore();
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [locationEnabled, setLocationEnabled] = useState(true);
  const [statistics, setStatistics] = useState<UserStatistics>({
    completedOrders: 0,
    loyaltyPoints: 0,
    totalSaved: 0,
  });
  const [isLoadingStats, setIsLoadingStats] = useState(true);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(
    (user as any)?.avatar_url || null
  );
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const formatCurrency = (amount: number) => {
    const formatted = new Intl.NumberFormat("fr-FR", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount ?? 0);

    return `${formatted.replace(/\u00A0/g, " ")} FCFA`;
  };

  useEffect(() => {
    setAvatarUrl((user as any)?.avatar_url || null);
  }, [user]);

  useEffect(() => {
    const loadUserProfile = async () => {
      if (!user?.id) return;

      if (user.first_name || user.last_name) return;

      try {
        const result = await userApiService.getUserProfile(user.id);
        if (result.success && result.data) {
          setUser({
            ...user,
            first_name: result.data.first_name,
            last_name: result.data.last_name,
            phone: result.data.phone || user.phone,
            avatar_url: result.data.avatar_url || (user as any)?.avatar_url,
          } as any);
        }
      } catch (error) {
        logger.error("Erreur chargement profil utilisateur:", error);
      }
    };

    if (user?.id) {
      loadUserProfile();
    }
  }, [user, setUser]);

  useEffect(() => {
    const loadStatistics = async () => {
      if (!user?.id) return;

      setIsLoadingStats(true);
      try {
        const result = await userApiService.getUserStatistics(user.id);
        if (result.success && result.data) {
          setStatistics(result.data);
        }
      } catch (error) {
        logger.error("Erreur chargement statistiques:", error);
      } finally {
        setIsLoadingStats(false);
      }
    };

    if (user?.id) {
      loadStatistics();
    }
  }, [user?.id]);

  // Rediriger vers l'authentification si l'utilisateur n'est pas connecté
  useEffect(() => {
    if (!user) {
      router.replace("/(auth)/register" as any);
    }
  }, [user]);

  const handleAvatarPress = async () => {
    if (!user?.id) {
      Alert.alert(
        "Erreur",
        "Vous devez être connecté pour changer votre avatar"
      );
      return;
    }

    try {
      const { status } =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Permission requise",
          "Nous avons besoin de l'accès à vos photos pour changer votre avatar"
        );
        return;
      }

      Alert.alert("Changer l'avatar", "Choisissez une option", [
        { text: "Annuler", style: "cancel" },
        {
          text: "Prendre une photo",
          onPress: async () => {
            const result = await ImagePicker.launchCameraAsync({
              mediaTypes: ImagePicker.MediaTypeOptions.Images,
              allowsEditing: true,
              aspect: [1, 1],
              quality: 0.8,
            });

            if (!result.canceled && result.assets[0]) {
              await uploadAvatar(
                result.assets[0].uri,
                result.assets[0].mimeType || "image/jpeg"
              );
            }
          },
        },
        {
          text: "Choisir depuis la galerie",
          onPress: async () => {
            const result = await ImagePicker.launchImageLibraryAsync({
              mediaTypes: ImagePicker.MediaTypeOptions.Images,
              allowsEditing: true,
              aspect: [1, 1],
              quality: 0.8,
            });

            if (!result.canceled && result.assets[0]) {
              await uploadAvatar(
                result.assets[0].uri,
                result.assets[0].mimeType || "image/jpeg"
              );
            }
          },
        },
      ]);
    } catch (error) {
      logger.error("Erreur sélection image:", error);
      Alert.alert("Erreur", "Impossible d'accéder à vos photos");
    }
  };

  const uploadAvatar = async (imageUri: string, mimeType: string) => {
    if (!user?.id) return;

    try {
      setUploadingAvatar(true);

      const base64 = await FileSystem.readAsStringAsync(imageUri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      const base64DataUri = `data:${mimeType};base64,${base64}`;

      const result = await userApiService.uploadAvatar(
        user.id,
        base64DataUri,
        mimeType
      );

      if (result.success && result.data) {
        setAvatarUrl(result.data.avatar_url);

        if (user) {
          setUser({
            ...user,
            avatar_url: result.data.avatar_url,
          } as any);
        }

        Alert.alert("Succès", "Votre avatar a été mis à jour");
      } else {
        Alert.alert(
          "Erreur",
          result.message || "Impossible de mettre à jour l'avatar"
        );
      }
    } catch (error) {
      logger.error("Erreur upload avatar:", error);
      Alert.alert("Erreur", "Impossible de mettre à jour l'avatar");
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleLogout = () => {
    Alert.alert("Déconnexion", "Êtes-vous sûr de vouloir vous déconnecter ?", [
      {
        text: "Annuler",
        style: "cancel",
      },
      {
        text: "Déconnecter",
        style: "destructive",
        onPress: () => {
          logout();
          router.replace("/(auth)/register" as any);
        },
      },
    ]);
  };

  const menuItems = [
    {
      icon: "person-outline",
      title: "Informations personnelles",
      subtitle: "Nom, téléphone, email",
      onPress: () => router.push("/profile/personal-info"),
      color: "#8B5CF6",
    },
    {
      icon: "location-outline",
      title: "Mes adresses",
      subtitle: "Domicile, bureau, favoris",
      onPress: () => router.push("/profile/addresses"),
      color: "#10B981",
    },
    {
      icon: "card-outline",
      title: "Moyens de paiement",
      subtitle: "Cartes, portefeuille mobile",
      onPress: () => router.push("/profile/payment-methods"),
      color: "#F59E0B",
    },
    {
      icon: "receipt-outline",
      title: "Mes transactions",
      subtitle: "Historique et réclamations",
      onPress: () => router.push("/profile/transactions"),
      color: "#3B82F6",
    },
    {
      icon: "receipt-outline",
      title: "Mes dettes",
      subtitle: "Gérer mes paiements différés",
      onPress: () => router.push("/profile/debts"),
      color: "#EF4444",
    },
    {
      icon: "time-outline",
      title: "Historique des commandes",
      subtitle: "Voir toutes vos livraisons",
      onPress: () => router.push("/profile/order-history"),
      color: "#3B82F6",
    },
    {
      icon: "star-outline",
      title: "Mes évaluations",
      subtitle: "Évaluations et commentaires",
      onPress: () => router.push("/profile/ratings"),
      color: "#EF4444",
    },
    {
      icon: "gift-outline",
      title: "Codes promo",
      subtitle: "Mes réductions et offres",
      onPress: () => router.push("/profile/promo-codes"),
      color: "#EC4899",
    },
    {
      icon: "trophy-outline",
      title: "Points de fidélité",
      subtitle: "Utilisez vos points pour des avantages",
      onPress: () => {
        Alert.alert(
          "Points de fidélité",
          `Vous avez ${statistics.loyaltyPoints} points.\n\n` +
            `• 1 point par commande complétée\n` +
            `• 5 points bonus toutes les 10 commandes\n\n` +
            `Utilisez vos points pour obtenir des réductions et des avantages exclusifs !`,
          [{ text: "OK" }]
        );
      },
      color: "#F59E0B",
    },
  ];

  const supportItems = [
    {
      icon: "settings-outline",
      title: "Paramètres",
      onPress: () => router.push("/profile/settings"),
    },
    {
      icon: "help-circle-outline",
      title: "Aide & Support",
      onPress: () => router.push("/profile/support"),
    },
    {
      icon: "shield-checkmark-outline",
      title: "Politique de confidentialité",
      onPress: () => router.push("/profile/privacy"),
    },
    {
      icon: "information-circle-outline",
      title: "À propos",
      onPress: () => router.push("/profile/about"),
    },
  ];

  // Ne rien afficher pendant la redirection
  if (!user) {
    return null;
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header avec profil utilisateur */}
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
            </View>

            <View style={styles.userInfo}>
              <Text style={styles.userName}>{formatUserName(user as any)}</Text>
              <Text style={styles.userEmail}>{user?.email}</Text>
              <Text style={styles.userPhone}>{user?.phone}</Text>
            </View>
          </View>

          {/* Statistiques rapides */}
          <View style={styles.statsContainer}>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>
                {isLoadingStats ? "..." : statistics.completedOrders}
              </Text>
              <Text style={styles.statLabel}>Commandes</Text>
              <Text style={styles.statSubLabel}>Complétées</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>
                {isLoadingStats ? "..." : formatCurrency(statistics.totalSaved)}
              </Text>
              <Text style={styles.statLabel}>Reste à payer</Text>
              <Text style={styles.statSubLabel}>Paiement différé</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>
                {isLoadingStats ? "..." : statistics.loyaltyPoints}
              </Text>
              <Text style={styles.statLabel}>Points</Text>
              <Text style={styles.statSubLabel}>Fidélité</Text>
            </View>
          </View>
        </View>

        {/* Paramètres rapides */}
        <View style={styles.quickSettings}>
          <View style={styles.quickSettingItem}>
            <View style={styles.quickSettingInfo}>
              <Ionicons name="notifications" size={24} color="#8B5CF6" />
              <View style={styles.quickSettingText}>
                <Text style={styles.quickSettingTitle}>Notifications</Text>
                <Text style={styles.quickSettingSubtitle}>
                  Recevoir les alertes
                </Text>
              </View>
            </View>
            <Switch
              value={notificationsEnabled}
              onValueChange={setNotificationsEnabled}
              trackColor={{ false: "#E5E7EB", true: "#8B5CF6" }}
              thumbColor={notificationsEnabled ? "#FFFFFF" : "#9CA3AF"}
            />
          </View>

          <View style={styles.quickSettingItem}>
            <View style={styles.quickSettingInfo}>
              <Ionicons name="location" size={24} color="#10B981" />
              <View style={styles.quickSettingText}>
                <Text style={styles.quickSettingTitle}>Localisation</Text>
                <Text style={styles.quickSettingSubtitle}>
                  Partager ma position
                </Text>
              </View>
            </View>
            <Switch
              value={locationEnabled}
              onValueChange={setLocationEnabled}
              trackColor={{ false: "#E5E7EB", true: "#10B981" }}
              thumbColor={locationEnabled ? "#FFFFFF" : "#9CA3AF"}
            />
          </View>
        </View>

        {/* Menu principal */}
        <View style={styles.menuContainer}>
          <Text style={styles.sectionTitle}>Mon compte</Text>
          {menuItems.map((item, index) => (
            <TouchableOpacity
              key={index}
              style={styles.menuItem}
              onPress={item.onPress}
            >
              <View style={styles.menuItemLeft}>
                <View
                  style={[
                    styles.menuIcon,
                    { backgroundColor: `${item.color}15` },
                  ]}
                >
                  <Ionicons
                    name={item.icon as any}
                    size={24}
                    color={item.color}
                  />
                </View>
                <View style={styles.menuItemText}>
                  <Text style={styles.menuItemTitle}>{item.title}</Text>
                  <Text style={styles.menuItemSubtitle}>{item.subtitle}</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
            </TouchableOpacity>
          ))}
        </View>

        {/* Support et paramètres */}
        <View style={styles.menuContainer}>
          <Text style={styles.sectionTitle}>Support</Text>
          {supportItems.map((item, index) => (
            <TouchableOpacity
              key={index}
              style={styles.menuItem}
              onPress={item.onPress}
            >
              <View style={styles.menuItemLeft}>
                <View style={styles.menuIcon}>
                  <Ionicons name={item.icon as any} size={24} color="#6B7280" />
                </View>
                <Text style={styles.menuItemTitle}>{item.title}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
            </TouchableOpacity>
          ))}
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F9FAFB",
  },
  header: {
    backgroundColor: "#FFFFFF",
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 20,
    marginBottom: 10,
  },
  profileSection: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
  },
  avatarContainer: {
    position: "relative",
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
    backgroundColor: "#F3F0FF",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#8B5CF6",
  },
  cameraButton: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#8B5CF6",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1F2937",
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 14,
    color: "#6B7280",
    marginBottom: 2,
  },
  userPhone: {
    fontSize: 14,
    color: "#6B7280",
  },
  statsContainer: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
  },
  statItem: {
    alignItems: "center",
  },
  statNumber: {
    fontSize: 20,
    fontWeight: "700",
    color: "#8B5CF6",
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: "#6B7280",
    textTransform: "uppercase",
    fontWeight: "500",
    marginTop: 2,
  },
  statSubLabel: {
    fontSize: 10,
    color: "#9CA3AF",
    marginTop: 2,
  },
  quickSettings: {
    backgroundColor: "#FFFFFF",
    marginHorizontal: 20,
    marginBottom: 10,
    borderRadius: 12,
    paddingVertical: 8,
  },
  quickSettingItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  quickSettingInfo: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  quickSettingText: {
    marginLeft: 12,
    flex: 1,
  },
  quickSettingTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1F2937",
    marginBottom: 2,
  },
  quickSettingSubtitle: {
    fontSize: 14,
    color: "#6B7280",
  },
  menuContainer: {
    backgroundColor: "#FFFFFF",
    marginHorizontal: 20,
    borderRadius: 12,
    marginBottom: 20,
    paddingVertical: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1F2937",
    marginHorizontal: 20,
    marginBottom: 12,
    marginTop: 8,
  },
  menuItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  menuItemLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  menuIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#F3F4F6",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  menuItemText: {
    flex: 1,
  },
  menuItemTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1F2937",
    marginBottom: 2,
  },
  menuItemSubtitle: {
    fontSize: 14,
    color: "#6B7280",
  },
  logoutButton: {
    backgroundColor: "#FEF2F2",
    marginHorizontal: 20,
    padding: 16,
    borderRadius: 12,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  logoutText: {
    marginLeft: 8,
    fontSize: 16,
    fontWeight: "600",
    color: "#EF4444",
  },
  versionContainer: {
    alignItems: "center",
    paddingBottom: 40,
  },
  versionText: {
    fontSize: 12,
    color: "#9CA3AF",
  },
  // Anciens styles conservés pour compatibilité
  headerTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: "#1F2937",
    textAlign: "center",
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 30,
  },
  optionsContainer: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    marginBottom: 30,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  option: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  optionText: {
    flex: 1,
    fontSize: 16,
    color: "#1F2937",
    marginLeft: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#333",
    marginTop: 20,
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    color: "#666",
    textAlign: "center",
  },
});
