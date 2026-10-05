import type { Prisma, PrismaClient } from '@prisma/client';
import { DomainError } from '../domain/errors.js';
import type { Question, Quiz, QuizOption } from '../domain/quiz.js';

export interface QuizRepository {
  create(quiz: Quiz): Promise<Quiz>;
  findById(id: string): Promise<Quiz | undefined>;
  findAll(): Promise<Quiz[]>;
  update(quiz: Quiz): Promise<Quiz>;
  delete(id: string): Promise<boolean>;
}

function copy(quiz: Quiz): Quiz {
  return { ...quiz, questions: quiz.questions.map((q) => ({ ...q, options: q.options.map((o) => ({ ...o })) })) };
}

function mapQuiz(row: Prisma.QuizGetPayload<{ include: { questions: { include: { options: true } } } }>): Quiz {
  return {
    id: row.id, title: row.title, category: row.category,
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

  async create(quiz: Quiz): Promise<Quiz> {
    try {
      const row = await this.client.quiz.create({ data: {
        id: quiz.id, title: quiz.title, description: quiz.description ?? null, category: quiz.category,
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

  async findAll(): Promise<Quiz[]> {
    try {
      const rows = await this.client.quiz.findMany({ include: nestedQuiz, orderBy: { createdAt: 'desc' } });
      return rows.map(mapQuiz);
    } catch (error) { throw mapQuizStoreError(error); }
  }

  async update(quiz: Quiz): Promise<Quiz> {
    try {
      const row = await this.client.$transaction(async (tx) => {
        await tx.question.deleteMany({ where: { quizId: quiz.id } });
        return tx.quiz.update({ where: { id: quiz.id }, data: {
          title: quiz.title, description: quiz.description ?? null, category: quiz.category, updatedAt: new Date(quiz.updatedAt),
          questions: { create: quiz.questions.map((q, position) => ({
            id: q.id, question: q.question, imageUrl: q.imageUrl ?? null, correctOptionId: q.correctOptionId, timeLimit: q.timeLimit, revealTime: q.revealTime ?? 0, points: q.points, position,
            options: { create: q.options.map((o, optionPosition) => ({ id: o.id, text: o.text, imageUrl: o.imageUrl ?? null, position: optionPosition })) },
          })) },
        }, include: nestedQuiz });
      });
      return mapQuiz(row);
    } catch (error) { throw mapQuizStoreError(error); }
  }

  async delete(id: string): Promise<boolean> {
    try { return (await this.client.quiz.deleteMany({ where: { id } })).count > 0; }
    catch (error) { throw mapQuizStoreError(error); }
  }
}

/** Test double used by isolated service tests; production is wired to PrismaQuizRepository. */
export class InMemoryQuizRepository implements QuizRepository {
  private readonly quizzes = new Map<string, Quiz>();
  async create(quiz: Quiz): Promise<Quiz> {
    if (this.quizzes.has(quiz.id)) throw new DomainError('QUIZ_ID_CONFLICT', 409, 'O identificador do quiz já está em uso.');
    const saved = copy(quiz); this.quizzes.set(saved.id, saved); return copy(saved);
  }
  async findById(id: string): Promise<Quiz | undefined> { const quiz = this.quizzes.get(id); return quiz ? copy(quiz) : undefined; }
  async findAll(): Promise<Quiz[]> { return [...this.quizzes.values()].map(copy); }
  async update(quiz: Quiz): Promise<Quiz> {
    if (!this.quizzes.has(quiz.id)) throw new DomainError('QUIZ_NOT_FOUND', 404, 'Quiz não encontrado.');
    const saved = copy(quiz); this.quizzes.set(saved.id, saved); return copy(saved);
  }
  async delete(id: string): Promise<boolean> { return this.quizzes.delete(id); }
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
