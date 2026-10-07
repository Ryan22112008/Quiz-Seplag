import type { Prisma, PrismaClient } from '@prisma/client';
import { DomainError } from '../domain/errors.js';
import type { GameReport, GameReportDetails } from '../domain/report.js';

export interface GameReportRepository {
  save(report: GameReport): Promise<void>;
  listOwned(ownerId: string, deleted?: boolean): Promise<GameReport[]>;
  findOwned(id: string, ownerId: string, deleted?: boolean): Promise<GameReport | undefined>;
  setDeleted(id: string, ownerId: string, deletedAt: Date | null): Promise<boolean>;
  permanentlyDelete(id: string, ownerId: string): Promise<boolean>;
}

const reportInclude = { quiz: { select: { ownerId: true } } } as const;
function mapReport(row: Prisma.GameReportGetPayload<{ include: typeof reportInclude }>): GameReport {
  return { id: row.id, quizId: row.quizId, roomId: row.roomId, roomPin: row.roomPin, startedAt: row.startedAt.toISOString(), finishedAt: row.finishedAt.toISOString(), durationSeconds: row.durationSeconds, participantCount: row.participantCount, questionCount: row.questionCount, totalAnswers: row.totalAnswers, correctAnswers: row.correctAnswers, accuracyRate: row.accuracyRate, details: row.details as unknown as GameReportDetails, deletedAt: row.deletedAt?.toISOString() ?? null };
}

export class PrismaGameReportRepository implements GameReportRepository {
  constructor(private readonly client: PrismaClient) {}
  async save(report: GameReport): Promise<void> {
    try {
      await this.client.gameReport.upsert({ where: { id: report.id }, create: toWrite(report), update: toWrite(report) });
    } catch { throw new DomainError('REPORT_NOT_FOUND', 503, 'Não foi possível salvar o relatório da partida.'); }
  }
  async listOwned(ownerId: string, deleted = false): Promise<GameReport[]> {
    try {
      const rows = await this.client.gameReport.findMany({ where: { quiz: { ownerId }, deletedAt: deleted ? { not: null } : null }, include: reportInclude, orderBy: { finishedAt: 'desc' } });
      return rows.map(mapReport);
    } catch { throw new DomainError('REPORT_NOT_FOUND', 503, 'Não foi possível carregar os relatórios.'); }
  }
  async findOwned(id: string, ownerId: string, deleted = false): Promise<GameReport | undefined> {
    try {
      const row = await this.client.gameReport.findFirst({ where: { id, quiz: { ownerId }, deletedAt: deleted ? { not: null } : null }, include: reportInclude });
      return row ? mapReport(row) : undefined;
    } catch { throw new DomainError('REPORT_NOT_FOUND', 503, 'Não foi possível carregar o relatório.'); }
  }
  async setDeleted(id: string, ownerId: string, deletedAt: Date | null): Promise<boolean> {
    try {
      const report = await this.findOwned(id, ownerId, deletedAt === null);
      if (!report) return false;
      const result = await this.client.gameReport.updateMany({ where: { id, quiz: { ownerId } }, data: { deletedAt } });
      return result.count > 0;
    } catch (error) { if (error instanceof DomainError) throw error; throw new DomainError('REPORT_NOT_FOUND', 503, 'Não foi possível atualizar o relatório.'); }
  }
  async permanentlyDelete(id: string, ownerId: string): Promise<boolean> {
    try {
      const result = await this.client.gameReport.deleteMany({ where: { id, quiz: { ownerId }, deletedAt: { not: null } } });
      return result.count > 0;
    } catch { throw new DomainError('REPORT_NOT_FOUND', 503, 'Não foi possível excluir o relatório.'); }
  }
}

function toWrite(report: GameReport): Prisma.GameReportUncheckedCreateInput {
  return { id: report.id, quizId: report.quizId, roomId: report.roomId, roomPin: report.roomPin, startedAt: new Date(report.startedAt), finishedAt: new Date(report.finishedAt), durationSeconds: report.durationSeconds, participantCount: report.participantCount, questionCount: report.questionCount, totalAnswers: report.totalAnswers, correctAnswers: report.correctAnswers, accuracyRate: report.accuracyRate, details: report.details as unknown as Prisma.InputJsonValue, deletedAt: report.deletedAt ? new Date(report.deletedAt) : null };
}
