import { Stack } from "expo-router";
import { useEffect } from "react";
import { AppState } from "react-native";
import { useDriverStore } from "../store/useDriverStore";

export default function RootLayout() {
  const { user, logout, validateUserExists } = useDriverStore();

  useEffect(() => {
    // Vérifier si l'utilisateur existe toujours au démarrage
    const checkUserValidity = async () => {
      if (user?.id) {
        try {
          const isValid = await validateUserExists();
          if (!isValid) {
            logout();
          }
        } catch {
          // En cas d'erreur réseau, on garde la session locale
        }
      }
    };

    checkUserValidity();
  }, [user?.id, logout, validateUserExists]);

  useEffect(() => {
    // Vérification périodique quand l'app devient active
    const handleAppStateChange = (nextAppState: string) => {
      if (nextAppState === 'active' && user?.id) {
        validateUserExists().then(isValid => {
          if (!isValid) {
            logout();
          }
        }).catch(() => {
          // Ignorer les erreurs réseau
        });
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription?.remove();
  }, [user?.id, logout, validateUserExists]);

  return (
      <Stack
      screenOptions={{
            headerShown: false,
          }} />
    
  );
}
