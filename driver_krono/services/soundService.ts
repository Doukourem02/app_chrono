import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import type { AudioPlayer } from 'expo-audio';
import { logger } from '../utils/logger';

const SOUND_ENABLED_KEY = '@chrono_sound_enabled';

// Sons disponibles
const ORDER_ASSIGN_SOUND = require('../assets/sounds/chronopopus.wav');
const ORDER_COMPLETED_SOUND = require('../assets/sounds/ordercompleted.wav');

class SoundService {
  private orderAssignPlayer: AudioPlayer | null = null;
  private orderCompletedPlayer: AudioPlayer | null = null;
  private isInitialized = false;
  private soundEnabled = true;

  async initialize() {
    if (this.isInitialized) return;

    try {
      // Charger la préférence de son
      const savedPreference = await AsyncStorage.getItem(SOUND_ENABLED_KEY);
      this.soundEnabled = savedPreference !== 'false';

      // Charger les sons (expo-audio) — assignation / complétion
      this.orderAssignPlayer = createAudioPlayer(ORDER_ASSIGN_SOUND);
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

  /** Son « nouvelle course » (assignation B2B / offre), aligné sur OrderRequestPopup */
  async playOrderSound() {
    if (!this.isInitialized) {
      await this.initialize();
    }
    if (!this.soundEnabled || !this.orderAssignPlayer) return;

    try {
      this.orderAssignPlayer.seekTo(0);
      this.orderAssignPlayer.play();
    } catch (error) {
      logger.warn('[SoundService] Erreur lecture son assignation:', undefined, error);
    }
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
      if (this.orderAssignPlayer) {
        this.orderAssignPlayer.release();
        this.orderAssignPlayer = null;
      }
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
