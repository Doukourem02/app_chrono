import { useEffect, useState } from 'react';
import { router } from 'expo-router';
import { View, ActivityIndicator, Text } from 'react-native';
import { useDriverStore } from '../store/useDriverStore';

export default function RootIndex() {
  const { isAuthenticated, user, accessToken, validateUserExists, logout } = useDriverStore();
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    const checkAuthentication = async () => {
      if (isAuthenticated && user) {
        const validationResult = await validateUserExists();

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

      setIsChecking(false);
    };

    // Petite attente pour éviter le flash
    const timer = setTimeout(checkAuthentication, 1000);
    return () => clearTimeout(timer);
  }, [isAuthenticated, user, accessToken, validateUserExists, logout]);

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
