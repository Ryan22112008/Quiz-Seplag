import { create } from 'zustand';
import type {
  FinalResult,
  FinalStatistics,
  GameState,
  QuestionResult,
  QuestionStatistics,
  RankingEntry,
} from '@/types/game';

interface GameStore {
  games: Record<string, GameState>;
  getGame: (roomPin: string) => GameState | undefined;
  startGame: (quizId: string, roomPin: string, totalQuestions: number) => void;
  applyQuestion: (roomPin: string, gameId: string, quizId: string, totalQuestions: number, question: NonNullable<GameState['currentQuestion']>) => void;
  syncGame: (input: { roomPin: string; gameId: string; quizId: string; currentQuestionIndex: number; totalQuestions: number; gameStatus: 'IN_PROGRESS' | 'FINISHED'; question: GameState['currentQuestion']; ranking: RankingEntry[]; hasAnswered: boolean; questionEnded: boolean }) => void;
  selectOption: (roomPin: string, optionId: string) => void;
  submitAnswer: (roomPin: string) => void;
  lockQuestion: (roomPin: string, timedOut?: boolean) => void;
  revealResults: (roomPin: string) => void;
  setQuestionResult: (roomPin: string, result: QuestionResult) => void;
  setRanking: (roomPin: string, ranking: RankingEntry[]) => void;
  setQuestionStatistics: (roomPin: string, statistics: QuestionStatistics) => void;
  setFinalResult: (roomPin: string, result: FinalResult) => void;
  setFinalStatistics: (roomPin: string, statistics: FinalStatistics) => void;
  finishGame: (roomPin: string) => void;
  resetGame: (roomPin?: string) => void;
}

/**
 * Local game state only. These actions are future event entry points:
 * applyQuestion→QUESTION_STARTED, submitAnswer→ANSWER_SUBMITTED,
 * lockQuestion→QUESTION_ENDED, setQuestionResult→QUESTION_RESULT,
 * setRanking→RANKING_UPDATED, finishGame→GAME_FINISHED.
 */
export const useGameStore = create<GameStore>((set, get) => ({
  games: {},
  getGame: (roomPin) => get().games[roomPin],
  startGame: (quizId, roomPin, totalQuestions) => {
    set((state) => ({
      games: {
        ...state.games,
        [roomPin]: {
          quizId,
          roomPin,
          currentQuestionIndex: 0,
          totalQuestions,
          status: 'waiting',
          endsAt: null,
          answerStatus: 'idle',
          selectedOptionId: null,
          answerTimedOut: false,
          questionResult: null,
          ranking: [],
          finalResult: null,
          questionStatistics: null,
          finalStatistics: null,
          currentQuestionId: null,
          questionEndsAt: null,
          currentQuestion: null,
        },
      },
    }));
  },
  applyQuestion: (roomPin, gameId, quizId, totalQuestions, question) => set((state) => {
    const previous = state.games[roomPin];
    const endsAt = Date.parse(question.questionEndsAt);
    return { games: { ...state.games, [roomPin]: {
      ...(previous ?? { answerStatus: 'idle' as const, selectedOptionId: null, answerTimedOut: false, questionResult: null, ranking: [], finalResult: null, questionStatistics: null, finalStatistics: null }),
      quizId, roomPin, gameId, totalQuestions, currentQuestionIndex: question.questionIndex,
      currentQuestionId: question.questionId, questionEndsAt: question.questionEndsAt, currentQuestion: question,
      status: 'question', endsAt,
      answerStatus: 'idle', selectedOptionId: null, answerTimedOut: false, questionResult: null,
      questionStatistics: null,
    } } };
  }),
  syncGame: ({ roomPin, gameId, quizId, currentQuestionIndex, totalQuestions, gameStatus, question, ranking, hasAnswered, questionEnded }) => set((state) => {
    const endsAt = question?.questionEndsAt ? Date.parse(question.questionEndsAt) : null;
    const status = gameStatus === 'FINISHED' ? 'finished' : question ? (questionEnded ? 'locked' : 'question') : 'waiting';
    const previous = state.games[roomPin];
    return { games: { ...state.games, [roomPin]: {
      quizId, roomPin, gameId, currentQuestionIndex, totalQuestions, status,
      endsAt: status === 'question' ? endsAt : null,
      answerStatus: hasAnswered ? 'submitted' : 'idle', selectedOptionId: null,
      answerTimedOut: questionEnded && !hasAnswered, questionResult: null, ranking,
      finalResult: previous?.finalResult ?? null, questionStatistics: null, finalStatistics: previous?.finalStatistics ?? null,
      currentQuestionId: question?.questionId ?? null, questionEndsAt: question?.questionEndsAt ?? null,
      currentQuestion: question ?? null,
    } } };
  }),
  selectOption: (roomPin, optionId) => set((state) => {
    const game = state.games[roomPin];
    if (!game || game.status !== 'question' || game.answerStatus === 'submitted') return state;
    return { games: { ...state.games, [roomPin]: { ...game, answerStatus: 'selected', selectedOptionId: optionId } } };
  }),
  submitAnswer: (roomPin) => set((state) => {
    const game = state.games[roomPin];
    if (!game || game.status !== 'question' || game.answerStatus !== 'selected' || !game.selectedOptionId) return state;
    return { games: { ...state.games, [roomPin]: { ...game, answerStatus: 'submitted' } } };
  }),
  lockQuestion: (roomPin, timedOut = false) => set((state) => {
    const game = state.games[roomPin];
    if (!game || game.status !== 'question') return state;
    return { games: { ...state.games, [roomPin]: {
      ...game,
      status: 'locked',
      endsAt: null,
      answerTimedOut: timedOut && game.answerStatus !== 'submitted',
    } } };
  }),
  revealResults: (roomPin) => set((state) => {
    const game = state.games[roomPin];
    if (!game || game.status !== 'locked') return state;
    return { games: { ...state.games, [roomPin]: { ...game, status: 'results' } } };
  }),
  setQuestionResult: (roomPin, result) => set((state) => {
    const game = state.games[roomPin];
    return game ? { games: { ...state.games, [roomPin]: { ...game, questionResult: result, status: 'results' } } } : state;
  }),
  setRanking: (roomPin, ranking) => set((state) => {
    const game = state.games[roomPin];
    return game ? { games: { ...state.games, [roomPin]: { ...game, ranking } } } : state;
  }),
  setQuestionStatistics: (roomPin, questionStatistics) => set((state) => {
    const game = state.games[roomPin];
    return game ? { games: { ...state.games, [roomPin]: { ...game, questionStatistics } } } : state;
  }),
  setFinalResult: (roomPin, finalResult) => set((state) => {
    const game = state.games[roomPin];
    return game ? { games: { ...state.games, [roomPin]: { ...game, finalResult } } } : state;
  }),
  setFinalStatistics: (roomPin, finalStatistics) => set((state) => {
    const game = state.games[roomPin];
    return game ? { games: { ...state.games, [roomPin]: { ...game, finalStatistics } } } : state;
  }),
  finishGame: (roomPin) => set((state) => {
    const game = state.games[roomPin];
    return game ? { games: { ...state.games, [roomPin]: { ...game, status: 'finished', endsAt: null } } } : state;
  }),
  resetGame: (roomPin) => set((state) => {
    if (!roomPin) return { games: {} };
    const games = { ...state.games };
    delete games[roomPin];
    return { games };
  }),
}));
