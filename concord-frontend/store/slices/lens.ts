import type { StateCreator } from 'zustand';

export interface LensSlice {
  activeLens: string;
  setActiveLens: (lens: string) => void;
}

export const createLensSlice: StateCreator<LensSlice, [], [], LensSlice> = (set) => ({
  activeLens: 'chat',
  setActiveLens: (lens) => set({ activeLens: lens }),
});
