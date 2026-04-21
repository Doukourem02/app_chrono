import { Circle, HStack, Image, RoundedRectangle, Spacer, Text, VStack, ZStack } from "@expo/ui/swift-ui";
import { font, foregroundStyle, frame, offset, padding } from "@expo/ui/swift-ui/modifiers";
import { createLiveActivity } from "expo-widgets";
import type { LiveActivityEnvironment } from "expo-widgets/build/Widgets.types";

/**
 * Présentations Apple :
 * - Bannière : écran de verrouillage / Notification Center
 * - Compact / minimal : îlot au repos
 * - Étendu : leading + center + trailing + bottom
 *
 * Toujours fournir **les quatre** zones étendues : en omettre (ex. mode « simplified » iOS 26+)
 * peut laisser l’îlot sur un indicateur de chargement.
 *
 * Îlot étendu (inspiration type ride-hailing) : leading = marque + temps restant + livreur,
 * center = espaceur, trailing = plaque + icône, bottom = statut + piste progression.
 *
 * Bannière verrouillage : deux bandes — haut : photo livreur + libellés + appel / SMS ;
 * séparateur ; bas : horloge + temps restant mis en avant (style apps course).
 *
 * Photo : `driverAvatarUrl` (https ou file). Icônes : SF Symbols.
 */
function palette(environment: LiveActivityEnvironment) {
  const dim = environment.isLuminanceReduced === true;
  return {
    title: "#FFFFFF",
    body: dim ? "#EBEBF5" : "#F2F2F7",
    muted: "#9CA3AF",
    /** Accent marque (charte Krono) */
    brand: "#8B5CF6",
    accent: "#C4B5FD",
    /** Accent actions / temps restant bannière : violet pour rester cohérent avec Krono */
    bannerAction: dim ? "#C4B5FD" : "#A78BFA",
    plateBg: "#1A1A1A",
    plateBorder: "#F2F2F7",
    plateText: "#FFFFFF",
    trackDone: dim ? "#7C7F87" : "#5E6168",
    trackRemaining: "#E5E5EA",
    trackKnob: "#ECECEC",
    trackDestination: "#8B5CF6",
    bannerChip: "#2C2C2E",
  } as const;
}

export type OrderTrackingLiveProps = {
  etaLabel: string;
  vehicleLabel?: string;
  vehicleInfoLabel?: string;
  plateLabel?: string;
  isPending?: boolean;
  statusCode?: string;
  statusLabel?: string;
  progress?: number;
  /** URL https ou chemin `file://` pour la photo livreur (bannière). */
  driverAvatarUrl?: string;
  /** Chiffres / + pour `tel:` et `sms:` (sans préfixe). */
  driverPhone?: string;
  /** Heure affichée sous « Heure » (ex. création commande, formatée côté app). */
  bannerClockLabel?: string;
  /** Image locale/packagée utilisée comme indicateur de progression. */
  vehicleMarkerUrl?: string;
};

function normalizeEtaLabel(etaRaw: string): string {
  const t = (etaRaw ?? "").trim();
  const lower = t.toLowerCase();
  if (!t || t === "—" || t === "-" || t === "–" || ["eta", "n/a", "null", "undefined"].includes(lower)) return "";
  const m = t.match(/^(\d+)\s*(?:min|mn|minutes?)?$/i);
  if (m) return `${m[1]} min`;
  return "";
}

function minimalEtaLabel(etaRaw: string): string {
  return normalizeEtaLabel(etaRaw);
}

function compactFallbackLabel(statusCode: string | undefined): string {
  switch ((statusCode ?? "").trim()) {
    case "accepted":
    case "enroute":
      return "En route";
    case "in_progress":
      return "Arrivé";
    case "picked_up":
    case "delivering":
      return "En route";
    case "completed":
      return "Terminé";
    case "cancelled":
      return "Annulé";
    case "declined":
      return "Refusé";
    default:
      return "Suivi";
  }
}

function compactTrailingLabel(
  statusCode: string | undefined,
  eta: string,
  isPending: boolean | undefined,
): string {
  if (isPending) return "Recherche livreurs";
  if ((statusCode ?? "").trim() === "in_progress") return "Arrivé";
  return eta || compactFallbackLabel(statusCode);
}

function shouldShowArrivedCompactVisual(statusCode: string | undefined, statusLabel: string | undefined): boolean {
  const status = (statusCode ?? "").trim().toLowerCase();
  if (status === "in_progress" || status === "arrived" || status === "at_pickup" || status === "at_dropoff") {
    return true;
  }

  const label = (statusLabel ?? "").trim().toLowerCase();
  return label.includes("arriv");
}

function minimalFallbackLabel(statusCode: string | undefined): string {
  switch ((statusCode ?? "").trim()) {
    case "accepted":
    case "enroute":
      return "Suivi";
    case "in_progress":
      return "Prep";
    case "picked_up":
    case "delivering":
      return "Route";
    case "completed":
      return "OK";
    default:
      return "Suivi";
  }
}

