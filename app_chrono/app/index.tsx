import { useEffect } from 'react';
import { router } from 'expo-router';
import { View, ActivityIndicator, Text } from 'react-native';
import { useAuthStore } from '../store/useAuthStore';

export default function RootIndex() {
  const { isAuthenticated, user, validateUser, logout } = useAuthStore();

  useEffect(() => {
    let cancelled = false;

    const checkSession = async () => {
      if (isAuthenticated && user) {
        const validationResult = await validateUser();

        if (cancelled) {
          return;
        }

        if (validationResult === true || validationResult === null || validationResult === 'not_found') {
          router.replace('/(tabs)' as any);
        } else {
          logout();
          router.replace('/(auth)/register' as any);
        }
      } else {
        router.replace('/(auth)/register' as any);
      }
    };

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
  }, [isAuthenticated, user, validateUser, logout]);

  return (
    <View style={{ 
      flex: 1, 
      backgroundColor: '#FFFFFF',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
    }}>
      <ActivityIndicator size="large" color="#8B7CF6" />
      <Text style={{ marginTop: 20, color: '#6B7280', textAlign: 'center' }}>
        Vérification...
      </Text>
    </View>
  );
}
