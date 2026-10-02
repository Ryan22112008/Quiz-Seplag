import { DomainError } from '../domain/errors.js';
import type { Game, PlayerAnswer, PlayerGameScore } from '../domain/game.js';

export interface GameRepository {
  create(game: Game): Promise<Game>;
  findById(id: string): Promise<Game | undefined>;
  findByRoomId(roomId: string): Promise<Game | undefined>;
  findActiveByRoomId(roomId: string): Promise<Game | undefined>;
  update(game: Game): Promise<Game>;
  finish(id: string, finishedAt: string): Promise<Game>;
  startQuestion(id: string, expectedIndex: number, questionId: string, startedAt: string, endsAt: string): Promise<Game>;
  advanceQuestion(id: string, expectedIndex: number, expectedQuestionId: string, questionId: string, startedAt: string, endsAt: string): Promise<Game>;
  finishAfterQuestion(id: string, expectedIndex: number, expectedQuestionId: string, finishedAt: string): Promise<Game>;
  submitAnswer(answer: PlayerAnswer): Promise<{ answer: PlayerAnswer; score: PlayerGameScore }>;
  findAnswer(gameId: string, questionId: string, playerId: string): Promise<PlayerAnswer | undefined>;
  listScores(gameId: string): Promise<PlayerGameScore[]>;
  delete(id: string): Promise<boolean>;
}

function clone(game: Game): Game { return { ...game }; }

/** In-memory until a Game table is introduced in a later persistence migration. */
export class InMemoryGameRepository implements GameRepository {
  private readonly games = new Map<string, Game>();
  private readonly answers = new Map<string, PlayerAnswer>();
  private readonly scores = new Map<string, PlayerGameScore>();

  private answerKey(gameId: string, questionId: string, playerId: string): string { return `${gameId}\u0000${questionId}\u0000${playerId}`; }
  private scoreKey(gameId: string, playerId: string): string { return `${gameId}\u0000${playerId}`; }

  async create(game: Game): Promise<Game> {
    if (this.games.has(game.id)) throw new DomainError('GAME_ID_CONFLICT', 409, 'O identificador da partida já está em uso.');
    if (game.status === 'IN_PROGRESS' && [...this.games.values()].some((current) => current.roomId === game.roomId && current.status === 'IN_PROGRESS')) {
      throw new DomainError('GAME_ALREADY_IN_PROGRESS', 409, 'Já existe uma partida em andamento nesta sala.');
    }
    const saved = clone(game);
    this.games.set(saved.id, saved);
    return clone(saved);
  }

  async findById(id: string): Promise<Game | undefined> {
    const game = this.games.get(id);
    return game ? clone(game) : undefined;
  }

  async findByRoomId(roomId: string): Promise<Game | undefined> {
    const games = [...this.games.values()].filter((game) => game.roomId === roomId);
    const game = games.at(-1);
    return game ? clone(game) : undefined;
  }

  async findActiveByRoomId(roomId: string): Promise<Game | undefined> {
    const game = [...this.games.values()].find((item) => item.roomId === roomId && item.status === 'IN_PROGRESS');
    return game ? clone(game) : undefined;
  }

  async update(game: Game): Promise<Game> {
    if (!this.games.has(game.id)) throw new DomainError('GAME_NOT_FOUND', 404, 'Partida não encontrada.');
    const saved = clone(game);
    this.games.set(saved.id, saved);
    return clone(saved);
  }

  async finish(id: string, finishedAt: string): Promise<Game> {
    const game = this.games.get(id);
    if (!game) throw new DomainError('GAME_NOT_FOUND', 404, 'Partida não encontrada.');
    if (game.status === 'FINISHED') throw new DomainError('GAME_ALREADY_FINISHED', 409, 'Esta partida já foi finalizada.');
    const finished = { ...game, status: 'FINISHED' as const, finishedAt };
    this.games.set(id, finished);
    return clone(finished);
  }

  async startQuestion(id: string, expectedIndex: number, questionId: string, startedAt: string, endsAt: string): Promise<Game> {
    const game = this.games.get(id);
    if (!game) throw new DomainError('GAME_NOT_FOUND', 404, 'Partida não encontrada.');
    if (game.status !== 'IN_PROGRESS') throw new DomainError('GAME_NOT_IN_PROGRESS', 409, 'A partida não está em andamento.');
    if (game.currentQuestionId !== null) throw new DomainError('QUESTION_ALREADY_ACTIVE', 409, 'Já existe uma pergunta ativa.');
    if (game.currentQuestionIndex !== expectedIndex) throw new DomainError('QUESTION_STATE_CHANGED', 409, 'O estado da pergunta foi alterado.');
    const updated = { ...game, currentQuestionId: questionId, questionStartedAt: startedAt, questionEndsAt: endsAt };
    this.games.set(id, updated);
    return clone(updated);
  }

