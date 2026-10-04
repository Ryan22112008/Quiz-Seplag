import { create } from 'zustand';
import type { ConnectionState } from '@/types/realtime';

interface RealtimeState {
  connectionState: ConnectionState;
  roomPin: string | null;
  playerId: string | null;
  role: 'host' | 'player' | null;
  subscribed: boolean;
  setConnectionState: (state: ConnectionState) => void;
  setSession: (session: { roomPin: string; playerId?: string; role: 'host' | 'player' }) => void;
  clearSession: () => void;
  setSyncing: () => void;
  setSynced: () => void;
}

/** No transport is connected in this frontend stage; disconnected is the truthful initial state. */
export const useRealtimeStore = create<RealtimeState>((set) => ({
  connectionState: 'disconnected',
  roomPin: null,
  playerId: null,
  role: null,
  subscribed: false,
  setConnectionState: (connectionState) => set({ connectionState }),
  setSession: ({ roomPin, playerId, role }) => set({ roomPin, playerId: playerId ?? null, role, subscribed: true, connectionState: 'syncing' }),
  clearSession: () => set({ roomPin: null, playerId: null, role: null, subscribed: false }),
  setSyncing: () => set({ connectionState: 'syncing', subscribed: true }),
  setSynced: () => set({ connectionState: 'synced', subscribed: true }),
}));
