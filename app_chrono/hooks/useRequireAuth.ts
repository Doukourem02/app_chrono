import { useAuthStore } from '../store/useAuthStore';
import { router } from 'expo-router';

export const useRequireAuth = () => {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  const requireAuth = (action: () => void) => {
    if (isAuthenticated) {
      // L'utilisateur est connecté, exécuter l'action
      action();
    } else {
      // L'utilisateur n'est pas connecté, rediriger directement
      router.push('/(auth)/register' as any);
    }
  };

  return { requireAuth, isAuthenticated };
};