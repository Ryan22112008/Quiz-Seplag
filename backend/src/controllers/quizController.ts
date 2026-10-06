import type { RequestHandler } from 'express';
import { DomainError } from '../domain/errors.js';
import type { QuizService } from '../services/quizService.js';

type Params = Record<string, string>;
export class QuizController {
  constructor(private readonly service: QuizService) {}
  create: RequestHandler<Params, unknown, unknown> = async (req, res, next) => {
    try { res.status(201).json(await this.service.createQuiz(req.body)); } catch (error) { next(error); }
  };
  get: RequestHandler<Params> = async (req, res, next) => {
    try {
      const id = req.params.id;
      if (typeof id !== 'string' || !id) throw new DomainError('INVALID_QUIZ_ID', 400, 'Identificador de quiz inválido.');
      const quiz = await this.service.getQuizById(id);
      res.status(200).json(quiz);
    } catch (error) { next(error); }
  };
  update: RequestHandler<Params, unknown, unknown> = async (req, res, next) => {
    try {
      const id = readId(req.params.id);
      res.status(200).json(await this.service.updateQuiz(id, req.body));
    } catch (error) { next(error); }
  };
  duplicate: RequestHandler<Params> = async (req, res, next) => {
    try {
      const id = readId(req.params.id);
      res.status(201).json(await this.service.duplicateQuiz(id));
    } catch (error) { next(error); }
  };
  delete: RequestHandler<Params> = async (req, res, next) => {
    try {
      await this.service.deleteQuiz(readId(req.params.id));
      res.status(204).send();
    } catch (error) { next(error); }
  };
}

function readId(value: string | undefined): string {
  if (!value) throw new DomainError('INVALID_QUIZ_ID', 400, 'Identificador de quiz inválido.');
  return value;
}
