import { useEffect } from 'react';
import { router } from 'expo-router';
import { View } from 'react-native';

export default function RootIndex() {
  useEffect(() => {
    // Rediriger directement vers l'app principale (tabs)
    // L'utilisateur peut explorer l'app librement
    const timer = setTimeout(() => {
      router.replace('/(tabs)' as any);
    }, 100);

    return () => clearTimeout(timer);
  }, []);

  return <View style={{ flex: 1, backgroundColor: '#FFFFFF' }} />;
}
