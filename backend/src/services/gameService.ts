import { randomUUID } from 'node:crypto';
import { DomainError } from '../domain/errors.js';
import { RESULTS_DURATION_MS, type AnswerSubmissionResult, type Game, type PlayerAnswer, type PublicGameState, type PublicQuestionState, type PublicRankingEntry } from '../domain/game.js';
import type { GameRepository } from '../repositories/gameRepository.js';
import type { QuizService } from './quizService.js';
import type { RoomService } from './roomService.js';

interface GameServiceDependencies { createId?: () => string; now?: () => string; nowMs?: () => number; onFinished?: (game: Game) => Promise<void> }

export class GameService {
  private readonly createId: () => string;
  private readonly nowMs: () => number;
  private readonly onFinished: ((game: Game) => Promise<void>) | undefined;

  constructor(
    private readonly repository: GameRepository,
    private readonly roomService: Pick<RoomService, 'getRoomByPin' | 'getRoomById' | 'setRoomStatus' | 'closeRoom'>,
    private readonly quizService: Pick<QuizService, 'getQuizById'>,
    dependencies: GameServiceDependencies = {},
  ) {
    this.createId = dependencies.createId ?? randomUUID;
    this.nowMs = dependencies.nowMs ?? (() => Date.parse(dependencies.now?.() ?? new Date().toISOString()));
    this.onFinished = dependencies.onFinished;
  }

  private timestamp(): string { return new Date(this.nowMs()).toISOString(); }

  private async publicState(game: Game): Promise<PublicGameState> {
    let currentQuestion: PublicQuestionState | null = null;
    if (game.currentQuestionId !== null && game.questionStartedAt !== null && game.questionEndsAt !== null) {
      const quiz = await this.quizService.getQuizById(game.quizId);
      const question = quiz.questions.find((item) => item.id === game.currentQuestionId);
      if (!question) throw new DomainError('QUESTION_NOT_STARTED', 409, 'A pergunta atual não foi encontrada no quiz.');
      currentQuestion = {
        questionId: question.id,
        questionIndex: game.currentQuestionIndex,
        text: question.question,
        ...(question.imageUrl ? { imageUrl: question.imageUrl } : {}),
        options: question.options.map(({ id, text, imageUrl }) => ({ id, text, ...(imageUrl ? { imageUrl } : {}) })),
        timeLimit: question.timeLimit,
        questionRevealAt: new Date(Date.parse(game.questionStartedAt) + (question.revealTime ?? 0) * 1000).toISOString(),
        questionStartedAt: game.questionStartedAt,
        questionEndsAt: game.questionEndsAt,
      };
    }
    return {
      id: game.id, roomId: game.roomId, roomPin: game.roomPin, quizId: game.quizId, status: game.status,
      phase: game.phase, resultsStartedAt: game.resultsStartedAt, resultsEndsAt: game.resultsEndsAt,
      currentQuestionIndex: game.currentQuestionIndex, totalQuestions: game.totalQuestions,
      questionStartedAt: game.questionStartedAt, questionEndsAt: game.questionEndsAt,
      currentQuestion, startedAt: game.startedAt, finishedAt: game.finishedAt, createdAt: game.createdAt,
    };
  }

  async startGame(roomPin: string): Promise<PublicGameState> {
    const room = await this.roomService.getRoomByPin(roomPin);
    if (await this.repository.findActiveByRoomId(room.id)) throw new DomainError('GAME_ALREADY_IN_PROGRESS', 409, 'Já existe uma partida em andamento nesta sala.');
    if (room.status !== 'WAITING' && room.status !== 'STARTING') throw new DomainError('ROOM_NOT_STARTABLE', 409, 'Esta sala não está em um estado que permita iniciar uma partida.');
    const quiz = await this.quizService.getQuizById(room.quizId);
    if (quiz.questions.length === 0) throw new DomainError('QUIZ_NOT_STARTABLE', 409, 'Adicione pelo menos uma pergunta ao quiz antes de iniciar a partida.');
    if (room.status === 'WAITING') await this.roomService.setRoomStatus(room.id, 'STARTING');
    await this.roomService.setRoomStatus(room.id, 'IN_PROGRESS');
    const timestamp = this.timestamp();
    const game: Game = {
      id: this.createId(), roomId: room.id, roomPin: room.pin, quizId: quiz.id, status: 'IN_PROGRESS',
      currentQuestionIndex: 0, totalQuestions: quiz.questions.length, currentQuestionId: null, phase: 'WAITING',
      questionStartedAt: null, questionEndsAt: null, resultsStartedAt: null, resultsEndsAt: null,
      startedAt: timestamp, finishedAt: null, createdAt: timestamp,
    };
    return this.publicState(await this.repository.create(game));
  }

