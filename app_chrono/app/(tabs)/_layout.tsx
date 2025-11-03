import { Ionicons } from '@expo/vector-icons';
import Octicons from '@expo/vector-icons/Octicons';
import { Tabs } from 'expo-router';
import React from 'react';
import { StyleSheet, View } from 'react-native';

export default function TabLayout() {

  return (
    <>
      <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarStyle: styles.navBar,
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
            tabBarStyle: { display: 'none' }, // Cache la barre de navigation sur la map
            tabBarIcon: ({ focused }) => (
              <View style={[styles.iconContainer, focused && styles.activeIcon]}>
                <Ionicons name="location" size={20} color={focused ? '#fff' : '#555'} />
              </View>
            ),
          }}
        />

        {/* COLIS */}
        <Tabs.Screen
          name="box"
          options={{
            title: 'Colis',
            tabBarIcon: ({ focused }) => (
              <View style={[styles.iconContainer, focused && styles.activeIcon]}>
                <Ionicons name="cube" size={20} color={focused ? '#fff' : '#555'} />
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
    paddingHorizontal: 5, 

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
