import { HStack, Image, ProgressView, Text, VStack } from "@expo/ui/swift-ui";
import {
  font,
  foregroundStyle,
  frame,
  padding,
  progressViewStyle,
} from "@expo/ui/swift-ui/modifiers";
import { createLiveActivity } from "expo-widgets";
import type { LiveActivityEnvironment } from "expo-widgets/build/Widgets.types";
import { Image as RNImage } from "react-native";

/**
 * Couleurs fixes pour l’îlot / Live Activity : le fond est quasi toujours noir.
 * Les styles « hiérarchiques » SwiftUI peuvent rester sombres → texte illisible.
 */
const ON_DARK = {
  title: "#FFFFFF",
  body: "#EBEBF5",
  muted: "#D1D1D6",
  brand: "#E9D5FF",
  accent: "#C4B5FD",
  trackFill: "#FFFFFF",
} as const;

/** Même ressource que l’icône app (`app.config.js`). */
const KRONO_LOGO_ASSET = require("../assets/images/logo/LOGO_APP2.png") as number;

function kronoLogoUri(): string | undefined {
  const r = RNImage.resolveAssetSource(KRONO_LOGO_ASSET);
  return typeof r?.uri === "string" ? r.uri : undefined;
}

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
  const brandLogoUri = kronoLogoUri();

  /** Progress déterminé uniquement : sans `value`, SwiftUI affiche un spinner (indéterminé). */
  const progressValue = props.isPending ? 0.22 : 0.5;

  const bottomBar = (
    <VStack modifiers={[padding({ horizontal: 12, vertical: 8 })]}>
      <ProgressView
        value={progressValue}
        modifiers={[
          progressViewStyle("linear"),
          frame({ height: 6 }),
          foregroundStyle(ON_DARK.trackFill),
        ]}
      />
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
    compactLeading: brandLogoUri ? (
      <Image uiImage={brandLogoUri} modifiers={[frame({ width: 22, height: 22 })]} />
    ) : (
      <Image systemName="car.fill" color={ON_DARK.accent} size={18} />
    ),
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
        {brandLogoUri ? (
          <Image uiImage={brandLogoUri} modifiers={[frame({ width: 30, height: 30 })]} />
        ) : null}
        <Text modifiers={[font({ weight: "bold", size: 15 }), foregroundStyle(ON_DARK.brand)]}>
          KRONO
        </Text>
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
