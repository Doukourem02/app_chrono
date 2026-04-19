import { Circle, HStack, Image, Link, RoundedRectangle, Spacer, Text, VStack, ZStack } from "@expo/ui/swift-ui";
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
 * Îlot étendu (inspiration type ride-hailing) : leading = marque + ETA + livreur,
 * center = espaceur, trailing = plaque + icône, bottom = statut + piste progression.
 *
 * Bannière verrouillage : deux bandes — haut : photo livreur + libellés + appel / SMS ;
 * séparateur ; bas : horloge + heure de référence + ETA mise en avant (style apps course).
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
    /** Accent actions / ETA bannière (proche ref. type Uber) */
    bannerAction: "#FF6B35",
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
  plateLabel?: string;
  isPending?: boolean;
  statusLabel?: string;
  progress?: number;
  /** URL https ou chemin `file://` pour la photo livreur (bannière). */
  driverAvatarUrl?: string;
  /** Chiffres / + pour `tel:` et `sms:` (sans préfixe). */
  driverPhone?: string;
  /** Heure affichée sous « Heure » (ex. création commande, formatée côté app). */
  bannerClockLabel?: string;
};

function bannerEtaParts(isPending: boolean, etaRaw: string): { value: string; unit: string } {
  if (isPending) return { value: "Recherche", unit: "" };
  const t = (etaRaw ?? "").trim();
  if (!t || t === "—") return { value: "—", unit: "" };
  const n = parseInt(t, 10);
  if (Number.isFinite(n) && String(n) === t) return { value: String(n), unit: " min" };
  const m = t.match(/^(\d+)\s*min\b/i);
  if (m) return { value: m[1], unit: " min" };
  return { value: t, unit: "" };
}

