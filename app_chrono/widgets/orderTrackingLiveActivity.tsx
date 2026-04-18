import { HStack, Image, RoundedRectangle, Spacer, Text, VStack, ZStack } from "@expo/ui/swift-ui";
import { font, foregroundStyle, frame, padding } from "@expo/ui/swift-ui/modifiers";
import { createLiveActivity } from "expo-widgets";
import type { LiveActivityEnvironment } from "expo-widgets/build/Widgets.types";

/**
 * Présentations Apple :
 * - Bannière : écran verrouillé / Notification Center
 * - Compact / minimal : îlot au repos
 * - Étendu : leading + center + trailing + bottom
 *
 * Toujours fournir **les quatre** zones étendues : en omettre (ex. mode « simplified » iOS 26+)
 * peut laisser l’îlot sur un indicateur de chargement.
 *
 * Icônes : SF Symbols uniquement (pas d’assets bitmap).
 */
function palette(environment: LiveActivityEnvironment) {
  const dim = environment.isLuminanceReduced === true;
  return {
    title: "#FFFFFF",
    body: dim ? "#EBEBF5" : "#F2F2F7",
    muted: "#D1D1D6",
    brand: "#EDE9FE",
    accent: "#E9D5FF",
    trackDone: dim ? "#9CA3AF" : "#6B7280",
    trackRemaining: "#E5E7EB",
  } as const;
}

export type OrderTrackingLiveProps = {
  etaLabel: string;
  vehicleLabel?: string;
  plateLabel?: string;
  isPending?: boolean;
};

function OrderTrackingLive(props: OrderTrackingLiveProps, environment: LiveActivityEnvironment) {
  "widget";
  const ON_DARK = palette(environment);
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

  const brandSize = simplified ? 14 : 15;
  const etaSize = simplified ? 22 : 26;
  const subSize = simplified ? 13 : 14;
  const plateSize = simplified ? 14 : 15;
  const iconSize = simplified ? 20 : 22;
  const pad = simplified ? 8 : 10;

  return {
    banner,
    compactLeading,
    compactTrailing,
    minimal,
    expandedCenter: (
      <VStack modifiers={[padding({ all: simplified ? 6 : 8 })]}>
        <Text modifiers={[font({ weight: "bold", size: etaSize }), foregroundStyle(ON_DARK.title)]}>{etaDisplay}</Text>
        <Text modifiers={[font({ size: subSize }), foregroundStyle(ON_DARK.body)]}>{vehicle}</Text>
      </VStack>
    ),
    expandedLeading: (
      <HStack spacing={8} alignment="center" modifiers={[padding({ all: pad })]}>
        <Text modifiers={[font({ weight: "bold", size: brandSize }), foregroundStyle(ON_DARK.brand)]}>KRONO</Text>
      </HStack>
    ),
    expandedTrailing: (
      <VStack modifiers={[padding({ all: pad })]}>
        <Text modifiers={[font({ weight: "bold", size: plateSize }), foregroundStyle(ON_DARK.title)]}>{plate}</Text>
        <Image systemName="car.side.fill" color={ON_DARK.accent} size={iconSize} />
      </VStack>
    ),
    expandedBottom: bottomBar,
  };
}

export default createLiveActivity("OrderTrackingLive", OrderTrackingLive);
