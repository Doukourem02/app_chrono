import { Ionicons } from '@expo/vector-icons';
import FontAwesome5 from '@expo/vector-icons/FontAwesome5';
import { Tabs } from 'expo-router';
import React from 'react';
import { StyleSheet, View } from 'react-native';

export default function TabLayout() {
  return (
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
