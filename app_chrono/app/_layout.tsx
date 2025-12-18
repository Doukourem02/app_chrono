import { Stack } from "expo-router";
import { useEffect } from "react";
import { initSentry } from "../utils/sentry";
import { ErrorBoundary } from "../components/error/ErrorBoundary";
import { soundService } from "../services/soundService";
// Validation des variables d'environnement au démarrage
import "../config/envCheck";

initSentry();

export default function RootLayout() {
  useEffect(() => {
    // Initialiser le service de son au démarrage
    soundService.initialize().catch((err) => {
      console.warn('[RootLayout] Erreur initialisation service son:', err);
    });
  }, []);

  return (
    <ErrorBoundary>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="summary" />
      </Stack>
    </ErrorBoundary>
  );
}
