import type { FinalResult, FinalStatistics, QuestionResult, QuestionStatistics, RankingEntry } from './game';
import type { Room, RoomPlayer } from './room';

/** Pin identifies a room only within this local prototype. A backend must issue a separate room/session id. */
export type ServerEvent =
  | { type: 'ROOM_CREATED'; payload: { room: Room } }
  | { type: 'PLAYER_JOINED'; payload: { roomPin: string; player: RoomPlayer } }
  | { type: 'PLAYER_LEFT'; payload: { roomPin: string; playerId: string } }
  | { type: 'GAME_STARTED'; payload: { quizId: string; roomPin: string; totalQuestions: number } }
  | { type: 'QUESTION_STARTED'; payload: { roomPin: string; questionId: string; questionIndex: number; endsAt: number } }
  | { type: 'ANSWER_SUBMITTED'; payload: { roomPin: string; playerId: string; statistics?: QuestionStatistics } }
  | { type: 'QUESTION_ENDED'; payload: { roomPin: string; timedOut?: boolean } }
  | { type: 'QUESTION_RESULT'; payload: { roomPin: string; result: QuestionResult; statistics?: QuestionStatistics } }
  | { type: 'RANKING_UPDATED'; payload: { roomPin: string; ranking: RankingEntry[] } }
  | { type: 'GAME_FINISHED'; payload: { roomPin: string; result?: FinalResult; statistics?: FinalStatistics; ranking?: RankingEntry[] } }
  | { type: 'ROOM_CLOSED'; payload: { roomPin: string } };

/** Commands are outbound requests. The backend remains authoritative for timing, answers and scores. */
export type ClientCommand =
  | { type: 'JOIN_ROOM'; payload: { roomPin: string; playerName: string } }
  | { type: 'LEAVE_ROOM'; payload: { roomPin: string; playerId: string } }
  | { type: 'START_GAME'; payload: { roomPin: string } }
  | { type: 'SUBMIT_ANSWER'; payload: { roomPin: string; questionId: string; optionId: string } }
  | { type: 'END_QUESTION'; payload: { roomPin: string; questionId: string } }
  | { type: 'NEXT_QUESTION'; payload: { roomPin: string } }
  | { type: 'FINISH_GAME'; payload: { roomPin: string } };

export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'error';

/** Client values are presentation/input only. Server validates submissions and owns official time, correctness and ranking.
 * Do not send a correct option to a player before QUESTION_RESULT. endsAt is for visual synchronization only.
 * playerId is not available in this prototype; playerName is display input, roomPin locates a local room, and a future
 * server-issued room/session identifier must be kept separate from both. No authentication/session identity exists yet.
 */
