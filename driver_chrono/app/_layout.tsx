import { Stack } from "expo-router";
import { useEffect } from "react";
import { AppState } from "react-native";
import { useDriverStore } from "../store/useDriverStore";

export default function RootLayout() {
  const { user, logout, validateUserExists } = useDriverStore();

  useEffect(() => {
    // 🔍 Vérifier si l'utilisateur existe toujours au démarrage
    const checkUserValidity = async () => {
      if (user?.id) {
        console.log("🔍 Vérification validité driver au démarrage...");
        try {
          const isValid = await validateUserExists();
          if (!isValid) {
            console.log("❌ Driver supprimé de la base - déconnexion forcée");
            logout();
          } else {
            console.log("✅ Driver valide - connexion maintenue");
          }
        } catch (error) {
          console.error("⚠️ Erreur vérification driver:", error);
          // En cas d'erreur réseau, on garde la session locale
        }
      }
    };

    checkUserValidity();
  }, [user?.id, logout, validateUserExists]);

  useEffect(() => {
    // 🔄 Vérification périodique quand l'app devient active
    const handleAppStateChange = (nextAppState: string) => {
      if (nextAppState === 'active' && user?.id) {
        console.log("📱 App redevenue active - vérification driver...");
        validateUserExists().then(isValid => {
          if (!isValid) {
            console.log("❌ Driver supprimé - déconnexion forcée");
            logout();
          }
        }).catch(error => {
          console.error("⚠️ Erreur vérification périodique:", error);
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
