import { create } from 'zustand';
import type { Room, RoomStatus } from '@/types/room';

interface RoomStore {
  rooms: Room[];
  createRoom: (quizId: string) => Room;
  getRoom: (pin: string) => Room | undefined;
  setRoomStatus: (pin: string, status: RoomStatus) => void;
  closeRoom: (pin: string) => void;
  clearRoom: (pin: string) => void;
  upsertRoom: (room: Room) => void;
  addPlayer: (pin: string, player: Room['players'][number]) => void;
  removePlayer: (pin: string, playerId: string) => void;
}

const STORAGE_KEY = 'quiz-seplag.rooms.v1';
const HOST_TOKEN_PREFIX = 'quiz-seplag.host-capability.v1.';
function loadRooms(): Room[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
    if (!Array.isArray(value)) return [];
    return value.filter((room): room is Room => typeof room === 'object' && room !== null &&
      typeof room.pin === 'string' && typeof room.quizId === 'string' && Array.isArray(room.players) &&
      ['waiting', 'starting', 'in-progress', 'finished'].includes(String(room.status)))
      .map((room) => ({ ...room, hostToken: sessionStorage.getItem(`${HOST_TOKEN_PREFIX}${room.pin}`) ?? undefined }));
  } catch { return []; }
}
function saveRooms(rooms: Room[]): void {
  try {
    for (const room of rooms) {
      if (room.hostToken) sessionStorage.setItem(`${HOST_TOKEN_PREFIX}${room.pin}`, room.hostToken);
      else if (room.status === 'finished') sessionStorage.removeItem(`${HOST_TOKEN_PREFIX}${room.pin}`);
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(rooms.map((room) => { const safe = { ...room }; delete safe.hostToken; return safe; })));
  } catch { /* The server snapshot remains available in this tab. */ }
}

/** Room projection cache. Persistent identities and PINs come from the API. */
export const useRoomStore = create<RoomStore>((set, get) => ({
  rooms: loadRooms(),
  createRoom: (quizId) => {
    const room: Room = { pin: '', quizId, status: 'waiting', players: [] };
    set((state) => { const rooms = [...state.rooms.filter((existing) => existing.quizId !== quizId), room]; saveRooms(rooms); return { rooms }; });
    return room;
  },
  getRoom: (pin) => get().rooms.find((room) => room.pin === pin),
  setRoomStatus: (pin, status) => set((state) => { const rooms = state.rooms.map((room) => room.pin === pin ? { ...room, status } : room); saveRooms(rooms); return { rooms }; }),
  closeRoom: (pin) => set((state) => { const rooms = state.rooms.map((room) => room.pin === pin ? { ...room, status: 'finished' as const } : room); saveRooms(rooms); return { rooms }; }),
  clearRoom: (pin) => set((state) => { const rooms = state.rooms.filter((room) => room.pin !== pin); try { sessionStorage.removeItem(`${HOST_TOKEN_PREFIX}${pin}`); } catch { /* Best effort cleanup. */ } saveRooms(rooms); return { rooms }; }),
  upsertRoom: (room) => set((state) => { const previous = state.rooms.find((item) => item.pin === room.pin); const merged = room.hostToken || !previous?.hostToken ? room : { ...room, hostToken: previous.hostToken }; const rooms = [...state.rooms.filter((item) => item.pin !== room.pin && item.quizId !== room.quizId), merged]; saveRooms(rooms); return { rooms }; }),
  addPlayer: (pin, player) => set((state) => { const rooms = state.rooms.map((room) => room.pin === pin && !room.players.some((item) => item.id === player.id)
    ? { ...room, players: [...room.players, player] } : room); saveRooms(rooms); return { rooms }; }),
  removePlayer: (pin, playerId) => set((state) => { const rooms = state.rooms.map((room) => room.pin === pin
    ? { ...room, players: room.players.filter((player) => player.id !== playerId) } : room); saveRooms(rooms); return { rooms }; }),
}));
