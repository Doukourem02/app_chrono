import { Stack } from "expo-router";
import { useEffect } from "react";
import { AppState } from "react-native";
import { useDriverStore } from "../store/useDriverStore";

export default function RootLayout() {
  const { user, validateUserExists, logout } = useDriverStore();

  useEffect(() => {
    // Vérification optionnelle en arrière-plan (non bloquante)
    const checkUserValidity = async () => {
      if (user?.id) {
        const result = await validateUserExists();
        if (result === false) {
          logout();
        }
      }
    };

    checkUserValidity();
  }, [user?.id, validateUserExists, logout]);

  useEffect(() => {
    // Vérification périodique optionnelle quand l'app devient active
    const handleAppStateChange = (nextAppState: string) => {
      if (nextAppState === 'active' && user?.id) {
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
  }, [user?.id, validateUserExists, logout]);

  return (
      <Stack
      screenOptions={{
            headerShown: false,
          }} />
    
  );
}
