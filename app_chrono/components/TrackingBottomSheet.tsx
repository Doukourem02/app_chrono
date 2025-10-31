import React from "react";
import {
  View,
  Text,
  Animated,
  PanResponderInstance,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

interface TrackingBottomSheetProps {
  currentOrder: any;
  panResponder: PanResponderInstance;
  animatedHeight: Animated.Value;
  isExpanded: boolean;
  onToggle: () => void;
}

const TrackingBottomSheet: React.FC<TrackingBottomSheetProps> = ({
  currentOrder,
  panResponder,
  animatedHeight,
  isExpanded,
  onToggle,
}) => {
  const insets = useSafeAreaInsets();

  const status = currentOrder?.status || "accepted";

  const statusSteps = [
    { label: "En route pour récupérer", key: "accepted" },
    { label: "Colis pris en charge", key: "picked_up" },
    { label: "En cours de livraison", key: "in_progress" },
    { label: "Livré", key: "completed" },
  ];

  const activeIndex = Math.max(
    0,
    statusSteps.findIndex((s) => s.key === status)
  );

  return (
    <Animated.View
      {...panResponder.panHandlers}
      style={[
        styles.sheetContainer,
        {
          height: animatedHeight,
          bottom: insets.bottom + 25,
        },
      ]}
    >
      {/* Handle */}
      <TouchableOpacity onPress={onToggle} style={styles.dragIndicator}>
        <View style={styles.dragHandle} />
      </TouchableOpacity>

      {/* ✅ COLLAPSÉ */}
      {!isExpanded && (
        <View style={styles.collapsedWrapper}>
          <View style={styles.collapsedContainer}>
            <View style={styles.driverAvatar} />

            <View style={styles.actionButtonsCollapsed}>
              <TouchableOpacity style={styles.iconCircle}>
                <Ionicons name="chatbubble-ellipses-outline" size={20} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.iconCircle}>
                <Ionicons name="call-outline" size={20} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* ✅ EXPANDÉ */}
      {isExpanded && (
        <View style={styles.expandedCard}>
          <Text style={styles.title}>Statut de la commande</Text>

          {/* Timeline */}
          <View style={styles.timelineContainer}>
            {statusSteps.map((step, index) => {
              const isActive = index <= activeIndex;
              return (
                <View key={step.key} style={styles.stepContainer}>
                  {index !== 0 && (
                    <View
                      style={[
                        styles.line,
                        { backgroundColor: isActive ? "#7C3AED" : "#E0E0E0" },
                      ]}
                    />
                  )}
                  <View
                    style={[
                      styles.circle,
                      {
                        backgroundColor: isActive ? "#7C3AED" : "#E0E0E0",
                        borderColor: isActive ? "#7C3AED" : "#ccc",
                      },
                    ]}
                  />
                  <Text
                    style={[
                      styles.stepText,
                      { color: isActive ? "#000" : "#aaa" },
                    ]}
                  >
                    {step.label}
                  </Text>
                </View>
              );
            })}
          </View>

          {/* Barre d’action */}
          <View style={styles.actionBar}>
            <View style={styles.driverAvatar} />
            <View style={styles.actionButtons}>
              <TouchableOpacity style={styles.actionButton}>
                <Ionicons name="chatbubble-ellipses-outline" size={20} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionButton}>
                <Ionicons name="call-outline" size={20} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </Animated.View>
  );
};

export default TrackingBottomSheet;

const styles = StyleSheet.create({
  sheetContainer: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
    backgroundColor: "transparent",
  },

  dragIndicator: {
    alignItems: "center",
    marginTop: 6,
  },
  dragHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#D1D5DB",
  },

  collapsedWrapper: {
    alignSelf: "center",
    width: "92%",
    backgroundColor: "#fff",
    padding: 10,
    borderRadius: 28,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },

  collapsedContainer: {
    backgroundColor: "#7C3AED",
    borderRadius: 22,
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 16,
    paddingHorizontal: 18,
  },

  driverAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#d1d5db",
  },

  actionButtonsCollapsed: {
    flexDirection: "row",
    marginLeft: "auto",
    gap: 12,
  },

  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#000",
    justifyContent: "center",
    alignItems: "center",
  },

  // ✅ NOUVELLE PARTIE FIDÈLE AU FIGMA
  expandedCard: {
    width: "92%",
    backgroundColor: "#fff",
    borderRadius: 28,
    paddingTop: 20,
    paddingHorizontal: 22,
    paddingBottom: 18,
    alignSelf: "center",
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 15,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },

  title: {
    fontSize: 17,
    fontWeight: "600",
    color: "#333",
    textAlign: "center",
    marginBottom: 16,
  },

  timelineContainer: {
    marginBottom: 24,
    paddingLeft: 6,
  },

  stepContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
    position: "relative",
  },

  line: {
    position: "absolute",
    left: 7,
    top: -14,
    width: 2,
    height: 26,
  },

  circle: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1.5,
    marginRight: 12,
  },

  stepText: {
    fontSize: 15,
    fontWeight: "500",
  },

  actionBar: {
    flexDirection: "row",
    backgroundColor: "#7C3AED",
    borderRadius: 35,
    paddingVertical: 12,
    paddingHorizontal: 18,
    alignItems: "center",
    justifyContent: "space-between",
    shadowColor: "#7C3AED",
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },

  actionButtons: {
    flexDirection: "row",
    gap: 12,
  },

  actionButton: {
    backgroundColor: "#000",
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
  },
});
