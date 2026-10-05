import { create } from 'zustand';

interface PlayerState {
  playerName: string;
  roomPin: string;
  playerId: string;
  roomId: string;
  playerToken: string;

  setPlayerName: (name: string) => void;
  setRoomPin: (pin: string) => void;
  setIdentity: (identity: { playerId: string; roomId: string; roomPin: string; playerName: string; playerToken: string }) => void;

  clearPlayer: () => void;
}

const STORAGE_KEY = 'quiz-seplag.player-session.v1';
const TOKEN_KEY = 'quiz-seplag.player-capability.v1';
function readIdentity(): Pick<PlayerState, 'playerName' | 'roomPin' | 'playerId' | 'roomId' | 'playerToken'> {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null');
    if (typeof value === 'object' && value !== null && 'playerName' in value && 'roomPin' in value && 'playerId' in value && 'roomId' in value &&
      typeof value.playerName === 'string' && typeof value.roomPin === 'string' && typeof value.playerId === 'string' && typeof value.roomId === 'string') {
      return { playerName: value.playerName, roomPin: value.roomPin, playerId: value.playerId, roomId: value.roomId, playerToken: sessionStorage.getItem(TOKEN_KEY) ?? '' };
    }
  } catch { /* Storage may be disabled or contain stale data. */ }
  return { playerName: '', roomPin: '', playerId: '', roomId: '', playerToken: '' };
}
function saveIdentity(identity: Pick<PlayerState, 'playerName' | 'roomPin' | 'playerId' | 'roomId'>): void {
  try {
    if (identity.playerId && identity.roomPin) localStorage.setItem(STORAGE_KEY, JSON.stringify({ playerName: identity.playerName, roomPin: identity.roomPin, playerId: identity.playerId, roomId: identity.roomId }));
    else localStorage.removeItem(STORAGE_KEY);
  } catch { /* The current tab can still continue without persistent browser storage. */ }
}

/**
 * Player identity and active room session for the join game flow.
 */
export const usePlayerStore = create<PlayerState>((set) => ({
  ...readIdentity(),

  setPlayerName: (name) => set((state) => { const next = { ...state, playerName: name }; saveIdentity(next); return next; }),
  setRoomPin: (pin) => set((state) => { const next = { ...state, roomPin: pin }; saveIdentity(next); return next; }),
  setIdentity: (identity) => { saveIdentity(identity); try { sessionStorage.setItem(TOKEN_KEY, identity.playerToken); } catch { /* Current session can still continue in memory. */ } set(identity); },

  clearPlayer: () => { saveIdentity({ playerName: '', roomPin: '', playerId: '', roomId: '' }); try { sessionStorage.removeItem(TOKEN_KEY); } catch { /* Best effort cleanup. */ } set({ playerName: '', roomPin: '', playerId: '', roomId: '', playerToken: '' }); },
}));
