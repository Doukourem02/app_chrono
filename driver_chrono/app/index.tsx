import { router } from "expo-router";
import { useEffect } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { useDriverStore } from "../store/useDriverStore";
import { apiService } from "../services/apiService";

export default function RootIndex() {
  const { isAuthenticated, user, accessToken, validateUserExists, logout } =
    useDriverStore();

  useEffect(() => {
    let cancelled = false;

    const checkSession = async () => {
      if (isAuthenticated && user) {
        // Vérifier et rafraîchir le token si nécessaire avant de valider la session
        // Cela évite les problèmes de session expirée après une longue période d'inactivité
        try {
          const tokenResult = await apiService.ensureAccessToken();
          if (!tokenResult.token) {
            // Token invalide ou impossible à rafraîchir, déconnecter
            if (!cancelled) {
              logout();
              router.replace("/(auth)/register" as any);
            }
            return;
          }
        } catch (error) {
          // En cas d'erreur, continuer avec la validation normale
          console.warn('Erreur lors de la vérification du token:', error);
        }

        const validationResult = await validateUserExists();

        if (cancelled) {
          return;
        }

        if (
          validationResult === true ||
          validationResult === null ||
          validationResult === "not_found"
        ) {
          router.replace("/(tabs)" as any);
        } else {
          // validationResult === false : suppression explicite côté backend
          logout();
          router.replace("/(auth)/register" as any);
        }
      } else {
        router.replace("/(auth)/register" as any);
      }
    };

    // Attendre que le layout soit monté avant de naviguer
    const timer = setTimeout(() => {
      checkSession().catch(() => {
        if (!cancelled) {
          router.replace("/(tabs)" as any);
        }
      });
    }, 800);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [isAuthenticated, user, accessToken, validateUserExists, logout]);

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: "#FFFFFF",
        justifyContent: "center",
        alignItems: "center",
        padding: 20,
      }}
    >
      <ActivityIndicator size="large" color="#8B5CF6" />
      <Text style={{ marginTop: 20, color: "#6B7280", textAlign: "center" }}>
        Vérification de la session...
      </Text>
    </View>
  );
}
