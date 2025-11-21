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
              onPress={handleGoBack}
              activeOpacity={0.8}
            >
              <Ionicons name="arrow-back" size={20} color="#374151" />
              <Text style={styles.secondaryButtonText}>Retour</Text>
            </TouchableOpacity>

            {showHome && (
              <TouchableOpacity
                style={[styles.button, styles.secondaryButton]}
                onPress={handleGoHome}
                activeOpacity={0.8}
              >
                <Ionicons name="home" size={20} color="#374151" />
                <Text style={styles.secondaryButtonText}>Accueil</Text>
              </TouchableOpacity>
            )}
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
    maxWidth: 600,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 48,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 10,
    },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 10,
  },
  statusCode: {
    fontSize: 72,
    fontWeight: '700',
    color: '#FEE2E2',
    marginBottom: 24,
    lineHeight: 72,
  },
  iconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#FEE2E2',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 32,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 16,
    textAlign: 'center',
  },
  message: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 24,
  },
  buttonsContainer: {
    width: '100%',
    flexDirection: 'row',
    gap: 12,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 12,
    minWidth: 120,
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
    backgroundColor: '#F3F4F6',
  },
  secondaryButtonText: {
    color: '#374151',
    fontSize: 16,
    fontWeight: '600',
  },
});

