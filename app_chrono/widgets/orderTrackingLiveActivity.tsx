import { Capsule, Circle, HStack, Image, RoundedRectangle, Spacer, Text, VStack, ZStack } from "@expo/ui/swift-ui";
import { background, font, foregroundStyle, frame, offset, padding, shapes } from "@expo/ui/swift-ui/modifiers";
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
    brand: "#FF6B2C",
    accent: "#F3F4F6",
    plateBg: "#111111",
    plateText: "#FFFFFF",
    trackDone: dim ? "#7C7F87" : "#5E6168",
    trackRemaining: "#D9D9DE",
    trackKnob: "#ECECEC",
    trackDestination: "#FF5A36",
  } as const;
}

export type OrderTrackingLiveProps = {
  etaLabel: string;
  vehicleLabel?: string;
  plateLabel?: string;
  isPending?: boolean;
  statusLabel?: string;
  progress?: number;
};

function OrderTrackingLive(props: OrderTrackingLiveProps, environment: LiveActivityEnvironment) {
  "widget";
  const ON_DARK = palette(environment);
  const vehicle = props.vehicleLabel?.trim() || "Krono";
  const plate = props.plateLabel?.trim() || "KRONO";
  const etaDisplay = (props.etaLabel ?? "").trim() || "—";
  const statusLabel = props.statusLabel?.trim() || (props.isPending ? "Recherche chauffeur" : "Livraison en cours");
  const compactTitle = props.isPending ? "Recherche" : etaDisplay;
  const simplified = environment.levelOfDetail === "simplified";
  const progress = Math.max(0.04, Math.min(1, props.progress ?? (props.isPending ? 0.08 : 0.56)));
  const trackWidth = simplified ? 214 : 250;
  const traveledWidth = Math.max(14, Math.round(trackWidth * progress));
  const carOffset = Math.max(0, Math.min(trackWidth - 28, traveledWidth - 14));
  const destinationOffset = Math.max(0, trackWidth - 18);

  const bottomBar = (
    <VStack modifiers={[padding({ horizontal: 12, vertical: 10 })]}>
      <ZStack alignment="leading">
        <RoundedRectangle
          cornerRadius={5}
          modifiers={[frame({ width: trackWidth, height: 8 }), foregroundStyle(ON_DARK.trackRemaining)]}
        />
        <RoundedRectangle
          cornerRadius={5}
          modifiers={[frame({ width: traveledWidth, height: 8 }), foregroundStyle(ON_DARK.trackDone)]}
        />
        <ZStack modifiers={[offset({ x: carOffset })]}>
          <Circle modifiers={[frame({ width: 28, height: 28 }), foregroundStyle(ON_DARK.trackKnob)]} />
          <Image systemName="car.side.fill" color="#6B7280" size={14} />
        </ZStack>
        <ZStack modifiers={[offset({ x: destinationOffset })]}>
          <Circle modifiers={[frame({ width: 18, height: 18 }), foregroundStyle(ON_DARK.trackDestination)]} />
          <Circle modifiers={[frame({ width: 8, height: 8 }), foregroundStyle("#FFFFFF")]} />
        </ZStack>
      </ZStack>
    </VStack>
  );

  const banner = (
    <VStack modifiers={[padding({ all: 12 })]}>
      <Text modifiers={[font({ weight: "bold", size: 20 }), foregroundStyle(ON_DARK.title)]}>{etaDisplay}</Text>
      <Text modifiers={[font({ size: 14 }), foregroundStyle(ON_DARK.body)]}>{vehicle}</Text>
      <Text modifiers={[font({ size: 12 }), foregroundStyle(ON_DARK.muted)]}>{statusLabel}</Text>
    </VStack>
  );

  const compactLeading = <Image systemName="car.fill" color={ON_DARK.accent} size={18} />;
  const compactTrailing = (
    <Text modifiers={[font({ weight: "bold", size: 14 }), foregroundStyle(ON_DARK.title)]}>{compactTitle}</Text>
  );
  const minimal = <Image systemName="car.fill" color={ON_DARK.accent} size={16} />;

  const etaSize = simplified ? 22 : 26;
  const subSize = simplified ? 13 : 14;
  const plateSize = simplified ? 14 : 15;
  const iconSize = simplified ? 20 : 22;
  const pad = simplified ? 8 : 10;
  const plateWidth = simplified ? 118 : 144;
  const plateHeight = simplified ? 36 : 42;

  return {
    banner,
    compactLeading,
    compactTrailing,
    minimal,
    expandedCenter: (
      <VStack modifiers={[padding({ all: simplified ? 6 : 8 })]}>
        <Text modifiers={[font({ weight: "bold", size: simplified ? 13 : 14 }), foregroundStyle(ON_DARK.brand)]}>KRONO</Text>
        <Text modifiers={[font({ weight: "bold", size: etaSize }), foregroundStyle(ON_DARK.title)]}>{etaDisplay}</Text>
        <Text modifiers={[font({ size: subSize }), foregroundStyle(ON_DARK.body)]}>{vehicle}</Text>
        <Text modifiers={[font({ size: 12 }), foregroundStyle(ON_DARK.muted)]}>{statusLabel}</Text>
      </VStack>
    ),
    expandedLeading: <Spacer minLength={0} />,
    expandedTrailing: (
      <VStack spacing={8} modifiers={[padding({ all: pad })]}>
        <ZStack>
          <Capsule modifiers={[frame({ width: plateWidth, height: plateHeight }), foregroundStyle(ON_DARK.plateBg)]} />
          <Text
            modifiers={[
              font({ weight: "bold", size: plateSize }),
              foregroundStyle(ON_DARK.plateText),
              background("#1A1A1A", shapes.capsule()),
              padding({ horizontal: 14, vertical: 8 }),
            ]}
          >
            {plate}
          </Text>
        </ZStack>
        <HStack spacing={6}>
          <Spacer minLength={0} />
          <Image systemName="car.side.fill" color={ON_DARK.accent} size={iconSize} />
        </HStack>
      </VStack>
    ),
    expandedBottom: bottomBar,
  };
}

export default createLiveActivity("OrderTrackingLive", OrderTrackingLive);
