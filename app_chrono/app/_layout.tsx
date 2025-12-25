import { Stack } from "expo-router";
import { useEffect } from "react";
import { AppState, AppStateStatus } from "react-native";
import { initSentry } from "../utils/sentry";
import { ErrorBoundary } from "../components/error/ErrorBoundary";
import { ErrorModalsProvider } from "../components/error/ErrorModalsProvider";
import { soundService } from "../services/soundService";
import { useAuthStore } from "../store/useAuthStore";
import { userApiService } from "../services/userApiService";
// Validation des variables d'environnement au démarrage
import "../config/envCheck";

initSentry();

export default function RootLayout() {
  const { isAuthenticated, user, logout } = useAuthStore();

  useEffect(() => {
    // Initialiser le service de son au démarrage
    soundService.initialize().catch((err) => {
      console.warn('[RootLayout] Erreur initialisation service son:', err);
    });
  }, []);

  // Vérifier et rafraîchir la session quand l'app revient en arrière-plan
  // Cela évite les problèmes de session expirée après une longue période d'inactivité
  useEffect(() => {
    const handleAppStateChange = async (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active' && isAuthenticated && user) {
        // L'app revient au premier plan, vérifier et rafraîchir le token si nécessaire
        try {
          const token = await userApiService.ensureAccessToken();
          if (!token) {
            // Token invalide ou impossible à rafraîchir, déconnecter silencieusement
            // L'utilisateur sera redirigé à la prochaine action nécessitant une authentification
            console.warn('[RootLayout] Session expirée lors du retour en arrière-plan');
            logout();
          }
        } catch (error) {
          // En cas d'erreur, ne pas déconnecter (peut être une erreur réseau temporaire)
          console.warn('[RootLayout] Erreur lors de la vérification du token au retour:', error);
        }
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      subscription.remove();
    };
  }, [isAuthenticated, user, logout]);

  return (
    <ErrorBoundary>
      <ErrorModalsProvider>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="(auth)" options={{ headerShown: false }} />
          <Stack.Screen name="summary" />
        </Stack>
      </ErrorModalsProvider>
    </ErrorBoundary>
  );
}