  async getGame(roomPin: string): Promise<PublicGameState> {
    const room = await this.roomService.getRoomByPin(roomPin);
    const game = await this.repository.findByRoomId(room.id);
    if (!game) throw new DomainError('GAME_NOT_FOUND', 404, 'Ainda não existe uma partida para esta sala.');
    return this.publicState(game);
  }

  getGameState(roomPin: string): Promise<PublicGameState> { return this.getGame(roomPin); }

  async startQuestion(gameId: string): Promise<PublicGameState> {
    const game = await this.requireGame(gameId);
    if (game.status !== 'IN_PROGRESS') throw new DomainError('GAME_NOT_IN_PROGRESS', 409, 'A partida não está em andamento.');
    if (game.phase !== 'WAITING' || game.currentQuestionId !== null) throw new DomainError('QUESTION_ALREADY_ACTIVE', 409, 'Já existe uma pergunta ativa.');
    const quiz = await this.quizService.getQuizById(game.quizId);
    const question = quiz.questions[game.currentQuestionIndex];
    if (!question) throw new DomainError('QUESTION_NOT_STARTED', 409, 'Não há pergunta disponível para iniciar.');
    const startedMs = this.nowMs();
    const startedAt = new Date(startedMs).toISOString();
    const endsAt = new Date(startedMs + question.timeLimit * 1000).toISOString();
    const started = await this.repository.startQuestion(game.id, game.currentQuestionIndex, question.id, startedAt, endsAt);
    return this.publicState(started);
  }

  async getCurrentQuestion(roomPin: string): Promise<PublicQuestionState> {
    const state = await this.getGame(roomPin);
    if (!state.currentQuestion) throw new DomainError('QUESTION_NOT_STARTED', 409, 'A pergunta ainda não foi iniciada.');
    return state.currentQuestion;
  }

  async hasAnswered(roomPin: string, questionId: string, playerId: string): Promise<boolean> {
    const state = await this.getGame(roomPin);
    if (state.currentQuestion?.questionId !== questionId) return false;
    return Boolean(await this.repository.findAnswer(state.id, questionId, playerId));
  }

  /** Advances once every player still in the room has answered the revealed question. */
  async advanceIfAllAnswered(roomPin: string, questionId: string): Promise<{ state: PublicGameState; started: boolean } | null> {
    const room = await this.roomService.getRoomByPin(roomPin);
    const game = await this.repository.findByRoomId(room.id);
    if (!game || game.status !== 'IN_PROGRESS' || game.phase !== 'QUESTION_ACTIVE' || game.currentQuestionId !== questionId || !game.questionStartedAt) return null;
    if (room.players.length === 0) return null;
    const quiz = await this.quizService.getQuizById(game.quizId);
    const question = quiz.questions.find((item) => item.id === questionId);
    if (!question || this.nowMs() < Date.parse(game.questionStartedAt) + (question.revealTime ?? 0) * 1000) return null;
    const answers = await Promise.all(room.players.map((player) => this.repository.findAnswer(game.id, questionId, player.id)));
    if (answers.some((answer) => !answer)) return null;
    try {
      return await this.beginQuestionResults(game.id, questionId);
    } catch (error) {
      // A concurrent final answer or host action may have advanced the question first.
      if (error instanceof DomainError && ['QUESTION_STATE_CHANGED', 'QUESTION_NOT_STARTED', 'GAME_NOT_IN_PROGRESS'].includes(error.code)) return null;
      throw error;
    }
  }

  async beginQuestionResults(gameId: string, expectedQuestionId: string): Promise<{ state: PublicGameState; started: boolean }> {
    const game = await this.requireGame(gameId);
    if (game.phase === 'QUESTION_RESULTS' && game.currentQuestionId === expectedQuestionId) return { state: await this.publicState(game), started: false };
    if (game.status !== 'IN_PROGRESS' || game.phase !== 'QUESTION_ACTIVE' || game.currentQuestionId !== expectedQuestionId) {
      throw new DomainError('QUESTION_STATE_CHANGED', 409, 'A pergunta atual já foi alterada.');
    }
    const startedAtMs = this.nowMs();
    const results = await this.repository.enterResults(game.id, game.currentQuestionIndex, expectedQuestionId,
      new Date(startedAtMs).toISOString(), new Date(startedAtMs + RESULTS_DURATION_MS).toISOString());
    return { state: await this.publicState(results), started: true };
  }

