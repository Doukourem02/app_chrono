import { create } from "zustand";

export type ActiveTrackingEtaPhase = "pickup" | "dropoff";

export type ActiveTrackingEta = {
  orderId: string;
  phase: ActiveTrackingEtaPhase;
  etaLabel: string | null;
  targetKind: ActiveTrackingEtaPhase;
  computedAt: number;
};

type ActiveTrackingEtaState = {
  etaByOrder: Record<string, ActiveTrackingEta>;
  setActiveTrackingEta: (value: ActiveTrackingEta) => void;
  clearActiveTrackingEta: (orderId: string) => void;
  clearAllActiveTrackingEta: () => void;
};

export const ACTIVE_TRACKING_ETA_FRESH_MS = 8_000;

export const useTrackingEtaStore = create<ActiveTrackingEtaState>((set) => ({
  etaByOrder: {},
  setActiveTrackingEta: (value) =>
    set((state) => ({
      etaByOrder: {
        ...state.etaByOrder,
        [value.orderId]: value,
      },
    })),
  clearActiveTrackingEta: (orderId) =>
    set((state) => {
      if (!state.etaByOrder[orderId]) return state;
      const next = { ...state.etaByOrder };
      delete next[orderId];
      return { etaByOrder: next };
    }),
  clearAllActiveTrackingEta: () => set({ etaByOrder: {} }),
}));

export function getActiveTrackingEta(orderId: string | null | undefined): ActiveTrackingEta | null {
  if (!orderId) return null;
  return useTrackingEtaStore.getState().etaByOrder[orderId] ?? null;
}

export function getFreshActiveTrackingEta(
  orderId: string | null | undefined,
  phase: ActiveTrackingEtaPhase | null,
  now = Date.now(),
): (ActiveTrackingEta & { isFresh: true }) | null {
  if (!orderId || !phase) return null;
  const value = getActiveTrackingEta(orderId);
  if (!value) return null;
  if (value.phase !== phase) return null;
  if (now - value.computedAt > ACTIVE_TRACKING_ETA_FRESH_MS) return null;
  return {
    ...value,
    isFresh: true,
  };
}
