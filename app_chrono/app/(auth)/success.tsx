import React, { useEffect, useRef } from 'react';
import {View,Text,TouchableOpacity,StyleSheet,Animated} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function SuccessScreen() {
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
  
    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
    ]).start();
  });

  const handleContinue = () => {
  
    router.push('/(tabs)' as any);
  };

  return (
    <View style={styles.container}>
      <View style={styles.contentContainer}>
        {/* Animation de succès */}
        <Animated.View 
          style={[
            styles.successIconContainer,
            { transform: [{ scale: scaleAnim }] }
          ]}
        >
          <View style={styles.successIcon}>
            <Ionicons name="checkmark" size={60} color="#FFFFFF" />
          </View>
        </Animated.View>

        {/* Texte de succès */}
        <Animated.View style={[styles.textContainer, { opacity: fadeAnim }]}>
          <Text style={styles.title}>Succès !</Text>
          <Text style={styles.subtitle}>
            Félicitations ! Vous avez été authentifié avec succès.
          </Text>
        </Animated.View>

        {/* Bouton Continue */}
        <Animated.View style={[styles.buttonContainer, { opacity: fadeAnim }]}>
          <TouchableOpacity 
            style={styles.continueButton}
            onPress={handleContinue}
          >
            <Text style={styles.continueButtonText}>Continue</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  contentContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  successIconContainer: {
    marginBottom: 40,
  },
  successIcon: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#10B981',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#10B981',
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 15,
  },
  textContainer: {
    alignItems: 'center',
    marginBottom: 60,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 24,
    maxWidth: 280,
  },
  buttonContainer: {
    width: '100%',
  },
  continueButton: {
    backgroundColor: '#8B7CF6',
    borderRadius: 25,
    paddingVertical: 16,
    alignItems: 'center',
    shadowColor: '#8B7CF6',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  continueButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});