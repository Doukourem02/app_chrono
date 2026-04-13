import { Ionicons } from '@expo/vector-icons';
import Octicons from '@expo/vector-icons/Octicons';
import { Tabs } from 'expo-router';
import React, { useEffect, useMemo } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '../../store/useAuthStore';
import { userOrderSocketService } from '../../services/userOrderSocketService';
import { usePeriodicClientOrderSync } from '../../hooks/usePeriodicClientOrderSync';

export default function TabLayout() {
  const { user } = useAuthStore();
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  usePeriodicClientOrderSync();

  /**
   * Ancien style : left 20 + marginHorizontal 80 → ~100 px de chaque côté sur un écran moyen.
   * Une seule paire left/right évite les écarts iOS/Android ; bottom suit la barre de gestes.
   */
  const tabBarLayoutStyle = useMemo(() => {
    const preferredSide = 100;
    const minPillWidth = 200;
    const maxSide = Math.max(16, (windowWidth - minPillWidth) / 2);
    const side = Math.min(preferredSide, maxSide);
    return {
      bottom: 12 + insets.bottom,
      left: side,
      right: side,
    };
  }, [insets.bottom, windowWidth]);

  useEffect(() => {
    if (user?.id) {
      userOrderSocketService.connect(user.id);
    }
    return () => {
      userOrderSocketService.disconnect();
    };
  }, [user?.id]);

  return (
    <>
      <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarStyle: [styles.navBar, tabBarLayoutStyle],
      }}
    >
        {/* ACCUEIL */}
        <Tabs.Screen
          name="index"
          options={{
            title: 'Accueil',
            tabBarIcon: ({ focused }) => (
              <View style={[styles.iconContainer, focused && styles.activeIcon]}>
                <Octicons name="home" size={20} color={focused ? '#fff' : '#555'} />
              </View>
            ),
          }}
        />

        {/* LOCALISATION */}
        <Tabs.Screen
          name="map"
          options={{
            title: 'Localisation',
            tabBarStyle: { display: 'none' }, 
            tabBarIcon: ({ focused }) => (
              <View style={[styles.iconContainer, focused && styles.activeIcon]}>
                <Ionicons name="location" size={20} color={focused ? '#fff' : '#555'} />
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
    </>
  );
}

const styles = StyleSheet.create({
  navBar: {
    position: 'absolute',
    height: 80,
    backgroundColor: '#fff',
    borderRadius: 40,
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    alignItems: 'center',
    paddingHorizontal: 5,

    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 8,
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
