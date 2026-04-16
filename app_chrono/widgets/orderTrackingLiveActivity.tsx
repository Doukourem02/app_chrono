import { HStack, Image, Text, VStack } from "@expo/ui/swift-ui";
import { font, foregroundStyle, padding } from "@expo/ui/swift-ui/modifiers";
import { createLiveActivity } from "expo-widgets";
import type { LiveActivityEnvironment } from "expo-widgets/build/Widgets.types";

export type OrderTrackingLiveProps = {
  etaLabel: string;
  vehicleLabel?: string;
  plateLabel?: string;
};

function OrderTrackingLive(
  props: OrderTrackingLiveProps,
  environment: LiveActivityEnvironment
) {
  "widget";
  const baseAccent = "#8B5CF6";
  const dimAccent = "#A78BFA";
  const accent = environment.isLuminanceReduced ? dimAccent : baseAccent;
  const primaryText = environment.colorScheme === "dark" ? "#FFFFFF" : "#111827";
  const mutedText = environment.colorScheme === "dark" ? "#D1D5DB" : "#4B5563";
  const doneTrack = environment.colorScheme === "dark" ? "#374151" : "#9CA3AF";
  const remainingTrack = environment.colorScheme === "dark" ? "#F3F4F6" : "#E5E7EB";

  const vehicle = props.vehicleLabel?.trim() || "Krono";
  const plate = props.plateLabel?.trim() || "KRONO";

  return {
    banner: (
      <VStack modifiers={[padding({ all: 12 })]}>
        <Text modifiers={[font({ weight: "bold", size: 20 }), foregroundStyle(primaryText)]}>
          {props.etaLabel}
        </Text>
        <Text modifiers={[font({ size: 14 }), foregroundStyle(primaryText)]}>{vehicle}</Text>
        <Text modifiers={[font({ size: 12 }), foregroundStyle(mutedText)]}>{plate}</Text>
      </VStack>
    ),
    compactLeading: <Image systemName="car.fill" color={accent} />,
    compactTrailing: (
      <Text modifiers={[font({ weight: "bold", size: 14 }), foregroundStyle(primaryText)]}>
        {props.etaLabel}
      </Text>
    ),
    minimal: <Image systemName="car.fill" color={accent} />,
    expandedCenter: (
      <VStack modifiers={[padding({ all: 8 })]}>
        <Text modifiers={[font({ weight: "bold", size: 28 }), foregroundStyle(primaryText)]}>
          {props.etaLabel}
        </Text>
        <Text modifiers={[font({ size: 14 }), foregroundStyle(primaryText)]}>{vehicle}</Text>
      </VStack>
    ),
    expandedLeading: (
      <HStack modifiers={[padding({ all: 10 })]}>
        <Image systemName="bolt.circle.fill" color={accent} />
        <Text modifiers={[font({ weight: "bold", size: 14 }), foregroundStyle(accent)]}>KRONO</Text>
      </HStack>
    ),
    expandedTrailing: (
      <VStack modifiers={[padding({ all: 10 })]}>
        <Text modifiers={[font({ weight: "bold", size: 18 }), foregroundStyle(primaryText)]}>
          {plate}
        </Text>
        <Image systemName="car.side.fill" color={accent} />
      </VStack>
    ),
    expandedBottom: (
      <VStack modifiers={[padding({ horizontal: 12, vertical: 8 })]}>
        <HStack>
          <Text modifiers={[font({ weight: "bold", size: 12 }), foregroundStyle(doneTrack)]}>
            ====================
          </Text>
          <Text modifiers={[font({ weight: "bold", size: 12 }), foregroundStyle(remainingTrack)]}>
            ==========
          </Text>
          <Text modifiers={[font({ weight: "bold", size: 18 }), foregroundStyle(accent)]}>o</Text>
        </HStack>
      </VStack>
    ),
  };
}

export default createLiveActivity("OrderTrackingLive", OrderTrackingLive);
