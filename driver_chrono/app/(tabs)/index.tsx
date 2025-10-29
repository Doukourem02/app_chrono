import React, { useState, useEffect } from "react";
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Alert,
} from "react-native";
import MapView, { Marker } from "react-native-maps";
import { Ionicons } from "@expo/vector-icons";
import { StatusToggle } from "../../components/StatusToggle";
import { StatsCards } from "../../components/StatsCards";
import { useDriverLocation } from "../../hooks/useDriverLocation";

export default function Index() {
  const [isOnline, setIsOnline] = useState(false);
  const [stats, setStats] = useState({
    todayDeliveries: 0,
    totalRevenue: 0,
  });
  
  // Hook de géolocalisation
  const { location, error } = useDriverLocation(isOnline);

  // Gestion du changement de statut
  const handleToggleOnline = (value: boolean) => {
    if (value && error) {
      Alert.alert(
        "Erreur de localisation", 
        "Impossible de vous mettre en ligne sans accès à votre localisation.",
        [{ text: "OK" }]
      );
      return;
    }
    setIsOnline(value);
  };

  // Région de la carte basée sur la localisation du chauffeur
  const mapRegion = location ? {
    latitude: location.latitude,
    longitude: location.longitude,
    latitudeDelta: 0.01,
    longitudeDelta: 0.01,
  } : {
    latitude: 5.345317,
    longitude: -4.024429,
    latitudeDelta: 0.05,
    longitudeDelta: 0.05,
  };

  useEffect(() => {
    // Simuler la récupération des stats depuis une API
    if (isOnline) {
      setStats({
        todayDeliveries: 3,
        totalRevenue: 45.50,
      });
    } else {
      setStats({
        todayDeliveries: 0,
        totalRevenue: 0,
      });
    }
  }, [isOnline]);

  return (
    <View style={styles.container}>
      {/* MAP */}
      <MapView
        style={StyleSheet.absoluteFillObject}
        region={mapRegion}
        customMapStyle={grayMapStyle}
        showsUserLocation={false}
        showsMyLocationButton={false}
      >
        {/* Marqueur du chauffeur quand en ligne */}
        {isOnline && location && (
          <Marker
            coordinate={{
              latitude: location.latitude,
              longitude: location.longitude,
            }}
            title="Ma position"
            description="Chauffeur en ligne"
          >
            <View style={styles.driverMarker}>
              <Ionicons name="car" size={20} color="#fff" />
            </View>
          </Marker>
        )}
      </MapView>

      {/* SWITCH ONLINE/OFFLINE */}
      <StatusToggle 
        isOnline={isOnline} 
        onToggle={handleToggleOnline}
        hasLocationError={!!error}
      />

      {/* STATS CARDS */}
      <StatsCards 
        todayDeliveries={stats.todayDeliveries}
        totalRevenue={stats.totalRevenue}
        isOnline={isOnline}
      />

      {/* FLOATING MENU */}
      <View style={styles.floatingMenu}>
        <TouchableOpacity style={[styles.menuButton, styles.activeButton]}>
          <Ionicons name="map" size={22} color="#fff" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuButton}>
          <Ionicons name="list" size={22} color="#8B5CF6" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  driverMarker: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#8B5CF6',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  floatingMenu: {
    position: "absolute",
    bottom: 30,
    alignSelf: "center",
    backgroundColor: "#fff",
    flexDirection: "row",
    justifyContent: "space-around",
    width: 120,
    paddingVertical: 10,
    borderRadius: 30,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
  },
  menuButton: {
    backgroundColor: "#fff",
    width: 45,
    height: 45,
    borderRadius: 25,
    alignItems: "center",
    justifyContent: "center",
  },
  activeButton: {
    backgroundColor: "#8B5CF6",
  },
});

/* 🗺️ STYLE GRIS PERSONNALISÉ POUR LA MAP */
const grayMapStyle = [
  {
    elementType: "geometry",
    stylers: [{ color: "#ebe3cd" }],
  },
  {
    elementType: "labels.text.fill",
    stylers: [{ color: "#523735" }],
  },
  {
    elementType: "labels.text.stroke",
    stylers: [{ color: "#f5f1e6" }],
  },
  {
    featureType: "administrative",
    elementType: "geometry.stroke",
    stylers: [{ color: "#c9b2a6" }],
  },
  {
    featureType: "poi",
    elementType: "geometry",
    stylers: [{ color: "#dfd2ae" }],
  },
  {
    featureType: "road",
    elementType: "geometry",
    stylers: [{ color: "#f5f1e6" }],
  },
  {
    featureType: "road.arterial",
    elementType: "geometry",
    stylers: [{ color: "#fdfcf8" }],
  },
  {
    featureType: "road.highway",
    elementType: "geometry",
    stylers: [{ color: "#f8c967" }],
  },
  {
    featureType: "water",
    elementType: "geometry.fill",
    stylers: [{ color: "#b9d3c2" }],
  },
];
