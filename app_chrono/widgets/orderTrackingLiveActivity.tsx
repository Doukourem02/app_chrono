import { Text, VStack } from "@expo/ui/swift-ui";
import { font, foregroundStyle, padding } from "@expo/ui/swift-ui/modifiers";
import { createLiveActivity } from "expo-widgets";
import type { LiveActivityEnvironment } from "expo-widgets/build/Widgets.types";

/**
 * Version minimale : uniquement `Text` / `VStack` (pas d’Image SF Symbol, pas de formes).
 * Si l’îlot s’affiche ainsi, on pourra réintroduire progressivement icônes et barre.
 */
const W = "#FFFFFF";
const W2 = "#EBEBF5";

export type OrderTrackingLiveProps = {
  etaLabel: string;
  vehicleLabel?: string;
  plateLabel?: string;
  isPending?: boolean;
};

function OrderTrackingLive(props: OrderTrackingLiveProps, _environment: LiveActivityEnvironment) {
  "widget";
  const vehicle = props.vehicleLabel?.trim() || "Krono";
  const plate = props.plateLabel?.trim() || "Krono";
  const compactTitle = props.isPending ? "Recherche" : props.etaLabel;

  return {
    banner: (
      <VStack modifiers={[padding({ all: 12 })]}>
        <Text modifiers={[font({ weight: "bold", size: 18 }), foregroundStyle(W)]}>{props.etaLabel}</Text>
        <Text modifiers={[font({ size: 14 }), foregroundStyle(W2)]}>{vehicle}</Text>
        <Text modifiers={[font({ size: 12 }), foregroundStyle(W2)]}>{plate}</Text>
      </VStack>
    ),
    compactLeading: (
      <Text modifiers={[font({ weight: "bold", size: 13 }), foregroundStyle(W)]}>K</Text>
    ),
    compactTrailing: (
      <Text modifiers={[font({ weight: "bold", size: 13 }), foregroundStyle(W)]}>{compactTitle}</Text>
    ),
    minimal: <Text modifiers={[font({ weight: "bold", size: 11 }), foregroundStyle(W)]}>K</Text>,
    expandedCenter: (
      <VStack modifiers={[padding({ all: 10 })]}>
        <Text modifiers={[font({ weight: "bold", size: 24 }), foregroundStyle(W)]}>{props.etaLabel}</Text>
        <Text modifiers={[font({ size: 14 }), foregroundStyle(W2)]}>{vehicle}</Text>
      </VStack>
    ),
    expandedLeading: (
      <Text modifiers={[font({ weight: "bold", size: 14 }), foregroundStyle(W2)]}>Krono</Text>
    ),
    expandedTrailing: (
      <Text modifiers={[font({ size: 13 }), foregroundStyle(W2)]}>{plate}</Text>
    ),
  };
}

export default createLiveActivity("OrderTrackingLive", OrderTrackingLive);
