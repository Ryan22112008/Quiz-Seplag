import type { RoomPlayer } from './player.js';

export const ROOM_STATUSES = ['WAITING', 'STARTING', 'IN_PROGRESS', 'FINISHED'] as const;
export type RoomStatus = (typeof ROOM_STATUSES)[number];

export interface Room {
  id: string;
  pin: string;
  quizId: string;
  status: RoomStatus;
  players: RoomPlayer[];
}
