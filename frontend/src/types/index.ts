/**
 * Shared base types. Domain/game types will be added in later steps.
 */
export type RouteId = string;
export type { Room, RoomPlayer, RoomStatus } from './room';
export type { AnswerStatus, FinalResult, FinalStatistics, GameState, GameStatus, QuestionResult, QuestionStatistics, RankingEntry } from './game';
