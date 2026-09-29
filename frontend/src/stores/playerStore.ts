import { create } from 'zustand';

interface PlayerState {
  playerName: string;
  roomPin: string;

  setPlayerName: (name: string) => void;
  setRoomPin: (pin: string) => void;

  clearPlayer: () => void;
}

/**
 * Player state for the join game flow.
 * Stores local player information without backend integration.
 */
export const usePlayerStore = create<PlayerState>((set) => ({
  playerName: '',
  roomPin: '',

  setPlayerName: (name) => set({ playerName: name }),
  setRoomPin: (pin) => set({ roomPin: pin }),

  clearPlayer: () => set({ playerName: '', roomPin: '' }),
}));
