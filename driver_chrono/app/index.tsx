import { useEffect } from 'react';
import { router } from 'expo-router';
import { View, ActivityIndicator, Text } from 'react-native';
import { useDriverStore } from '../store/useDriverStore';

export default function RootIndex() {
  const { isAuthenticated, user, accessToken, validateUserExists, logout } = useDriverStore();

  useEffect(() => {
    let cancelled = false;

    const checkSession = async () => {
      if (isAuthenticated && user) {
        const validationResult = await validateUserExists();

        if (cancelled) {
          return;
        }

        if (validationResult === true || validationResult === null || validationResult === 'not_found') {
          router.replace('/(tabs)' as any);
        } else {
          // validationResult === false : suppression explicite côté backend
          logout();
          router.replace('/(auth)/register' as any);
        }
      } else {
        router.replace('/(auth)/register' as any);
      }
    };

    // Attendre que le layout soit monté avant de naviguer
    const timer = setTimeout(() => {
      checkSession().catch(() => {
        if (!cancelled) {
          router.replace('/(tabs)' as any);
        }
      });
    }, 800);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [isAuthenticated, user, accessToken, validateUserExists, logout]);

  return (
    <View style={{ 
      flex: 1, 
      backgroundColor: '#FFFFFF',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
    }}>
      <ActivityIndicator size="large" color="#8B5CF6" />
      <Text style={{ marginTop: 20, color: '#6B7280', textAlign: 'center' }}>
        Vérification de la session...
      </Text>
    </View>
  );
}
