import { useAuthStore } from '../store/useAuthStore';
import { router } from 'expo-router';

export const useRequireAuth = () => {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  const requireAuth = (action: () => void) => {
    if (isAuthenticated) {
      action();
    } else {
      router.push('/(auth)/register' as any);
    }
  };

  return { requireAuth, isAuthenticated };
};