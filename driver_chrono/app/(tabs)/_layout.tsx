import { Ionicons } from '@expo/vector-icons';
import FontAwesome5 from '@expo/vector-icons/FontAwesome5';
import { Tabs, router } from 'expo-router';
import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { useUIStore } from '../../store/useUIStore';
import { useDriverStore } from '../../store/useDriverStore';

export default function TabLayout() {
  const hideTabBar = useUIStore((state) => state.hideTabBar);
  const { needsDriverTypeSelection } = useDriverStore();
  
  // Vérifier au montage si le profil est complet
  useEffect(() => {
    // Ajouter un petit délai pour éviter les race conditions lors de la navigation
    const timer = setTimeout(() => {
      // Si pas de driver_type, rediriger vers la sélection
      if (needsDriverTypeSelection()) {
        router.replace('/(auth)/driver-type-selection' as any);
        return;
      }
    }, 200);
    
    return () => clearTimeout(timer);
  }, [needsDriverTypeSelection]);
  
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarStyle: hideTabBar ? { display: 'none' } : styles.navBar,
      }}
    >
        {/* ACCUEIL */}
        <Tabs.Screen
          name="index"
          options={{
            title: 'Accueil',
            tabBarIcon: ({ focused }) => (
              <View style={[styles.iconContainer, focused && styles.activeIcon]}>
                <FontAwesome5 name="map-marked-alt" size={20} color={focused ? '#fff' : '#555'} />
              </View>
            ),
          }}
        />

        {/* REVENUS */}
        <Tabs.Screen
          name="revenus"
          options={{
            title: 'Revenus',
            tabBarIcon: ({ focused }) => (
              <View style={[styles.iconContainer, focused && styles.activeIcon]}>
                <Ionicons name="card" size={20} color={focused ? '#fff' : '#555'} />
              </View>
            ),
          }}
        />

        {/* PROFIL */}
        <Tabs.Screen
          name="profile"
          options={{
            title: 'Profil',
            tabBarIcon: ({ focused }) => (
              <View style={[styles.iconContainer, focused && styles.activeIcon]}>
                <Ionicons name="person" size={20} color={focused ? '#fff' : '#555'} />
              </View>
            ),
          }}
        />
      </Tabs>
    );
  }

const styles = StyleSheet.create({
  navBar: {
    position: 'absolute',
    bottom: 25,
    left: 20,
    right: 20,
    marginHorizontal: 80, 
    height: 80,
    backgroundColor: '#fff',
    borderRadius: 40,
    flexDirection: 'row',
    justifyContent: 'space-evenly', 
    alignItems: 'center',
    paddingHorizontal: 10, 

    // Ombre douce
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 7,
  },

  iconContainer: {
    width: 58,
    height: 58,
    borderRadius: 35,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f2f2f2',
    marginTop: 5.5,
  },

  activeIcon: {
    backgroundColor: '#8B5CF6',
  },
});
