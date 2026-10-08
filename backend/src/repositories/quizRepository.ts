import type { Prisma, PrismaClient } from '@prisma/client';
import { DomainError } from '../domain/errors.js';
import type { Question, Quiz, QuizOption } from '../domain/quiz.js';

export interface QuizRepository {
  create(quiz: Quiz, ownerId?: string): Promise<Quiz>;
  findById(id: string): Promise<Quiz | undefined>;
  findOwnedById(id: string, ownerId: string, deleted?: boolean): Promise<Quiz | undefined>;
  findAllByOwner(ownerId: string, deleted?: boolean): Promise<Quiz[]>;
  findAll(): Promise<Quiz[]>;
  update(quiz: Quiz, ownerId?: string): Promise<Quiz>;
  setDeletedAt(id: string, ownerId: string, deletedAt: Date | null): Promise<boolean>;
  delete(id: string): Promise<boolean>;
}


function copy(quiz: Quiz): Quiz {
  return { ...quiz, questions: quiz.questions.map((q) => ({ ...q, options: q.options.map((o) => ({ ...o })) })) };
}

function mapQuiz(row: Prisma.QuizGetPayload<{ include: { questions: { include: { options: true } } } }>): Quiz {
  return {
    id: row.id, title: row.title, category: row.category, isDraft: row.isDraft,
    ...(row.description === null ? {} : { description: row.description }),
    createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString(),
    questions: row.questions.sort((a, b) => a.position - b.position).map((q): Question => ({
      id: q.id, question: q.question, ...(q.imageUrl ? { imageUrl: q.imageUrl } : {}), correctOptionId: q.correctOptionId, timeLimit: q.timeLimit, revealTime: q.revealTime, points: q.points,
      options: q.options.sort((a, b) => a.position - b.position).map((o): QuizOption => ({ id: o.id, text: o.text, ...(o.imageUrl ? { imageUrl: o.imageUrl } : {}) })),
    })),
  };
}
const nestedQuiz = { questions: { include: { options: true } } } as const;

export class PrismaQuizRepository implements QuizRepository {
  constructor(private readonly client: PrismaClient) {}

  async create(quiz: Quiz, ownerId?: string): Promise<Quiz> {
    try {
      const row = await this.client.quiz.create({ data: {
        id: quiz.id, ownerId: ownerId ?? null, title: quiz.title, description: quiz.description ?? null, category: quiz.category, isDraft: quiz.isDraft ?? false,
        createdAt: new Date(quiz.createdAt), updatedAt: new Date(quiz.updatedAt),
        questions: { create: quiz.questions.map((q, position) => ({
          id: q.id, question: q.question, imageUrl: q.imageUrl ?? null, correctOptionId: q.correctOptionId, timeLimit: q.timeLimit, revealTime: q.revealTime ?? 0, points: q.points, position,
          options: { create: q.options.map((o, optionPosition) => ({ id: o.id, text: o.text, imageUrl: o.imageUrl ?? null, position: optionPosition })) },
        })) },
      }, include: nestedQuiz });
      return mapQuiz(row);
    } catch (error) { throw mapQuizStoreError(error); }
  }

  async findById(id: string): Promise<Quiz | undefined> {
    try {
      const row = await this.client.quiz.findUnique({ where: { id }, include: nestedQuiz });
      return row ? mapQuiz(row) : undefined;
    } catch (error) { throw mapQuizStoreError(error); }
  }

  async findOwnedById(id: string, ownerId: string, deleted = false): Promise<Quiz | undefined> {
    try {
      const row = await this.client.quiz.findFirst({ where: { id, ownerId, deletedAt: deleted ? { not: null } : null }, include: nestedQuiz });
      return row ? mapQuiz(row) : undefined;
    } catch (error) { throw mapQuizStoreError(error); }
  }

  async findAllByOwner(ownerId: string, deleted = false): Promise<Quiz[]> {
    try {
      const rows = await this.client.quiz.findMany({ where: { ownerId, deletedAt: deleted ? { not: null } : null }, include: nestedQuiz, orderBy: { updatedAt: 'desc' } });
      return rows.map(mapQuiz);
    } catch (error) { throw mapQuizStoreError(error); }
  }

  async findAll(): Promise<Quiz[]> {
    try {
      const rows = await this.client.quiz.findMany({ include: nestedQuiz, orderBy: { createdAt: 'desc' } });
      return rows.map(mapQuiz);
    } catch (error) { throw mapQuizStoreError(error); }
  }

