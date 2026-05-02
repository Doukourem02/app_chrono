import React, { useState } from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { useRequireAuth } from "../hooks/useRequireAuth";
import { useAuthStore } from "../store/useAuthStore";
import { AnimatedCard } from "./animations";
import NewB2BShippingModal from "./NewB2BShippingModal";
import BatchShippingBottomSheet from "./BatchShippingBottomSheet";

export default function ActionCards() {
  const { requireAuth } = useRequireAuth();
  const { user } = useAuthStore();
  const isBusiness = user?.is_business === true;

  const [b2bModalVisible, setB2bModalVisible] = useState(false);
  const [batchSheetVisible, setBatchSheetVisible] = useState(false);

  const handleNewDelivery = () => {
    requireAuth(() => {
      router.push("/(tabs)/map" as any);
    });
  };

  const handleTrackPackage = () => {
    requireAuth(() => {
      router.push("/profile/order-history" as any);
    });
  };

  const handleB2BOrder = () => {
    requireAuth(() => setB2bModalVisible(true));
  };

  const handleBatch = () => {
    requireAuth(() => setBatchSheetVisible(true));
  };

  return (
    <>
      {isBusiness ? (
        <View style={styles.actionRow}>
          <AnimatedCard
            index={0}
            delay={0}
            style={[styles.actionCard, { backgroundColor: "#EDE9FE" }]}
            onPress={handleB2BOrder}
          >
            <Text style={styles.cardTitle}>Livraison{"\n"}Client</Text>
            <Image
              source={require("../assets/images/delivery.png")}
              style={styles.cardImage}
            />
          </AnimatedCard>

          <AnimatedCard
            index={1}
            delay={0}
            style={[styles.actionCard, { backgroundColor: "#F5E8FF" }]}
            onPress={handleBatch}
          >
            <Text style={styles.cardTitle}>Tournée{"\n"}Lots</Text>
            <Image
              source={require("../assets/images/colis.png")}
              style={styles.cardImage}
            />
          </AnimatedCard>
        </View>
      ) : (
        <View style={styles.actionRow}>
          <AnimatedCard
            index={0}
            delay={0}
            style={[styles.actionCard, { backgroundColor: "#F5E8FF" }]}
            onPress={handleNewDelivery}
          >
            <Text style={styles.cardTitle}>Nouvelle{"\n"}Livraison</Text>
            <Image
              source={require("../assets/images/delivery.png")}
              style={styles.cardImage}
            />
          </AnimatedCard>

          <AnimatedCard
            index={1}
            delay={0}
            style={[styles.actionCard, { backgroundColor: "#eeeeeeff" }]}
            onPress={handleTrackPackage}
          >
            <Text style={styles.cardTitle}>Suivis de{"\n"}Colis</Text>
            <Image
              source={require("../assets/images/colis.png")}
              style={styles.cardImage}
            />
          </AnimatedCard>
        </View>
      )}

      <NewB2BShippingModal
        visible={b2bModalVisible}
        onClose={() => setB2bModalVisible(false)}
      />
      <BatchShippingBottomSheet
        visible={batchSheetVisible}
        onClose={() => setBatchSheetVisible(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  actionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 25,
  },
  actionCard: {
    flex: 1,
    borderRadius: 15,
    padding: 15,
    marginRight: 10,
    justifyContent: "space-between",
    height: 140,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#222",
  },
  cardImage: {
    width: 110,
    height: 110,
    alignSelf: "flex-end",
    marginTop: 5,
    position: "absolute",
    bottom: -10,
    right: -5,
  },
});
