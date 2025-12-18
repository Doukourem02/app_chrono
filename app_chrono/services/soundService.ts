import { Audio } from 'expo-av';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SOUND_ENABLED_KEY = '@chrono_sound_enabled';

// Sons disponibles
const ORDER_ACCEPTED_SOUND = require('../assets/sounds/orderaccept.wav');
const ORDER_COMPLETED_SOUND = require('../assets/sounds/ordercompleted.wav');

class SoundService {
  private orderAcceptedSound: Audio.Sound | null = null;
  private orderCompletedSound: Audio.Sound | null = null;
  private isInitialized = false;
  private soundEnabled = true;

  async initialize() {
    if (this.isInitialized) return;

    try {
      // Charger la préférence de son
      const savedPreference = await AsyncStorage.getItem(SOUND_ENABLED_KEY);
      this.soundEnabled = savedPreference !== 'false';

      // Charger les sons
      const { sound: acceptedSound } = await Audio.Sound.createAsync(ORDER_ACCEPTED_SOUND);
      const { sound: completedSound } = await Audio.Sound.createAsync(ORDER_COMPLETED_SOUND);

      this.orderAcceptedSound = acceptedSound;
      this.orderCompletedSound = completedSound;

      // Configurer le mode audio
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
      });

      this.isInitialized = true;
    } catch (error) {
      console.warn('[SoundService] Erreur initialisation:', error);
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
    if (!this.soundEnabled || !this.orderAcceptedSound) return;

    try {
      await this.orderAcceptedSound.stopAsync();
      await this.orderAcceptedSound.setPositionAsync(0);
      await this.orderAcceptedSound.playAsync();
    } catch (error) {
      console.warn('[SoundService] Erreur lecture son commande acceptée:', error);
    }
  }

  async playOrderCompleted() {
    if (!this.soundEnabled || !this.orderCompletedSound) return;

    try {
      await this.orderCompletedSound.stopAsync();
      await this.orderCompletedSound.setPositionAsync(0);
      await this.orderCompletedSound.playAsync();
    } catch (error) {
      console.warn('[SoundService] Erreur lecture son commande complétée:', error);
    }
  }

  async cleanup() {
    try {
      if (this.orderAcceptedSound) {
        await this.orderAcceptedSound.unloadAsync();
        this.orderAcceptedSound = null;
      }
      if (this.orderCompletedSound) {
        await this.orderCompletedSound.unloadAsync();
        this.orderCompletedSound = null;
      }
      this.isInitialized = false;
    } catch (error) {
      console.warn('[SoundService] Erreur cleanup:', error);
    }
  }
}

export const soundService = new SoundService();

