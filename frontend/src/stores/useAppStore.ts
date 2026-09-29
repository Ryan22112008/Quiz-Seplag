import { create } from 'zustand';

interface AppState {
  isInitialized: boolean;
  setInitialized: (value: boolean) => void;
}

/**
 * Minimal global store placeholder.
 * No domain/game logic in this step — only app shell state.
 */
export const useAppStore = create<AppState>((set) => ({
  isInitialized: false,
  setInitialized: (value) => set({ isInitialized: value }),
}));