function OrderTrackingLive(props: OrderTrackingLiveProps, environment: LiveActivityEnvironment) {
  "widget";
  const ON_DARK = palette(environment);
  const ACTION = ON_DARK.bannerAction;
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

  const driverPhone = (props.driverPhone ?? "").trim();
  const avatarUrl = (props.driverAvatarUrl ?? "").trim();
  const clockText = (props.bannerClockLabel ?? "").trim() || "—";
  const etaParts = bannerEtaParts(props.isPending === true, etaDisplay);

  const bottomBar = (
    <VStack spacing={8} modifiers={[padding({ horizontal: 12, vertical: 10 })]}>
      <Text modifiers={[font({ size: 11 }), foregroundStyle(ON_DARK.muted), frame({ maxWidth: trackWidth, alignment: "leading" })]}>
        {statusLabel}
      </Text>
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

  const riderLabel = props.isPending === true ? "Livreur" : "Votre livreur";

  const avatarBlock = (
    <ZStack modifiers={[frame({ width: 52, height: 52 })]}>
      <Circle modifiers={[frame({ width: 52, height: 52 }), foregroundStyle(ON_DARK.bannerChip)]} />
      {avatarUrl ? (
        <Image uiImage={avatarUrl} modifiers={[frame({ width: 48, height: 48 })]} />
      ) : (
        <Image systemName="person.crop.circle.fill" color="#8E8E93" size={30} />
      )}
    </ZStack>
  );

  const telDest = driverPhone ? `tel:${driverPhone}` : "";
  const smsDest = driverPhone ? `sms:${driverPhone}` : "";

  const phoneChip = driverPhone ? (
    <Link destination={telDest} modifiers={[frame({ width: 44, height: 44 })]}>
      <ZStack modifiers={[frame({ width: 44, height: 44 })]}>
        <Circle modifiers={[frame({ width: 44, height: 44 }), foregroundStyle(ON_DARK.bannerChip)]} />
        <Image systemName="phone.fill" color={ACTION} size={18} />
      </ZStack>
    </Link>
  ) : (
    <ZStack modifiers={[frame({ width: 44, height: 44 })]}>
      <Circle modifiers={[frame({ width: 44, height: 44 }), foregroundStyle("#1C1C1E")]} />
      <Image systemName="phone.fill" color="#505050" size={18} />
    </ZStack>
  );

  const messageChip = driverPhone ? (
    <Link destination={smsDest} modifiers={[frame({ width: 44, height: 44 })]}>
      <ZStack modifiers={[frame({ width: 44, height: 44 })]}>
        <Circle modifiers={[frame({ width: 44, height: 44 }), foregroundStyle(ON_DARK.bannerChip)]} />
        <Image systemName="message.fill" color={ACTION} size={18} />
      </ZStack>
    </Link>
  ) : (
    <ZStack modifiers={[frame({ width: 44, height: 44 })]}>
      <Circle modifiers={[frame({ width: 44, height: 44 }), foregroundStyle("#1C1C1E")]} />
      <Image systemName="message.fill" color="#505050" size={18} />
    </ZStack>
  );

  const bannerTopRow = (
    <HStack spacing={12} modifiers={[padding({ horizontal: 4, vertical: 2 })]}>
      {avatarBlock}
      <VStack spacing={3} modifiers={[frame({ alignment: "leading" })]}>
        <Text modifiers={[font({ size: 11, weight: "medium" }), foregroundStyle(ON_DARK.muted)]}>{riderLabel}</Text>
        <Text modifiers={[font({ weight: "bold", size: 17 }), foregroundStyle(ON_DARK.title)]}>{vehicle}</Text>
      </VStack>
      <Spacer minLength={0} />
      <HStack spacing={10}>
        {phoneChip}
        {messageChip}
      </HStack>
    </HStack>
  );

  const bannerDivider = (
    <RoundedRectangle cornerRadius={0.5} modifiers={[frame({ width: 320, height: 1 }), foregroundStyle("#3A3A3C")]} />
  );

  const bannerBottomRow = (
    <HStack spacing={12} modifiers={[padding({ horizontal: 4, top: 6, bottom: 2 })]}>
      <HStack spacing={10}>
        <ZStack modifiers={[frame({ width: 36, height: 36 })]}>
          <Circle modifiers={[frame({ width: 36, height: 36 }), foregroundStyle(ON_DARK.bannerChip)]} />
          <Image systemName="clock.fill" color={ACTION} size={16} />
        </ZStack>
        <VStack spacing={2} modifiers={[frame({ alignment: "leading" })]}>
          <Text modifiers={[font({ size: 10, weight: "medium" }), foregroundStyle(ON_DARK.muted)]}>Heure</Text>
          <Text modifiers={[font({ weight: "semibold", size: 15 }), foregroundStyle(ON_DARK.title)]}>{clockText}</Text>
        </VStack>
      </HStack>
      <Spacer minLength={0} />
      <HStack spacing={2} modifiers={[frame({ alignment: "trailing" })]}>
        <Text modifiers={[font({ weight: "bold", size: 28 }), foregroundStyle(ACTION)]}>{etaParts.value}</Text>
        {etaParts.unit ? (
          <Text modifiers={[font({ weight: "bold", size: 16 }), foregroundStyle(ACTION)]}>{etaParts.unit}</Text>
        ) : null}
      </HStack>
    </HStack>
  );

  const banner = (
    <VStack spacing={8} modifiers={[padding({ horizontal: 12, vertical: 12 })]}>
      {bannerTopRow}
      {bannerDivider}
      {bannerBottomRow}
    </VStack>
  );

  const compactLeading = <Image systemName="car.fill" color={ON_DARK.accent} size={18} />;
  const compactTrailing = (
    <Text modifiers={[font({ weight: "bold", size: 14 }), foregroundStyle(ON_DARK.title)]}>{compactTitle}</Text>
  );
  const minimal = <Image systemName="car.fill" color={ON_DARK.accent} size={16} />;

  const etaSize = simplified ? 22 : 26;
  const subSize = simplified ? 13 : 14;
  const plateSize = simplified ? 13 : 14;
  const iconSize = simplified ? 20 : 22;
  const pad = simplified ? 8 : 10;
  const plateWidth = simplified ? 120 : 138;
  const plateHeight = simplified ? 34 : 38;
  const leadPad = simplified ? 6 : 8;

  const expandedTripColumn = (
    <VStack spacing={4} modifiers={[padding({ leading: leadPad, trailing: 6, top: pad, bottom: pad }), frame({ maxWidth: 200, alignment: "leading" })]}>
      <Text modifiers={[font({ weight: "bold", size: simplified ? 12 : 13 }), foregroundStyle(ON_DARK.brand)]}>KRONO</Text>
      <Text modifiers={[font({ weight: "bold", size: etaSize }), foregroundStyle(ON_DARK.title)]}>{etaDisplay}</Text>
      <Text modifiers={[font({ size: subSize }), foregroundStyle(ON_DARK.body), frame({ alignment: "leading" })]}>{vehicle}</Text>
    </VStack>
  );

  const plateFrame = (
    <ZStack>
      <RoundedRectangle
        cornerRadius={10}
        modifiers={[frame({ width: plateWidth + 4, height: plateHeight + 4 }), foregroundStyle(ON_DARK.plateBorder)]}
      />
      <RoundedRectangle
        cornerRadius={8}
        modifiers={[frame({ width: plateWidth, height: plateHeight }), foregroundStyle(ON_DARK.plateBg)]}
      />
      <Text modifiers={[font({ weight: "bold", size: plateSize }), foregroundStyle(ON_DARK.plateText)]}>{plate}</Text>
    </ZStack>
  );

  return {
    banner,
    compactLeading,
    compactTrailing,
    minimal,
    expandedCenter: <Spacer minLength={0} />,
    expandedLeading: expandedTripColumn,
    expandedTrailing: (
      <VStack spacing={6} modifiers={[padding({ leading: 6, trailing: leadPad, top: pad, bottom: pad }), frame({ alignment: "trailing" })]}>
        {plateFrame}
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
