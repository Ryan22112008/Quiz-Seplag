import type { RequestHandler } from 'express';
import { DomainError } from '../domain/errors.js';
import type { GameReportService } from '../services/reportService.js';

type Params = Record<string, string>;
function ownerId(request: { auth?: { user: { id: string } } }): string {
  if (!request.auth?.user.id) throw new DomainError('FORBIDDEN', 401, 'Entre com sua conta para continuar.');
  return request.auth.user.id;
}
function reportId(value: string | undefined): string {
  if (!value) throw new DomainError('REPORT_NOT_FOUND', 404, 'Relatório não encontrado.');
  return value;
}

export class ReportController {
  constructor(private readonly service: GameReportService) {}
  list: RequestHandler = async (request, response, next) => { try { response.set('Cache-Control', 'no-store').json(await this.service.list(ownerId(request))); } catch (error) { next(error); } };
  trash: RequestHandler = async (request, response, next) => { try { response.set('Cache-Control', 'no-store').json(await this.service.list(ownerId(request), true)); } catch (error) { next(error); } };
  get: RequestHandler<Params> = async (request, response, next) => { try { response.set('Cache-Control', 'no-store').json(await this.service.get(reportId(request.params.id), ownerId(request))); } catch (error) { next(error); } };
  delete: RequestHandler<Params> = async (request, response, next) => { try { await this.service.trash(reportId(request.params.id), ownerId(request)); response.status(204).send(); } catch (error) { next(error); } };
  restore: RequestHandler<Params> = async (request, response, next) => { try { await this.service.restore(reportId(request.params.id), ownerId(request)); response.status(204).send(); } catch (error) { next(error); } };
  permanentlyDelete: RequestHandler<Params> = async (request, response, next) => { try { await this.service.permanentlyDelete(reportId(request.params.id), ownerId(request)); response.status(204).send(); } catch (error) { next(error); } };
}