  async advanceAfterResults(gameId: string): Promise<PublicGameState | null> {
    const game = await this.requireGame(gameId);
    if (game.phase !== 'QUESTION_RESULTS' || !game.currentQuestionId || !game.resultsEndsAt || this.nowMs() < Date.parse(game.resultsEndsAt)) return null;
    const quiz = await this.quizService.getQuizById(game.quizId);
    const nextQuestion = quiz.questions[game.currentQuestionIndex + 1] ?? null;
    const nowMs = this.nowMs();
    try {
      const advanced = await this.repository.advanceAfterResults(game.id, game.currentQuestionIndex, game.currentQuestionId,
        nextQuestion?.id ?? null, new Date(nowMs).toISOString(), nextQuestion ? new Date(nowMs + nextQuestion.timeLimit * 1000).toISOString() : null,
        nextQuestion ? null : new Date(nowMs).toISOString());
      if (advanced.status === 'FINISHED') { await this.onFinished?.(advanced); await this.roomService.closeRoom(game.roomId); }
      return this.publicState(advanced);
    } catch (error) {
      if (error instanceof DomainError && ['QUESTION_STATE_CHANGED', 'GAME_NOT_IN_PROGRESS'].includes(error.code)) return null;
      throw error;
    }
  }

  async isQuestionExpired(gameId: string): Promise<boolean> {
    const game = await this.requireGame(gameId);
    if (game.status !== 'IN_PROGRESS') throw new DomainError('GAME_NOT_IN_PROGRESS', 409, 'A partida não está em andamento.');
    if (!game.currentQuestionId || !game.questionEndsAt) throw new DomainError('QUESTION_NOT_STARTED', 409, 'Não há pergunta ativa.');
    return this.nowMs() >= Date.parse(game.questionEndsAt);
  }

  async submitAnswer(gameId: string, input: unknown): Promise<AnswerSubmissionResult> {
    if (!isRecord(input) || !hasExactKeys(input, ['playerId', 'questionId', 'optionId']) ||
      !isIdentifier(input.playerId) || !isIdentifier(input.questionId) || !isIdentifier(input.optionId)) {
      throw new DomainError('INVALID_ANSWER', 400, 'Envie somente playerId, questionId e optionId válidos.');
    }
    const game = await this.requireGame(gameId);
    if (game.status !== 'IN_PROGRESS') throw new DomainError('GAME_NOT_IN_PROGRESS', 409, 'A partida não está em andamento.');
    if (!game.currentQuestionId || !game.questionStartedAt || !game.questionEndsAt) {
      throw new DomainError('QUESTION_NOT_STARTED', 409, 'Não há pergunta ativa para responder.');
    }
    if (game.phase !== 'QUESTION_ACTIVE') throw new DomainError('QUESTION_NOT_ACTIVE', 409, 'A pergunta não está aceitando respostas.');
    const room = await this.roomService.getRoomById(game.roomId);
    const player = room.players.find((item) => item.id === input.playerId);
    if (!player) throw new DomainError('PLAYER_NOT_FOUND', 404, 'Jogador não pertence a esta sala.');
    const quiz = await this.quizService.getQuizById(game.quizId);
    if (!quiz.questions.some((item) => item.id === input.questionId)) {
      throw new DomainError('QUESTION_NOT_FOUND', 404, 'Pergunta não encontrada no quiz.');
    }
    if (input.questionId !== game.currentQuestionId) {
      throw new DomainError('QUESTION_NOT_CURRENT', 409, 'A resposta não corresponde à pergunta atual.');
    }
    const question = quiz.questions.find((item) => item.id === game.currentQuestionId);
    if (!question) throw new DomainError('QUESTION_NOT_FOUND', 404, 'Pergunta não encontrada no quiz.');
    if (!question.options.some((option) => option.id === input.optionId)) {
      throw new DomainError('OPTION_NOT_FOUND', 404, 'Alternativa não pertence à pergunta atual.');
    }
    const answeredMs = this.nowMs();
    const revealAt = Date.parse(game.questionStartedAt) + (question.revealTime ?? 0) * 1000;
    if (answeredMs < revealAt) {
      throw new DomainError('QUESTION_NOT_REVEALED', 409, 'As alternativas ainda não foram reveladas.');
    }
    if (answeredMs >= Date.parse(game.questionEndsAt)) {
      throw new DomainError('QUESTION_EXPIRED', 409, 'O tempo para responder esta pergunta terminou.');
    }
    const isCorrect = input.optionId === question.correctOptionId;
    const durationMs = Date.parse(game.questionEndsAt) - Date.parse(game.questionStartedAt);
    const remainingMs = Date.parse(game.questionEndsAt) - answeredMs;
    // Correct answers earn the question's base points scaled by remaining time; wrong answers earn zero.
    const points = isCorrect ? Math.min(question.points, Math.floor(question.points * remainingMs / durationMs)) : 0;
    const answer: PlayerAnswer = {
      gameId: game.id, playerId: input.playerId, questionId: question.id, selectedOptionId: input.optionId,
      answeredAt: new Date(answeredMs).toISOString(), isCorrect, points,
    };
    const recorded = await this.repository.submitAnswer(answer);
    return { accepted: true, isCorrect, points, totalScore: recorded.score.score };
  }

