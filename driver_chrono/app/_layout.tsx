import { Stack } from "expo-router";
import { useEffect } from "react";
import { AppState, AppStateStatus } from "react-native";
import { useDriverStore } from "../store/useDriverStore";
import { initSentry } from "../utils/sentry";
import { ErrorBoundary } from "../components/error/ErrorBoundary";
import { ErrorModalsProvider } from "../components/error/ErrorModalsProvider";
import { soundService } from "../services/soundService";
import { apiService } from "../services/apiService";
import "../config/envCheck";
import { logger } from "../utils/logger";

//  SENTRY: Initialiser le monitoring d'erreurs
initSentry();

export default function RootLayout() {
  const { isAuthenticated, user, validateUserExists, logout } = useDriverStore();

  useEffect(() => {
    // Vérification optionnelle en arrière-plan (non bloquante)
    const checkUserValidity = async () => {
      if (user?.id) {
        // Vérifier et rafraîchir le token si nécessaire
        try {
          const tokenResult = await apiService.ensureAccessToken();
          if (!tokenResult.token) {
            // Token invalide ou impossible à rafraîchir, déconnecter
            logout();
            return;
          }
        } catch (error) {
          // En cas d'erreur, continuer avec la validation normale
          logger.warn('Erreur lors de la vérification du token:', undefined, error);
        }

        const result = await validateUserExists();
        if (result === false) {
          logout();
        }
      }
    };

    checkUserValidity();
  }, [user?.id, validateUserExists, logout]);

  useEffect(() => {
    // Vérification et rafraîchissement du token quand l'app devient active
    // Cela évite les problèmes de session expirée après une longue période d'inactivité
    const handleAppStateChange = async (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active' && isAuthenticated && user?.id) {
        // L'app revient au premier plan, vérifier et rafraîchir le token si nécessaire
        try {
          const tokenResult = await apiService.ensureAccessToken();
          if (!tokenResult.token) {
            // Token invalide ou impossible à rafraîchir, déconnecter silencieusement
            // L'utilisateur sera redirigé à la prochaine action nécessitant une authentification
            logger.warn('[RootLayout] Session expirée lors du retour en arrière-plan');
            logout();
            return;
          }
        } catch (error) {
          // En cas d'erreur, ne pas déconnecter (peut être une erreur réseau temporaire)
          logger.warn('[RootLayout] Erreur lors de la vérification du token au retour:', undefined, error);
        }

        // Valider aussi l'existence de l'utilisateur
        validateUserExists().then((result) => {
          if (result === false) {
            logout();
          }
        }).catch(() => {
          // ignorer
        });
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription?.remove();
  }, [isAuthenticated, user?.id, validateUserExists, logout]);

  useEffect(() => {
    // Initialiser le service de son au démarrage
    soundService.initialize().catch((err) => {
      logger.warn('[RootLayout] Erreur initialisation service son:', undefined, err);
    });
  }, []);

  return (
    <ErrorBoundary>
      <ErrorModalsProvider>
        <Stack
          screenOptions={{
            headerShown: false,
          }}
        />
      </ErrorModalsProvider>
    </ErrorBoundary>
  );
}
