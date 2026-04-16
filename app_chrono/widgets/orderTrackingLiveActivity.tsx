import { Image, Text, VStack } from "@expo/ui/swift-ui";
import { font, foregroundStyle, padding } from "@expo/ui/swift-ui/modifiers";
import { createLiveActivity } from "expo-widgets";
import type { LiveActivityEnvironment } from "expo-widgets/build/Widgets.types";

export type OrderTrackingLiveProps = {
  statusLabel: string;
  etaLabel: string;
  detailLine?: string;
};

function OrderTrackingLive(
  props: OrderTrackingLiveProps,
  environment: LiveActivityEnvironment
) {
  "widget";
  const accent = environment.colorScheme === "dark" ? "#FFFFFF" : "#EA580C";

  const detail = props.detailLine?.trim() || "Krono";

  return {
    banner: (
      <VStack modifiers={[padding({ all: 12 })]}>
        <Text modifiers={[font({ weight: "bold", size: 16 }), foregroundStyle(accent)]}>
          {props.statusLabel}
        </Text>
        <Text modifiers={[font({ size: 14 }), foregroundStyle(accent)]}>{props.etaLabel}</Text>
        <Text modifiers={[font({ size: 12 }), foregroundStyle(accent)]}>{detail}</Text>
      </VStack>
    ),
    compactLeading: <Image systemName="shippingbox.fill" color={accent} />,
    compactTrailing: (
      <Text modifiers={[font({ weight: "bold", size: 14 }), foregroundStyle(accent)]}>
        {props.etaLabel}
      </Text>
    ),
    minimal: <Image systemName="shippingbox.fill" color={accent} />,
    expandedCenter: (
      <VStack modifiers={[padding({ all: 8 })]}>
        <Text modifiers={[font({ weight: "bold", size: 18 }), foregroundStyle(accent)]}>
          {props.statusLabel}
        </Text>
        <Text modifiers={[font({ size: 14 }), foregroundStyle(accent)]}>{props.etaLabel}</Text>
      </VStack>
    ),
    expandedLeading: (
      <VStack modifiers={[padding({ all: 10 })]}>
        <Text modifiers={[font({ weight: "bold", size: 13 }), foregroundStyle(accent)]}>KRONO</Text>
        <Text modifiers={[font({ size: 11 }), foregroundStyle(accent)]}>Livraison</Text>
      </VStack>
    ),
    expandedTrailing: (
      <VStack modifiers={[padding({ all: 10 })]}>
        <Text modifiers={[font({ weight: "bold", size: 20 }), foregroundStyle(accent)]}>
          {props.etaLabel}
        </Text>
        <Text modifiers={[font({ size: 11 }), foregroundStyle(accent)]}>ETA</Text>
      </VStack>
    ),
    expandedBottom: (
      <VStack modifiers={[padding({ horizontal: 12, vertical: 8 })]}>
        <Text modifiers={[font({ size: 13 }), foregroundStyle(accent)]}>{detail}</Text>
      </VStack>
    ),
  };
}

export default createLiveActivity("OrderTrackingLive", OrderTrackingLive);
