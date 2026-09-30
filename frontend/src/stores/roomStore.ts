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

function generatePin(existingPins: string[]): string {
  const random = new Uint32Array(1);
  let pin: string;
  do {
    crypto.getRandomValues(random);
    pin = String(100000 + (random[0] % 900000));
  } while (existingPins.includes(pin));
  return pin;
}

/** In-memory only; this store does not represent a server-backed room. */
export const useRoomStore = create<RoomStore>((set, get) => ({
  rooms: [],
  createRoom: (quizId) => {
    const room: Room = { pin: generatePin(get().rooms.map(({ pin }) => pin)), quizId, status: 'waiting', players: [] };
    set((state) => ({ rooms: [...state.rooms.filter((existing) => existing.quizId !== quizId), room] }));
    return room;
  },
  getRoom: (pin) => get().rooms.find((room) => room.pin === pin),
  setRoomStatus: (pin, status) => set((state) => ({
    rooms: state.rooms.map((room) => room.pin === pin ? { ...room, status } : room),
  })),
  closeRoom: (pin) => set((state) => ({
    rooms: state.rooms.map((room) => room.pin === pin ? { ...room, status: 'finished', players: [] } : room),
  })),
  clearRoom: (pin) => set((state) => ({ rooms: state.rooms.filter((room) => room.pin !== pin) })),
  upsertRoom: (room) => set((state) => ({ rooms: [...state.rooms.filter((item) => item.pin !== room.pin), room] })),
  addPlayer: (pin, player) => set((state) => ({
    rooms: state.rooms.map((room) => room.pin === pin && !room.players.some((item) => item.id === player.id)
      ? { ...room, players: [...room.players, player] } : room),
  })),
  removePlayer: (pin, playerId) => set((state) => ({
    rooms: state.rooms.map((room) => room.pin === pin
      ? { ...room, players: room.players.filter((player) => player.id !== playerId) } : room),
  })),
}));
