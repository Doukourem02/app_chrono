import { create } from "zustand";

type State = {
  /** Socket commandes : reconnexions Socket.IO épuisées */
  socketDegraded: boolean;
  setSocketDegraded: (v: boolean) => void;
};

export const useRealtimeDegradedStore = create<State>((set) => ({
  socketDegraded: false,
  setSocketDegraded: (socketDegraded) => set({ socketDegraded }),
}));
