import { create } from "zustand";

type State = {
  /** Incrémenté après un refetch livraisons (liste accueil) */
  deliveriesListBump: number;
  bumpDeliveriesList: () => void;
};

export const useUserDataResyncStore = create<State>((set) => ({
  deliveriesListBump: 0,
  bumpDeliveriesList: () =>
    set((s) => ({ deliveriesListBump: s.deliveriesListBump + 1 })),
}));
