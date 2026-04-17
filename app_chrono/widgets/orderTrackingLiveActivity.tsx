import { Ellipse, HStack, Image, RoundedRectangle, Spacer, Text, VStack, ZStack } from "@expo/ui/swift-ui";
import { font, foregroundStyle, frame, padding } from "@expo/ui/swift-ui/modifiers";
import { createLiveActivity } from "expo-widgets";
import type { LiveActivityEnvironment } from "expo-widgets/build/Widgets.types";
import { Image as RNImage } from "react-native";

/** Même ressource que l’icône app (`app.config.js`) — bundle Metro pour SwiftUI `uiImage`. */
const KRONO_LOGO_ASSET = require("../assets/images/logo/LOGO_APP2.png") as number;

function kronoLogoUri(): string | undefined {
  const r = RNImage.resolveAssetSource(KRONO_LOGO_ASSET);
  return typeof r?.uri === "string" ? r.uri : undefined;
}

export type OrderTrackingLiveProps = {
  etaLabel: string;
  vehicleLabel?: string;
  plateLabel?: string;
  /** Commande encore sans livreur (affichage compact + barre). */
  isPending?: boolean;
};

function OrderTrackingLive(
  props: OrderTrackingLiveProps,
  environment: LiveActivityEnvironment
) {
  "widget";
  const baseAccent = "#8B5CF6";
  const dimAccent = "#A78BFA";
  const accent = environment.isLuminanceReduced ? dimAccent : baseAccent;
  /** Sur l’îlot Dynamic Island, `colorScheme` peut rester « light » alors que le fond est noir. */
  const primaryStyle = { type: "hierarchical" as const, style: "primary" as const };
  const secondaryStyle = { type: "hierarchical" as const, style: "secondary" as const };
  const tertiaryStyle = { type: "hierarchical" as const, style: "tertiary" as const };

  const vehicle = props.vehicleLabel?.trim() || "Krono";
  const plate = props.plateLabel?.trim() || "KRONO";

  const trackDone = environment.colorScheme === "dark" ? "#4B5563" : "#9CA3AF";
  const trackRemaining = environment.colorScheme === "dark" ? "#E5E7EB" : "#F3F4F6";

  const compactTitle = props.isPending ? "Recherche" : props.etaLabel;
  const brandLogoUri = kronoLogoUri();

  /** Piste : fond clair pleine largeur, segment parcouru au-dessus, point d’arrivée. */
  const bottomBar = props.isPending ? (
    <VStack modifiers={[padding({ horizontal: 12, vertical: 6 })]}>
      <ZStack alignment="leading">
        <RoundedRectangle
          cornerRadius={4}
          modifiers={[frame({ height: 6, maxWidth: 300 }), foregroundStyle(trackRemaining)]}
        />
        <RoundedRectangle
          cornerRadius={4}
          modifiers={[frame({ width: 72, height: 6 }), foregroundStyle(trackDone)]}
        />
      </ZStack>
    </VStack>
  ) : (
    <VStack modifiers={[padding({ horizontal: 12, vertical: 6 })]}>
      <ZStack alignment="leading">
        <RoundedRectangle
          cornerRadius={4}
          modifiers={[frame({ height: 6, maxWidth: 300 }), foregroundStyle(trackRemaining)]}
        />
        <HStack>
          <RoundedRectangle
            cornerRadius={4}
            modifiers={[frame({ width: 120, height: 6 }), foregroundStyle(trackDone)]}
          />
          <Spacer minLength={0} />
          <Ellipse modifiers={[frame({ width: 10, height: 10 }), foregroundStyle(accent)]} />
        </HStack>
      </ZStack>
    </VStack>
  );

  return {
    banner: (
      <VStack modifiers={[padding({ all: 12 })]}>
        <Text modifiers={[font({ weight: "bold", size: 20 }), foregroundStyle(primaryStyle)]}>
          {props.etaLabel}
        </Text>
        <Text modifiers={[font({ size: 14 }), foregroundStyle(secondaryStyle)]}>{vehicle}</Text>
        <Text modifiers={[font({ size: 12 }), foregroundStyle(tertiaryStyle)]}>{plate}</Text>
      </VStack>
    ),
    compactLeading: <Image systemName="car.fill" color={accent} />,
    compactTrailing: (
      <Text modifiers={[font({ weight: "bold", size: 14 }), foregroundStyle(primaryStyle)]}>
        {compactTitle}
      </Text>
    ),
    minimal: <Image systemName="car.fill" color={accent} />,
    expandedCenter: (
      <VStack modifiers={[padding({ all: 8 })]}>
        <Text modifiers={[font({ weight: "bold", size: 26 }), foregroundStyle(primaryStyle)]}>
          {props.etaLabel}
        </Text>
        <Text modifiers={[font({ size: 14 }), foregroundStyle(secondaryStyle)]}>{vehicle}</Text>
      </VStack>
    ),
    expandedLeading: (
      <HStack spacing={8} alignment="center" modifiers={[padding({ all: 10 })]}>
        {brandLogoUri ? (
          <Image uiImage={brandLogoUri} modifiers={[frame({ width: 28, height: 28 })]} />
        ) : null}
        <Text modifiers={[font({ weight: "bold", size: 14 }), foregroundStyle(accent)]}>KRONO</Text>
      </HStack>
    ),
    expandedTrailing: (
      <VStack modifiers={[padding({ all: 10 })]}>
        <Text modifiers={[font({ weight: "bold", size: 16 }), foregroundStyle(primaryStyle)]}>
          {plate}
        </Text>
        <Image systemName="car.side.fill" color={accent} />
      </VStack>
    ),
    expandedBottom: bottomBar,
  };
}

export default createLiveActivity("OrderTrackingLive", OrderTrackingLive);
