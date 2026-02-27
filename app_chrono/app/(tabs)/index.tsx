import React from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import ActionCards from "../../components/ActionCards";
import Header from "../../components/Header";
import SearchBar from "../../components/SearchBar";
import SectionHeader from "../../components/SectionHeader";
import ShipmentList from "../../components/ShipmentList";
import { useOrderStatusPolling } from "../../hooks/useOrderStatusPolling";
import { logger } from "../../utils/logger";

export default function Index() {
  useOrderStatusPolling();

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollContainer} contentContainerStyle={styles.scrollContent}>
        <Header />
        <SearchBar />
        
        <ActionCards />
        <SectionHeader 
          title="Expédition actuelle" 
          onSeeMorePress={() => logger.debug('Voir plus pressed')}
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
});