  async advanceQuestion(id: string, expectedIndex: number, expectedQuestionId: string, questionId: string, startedAt: string, endsAt: string): Promise<Game> {
    const game = this.games.get(id);
    if (!game) throw new DomainError('GAME_NOT_FOUND', 404, 'Partida não encontrada.');
    if (game.status !== 'IN_PROGRESS') throw new DomainError('GAME_NOT_IN_PROGRESS', 409, 'A partida não está em andamento.');
    if (game.currentQuestionIndex !== expectedIndex || game.currentQuestionId !== expectedQuestionId) {
      throw new DomainError('QUESTION_STATE_CHANGED', 409, 'A pergunta atual já foi alterada.');
    }
    const updated = { ...game, currentQuestionIndex: expectedIndex + 1, currentQuestionId: questionId, questionStartedAt: startedAt, questionEndsAt: endsAt };
    this.games.set(id, updated);
    return clone(updated);
  }

  async finishAfterQuestion(id: string, expectedIndex: number, expectedQuestionId: string, finishedAt: string): Promise<Game> {
    const game = this.games.get(id);
    if (!game) throw new DomainError('GAME_NOT_FOUND', 404, 'Partida não encontrada.');
    if (game.status !== 'IN_PROGRESS') throw new DomainError('GAME_NOT_IN_PROGRESS', 409, 'A partida não está em andamento.');
    if (game.currentQuestionIndex !== expectedIndex || game.currentQuestionId !== expectedQuestionId) {
      throw new DomainError('QUESTION_STATE_CHANGED', 409, 'A pergunta atual já foi alterada.');
    }
    const updated = { ...game, status: 'FINISHED' as const, finishedAt };
    this.games.set(id, updated);
    return clone(updated);
  }

  async submitAnswer(answer: PlayerAnswer): Promise<{ answer: PlayerAnswer; score: PlayerGameScore }> {
    const game = this.games.get(answer.gameId);
    if (!game) throw new DomainError('GAME_NOT_FOUND', 404, 'Partida não encontrada.');
    if (game.status !== 'IN_PROGRESS') throw new DomainError('GAME_NOT_IN_PROGRESS', 409, 'A partida não está em andamento.');
    if (game.currentQuestionId !== answer.questionId) {
      throw new DomainError('QUESTION_NOT_CURRENT', 409, 'A resposta não corresponde à pergunta atual.');
    }
    if (!game.questionEndsAt || Date.parse(answer.answeredAt) >= Date.parse(game.questionEndsAt)) {
      throw new DomainError('QUESTION_EXPIRED', 409, 'O tempo para responder esta pergunta terminou.');
    }
    const key = this.answerKey(answer.gameId, answer.questionId, answer.playerId);
    if (this.answers.has(key)) throw new DomainError('ANSWER_ALREADY_SUBMITTED', 409, 'Este jogador já respondeu à pergunta.');
    const savedAnswer = { ...answer };
    const scoreKey = this.scoreKey(answer.gameId, answer.playerId);
    const previous = this.scores.get(scoreKey) ?? {
      gameId: answer.gameId, playerId: answer.playerId, score: 0, answeredQuestions: 0, correctAnswers: 0,
    };
    const score = {
      ...previous,
      score: previous.score + answer.points,
      answeredQuestions: previous.answeredQuestions + 1,
      correctAnswers: previous.correctAnswers + (answer.isCorrect ? 1 : 0),
    };
    this.answers.set(key, savedAnswer);
    this.scores.set(scoreKey, score);
    return { answer: { ...savedAnswer }, score: { ...score } };
  }

  async findAnswer(gameId: string, questionId: string, playerId: string): Promise<PlayerAnswer | undefined> {
    const answer = this.answers.get(this.answerKey(gameId, questionId, playerId));
    return answer ? { ...answer } : undefined;
  }

  async listScores(gameId: string): Promise<PlayerGameScore[]> {
    return [...this.scores.values()].filter((score) => score.gameId === gameId).map((score) => ({ ...score }));
  }

  async delete(id: string): Promise<boolean> { return this.games.delete(id); }
}
