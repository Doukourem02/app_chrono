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
  const insets = useSafeAreaInsets(); // ✅ pour iPhone / Android bottom safe-area

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
          bottom: insets.bottom + 10, // ✅ la sheet flotte, ne touche pas le bas
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
        <View style={styles.content}>
          <Text style={styles.title}>Statut de la commande</Text>

          <View style={styles.timelineContainer}>
            {statusSteps.map((step, index) => {
              const isActive = index <= activeIndex;
              return (
                <View key={step.key} style={styles.stepContainer}>
                  {index !== 0 && (
                    <View
                      style={[
                        styles.line,
                        { backgroundColor: isActive ? "#7C3AED" : "#ccc" },
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

  content: {
    flex: 1,
    backgroundColor: "#fff",
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
    paddingHorizontal: 20,
    paddingTop: 12,
  },

  title: {
    fontSize: 17,
    fontWeight: "600",
    color: "#333",
    textAlign: "center",
    marginBottom: 12,
  },

  timelineContainer: {
    marginBottom: 22,
    paddingHorizontal: 10,
  },

  stepContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
    position: "relative",
  },

  line: {
    position: "absolute",
    left: 7,
    top: -14,
    width: 2,
    height: 22,
  },

  circle: {
    width: 15,
    height: 15,
    borderRadius: 8,
    borderWidth: 1.5,
    marginRight: 10,
  },

  stepText: {
    fontSize: 14,
  },

  actionBar: {
    flexDirection: "row",
    backgroundColor: "#7C3AED",
    borderRadius: 30,
    paddingVertical: 12,
    paddingHorizontal: 20,
    alignItems: "center",
    justifyContent: "space-between",
  },

  actionButtons: {
    flexDirection: "row",
    gap: 10,
  },

  actionButton: {
    backgroundColor: "#000",
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
});
