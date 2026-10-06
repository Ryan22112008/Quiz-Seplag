export const GAME_STATUSES = ['IN_PROGRESS', 'FINISHED'] as const;
export type GameStatus = (typeof GAME_STATUSES)[number];
export type GamePhase = 'WAITING' | 'QUESTION_ACTIVE' | 'QUESTION_RESULTS' | 'FINISHED';
export const RESULTS_DURATION_MS = 3_000;

/** Backend-owned execution record. Quiz questions and answers are never embedded in public game state. */
export interface Game {
  id: string;
  roomId: string;
  roomPin: string;
  quizId: string;
  status: GameStatus;
  phase: GamePhase;
  currentQuestionIndex: number;
  totalQuestions: number;
  currentQuestionId: string | null;
  questionStartedAt: string | null;
  questionEndsAt: string | null;
  resultsStartedAt: string | null;
  resultsEndsAt: string | null;
  startedAt: string;
  finishedAt: string | null;
  createdAt: string;
}

export interface PublicQuestionState {
  questionId: string;
  questionIndex: number;
  text: string;
  imageUrl?: string;
  options: ReadonlyArray<{ id: string; text: string; imageUrl?: string }>;
  timeLimit: number;
  questionRevealAt: string;
  questionStartedAt: string;
  questionEndsAt: string;
}

export interface PlayerAnswer {
  gameId: string;
  playerId: string;
  questionId: string;
  selectedOptionId: string;
  answeredAt: string;
  isCorrect: boolean;
  points: number;
}

export interface PlayerGameScore {
  gameId: string;
  playerId: string;
  score: number;
  answeredQuestions: number;
  correctAnswers: number;
}

export interface PublicRankingEntry {
  position: number;
  playerId: string;
  playerName: string;
  score: number;
  answeredQuestions: number;
  correctAnswers: number;
}

export interface AnswerSubmissionResult {
  accepted: true;
  isCorrect: boolean;
  points: number;
  totalScore: number;
}

/** Safe HTTP projection; deliberately omits the answer and all other quiz questions. */
export type PublicGameState = Readonly<Omit<Game, 'currentQuestionId'>> & {
  currentQuestion: PublicQuestionState | null;
};
