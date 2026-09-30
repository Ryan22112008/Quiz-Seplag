import { create } from 'zustand';
import type { ConnectionState } from '@/types/realtime';

interface RealtimeState {
  connectionState: ConnectionState;
  setConnectionState: (state: ConnectionState) => void;
}

/** No transport is connected in this frontend stage; disconnected is the truthful initial state. */
export const useRealtimeStore = create<RealtimeState>((set) => ({
  connectionState: 'disconnected',
  setConnectionState: (connectionState) => set({ connectionState }),
}));
