import type { RequestHandler } from 'express';
import { DomainError } from '../domain/errors.js';
import type { QuizService } from '../services/quizService.js';

type Params = Record<string, string>;
export class QuizController {
  constructor(private readonly service: QuizService) {}
  create: RequestHandler<Params, unknown, unknown> = async (req, res, next) => {
    try { res.status(201).json(await this.service.createQuiz(req.body)); } catch (error) { next(error); }
  };
  list: RequestHandler = async (_req, res, next) => {
    try { res.status(200).json(await this.service.listQuizzes()); } catch (error) { next(error); }
  };
  get: RequestHandler<Params> = async (req, res, next) => {
    try {
      const id = req.params.id;
      if (typeof id !== 'string' || !id) throw new DomainError('INVALID_QUIZ_ID', 400, 'Identificador de quiz inválido.');
      res.status(200).json(await this.service.getQuizById(id));
    } catch (error) { next(error); }
  };
}
