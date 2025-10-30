import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface DriverProfile {
  id: string;
  user_id: string;
  first_name: string;
  last_name: string;
  license_number?: string;
  vehicle_type?: string;
  vehicle_plate?: string;
  vehicle_model?: string;
  current_latitude?: number;
  current_longitude?: number;
  is_online: boolean;
  is_available: boolean;
  total_deliveries: number;
  completed_deliveries: number;
  rating: number;
  total_earnings: number;
  profile_image_url?: string;
}

export interface DriverUser {
  id: string;
  email: string;
  phone: string;
  role: string;
  created_at: string;
}

interface DriverStore {
  // État d'authentification
  isAuthenticated: boolean;
  user: DriverUser | null;
  profile: DriverProfile | null;
  
  // État de l'application
  isOnline: boolean;
  currentLocation: { latitude: number; longitude: number } | null;
  
  // Actions d'authentification
  setUser: (user: DriverUser) => void;
  setProfile: (profile: DriverProfile) => void;
  logout: () => void;
  validateUserExists: () => Promise<boolean>;
  
  // Actions driver
  setOnlineStatus: (isOnline: boolean) => void;
  setLocation: (location: { latitude: number; longitude: number }) => void;
  updateProfile: (updates: Partial<DriverProfile>) => void;
  
  // Statistiques
  todayStats: {
    deliveries: number;
    earnings: number;
    hours: number;
  };
  updateTodayStats: (stats: Partial<DriverStore['todayStats']>) => void;
}

export const useDriverStore = create<DriverStore>()(
  persist(
    (set, get) => ({
      // État initial
      isAuthenticated: false,
      user: null,
      profile: null,
      isOnline: false,
      currentLocation: null,
      todayStats: {
        deliveries: 0,
        earnings: 0,
        hours: 0,
      },

      // Actions d'authentification
      setUser: (user) => {
        set({ 
          user, 
          isAuthenticated: true 
        });
      },

      setProfile: (profile) => {
        set({ profile });
      },

      logout: () => {
        set({
          isAuthenticated: false,
          user: null,
          profile: null,
          isOnline: false,
          currentLocation: null,
          todayStats: {
            deliveries: 0,
            earnings: 0,
            hours: 0,
          },
        });
      },

      validateUserExists: async () => {
        const { user } = get();
        if (!user?.email) return false;

        try {
          console.log(`🔍 Vérification existence driver: ${user.email}`);
          
          const response = await fetch(`${process.env.EXPO_PUBLIC_API_URL}/api/auth-simple/check/${user.email}`);
          const data = await response.json();

          if (!response.ok || !data.success || !data.user) {
            console.log("❌ Driver non trouvé dans la base");
            return false;
          }

          console.log("✅ Driver trouvé dans la base");
          return true;
        } catch (error) {
          console.error("⚠️ Erreur vérification driver:", error);
          // En cas d'erreur réseau, on assume que c'est OK pour éviter de déconnecter inutilement
          return true;
        }
      },

      // Actions driver
      setOnlineStatus: (isOnline) => {
        set({ isOnline });
        // Mettre à jour le profil si nécessaire
        const { profile } = get();
        if (profile) {
          set({
            profile: {
              ...profile,
              is_online: isOnline,
              is_available: isOnline,
            }
          });
        }
      },

      setLocation: (location) => {
        set({ currentLocation: location });
        // Mettre à jour le profil avec la localisation
        const { profile } = get();
        if (profile) {
          set({
            profile: {
              ...profile,
              current_latitude: location.latitude,
              current_longitude: location.longitude,
            }
          });
        }
      },

      updateProfile: (updates) => {
        const { profile } = get();
        if (profile) {
          set({
            profile: {
              ...profile,
              ...updates,
            }
          });
        }
      },

      updateTodayStats: (stats) => {
        const { todayStats } = get();
        set({
          todayStats: {
            ...todayStats,
            ...stats,
          }
        });
      },
    }),
    {
      name: 'driver-store',
      storage: createJSONStorage(() => AsyncStorage),
      // Ne pas persister la localisation et le statut online
      partialize: (state) => ({
        isAuthenticated: state.isAuthenticated,
        user: state.user,
        profile: state.profile,
        todayStats: state.todayStats,
      }),
    }
  )
);