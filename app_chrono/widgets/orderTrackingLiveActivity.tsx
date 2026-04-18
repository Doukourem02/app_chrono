import { HStack, Image, RoundedRectangle, Spacer, Text, VStack, ZStack } from "@expo/ui/swift-ui";
import { font, foregroundStyle, frame, padding } from "@expo/ui/swift-ui/modifiers";
import { createLiveActivity } from "expo-widgets";
import type { LiveActivityEnvironment } from "expo-widgets/build/Widgets.types";

/**
 * Présentations Apple (pas de « scène 3 » officielle) :
 * - Bannière : écran verrouillé / Notification Center
 * - Compact / minimal : îlot au repos
 * - Étendu : leading + center + trailing + bottom autour de l’îlot
 *
 * Sous iOS 26+, `levelOfDetail === 'simplified'` peut exiger moins de vues ; sinon l’îlot peut rester sur un indicateur de chargement.
 */
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

function OrderTrackingLive(props: OrderTrackingLiveProps, environment: LiveActivityEnvironment) {
  "widget";
  const vehicle = props.vehicleLabel?.trim() || "Krono";
  const plate = props.plateLabel?.trim() || "KRONO";
  const etaDisplay = (props.etaLabel ?? "").trim() || "—";
  const compactTitle = props.isPending ? "Recherche" : etaDisplay;
  const simplified = environment.levelOfDetail === "simplified";

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

  const banner = (
    <VStack modifiers={[padding({ all: 12 })]}>
      <Text modifiers={[font({ weight: "bold", size: 20 }), foregroundStyle(ON_DARK.title)]}>{etaDisplay}</Text>
      <Text modifiers={[font({ size: 14 }), foregroundStyle(ON_DARK.body)]}>{vehicle}</Text>
      <Text modifiers={[font({ size: 12 }), foregroundStyle(ON_DARK.muted)]}>{plate}</Text>
    </VStack>
  );

  const compactLeading = <Image systemName="car.fill" color={ON_DARK.accent} size={18} />;
  const compactTrailing = (
    <Text modifiers={[font({ weight: "bold", size: 14 }), foregroundStyle(ON_DARK.title)]}>{compactTitle}</Text>
  );
  const minimal = <Image systemName="car.fill" color={ON_DARK.accent} size={16} />;

  /** Une seule colonne : évite les layouts multi-régions trop denses sous iOS 26+ simplified. */
  if (simplified) {
    return {
      banner,
      compactLeading,
      compactTrailing,
      minimal,
      expandedCenter: (
        <VStack modifiers={[padding({ horizontal: 10, vertical: 8 })]}>
          <Text modifiers={[font({ weight: "bold", size: 12 }), foregroundStyle(ON_DARK.brand)]}>KRONO</Text>
          <Text modifiers={[font({ weight: "bold", size: 24 }), foregroundStyle(ON_DARK.title)]}>{etaDisplay}</Text>
          <Text modifiers={[font({ size: 13 }), foregroundStyle(ON_DARK.body)]}>{vehicle}</Text>
          <Text modifiers={[font({ size: 12 }), foregroundStyle(ON_DARK.muted)]}>{plate}</Text>
        </VStack>
      ),
    };
  }

  return {
    banner,
    compactLeading,
    compactTrailing,
    minimal,
    expandedCenter: (
      <VStack modifiers={[padding({ all: 8 })]}>
        <Text modifiers={[font({ weight: "bold", size: 26 }), foregroundStyle(ON_DARK.title)]}>{etaDisplay}</Text>
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
        <Text modifiers={[font({ weight: "bold", size: 15 }), foregroundStyle(ON_DARK.title)]}>{plate}</Text>
        <Image systemName="car.side.fill" color={ON_DARK.accent} size={22} />
      </VStack>
    ),
    expandedBottom: bottomBar,
  };
}

export default createLiveActivity("OrderTrackingLive", OrderTrackingLive);
