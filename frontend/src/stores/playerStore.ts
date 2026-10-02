import { create } from 'zustand';

interface PlayerState {
  playerName: string;
  roomPin: string;
  playerId: string;
  roomId: string;

  setPlayerName: (name: string) => void;
  setRoomPin: (pin: string) => void;
  setIdentity: (identity: { playerId: string; roomId: string; roomPin: string; playerName: string }) => void;

  clearPlayer: () => void;
}

/**
 * Player state for the join game flow.
 * Stores local player information without backend integration.
 */
export const usePlayerStore = create<PlayerState>((set) => ({
  playerName: '',
  roomPin: '',
  playerId: '',
  roomId: '',

  setPlayerName: (name) => set({ playerName: name }),
  setRoomPin: (pin) => set({ roomPin: pin }),
  setIdentity: (identity) => set(identity),

  clearPlayer: () => set({ playerName: '', roomPin: '', playerId: '', roomId: '' }),
}));
