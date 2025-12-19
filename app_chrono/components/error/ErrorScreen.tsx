import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withRepeat,
  withSequence,
} from 'react-native-reanimated';
import { router } from 'expo-router';

interface ErrorScreenProps {
  title?: string;
  message?: string;
  statusCode?: number;
  showRetry?: boolean;
  showHome?: boolean;
  onRetry?: () => void;
  onGoHome?: () => void;
}

export default function ErrorScreen({
  title = 'Une erreur est survenue',
  message = 'Désolé, une erreur inattendue s\'est produite. Veuillez réessayer ou contacter le support si le problème persiste.',
  statusCode,
  showRetry = true,
  showHome = true,
  onRetry,
  onGoHome,
}: ErrorScreenProps) {
  // Animations
  const iconScale = useSharedValue(0.8);
  const iconRotation = useSharedValue(-10);
  const cardOpacity = useSharedValue(0);
  const cardTranslateY = useSharedValue(20);
  const pulseScale = useSharedValue(1);

  React.useEffect(() => {
    // Animation d'entrée
    iconScale.value = withSpring(1, { damping: 10, stiffness: 100 });
    iconRotation.value = withSpring(0, { damping: 10, stiffness: 100 });
    cardOpacity.value = withTiming(1, { duration: 600 });
    cardTranslateY.value = withSpring(0, { damping: 15, stiffness: 100 });

    // Animation de pulsation continue
    pulseScale.value = withRepeat(
      withSequence(
        withTiming(1.1, { duration: 2000 }),
        withTiming(1, { duration: 2000 })
      ),
      -1,
      false
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const iconAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: iconScale.value },
      { rotate: `${iconRotation.value}deg` },
    ],
  }));

  const cardAnimatedStyle = useAnimatedStyle(() => ({
    opacity: cardOpacity.value,
    transform: [{ translateY: cardTranslateY.value }],
  }));

  const pulseAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
  }));

  const handleRetry = () => {
    if (onRetry) {
      onRetry();
    } else {
      // Recharger l'application
      router.replace('/');
    }
  };

  const handleGoHome = () => {
    if (onGoHome) {
      onGoHome();
    } else {
      router.replace('/(tabs)');
    }
  };

  const handleGoBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)');
    }
  };

  const getStatusCodeMessage = () => {
    switch (statusCode) {
      case 404:
        return 'Page introuvable';
      case 500:
        return 'Erreur serveur';
      case 403:
        return 'Accès refusé';
      case 401:
        return 'Non autorisé';
      default:
        return title;
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Cercle animé en arrière-plan */}
        <Animated.View style={[styles.backgroundCircle, pulseAnimatedStyle]} />

        <Animated.View style={[styles.card, cardAnimatedStyle]}>
          {statusCode && (
            <Text style={styles.statusCode}>{statusCode}</Text>
          )}

          <Animated.View style={[styles.iconContainer, iconAnimatedStyle]}>
            <Ionicons name="alert-circle" size={64} color="#EF4444" />
          </Animated.View>

          <Text style={styles.title}>{getStatusCodeMessage()}</Text>
          <Text style={styles.message}>{message}</Text>

          <View style={styles.buttonsContainer}>
            {showRetry && (
              <TouchableOpacity
                style={[styles.button, styles.primaryButton]}
                onPress={handleRetry}
                activeOpacity={0.8}
              >
                <Ionicons name="refresh" size={20} color="#FFFFFF" />
                <Text style={styles.primaryButtonText}>Réessayer</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[styles.button, styles.secondaryButton]}
              onPress={router.canGoBack() ? handleGoBack : handleGoHome}
              activeOpacity={0.8}
            >
              <Ionicons 
                name={router.canGoBack() ? "arrow-back" : "home"} 
                size={18} 
                color="#6B7280" 
              />
              <Text style={styles.secondaryButtonText}>
                {router.canGoBack() ? 'Retour' : 'Accueil'}
              </Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    position: 'relative',
  },
  backgroundCircle: {
    position: 'absolute',
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: '#FEE2E2',
    opacity: 0.3,
    top: '10%',
    left: '10%',
  },
  card: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 32,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 8,
  },
  statusCode: {
    fontSize: 64,
    fontWeight: '700',
    color: '#FEE2E2',
    marginBottom: 16,
    lineHeight: 64,
  },
  iconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#FEF2F2',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 12,
    textAlign: 'center',
  },
  message: {
    fontSize: 15,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 22,
    paddingHorizontal: 8,
  },
  buttonsContainer: {
    width: '100%',
    gap: 12,
    marginTop: 8,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    minHeight: 52,
    width: '100%',
  },
  primaryButton: {
    backgroundColor: '#8B5CF6',
    shadowColor: '#8B5CF6',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 4,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  secondaryButtonText: {
    color: '#6B7280',
    fontSize: 15,
    fontWeight: '500',
  },
});