  async getRanking(roomPin: string): Promise<PublicRankingEntry[]> {
    const room = await this.roomService.getRoomByPin(roomPin);
    const game = await this.repository.findByRoomId(room.id);
    if (!game) throw new DomainError('GAME_NOT_FOUND', 404, 'Ainda não existe uma partida para esta sala.');
    const scores = new Map((await this.repository.listScores(game.id)).map((score) => [score.playerId, score]));
    const ranking = room.players.map((player) => {
      const score = scores.get(player.id);
      return { playerId: player.id, playerName: player.name, avatarCharacterId: player.avatarCharacterId ?? 'bear', avatarAccessoryId: player.avatarAccessoryId ?? 'none', score: score?.score ?? 0, answeredQuestions: score?.answeredQuestions ?? 0, correctAnswers: score?.correctAnswers ?? 0 };
    });
    ranking.sort((a, b) => b.score - a.score || b.correctAnswers - a.correctAnswers ||
      a.playerName.localeCompare(b.playerName, 'pt-BR', { sensitivity: 'base' }) || a.playerId.localeCompare(b.playerId));
    return ranking.map((entry, index) => ({ position: index + 1, ...entry }));
  }

  async nextQuestion(gameId: string, options: { skipCurrentQuestion?: boolean } = {}): Promise<PublicGameState> {
    const game = await this.requireGame(gameId);
    if (game.status !== 'IN_PROGRESS') throw new DomainError('GAME_NOT_IN_PROGRESS', 409, 'A partida não está em andamento.');
    if (!game.currentQuestionId || !game.questionEndsAt) throw new DomainError('QUESTION_NOT_STARTED', 409, 'Não há pergunta ativa.');
    const nowMs = this.nowMs();
    if (!options.skipCurrentQuestion && nowMs < Date.parse(game.questionEndsAt)) {
      throw new DomainError('QUESTION_NOT_EXPIRED', 409, 'O tempo da pergunta ainda não terminou.');
    }
    const quiz = await this.quizService.getQuizById(game.quizId);
    if (game.currentQuestionIndex + 1 >= quiz.questions.length) {
      const finished = await this.repository.finishAfterQuestion(game.id, game.currentQuestionIndex, game.currentQuestionId, new Date(nowMs).toISOString());
      await this.onFinished?.(finished);
      await this.roomService.closeRoom(game.roomId);
      return this.publicState(finished);
    }
    const next = quiz.questions[game.currentQuestionIndex + 1]!;
    const startedAt = new Date(nowMs).toISOString();
    const endsAt = new Date(nowMs + next.timeLimit * 1000).toISOString();
    const advanced = await this.repository.advanceQuestion(game.id, game.currentQuestionIndex, game.currentQuestionId, next.id, startedAt, endsAt);
    return this.publicState(advanced);
  }

  async finishGame(roomPin: string): Promise<PublicGameState> {
    const room = await this.roomService.getRoomByPin(roomPin);
    const game = await this.repository.findByRoomId(room.id);
    if (!game) throw new DomainError('GAME_NOT_FOUND', 404, 'Ainda não existe uma partida para esta sala.');
    if (game.status === 'FINISHED') throw new DomainError('GAME_ALREADY_FINISHED', 409, 'Esta partida já foi finalizada.');
    const finished = await this.repository.finish(game.id, this.timestamp());
    await this.onFinished?.(finished);
    await this.roomService.closeRoom(room.id);
    return this.publicState(finished);
  }

  private async requireGame(id: string): Promise<Game> {
    const game = await this.repository.findById(id);
    if (!game) throw new DomainError('GAME_NOT_FOUND', 404, 'Partida não encontrada.');
    return game;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function hasExactKeys(value: Record<string, unknown>, keys: string[]): boolean {
  return Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key));
}
function isIdentifier(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= 128;
}
