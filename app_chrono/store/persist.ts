import AsyncStorage from '@react-native-async-storage/async-storage';
import { StateCreator } from 'zustand';

export interface PersistOptions {
  name: string;
  version?: number;
  migrate?: (persistedState: unknown, version: number) => any;
  partialize?: (state: any) => any;
}

export const persist = <T>(
  config: StateCreator<T>,
  options: PersistOptions
) => {
  return (set: any, get: any, api: any): T => {
    const { name, version = 1, migrate, partialize } = options;

    const loadState = async () => {
      try {
        const persistedState = await AsyncStorage.getItem(name);
        if (persistedState) {
          const parsed = JSON.parse(persistedState);
          const currentVersion = parsed._version || 0;
          
          let state = parsed;
          
          if (migrate && currentVersion < version) {
            state = migrate(parsed, currentVersion);
          }
          
          delete state._version;
          
          set((current: T) => ({
            ...current,
            ...state,
          }));
        }
      } catch (error) {
        console.warn('Error loading persisted state:', error);
      }
    };

    const saveState = async (state: T) => {
      try {
        const stateToSave = partialize ? partialize(state) : state;
        const persistData = {
          ...stateToSave,
          _version: version,
        };
        await AsyncStorage.setItem(name, JSON.stringify(persistData));
      } catch (error) {
        console.warn('Error saving state:', error);
      }
    };

    loadState();

    const enhancedSet = (partial: any, replace?: boolean) => {
      set(partial, replace);
      const newState = get();
      saveState(newState);
    };

    return config(enhancedSet, get, api);
  };
};