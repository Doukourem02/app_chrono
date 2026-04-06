import { create } from "zustand";

type State = {
  ordersSocketDegraded: boolean;
  messagesSocketDegraded: boolean;
  setOrdersSocketDegraded: (v: boolean) => void;
  setMessagesSocketDegraded: (v: boolean) => void;
};

export const useRealtimeDegradedStore = create<State>((set) => ({
  ordersSocketDegraded: false,
  messagesSocketDegraded: false,
  setOrdersSocketDegraded: (ordersSocketDegraded) => set({ ordersSocketDegraded }),
  setMessagesSocketDegraded: (messagesSocketDegraded) => set({ messagesSocketDegraded }),
}));