function etaHeadline(statusCode: string | undefined, eta: string, isPending: boolean | undefined): string {
  if (isPending) return "Recherche livreur";
  const status = (statusCode ?? "").trim();
  if (status === "completed") return "Livraison terminée";
  if (status === "cancelled") return "Commande annulée";
  if (status === "declined") return "Commande refusée";
  if (status === "picked_up" || status === "delivering") {
    return eta ? `Livraison dans ${eta}` : "En livraison";
  }
  return eta ? `Prise en charge dans ${eta}` : "Vers la prise en charge";
}

function OrderTrackingLive(props: OrderTrackingLiveProps, environment: LiveActivityEnvironment) {
  "widget";
  const ON_DARK = palette(environment);
  const vehicleInfo = props.vehicleInfoLabel?.trim() || "Livraison Krono";
  const etaDisplay = (props.etaLabel ?? "").trim() || "—";
  const normalizedEta = normalizeEtaLabel(etaDisplay);
  const compactTitle = compactTrailingLabel(props.statusCode, normalizedEta, props.isPending);
  const simplified = environment.levelOfDetail === "simplified";
  const progress = Math.max(0.04, Math.min(1, props.progress ?? (props.isPending ? 0.08 : 0.56)));
  const markerWidth = 50;
  const markerHeight = 33;
  const markerHalf = markerWidth / 2;
  const trackWidth = simplified ? 214 : 250;
  const traveledWidth = Math.max(14, Math.round(trackWidth * progress));
  const carOffset = Math.max(0, Math.min(trackWidth - markerWidth, traveledWidth - markerHalf));
  const destinationOffset = Math.max(0, trackWidth - 14);

  const avatarUrl = (props.driverAvatarUrl ?? "").trim();
  const vehicleMarkerUrl = (props.vehicleMarkerUrl ?? "").trim();
  const compactArrivedVisual = shouldShowArrivedCompactVisual(props.statusCode, props.statusLabel);

  const driverAvatar = (
    <ZStack modifiers={[frame({ width: 44, height: 44 })]}>
      {avatarUrl ? (
        <Image uiImage={avatarUrl} modifiers={[frame({ width: 44, height: 44 })]} />
      ) : (
        <>
          <Circle modifiers={[frame({ width: 44, height: 44 }), foregroundStyle("#FFFFFF")]} />
          <Circle modifiers={[frame({ width: 38, height: 38 }), foregroundStyle(ON_DARK.bannerChip)]} />
          <Image systemName="person.crop.circle.fill" color="#8E8E93" size={28} />
        </>
      )}
    </ZStack>
  );
  const compactDriverAvatar = avatarUrl ? (
    <Image uiImage={avatarUrl} modifiers={[frame({ width: 36, height: 36 })]} />
  ) : (
    <ZStack modifiers={[frame({ width: 36, height: 36 })]}>
      <Circle modifiers={[frame({ width: 36, height: 36 }), foregroundStyle("#FFFFFF")]} />
      <Circle modifiers={[frame({ width: 31, height: 31 }), foregroundStyle(ON_DARK.bannerChip)]} />
      <Image systemName="person.crop.circle.fill" color="#8E8E93" size={24} />
    </ZStack>
  );

  const compactLeading = (
    <Text modifiers={[font({ weight: "bold", size: 14 }), foregroundStyle(ON_DARK.accent)]}>
      KRONO
    </Text>
  );
  const compactTrailing = compactArrivedVisual ? (
    <HStack spacing={4}>
      <Image systemName="hand.wave.fill" color={ON_DARK.title} size={18} />
      {compactDriverAvatar}
    </HStack>
  ) : (
    <Text modifiers={[font({ weight: "bold", size: 14 }), foregroundStyle(ON_DARK.accent)]}>{compactTitle}</Text>
  );
  const minimalTitle = props.isPending ? "Recherche" : minimalEtaLabel(etaDisplay) || minimalFallbackLabel(props.statusCode);
  const minimal = minimalTitle ? (
    <Text modifiers={[font({ weight: "bold", size: 13 }), foregroundStyle(ON_DARK.accent)]}>{minimalTitle}</Text>
  ) : (
    <Image systemName="car.fill" color={ON_DARK.accent} size={16} />
  );

  const headline = etaHeadline(props.statusCode, normalizedEta, props.isPending);
  const shortVehicleInfo = vehicleInfo.length > 31 ? `${vehicleInfo.slice(0, 28)}...` : vehicleInfo;
  const bannerTrackWidth = simplified ? 280 : 310;
  const bannerTraveledWidth = Math.max(16, Math.round(bannerTrackWidth * progress));
  const bannerCarOffset = Math.max(0, Math.min(bannerTrackWidth - markerWidth, bannerTraveledWidth - markerHalf));
  const bannerDestinationOffset = Math.max(0, bannerTrackWidth - 14);
  const etaSize = simplified ? 22 : 26;
  const infoSize = simplified ? 12 : 13;
  const expandedLeading = <Spacer minLength={0} />;
  const expandedTrailing = <Spacer minLength={0} />;

  const banner = (
    <VStack spacing={12} modifiers={[padding({ horizontal: 16, vertical: 18 }), frame({ minHeight: 122 })]}>
      <Text modifiers={[font({ weight: "bold", size: 14 }), foregroundStyle(ON_DARK.brand), frame({ maxWidth: bannerTrackWidth, alignment: "leading" })]}>
        KRONO
      </Text>
      <HStack spacing={10}>
        <VStack spacing={3} modifiers={[frame({ maxWidth: 230, alignment: "leading" })]}>
          <Text modifiers={[font({ weight: "bold", size: 18 }), foregroundStyle(ON_DARK.title)]}>{headline}</Text>
          <Text modifiers={[font({ weight: "medium", size: 12 }), foregroundStyle(ON_DARK.accent), frame({ alignment: "leading" })]}>
            {shortVehicleInfo}
          </Text>
        </VStack>
        {driverAvatar}
      </HStack>
      <ZStack alignment="leading">
        <RoundedRectangle
          cornerRadius={5}
          modifiers={[frame({ width: bannerTrackWidth, height: 5 }), foregroundStyle("#5E6168")]}
        />
        <RoundedRectangle
          cornerRadius={5}
          modifiers={[frame({ width: bannerTraveledWidth, height: 5 }), foregroundStyle("#A7C7FF")]}
        />
        <ZStack modifiers={[offset({ x: bannerCarOffset })]}>
          {vehicleMarkerUrl ? (
            <Image uiImage={vehicleMarkerUrl} modifiers={[frame({ width: markerWidth, height: markerHeight })]} />
          ) : (
            <Image systemName="bicycle" color="#F2F2F7" size={21} />
          )}
        </ZStack>
        <ZStack modifiers={[offset({ x: bannerDestinationOffset })]}>
          <Circle modifiers={[frame({ width: 14, height: 14 }), foregroundStyle("#A7C7FF")]} />
          <Circle modifiers={[frame({ width: 6, height: 6 }), foregroundStyle("#111827")]} />
        </ZStack>
      </ZStack>
    </VStack>
  );

  const expandedBottom = (
    <VStack spacing={9} modifiers={[padding({ horizontal: 12, top: 0, bottom: 10 })]}>
      <Text modifiers={[font({ weight: "bold", size: simplified ? 13 : 14 }), foregroundStyle(ON_DARK.brand), frame({ maxWidth: trackWidth, alignment: "leading" })]}>
        KRONO
      </Text>
      <HStack spacing={10}>
        <VStack spacing={3} modifiers={[frame({ maxWidth: 230, alignment: "leading" })]}>
          <Text modifiers={[font({ weight: "bold", size: etaSize }), foregroundStyle(ON_DARK.title)]}>{headline}</Text>
          <Text modifiers={[font({ weight: "medium", size: infoSize }), foregroundStyle(ON_DARK.accent), frame({ alignment: "leading" })]}>
            {shortVehicleInfo}
          </Text>
        </VStack>
        {driverAvatar}
      </HStack>
      <ZStack alignment="leading">
        <RoundedRectangle
          cornerRadius={5}
          modifiers={[frame({ width: trackWidth, height: 5 }), foregroundStyle("#5E6168")]}
        />
        <RoundedRectangle
          cornerRadius={5}
          modifiers={[frame({ width: traveledWidth, height: 5 }), foregroundStyle("#A7C7FF")]}
        />
        <ZStack modifiers={[offset({ x: carOffset })]}>
          {vehicleMarkerUrl ? (
            <Image uiImage={vehicleMarkerUrl} modifiers={[frame({ width: markerWidth, height: markerHeight })]} />
          ) : (
            <Image systemName="bicycle" color="#F2F2F7" size={21} />
          )}
        </ZStack>
        <ZStack modifiers={[offset({ x: destinationOffset })]}>
          <Circle modifiers={[frame({ width: 14, height: 14 }), foregroundStyle("#A7C7FF")]} />
          <Circle modifiers={[frame({ width: 6, height: 6 }), foregroundStyle("#111827")]} />
        </ZStack>
      </ZStack>
    </VStack>
  );

  return {
    banner,
    compactLeading,
    compactTrailing,
    minimal,
    expandedCenter: <Spacer minLength={0} />,
    expandedLeading,
    expandedTrailing,
    expandedBottom,
  };
}

export default createLiveActivity("OrderTrackingLive", OrderTrackingLive);
