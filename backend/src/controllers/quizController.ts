import type { RequestHandler } from 'express';
import { DomainError } from '../domain/errors.js';
import type { QuizService } from '../services/quizService.js';
import type { Quiz } from '../domain/quiz.js';
import type { QuizLibraryQuery } from '../repositories/quizRepository.js';

type Params = Record<string, string>;
export class QuizController {
  constructor(private readonly service: QuizService) {}
  create: RequestHandler<Params, unknown, unknown> = async (req, res, next) => {
    try { res.status(201).json(toOwnedQuiz(await this.service.createQuiz(req.body, req.auth!.user.id))); } catch (error) { next(error); }
  };
  list: RequestHandler = async (req, res, next) => {
    try {
      const search = queryText(req.query.q);
      const category = queryText(req.query.category);
      const scopeValue = queryText(req.query.scope) ?? 'all';
      const sortValue = queryText(req.query.sort) ?? 'recent';
      const offset = queryInteger(req.query.offset, 0, 1_000_000);
      const limit = queryInteger(req.query.limit, 24, 48);
      if (search === null || category === null || !['all', 'mine', 'legacy'].includes(scopeValue) || !['recent', 'oldest', 'title-asc', 'title-desc'].includes(sortValue) || offset === null || limit === null) {
        throw new DomainError('INVALID_LIBRARY_QUERY', 400, 'Os filtros da biblioteca são inválidos.');
      }
      const query: QuizLibraryQuery = { ...(search ? { search } : {}), ...(category ? { category } : {}), scope: scopeValue as QuizLibraryQuery['scope'], sort: sortValue as QuizLibraryQuery['sort'], offset, limit };
      res.status(200).json(await this.service.listLibrary(req.auth!.user.id, query));
    } catch (error) { next(error); }
  };
  get: RequestHandler<Params> = async (req, res, next) => {
    try {
      const id = req.params.id;
      if (typeof id !== 'string' || !id) throw new DomainError('INVALID_QUIZ_ID', 400, 'Identificador de quiz inválido.');
      const quiz = await this.service.getQuizById(id);
      if (quiz.ownerId && quiz.ownerId !== req.auth!.user.id) throw new DomainError('FORBIDDEN', 403, 'Você não tem acesso a este quiz.');
      res.status(200).json(quiz.ownerId ? toOwnedQuiz(quiz) : toPublicQuiz(quiz));
    } catch (error) { next(error); }
  };
  update: RequestHandler<Params, unknown, unknown> = async (req, res, next) => {
    try {
      const id = readId(req.params.id);
      res.status(200).json(toOwnedQuiz(await this.service.updateQuiz(id, req.body, req.auth!.user.id)));
    } catch (error) { next(error); }
  };
  duplicate: RequestHandler<Params> = async (req, res, next) => {
    try {
      const id = readId(req.params.id);
      res.status(201).json(toOwnedQuiz(await this.service.duplicateQuiz(id, req.auth!.user.id)));
    } catch (error) { next(error); }
  };
  delete: RequestHandler<Params> = async (req, res, next) => {
    try {
      await this.service.deleteQuiz(readId(req.params.id), req.auth!.user.id);
      res.status(204).send();
    } catch (error) { next(error); }
  };
}

function readId(value: string | undefined): string {
  if (!value) throw new DomainError('INVALID_QUIZ_ID', 400, 'Identificador de quiz inválido.');
  return value;
}
function queryText(value: unknown): string | undefined | null {
  if (value === undefined) return undefined;
  if (typeof value !== 'string' || value.trim().length > 120) return null;
  return value.trim();
}
function queryInteger(value: unknown, fallback: number, max: number): number | null {
  if (value === undefined) return fallback;
  if (typeof value !== 'string' || !/^\d+$/u.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed <= max ? parsed : null;
}

export function toPublicQuiz(quiz: Awaited<ReturnType<QuizService['getQuizById']>>) {
  return {
    id: quiz.id, title: quiz.title, description: quiz.description, category: quiz.category,
    createdAt: quiz.createdAt, updatedAt: quiz.updatedAt,
    questions: quiz.questions.map(({ id, question, imageUrl, options, timeLimit, revealTime, points }) => ({ id, question, ...(imageUrl ? { imageUrl } : {}), options, timeLimit, revealTime: revealTime ?? 0, points })),
  };
}

export function toOwnedQuiz(quiz: Quiz): Omit<Quiz, 'ownerId'> {
  const { ownerId: _ownerId, ...ownedQuiz } = quiz;
  return ownedQuiz;
}
