import type { GameState, RankingEntry } from './game';
import type { Room, RoomPlayer } from './room';

/** Events received by participants in a room. */
export type ServerEvent =
  | { type: 'ROOM_CREATED'; payload: { room: Room; hostToken: string } }
  | { type: 'PLAYER_JOINED'; payload: { roomPin: string; player: RoomPlayer } }
  | { type: 'PLAYER_LEFT'; payload: { roomPin: string; playerId: string } }
  | { type: 'GAME_STARTED'; payload: { quizId: string; roomPin: string; totalQuestions: number } }
  | { type: 'ROOM_SUBSCRIBED'; payload: { roomPin: string; role: 'host' | 'player'; playerToken?: string } }
  | { type: 'ROOM_SYNCED'; payload: { room: Room; game: { id: string; roomId: string; roomPin: string; quizId: string; status: 'IN_PROGRESS' | 'FINISHED'; phase: 'WAITING' | 'QUESTION_ACTIVE' | 'QUESTION_RESULTS' | 'FINISHED'; currentQuestionIndex: number; totalQuestions: number; currentQuestion: GameState['currentQuestion']; questionStartedAt: string | null; questionEndsAt: string | null; resultsStartedAt: string | null; resultsEndsAt: string | null } | null; ranking: RankingEntry[]; hasAnsweredCurrentQuestion: boolean; questionEnded: boolean } }
  | { type: 'REALTIME_ERROR'; payload: { code: string; message: string } }
  | { type: 'QUESTION_STARTED'; payload: { roomPin: string; questionId: string; questionIndex: number; endsAt: number; gameId: string; question: { questionId: string; questionIndex: number; text: string; imageUrl?: string; options: Array<{ id: string; text: string; imageUrl?: string }>; timeLimit: number; questionRevealAt: string; questionStartedAt: string; questionEndsAt: string }; questionStartedAt: string; questionEndsAt: string } }
  | { type: 'ANSWER_SUBMITTED'; payload: { roomPin: string; playerId: string } }
  | { type: 'QUESTION_ENDED'; payload: { roomPin: string; timedOut: boolean } }
  | { type: 'QUESTION_RESULTS'; payload: { roomPin: string; questionId: string; ranking: RankingEntry[]; resultsStartedAt: string; resultsEndsAt: string } }
  | { type: 'RANKING_UPDATED'; payload: { roomPin: string; ranking: RankingEntry[] } }
  | { type: 'GAME_FINISHED'; payload: { roomPin: string; ranking: RankingEntry[] } }
  | { type: 'ROOM_CLOSED'; payload: { roomPin: string } };

/** Actions participants can send to a room. */
export type ClientCommand =
  | { type: 'CREATE_ROOM'; payload: { quizId: string } }
  | { type: 'JOIN_ROOM'; payload: { roomPin: string; playerName: string } }
  | { type: 'SUBSCRIBE_GAME'; payload: { roomPin: string; playerId?: string; playerToken?: string; hostToken?: string } }
  | { type: 'LEAVE_ROOM'; payload: { roomPin: string; playerId?: string } }
  | { type: 'START_GAME'; payload: { roomPin: string } }
  | { type: 'START_QUESTION'; payload: { roomPin: string } }
  | { type: 'SUBMIT_ANSWER'; payload: { roomPin: string; questionId: string; optionId: string } }
  | { type: 'END_QUESTION'; payload: { roomPin: string; questionId: string } }
  | { type: 'NEXT_QUESTION'; payload: { roomPin: string } }
  | { type: 'FINISH_GAME'; payload: { roomPin: string } }
  | { type: 'CLOSE_ROOM'; payload: { roomPin: string } };

export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'syncing' | 'synced' | 'error';
