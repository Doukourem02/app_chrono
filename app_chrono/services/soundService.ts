import AsyncStorage from '@react-native-async-storage/async-storage';
import { logger } from '../utils/logger';

const SOUND_ENABLED_KEY = '@chrono_sound_enabled';

// Sons disponibles
const ORDER_ACCEPTED_SOUND = require('../assets/sounds/orderaccept.wav');
const ORDER_COMPLETED_SOUND = require('../assets/sounds/ordercompleted.wav');

type AudioPlayerLike = {
  pause: () => void;
  play: () => void;
  seekTo: (seconds: number) => Promise<void>;
  remove: () => void;
};

class SoundService {
  private orderAcceptedPlayer: AudioPlayerLike | null = null;
  private orderCompletedPlayer: AudioPlayerLike | null = null;
  private isInitialized = false;
  private soundEnabled = true;
  private audioAvailable = false;

  async initialize() {
    if (this.isInitialized) return;

    try {
      // Charger la préférence de son
      const savedPreference = await AsyncStorage.getItem(SOUND_ENABLED_KEY);
      this.soundEnabled = savedPreference !== 'false';

      // Import dynamique pour éviter le crash si le module natif ExpoAudio n'est pas lié
      // (nécessite un rebuild: npx expo prebuild && npx expo run:ios)
      const { createAudioPlayer, setAudioModeAsync } = await import('expo-audio');

      this.orderAcceptedPlayer = createAudioPlayer(ORDER_ACCEPTED_SOUND);
      this.orderCompletedPlayer = createAudioPlayer(ORDER_COMPLETED_SOUND);

      await setAudioModeAsync({
        playsInSilentMode: true,
        shouldPlayInBackground: false,
      });

      this.audioAvailable = true;
      this.isInitialized = true;
    } catch (error) {
      logger.warn(
        '[SoundService] expo-audio non disponible (rebuild requis). Sons désactivés.',
        undefined,
        error
      );
      this.audioAvailable = false;
      this.isInitialized = true;
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

  async playOrderAccepted() {
    if (!this.soundEnabled || !this.audioAvailable || !this.orderAcceptedPlayer) return;

    try {
      this.orderAcceptedPlayer.pause();
      await this.orderAcceptedPlayer.seekTo(0);
      this.orderAcceptedPlayer.play();
    } catch (error) {
      logger.warn('[SoundService] Erreur lecture son commande acceptée:', undefined, error);
    }
  }

  async playOrderCompleted() {
    if (!this.soundEnabled || !this.audioAvailable || !this.orderCompletedPlayer) return;

    try {
      this.orderCompletedPlayer.pause();
      await this.orderCompletedPlayer.seekTo(0);
      this.orderCompletedPlayer.play();
    } catch (error) {
      logger.warn('[SoundService] Erreur lecture son commande complétée:', undefined, error);
    }
  }

  async cleanup() {
    try {
      if (this.orderAcceptedPlayer) {
        this.orderAcceptedPlayer.remove();
        this.orderAcceptedPlayer = null;
      }
      if (this.orderCompletedPlayer) {
        this.orderCompletedPlayer.remove();
        this.orderCompletedPlayer = null;
      }
      this.isInitialized = false;
      this.audioAvailable = false;
    } catch (error) {
      logger.warn('[SoundService] Erreur cleanup:', undefined, error);
    }
  }
}

export const soundService = new SoundService();
