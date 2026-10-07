export interface RoomPlayer {
  id: string;
  name: string;
  avatarCharacterId?: string;
  avatarAccessoryId?: string;
}

export type RoomStatus = 'waiting' | 'starting' | 'in-progress' | 'finished';

/** Client-side room projection and local host capability for reconnecting the same room. */
export interface Room {
  id?: string;
  pin: string;
  quizId: string;
  status: RoomStatus;
  players: RoomPlayer[];
  hostToken?: string;
}
