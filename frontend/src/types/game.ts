export type GameStatus = 'waiting' | 'question' | 'locked' | 'results' | 'finished';
export type AnswerStatus = 'idle' | 'selected' | 'submitted';

export interface QuestionResult {
  correctOptionId: string;
  correct?: boolean;
  points?: number;
}

export interface RankingEntry {
  position: number;
  playerId: string;
  playerName: string;
  score: number;
  correctAnswers?: number;
}

export interface FinalResult {
  score?: number;
  position?: number;
  totalPlayers?: number;
}

export interface QuestionStatistics {
  totalResponses?: number;
  correctResponses?: number;
  responsesByOption?: Record<string, number>;
}

export interface FinalStatistics {
  totalAnswers?: number;
  accuracyRate?: number;
  highestScore?: number;
}

/** Local projection of a game. Transport events can later populate the same fields. */
export interface GameState {
  quizId: string;
  roomPin: string;
  currentQuestionIndex: number;
  totalQuestions: number;
  status: GameStatus;
  endsAt: number | null;
  answerStatus: AnswerStatus;
  selectedOptionId: string | null;
  answerTimedOut: boolean;
  questionResult: QuestionResult | null;
  ranking: RankingEntry[];
  finalResult: FinalResult | null;
  questionStatistics: QuestionStatistics | null;
  finalStatistics: FinalStatistics | null;
  gameId?: string;
  currentQuestionId?: string | null;
  questionEndsAt?: string | null;
  currentQuestion?: { questionId: string; questionIndex: number; text: string; imageUrl?: string; options: Array<{ id: string; text: string; imageUrl?: string }>; timeLimit: number; questionRevealAt: string; questionStartedAt: string; questionEndsAt: string } | null;
}
