import { SkeletonLoader } from "@/components/animations";

/**
 * Affiché pendant le chargement RSC d’une page du dashboard : évite l’écran vide
 * qui donne l’impression d’un rechargement complet du navigateur.
 */
export default function DashboardSegmentLoading() {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 16,
        width: "100%",
        paddingTop: 8,
      }}
      aria-busy
      aria-label="Chargement"
    >
      <SkeletonLoader width="min(100%, 420px)" height={40} borderRadius={10} />
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
        <SkeletonLoader width={140} height={88} borderRadius={12} />
        <SkeletonLoader width={140} height={88} borderRadius={12} />
        <SkeletonLoader width={140} height={88} borderRadius={12} />
        <SkeletonLoader width={140} height={88} borderRadius={12} />
      </div>
      <SkeletonLoader width="100%" height={220} borderRadius={12} />
    </div>
  );
}
