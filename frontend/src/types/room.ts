export interface RoomPlayer {
  id: string;
  name: string;
}

export type RoomStatus = 'waiting' | 'starting' | 'in-progress' | 'finished';

/** Local-only room state. A future backend will own room identity and membership. */
export interface Room {
  pin: string;
  quizId: string;
  status: RoomStatus;
  players: RoomPlayer[];
}
