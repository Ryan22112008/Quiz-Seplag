import type { RequestHandler } from 'express';
import { DomainError } from '../domain/errors.js';
import type { QuizService } from '../services/quizService.js';
import type { Quiz } from '../domain/quiz.js';

type Params = Record<string, string>;
export class QuizController {
  constructor(private readonly service: QuizService) {}
  create: RequestHandler<Params, unknown, unknown> = async (req, res, next) => {
    try { res.status(201).json(toOwnedQuiz(await this.service.createQuiz(req.body, req.auth!.user.id))); } catch (error) { next(error); }
  };
  list: RequestHandler = async (req, res, next) => {
    try { res.status(200).json((await this.service.listQuizzesByOwner(req.auth!.user.id)).map(toPublicQuiz)); } catch (error) { next(error); }
  };
  get: RequestHandler<Params> = async (req, res, next) => {
    try {
      const id = req.params.id;
      if (typeof id !== 'string' || !id) throw new DomainError('INVALID_QUIZ_ID', 400, 'Identificador de quiz inválido.');
      const quiz = await this.service.getQuizById(id);
      if (quiz.ownerId !== req.auth!.user.id) throw new DomainError('FORBIDDEN', 403, 'Você não tem acesso a este quiz.');
      res.status(200).json(toPublicQuiz(quiz));
    } catch (error) { next(error); }
  };
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
