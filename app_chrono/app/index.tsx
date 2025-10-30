import { useEffect } from 'react';
import { router } from 'expo-router';
import { View, ActivityIndicator, Text } from 'react-native';
import { useAuthStore } from '../store/useAuthStore';

export default function RootIndex() {
  const { isAuthenticated, user } = useAuthStore();

  useEffect(() => {
    const timer = setTimeout(() => {
      if (isAuthenticated && user) {
        router.replace('/(tabs)' as any);
      } else {
        router.replace('/(auth)/register' as any);
      }
    }, 1000);

    return () => clearTimeout(timer);
  }, [isAuthenticated, user]);

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
