import type { RequestHandler } from 'express';
import { DomainError } from '../domain/errors.js';
import type { QuizService } from '../services/quizService.js';

type Params = Record<string, string>;
export class QuizController {
  constructor(private readonly service: QuizService) {}
  list: RequestHandler = async (req, res, next) => {
    try { res.status(200).json(await this.service.listOwnedQuizzes(userId(req))); } catch (error) { next(error); }
  };
  listTrash: RequestHandler = async (req, res, next) => {
    try { res.status(200).json(await this.service.listOwnedQuizzes(userId(req), true)); } catch (error) { next(error); }
  };
  create: RequestHandler<Params, unknown, unknown> = async (req, res, next) => {
    try { res.status(201).json(await this.service.createQuiz(req.body, userId(req))); } catch (error) { next(error); }
  };
  get: RequestHandler<Params> = async (req, res, next) => {
    try {
      const id = req.params.id;
      if (typeof id !== 'string' || !id) throw new DomainError('INVALID_QUIZ_ID', 400, 'Identificador de quiz inválido.');
      const quiz = await this.service.getOwnedQuizById(id, userId(req));
      res.status(200).json(quiz);
    } catch (error) { next(error); }
  };
  update: RequestHandler<Params, unknown, unknown> = async (req, res, next) => {
    try {
      const id = readId(req.params.id);
      res.status(200).json(await this.service.updateQuiz(id, req.body, userId(req)));
    } catch (error) { next(error); }
  };
  duplicate: RequestHandler<Params> = async (req, res, next) => {
    try {
      const id = readId(req.params.id);
      res.status(201).json(await this.service.duplicateQuiz(id, userId(req)));
    } catch (error) { next(error); }
  };
  delete: RequestHandler<Params> = async (req, res, next) => {
    try {
      await this.service.trashOwnedQuiz(readId(req.params.id), userId(req));
      res.status(204).send();
    } catch (error) { next(error); }
  };
  restore: RequestHandler<Params> = async (req, res, next) => {
    try { await this.service.restoreOwnedQuiz(readId(req.params.id), userId(req)); res.status(204).send(); } catch (error) { next(error); }
  };
  permanentlyDelete: RequestHandler<Params> = async (req, res, next) => {
    try { await this.service.permanentlyDeleteOwnedQuiz(readId(req.params.id), userId(req)); res.status(204).send(); } catch (error) { next(error); }
  };
}

function userId(req: { auth?: { user: { id: string } } }): string {
  if (!req.auth?.user.id) throw new DomainError('FORBIDDEN', 401, 'Entre com sua conta para continuar.');
  return req.auth.user.id;
}

function readId(value: string | undefined): string {
  if (!value) throw new DomainError('INVALID_QUIZ_ID', 400, 'Identificador de quiz inválido.');
  return value;
}
