import { HStack, Image, RoundedRectangle, Spacer, Text, VStack, ZStack } from "@expo/ui/swift-ui";
import { font, foregroundStyle, frame, padding } from "@expo/ui/swift-ui/modifiers";
import { createLiveActivity } from "expo-widgets";
import type { LiveActivityEnvironment } from "expo-widgets/build/Widgets.types";

/** Îlot / Live Activity : fond noir — texte + SF Symbols uniquement (pas d’image logo dans l’extension). */
const ON_DARK = {
  title: "#FFFFFF",
  body: "#EBEBF5",
  muted: "#D1D1D6",
  brand: "#E9D5FF",
  accent: "#C4B5FD",
  trackDone: "#6B7280",
  trackRemaining: "#E5E7EB",
} as const;

export type OrderTrackingLiveProps = {
  etaLabel: string;
  vehicleLabel?: string;
  plateLabel?: string;
  isPending?: boolean;
};

function OrderTrackingLive(props: OrderTrackingLiveProps, _environment: LiveActivityEnvironment) {
  "widget";
  const vehicle = props.vehicleLabel?.trim() || "Krono";
  const plate = props.plateLabel?.trim() || "KRONO";

  const compactTitle = props.isPending ? "Recherche" : props.etaLabel;

  const bottomBar = props.isPending ? (
    <VStack modifiers={[padding({ horizontal: 12, vertical: 8 })]}>
      <ZStack alignment="leading">
        <RoundedRectangle
          cornerRadius={4}
          modifiers={[frame({ height: 6, maxWidth: 300 }), foregroundStyle(ON_DARK.trackRemaining)]}
        />
        <RoundedRectangle
          cornerRadius={4}
          modifiers={[frame({ width: 64, height: 6 }), foregroundStyle(ON_DARK.trackDone)]}
        />
      </ZStack>
    </VStack>
  ) : (
    <VStack modifiers={[padding({ horizontal: 12, vertical: 8 })]}>
      <ZStack alignment="leading">
        <RoundedRectangle
          cornerRadius={4}
          modifiers={[frame({ height: 6, maxWidth: 300 }), foregroundStyle(ON_DARK.trackRemaining)]}
        />
        <HStack>
          <RoundedRectangle
            cornerRadius={4}
            modifiers={[frame({ width: 110, height: 6 }), foregroundStyle(ON_DARK.trackDone)]}
          />
          <Spacer minLength={0} />
        </HStack>
      </ZStack>
    </VStack>
  );

  return {
    banner: (
      <VStack modifiers={[padding({ all: 12 })]}>
        <Text modifiers={[font({ weight: "bold", size: 20 }), foregroundStyle(ON_DARK.title)]}>
          {props.etaLabel}
        </Text>
        <Text modifiers={[font({ size: 14 }), foregroundStyle(ON_DARK.body)]}>{vehicle}</Text>
        <Text modifiers={[font({ size: 12 }), foregroundStyle(ON_DARK.muted)]}>{plate}</Text>
      </VStack>
    ),
    compactLeading: <Image systemName="car.fill" color={ON_DARK.accent} size={18} />,
    compactTrailing: (
      <Text modifiers={[font({ weight: "bold", size: 14 }), foregroundStyle(ON_DARK.title)]}>
        {compactTitle}
      </Text>
    ),
    minimal: <Image systemName="car.fill" color={ON_DARK.accent} size={16} />,
    expandedCenter: (
      <VStack modifiers={[padding({ all: 8 })]}>
        <Text modifiers={[font({ weight: "bold", size: 26 }), foregroundStyle(ON_DARK.title)]}>
          {props.etaLabel}
        </Text>
        <Text modifiers={[font({ size: 14 }), foregroundStyle(ON_DARK.body)]}>{vehicle}</Text>
      </VStack>
    ),
    expandedLeading: (
      <HStack spacing={8} alignment="center" modifiers={[padding({ all: 10 })]}>
        <Text modifiers={[font({ weight: "bold", size: 15 }), foregroundStyle(ON_DARK.brand)]}>KRONO</Text>
      </HStack>
    ),
    expandedTrailing: (
      <VStack modifiers={[padding({ all: 10 })]}>
        <Text modifiers={[font({ weight: "bold", size: 15 }), foregroundStyle(ON_DARK.title)]}>
          {plate}
        </Text>
        <Image systemName="car.side.fill" color={ON_DARK.accent} size={22} />
      </VStack>
    ),
    expandedBottom: bottomBar,
  };
}

export default createLiveActivity("OrderTrackingLive", OrderTrackingLive);