  async update(quiz: Quiz, ownerId?: string): Promise<Quiz> {
    try {
      const row = await this.client.$transaction(async (tx) => {
        const existing = await tx.quiz.findFirst({ where: { id: quiz.id, ...(ownerId ? { ownerId } : {}), deletedAt: null }, select: { id: true } });
        if (!existing) throw new DomainError('QUIZ_NOT_FOUND', 404, 'Quiz não encontrado.');
        const activeRooms = await tx.room.count({ where: { quizId: quiz.id, status: { in: ['WAITING', 'STARTING', 'IN_PROGRESS'] } } });
        if (activeRooms) throw new DomainError('QUIZ_IN_USE', 409, 'Encerre as salas ativas antes de editar este quiz.');
        await tx.question.deleteMany({ where: { quizId: quiz.id } });
        return tx.quiz.update({ where: { id: quiz.id }, data: {
          title: quiz.title, description: quiz.description ?? null, category: quiz.category, isDraft: quiz.isDraft ?? false, updatedAt: new Date(quiz.updatedAt),
          questions: { create: quiz.questions.map((q, position) => ({
            id: q.id, question: q.question, imageUrl: q.imageUrl ?? null, correctOptionId: q.correctOptionId, timeLimit: q.timeLimit, revealTime: q.revealTime ?? 0, points: q.points, position,
            options: { create: q.options.map((o, optionPosition) => ({ id: o.id, text: o.text, imageUrl: o.imageUrl ?? null, position: optionPosition })) },
          })) },
        }, include: nestedQuiz });
      });
      return mapQuiz(row);
    } catch (error) { throw mapQuizStoreError(error); }
  }

  async setDeletedAt(id: string, ownerId: string, deletedAt: Date | null): Promise<boolean> {
    try {
      const result = await this.client.quiz.updateMany({ where: { id, ownerId, deletedAt: deletedAt ? null : { not: null } }, data: { deletedAt } });
      return result.count > 0;
    } catch (error) { throw mapQuizStoreError(error); }
  }

  async delete(id: string): Promise<boolean> {
    try {
      return await this.client.$transaction(async (tx) => {
        const quiz = await tx.quiz.findUnique({ where: { id }, select: { id: true } });
        if (!quiz) return false;
        const relatedRooms = await tx.room.count({ where: { quizId: id } });
        if (relatedRooms) throw new DomainError('QUIZ_HAS_HISTORY', 409, 'Este quiz possui salas registradas e foi mantido para preservar o histórico.');
        await tx.quiz.delete({ where: { id } });
        return true;
      });
    }
    catch (error) { throw mapQuizStoreError(error); }
  }

}

/** Test double used by isolated service tests; production is wired to PrismaQuizRepository. */
export class InMemoryQuizRepository implements QuizRepository {
  private readonly quizzes = new Map<string, Quiz>();
  private readonly owners = new Map<string, string>();
  private readonly deleted = new Set<string>();
  async create(quiz: Quiz, ownerId?: string): Promise<Quiz> {
    if (this.quizzes.has(quiz.id)) throw new DomainError('QUIZ_ID_CONFLICT', 409, 'O identificador do quiz já está em uso.');
    const saved = copy(quiz); this.quizzes.set(saved.id, saved); if (ownerId) this.owners.set(saved.id, ownerId); return copy(saved);
  }
  async findById(id: string): Promise<Quiz | undefined> { const quiz = this.quizzes.get(id); return quiz ? copy(quiz) : undefined; }
  async findOwnedById(id: string, ownerId: string, deleted = false): Promise<Quiz | undefined> { const quiz = this.quizzes.get(id); return quiz && this.owners.get(id) === ownerId && this.deleted.has(id) === deleted ? copy(quiz) : undefined; }
  async findAllByOwner(ownerId: string, deleted = false): Promise<Quiz[]> { return [...this.quizzes.values()].filter((quiz) => this.owners.get(quiz.id) === ownerId && this.deleted.has(quiz.id) === deleted).map(copy); }
  async findAll(): Promise<Quiz[]> { return [...this.quizzes.values()].map(copy); }
  async update(quiz: Quiz, ownerId?: string): Promise<Quiz> {
    if (!this.quizzes.has(quiz.id)) throw new DomainError('QUIZ_NOT_FOUND', 404, 'Quiz não encontrado.');
    if (ownerId && this.owners.get(quiz.id) !== ownerId) throw new DomainError('QUIZ_NOT_FOUND', 404, 'Quiz não encontrado.');
    const saved = copy(quiz); this.quizzes.set(saved.id, saved); return copy(saved);
  }
  async setDeletedAt(id: string, ownerId: string, deletedAt: Date | null): Promise<boolean> { if (this.owners.get(id) !== ownerId || !this.quizzes.has(id)) return false; if (deletedAt) this.deleted.add(id); else this.deleted.delete(id); return true; }
  async delete(id: string): Promise<boolean> { this.owners.delete(id); this.deleted.delete(id); return this.quizzes.delete(id); }
}

function mapQuizStoreError(error: unknown): DomainError {
  if (error instanceof DomainError) return error;
  if (isPrismaKnownError(error)) {
    if (error.code === 'P2002') return new DomainError('QUIZ_ID_CONFLICT', 409, 'O identificador do quiz já está em uso.');
    if (error.code === 'P2025') return new DomainError('QUIZ_NOT_FOUND', 404, 'Quiz não encontrado.');
  }
  return new DomainError('QUIZ_STORE_ERROR', 503, 'Não foi possível acessar os dados do quiz.');
}

function isPrismaKnownError(error: unknown): error is { code: string } {
  return typeof error === 'object' && error !== null && 'code' in error && typeof error.code === 'string' && error.code.startsWith('P');
}
