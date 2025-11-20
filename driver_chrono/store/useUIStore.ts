import { create } from 'zustand';

interface UIStore {
  hideTabBar: boolean;
  setHideTabBar: (hide: boolean) => void;
}

export const useUIStore = create<UIStore>((set) => ({
  hideTabBar: false,
  setHideTabBar: (hide: boolean) => set({ hideTabBar: hide }),
}));

