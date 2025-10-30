import { useEffect, useState } from 'react';
import { router } from 'expo-router';
import { View, ActivityIndicator, Text } from 'react-native';
import { useDriverStore } from '../store/useDriverStore';

export default function RootIndex() {
  const { isAuthenticated, user, validateUserExists, logout } = useDriverStore();
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    const checkAuthentication = async () => {
      try {
        if (isAuthenticated && user) {
          const userExists = await validateUserExists();
          
          if (!userExists) {
            logout();
            router.replace('/(auth)/register' as any);
          } else {
            router.replace('/(tabs)' as any);
          }
        } else {
          router.replace('/(auth)/register' as any);
        }
      } catch {
        router.replace('/(auth)/register' as any);
      } finally {
        setIsChecking(false);
      }
    };

    // Petite attente pour éviter le flash
    const timer = setTimeout(checkAuthentication, 1000);
    return () => clearTimeout(timer);
  }, [isAuthenticated, user, validateUserExists, logout]);

  if (isChecking) {
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

  return null; // Le router.replace gérera la navigation
}
