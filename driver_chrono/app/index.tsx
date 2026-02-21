import { router } from "expo-router";
import { useEffect } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { useDriverStore } from "../store/useDriverStore";
import { apiService } from "../services/apiService";
import { logger } from "../utils/logger";

export default function RootIndex() {
  const { validateUserExists, logout, hydrateTokens } = useDriverStore();

  useEffect(() => {
    let cancelled = false;

    const checkSession = async () => {
      // Charger le refresh token depuis SecureStore AVANT tout check (comme app_chrono)
      await hydrateTokens();
      const state = useDriverStore.getState();
      const { isAuthenticated: auth, user: u, profile: p } = state;

      if (auth && u) {
        let tokenResult: { token: string | null } = { token: null };
        try {
          tokenResult = await apiService.ensureAccessToken();
        } catch (error) {
          logger.warn('Erreur lors de la vérification du token:', undefined, error);
        }

        if (cancelled) return;

        if (!tokenResult.token) {
          logout();
          router.replace("/(auth)/register" as any);
          return;
        }

        const validationResult = await validateUserExists();

        if (cancelled) return;

        if (
          validationResult === true ||
          validationResult === null ||
          validationResult === "not_found"
        ) {
          // Recharger le profil depuis le backend pour s'assurer qu'on a les données à jour
          // (le profil persisté pourrait être obsolète)
          let freshProfile = null;
          try {
            const profileResult = await apiService.getDriverProfile(u.id);
            if (profileResult.success && profileResult.data) {
              freshProfile = profileResult.data;
              // Mettre à jour le profil dans le store avec les données fraîches du backend
              const { setProfile } = useDriverStore.getState();
              setProfile(freshProfile);
            }
          } catch (error) {
            logger.warn('Erreur rechargement profil:', undefined, error);
            // Continuer même si le rechargement échoue
          }

          // Utiliser le profil frais si disponible, sinon utiliser celui du store
          const currentProfile = freshProfile || p;
          
          // ÉTAPE 1 : Vérifier si driver_type manquant (PRIORITÉ - TOUJOURS EN PREMIER)
          if (!currentProfile || !currentProfile.driver_type) {
            router.replace("/(auth)/driver-type-selection" as any);
            return;
          }
          
          // Si driver_type existe, le profil est considéré comme complété
          // (les informations véhicule sont optionnelles et peuvent être complétées plus tard)
          // Profil complet → accès aux tabs
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

    const runCheck = () => {
      if (cancelled) return;
      checkSession().catch(() => {
        if (!cancelled) router.replace("/(tabs)" as any);
      });
    };

    // Attendre que le persist Zustand ait rechargé user/isAuthenticated (comme app_chrono)
    const unsub = useDriverStore.persist.onFinishHydration(runCheck);
    if (useDriverStore.persist.hasHydrated()) {
      runCheck();
    }
    const fallback = setTimeout(runCheck, 2500);

    return () => {
      cancelled = true;
      unsub?.();
      clearTimeout(fallback);
    };
  }, [validateUserExists, logout, hydrateTokens]);

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
