import { useEffect } from 'react';
import { router } from 'expo-router';
import { View, ActivityIndicator, Text } from 'react-native';
import { useAuthStore } from '../store/useAuthStore';
import { userApiService } from '../services/userApiService';
import { logger } from '../utils/logger';

export default function RootIndex() {
  const { isAuthenticated, user, validateUser, logout } = useAuthStore();

  useEffect(() => {
    let cancelled = false;

    const checkSession = async () => {
      if (isAuthenticated && user) {
        // Vérifier et rafraîchir le token si nécessaire avant de valider la session
        // Cela évite les problèmes de session expirée après une longue période d'inactivité
        try {
          const token = await userApiService.ensureAccessToken();
          if (!token) {
            // Token invalide ou impossible à rafraîchir, déconnecter
            if (!cancelled) {
              logout();
              router.replace('/(tabs)' as any);
            }
            return;
          }
        } catch (error) {
          // En cas d'erreur, continuer avec la validation normale
          logger.warn('Erreur lors de la vérification du token:', undefined, error);
        }

        // Si l'utilisateur est authentifié, valider sa session
        const validationResult = await validateUser();

        if (cancelled) {
          return;
        }

        if (validationResult === true || validationResult === null || validationResult === 'not_found') {
          // Session valide, rediriger vers l'application
          router.replace('/(tabs)' as any);
        } else {
          // Session invalide, déconnecter et permettre l'accès en mode invité
          logout();
          router.replace('/(tabs)' as any);
        }
      } else {
        // Pas d'authentification : permettre l'accès en mode invité
        // L'utilisateur pourra explorer l'application et s'inscrire quand il le souhaite
        router.replace('/(tabs)' as any);
      }
    };

    const timer = setTimeout(() => {
      checkSession().catch(() => {
        if (!cancelled) {
          // En cas d'erreur, permettre l'accès en mode invité
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
        Chargement...
      </Text>
    </View>
  );
}
