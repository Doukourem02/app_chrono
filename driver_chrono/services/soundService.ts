import { Audio } from 'expo-av';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { logger } from '../utils/logger';

const SOUND_ENABLED_KEY = '@chrono_sound_enabled';

// Son disponible
const ORDER_COMPLETED_SOUND = require('../assets/sounds/ordercompleted.wav');

class SoundService {
  private orderCompletedSound: Audio.Sound | null = null;
  private isInitialized = false;
  private soundEnabled = true;

  async initialize() {
    if (this.isInitialized) return;

    try {
      // Charger la préférence de son
      const savedPreference = await AsyncStorage.getItem(SOUND_ENABLED_KEY);
      this.soundEnabled = savedPreference !== 'false';

      // Charger le son
      const { sound: completedSound } = await Audio.Sound.createAsync(ORDER_COMPLETED_SOUND);

      this.orderCompletedSound = completedSound;

      // Configurer le mode audio
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
      });

      this.isInitialized = true;
    } catch (error) {
      logger.warn('[SoundService] Erreur initialisation:', undefined, error);
    }
  }

  async setSoundEnabled(enabled: boolean) {
    this.soundEnabled = enabled;
    await AsyncStorage.setItem(SOUND_ENABLED_KEY, enabled.toString());
  }

  async isSoundEnabled(): Promise<boolean> {
    if (!this.isInitialized) {
      await this.initialize();
    }
    return this.soundEnabled;
  }

  async playOrderCompleted() {
    if (!this.soundEnabled || !this.orderCompletedSound) return;

    try {
      await this.orderCompletedSound.stopAsync();
      await this.orderCompletedSound.setPositionAsync(0);
      await this.orderCompletedSound.playAsync();
    } catch (error) {
      logger.warn('[SoundService] Erreur lecture son commande complétée:', undefined, error);
    }
  }

  async cleanup() {
    try {
      if (this.orderCompletedSound) {
        await this.orderCompletedSound.unloadAsync();
        this.orderCompletedSound = null;
      }
      this.isInitialized = false;
    } catch (error) {
      logger.warn('[SoundService] Erreur cleanup:', undefined, error);
    }
  }
}

export const soundService = new SoundService();

