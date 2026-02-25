import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import type { AudioPlayer } from 'expo-audio';
import { logger } from '../utils/logger';

const SOUND_ENABLED_KEY = '@chrono_sound_enabled';

// Son disponible
const ORDER_COMPLETED_SOUND = require('../assets/sounds/ordercompleted.wav');

class SoundService {
  private orderCompletedPlayer: AudioPlayer | null = null;
  private isInitialized = false;
  private soundEnabled = true;

  async initialize() {
    if (this.isInitialized) return;

    try {
      // Charger la préférence de son
      const savedPreference = await AsyncStorage.getItem(SOUND_ENABLED_KEY);
      this.soundEnabled = savedPreference !== 'false';

      // Charger le son (expo-audio)
      this.orderCompletedPlayer = createAudioPlayer(ORDER_COMPLETED_SOUND);

      // Configurer le mode audio
      await setAudioModeAsync({
        playsInSilentMode: true,
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
    if (!this.soundEnabled || !this.orderCompletedPlayer) return;

    try {
      this.orderCompletedPlayer.seekTo(0);
      this.orderCompletedPlayer.play();
    } catch (error) {
      logger.warn('[SoundService] Erreur lecture son commande complétée:', undefined, error);
    }
  }

  async cleanup() {
    try {
      if (this.orderCompletedPlayer) {
        this.orderCompletedPlayer.release();
        this.orderCompletedPlayer = null;
      }
      this.isInitialized = false;
    } catch (error) {
      logger.warn('[SoundService] Erreur cleanup:', undefined, error);
    }
  }
}

export const soundService = new SoundService();
