import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import ActionCards from "../../components/ActionCards";
import Header from "../../components/Header";
import SearchBar from "../../components/SearchBar";
import SectionHeader from "../../components/SectionHeader";
import ShipmentList from "../../components/ShipmentList";
import { useShipmentStore } from "../../store/useShipmentStore";

export default function Index() {
  const { 
    currentShipment, 
    pickupLocation, 
    deliveryLocation
  } = useShipmentStore();

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollContainer} contentContainerStyle={styles.scrollContent}>
        <Header />
        <SearchBar />
        
        {/* Indicateur Zustand - Affiche la livraison courante */}
        {currentShipment.id && (
          <View style={styles.currentShipmentBanner}>
            <Text style={styles.bannerTitle}>🚀 Livraison en cours</Text>
            <Text style={styles.bannerText}>
              {pickupLocation} → {deliveryLocation}
            </Text>
            <Text style={styles.bannerStatus}>
              Statut: {currentShipment.status}
            </Text>
          </View>
        )}
        
        <ActionCards />
        <SectionHeader 
          title="Expédition actuelle" 
          onSeeMorePress={() => console.log('Voir plus pressed')}
        />
        <ShipmentList />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    marginTop: 30,
  },
  scrollContainer: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 40,
  },
  scrollContent: {
    paddingBottom: 100,
  },
  currentShipmentBanner: {
    backgroundColor: '#8B5CF6',
    borderRadius: 15,
    padding: 15,
    marginVertical: 15,
  },
  bannerTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  bannerText: {
    color: '#fff',
    fontSize: 14,
    marginBottom: 3,
  },
  bannerStatus: {
    color: '#E8E0FF',
    fontSize: 12,
    fontStyle: 'italic',
  },
});