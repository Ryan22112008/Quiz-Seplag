import type { Prisma, PrismaClient } from '@prisma/client';
import { DomainError } from '../domain/errors.js';
import type { Question, Quiz, QuizOption } from '../domain/quiz.js';

export interface QuizRepository {
  create(quiz: Quiz): Promise<Quiz>;
  findById(id: string): Promise<Quiz | undefined>;
  findAll(): Promise<Quiz[]>;
  findAllByOwner?(ownerId: string): Promise<Quiz[]>;
  findAllVisibleToOwner?(ownerId: string): Promise<Quiz[]>;
  findLibrary?(ownerId: string, query: QuizLibraryQuery): Promise<QuizLibraryResult>;
  owns?(id: string, ownerId: string): Promise<boolean>;
  canUse?(id: string, ownerId: string): Promise<boolean>;
  updateOwned?(quiz: Quiz, ownerId: string): Promise<Quiz>;
  deleteOwned?(id: string, ownerId: string): Promise<void>;
  update(quiz: Quiz): Promise<Quiz>;
  delete(id: string): Promise<boolean>;
}

export interface QuizLibraryQuery { search?: string; category?: string; scope: 'all' | 'mine' | 'legacy'; sort: 'recent' | 'oldest' | 'title-asc' | 'title-desc'; offset: number; limit: number }
export interface QuizLibraryItem { id: string; title: string; description: string | null; category: string; questionCount: number; coverImageUrl: string | null; createdAt: string; updatedAt: string; ownerId: string | null; ownerName: string | null; isLegacy: boolean }
export interface QuizLibraryResult { total: number; items: QuizLibraryItem[] }

function copy(quiz: Quiz): Quiz {
  return { ...quiz, questions: quiz.questions.map((q) => ({ ...q, options: q.options.map((o) => ({ ...o })) })) };
}

function mapQuiz(row: Prisma.QuizGetPayload<{ include: { questions: { include: { options: true } } } }>): Quiz {
  return {
    id: row.id, title: row.title, category: row.category,
    ...(row.ownerId ? { ownerId: row.ownerId } : {}),
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
        id: quiz.id, ownerId: quiz.ownerId ?? null, title: quiz.title, description: quiz.description ?? null, category: quiz.category,
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

  async findAllByOwner(ownerId: string): Promise<Quiz[]> {
    const rows = await this.client.quiz.findMany({ where: { OR: [{ ownerId }, { ownerId: null }] }, include: nestedQuiz, orderBy: { createdAt: 'desc' } });
    return rows.map(mapQuiz);
  }

  async owns(id: string, ownerId: string): Promise<boolean> {
    return (await this.client.quiz.count({ where: { id, ownerId } })) > 0;
  }

  async canUse(id: string, ownerId: string): Promise<boolean> {
    return (await this.client.quiz.count({ where: { id, OR: [{ ownerId }, { ownerId: null }] } })) > 0;
  }

  async findLibrary(ownerId: string, query: QuizLibraryQuery): Promise<QuizLibraryResult> {
    const access: Prisma.QuizWhereInput = query.scope === 'mine' ? { ownerId } : query.scope === 'legacy' ? { ownerId: null } : { OR: [{ ownerId }, { ownerId: null }] };
    const where: Prisma.QuizWhereInput = { AND: [access, ...(query.category ? [{ category: query.category }] : []), ...(query.search ? [{ OR: [{ title: { contains: query.search } }, { description: { contains: query.search } }] }] : [])] };
    const orderBy: Prisma.QuizOrderByWithRelationInput[] = query.sort === 'oldest' ? [{ createdAt: 'asc' }, { id: 'asc' }] : query.sort === 'title-asc' ? [{ title: 'asc' }, { updatedAt: 'desc' }, { id: 'asc' }] : query.sort === 'title-desc' ? [{ title: 'desc' }, { updatedAt: 'desc' }, { id: 'asc' }] : [{ createdAt: 'desc' }, { id: 'asc' }];
    const [rows, total] = await this.client.$transaction([
      this.client.quiz.findMany({ where, orderBy, skip: query.offset, take: query.limit, include: { _count: { select: { questions: true } }, owner: { select: { id: true, name: true } }, questions: { select: { imageUrl: true }, orderBy: { position: 'asc' }, take: 1 } } }),
      this.client.quiz.count({ where }),
    ]);
    return { total, items: rows.map((row) => ({ id: row.id, title: row.title, description: row.description, category: row.category, questionCount: row._count.questions, coverImageUrl: row.questions[0]?.imageUrl ?? null, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString(), ownerId: row.ownerId, ownerName: row.owner?.name ?? null, isLegacy: row.ownerId === null })) };
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

  async updateOwned(quiz: Quiz, ownerId: string): Promise<Quiz> {
    try {
      return await this.client.$transaction(async (tx) => {
        const current = await tx.quiz.findUnique({ where: { id: quiz.id }, select: { ownerId: true } });
        if (!current) throw new DomainError('QUIZ_NOT_FOUND', 404, 'Quiz não encontrado.');
        if (current.ownerId !== ownerId) throw new DomainError('FORBIDDEN', 403, 'Somente o proprietário pode alterar este quiz.');
        const activeRooms = await tx.room.count({ where: { quizId: quiz.id, status: { in: ['WAITING', 'STARTING', 'IN_PROGRESS'] } } });
        if (activeRooms) throw new DomainError('QUIZ_IN_USE', 409, 'Encerre as salas ativas antes de editar este quiz.');
        await tx.question.deleteMany({ where: { quizId: quiz.id } });
        const row = await tx.quiz.update({ where: { id: quiz.id }, data: {
          title: quiz.title, description: quiz.description ?? null, category: quiz.category, updatedAt: new Date(quiz.updatedAt),
          questions: { create: quiz.questions.map((q, position) => ({ id: q.id, question: q.question, imageUrl: q.imageUrl ?? null, correctOptionId: q.correctOptionId, timeLimit: q.timeLimit, revealTime: q.revealTime ?? 0, points: q.points, position, options: { create: q.options.map((o, optionPosition) => ({ id: o.id, text: o.text, imageUrl: o.imageUrl ?? null, position: optionPosition })) } })) },
        }, include: nestedQuiz });
        return mapQuiz(row);
      });
    } catch (error) { throw mapQuizStoreError(error); }
  }

  async delete(id: string): Promise<boolean> {
    try { return (await this.client.quiz.deleteMany({ where: { id } })).count > 0; }
    catch (error) { throw mapQuizStoreError(error); }
  }

  async deleteOwned(id: string, ownerId: string): Promise<void> {
    await this.client.$transaction(async (tx) => {
      const current = await tx.quiz.findUnique({ where: { id }, select: { ownerId: true } });
      if (!current) throw new DomainError('QUIZ_NOT_FOUND', 404, 'Quiz não encontrado.');
      if (current.ownerId !== ownerId) throw new DomainError('FORBIDDEN', 403, 'Somente o proprietário pode excluir este quiz.');
      const relatedRooms = await tx.room.count({ where: { quizId: id } });
      if (relatedRooms) throw new DomainError('QUIZ_HAS_HISTORY', 409, 'Este quiz possui salas registradas e foi mantido para preservar o histórico.');
      await tx.quiz.delete({ where: { id } });
    });
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
  async findAllByOwner(ownerId: string): Promise<Quiz[]> { return [...this.quizzes.values()].filter((quiz) => quiz.ownerId === ownerId || !quiz.ownerId).map(copy); }
  async owns(id: string, ownerId: string): Promise<boolean> { return this.quizzes.get(id)?.ownerId === ownerId; }
  async canUse(id: string, ownerId: string): Promise<boolean> { const quiz = this.quizzes.get(id); return !!quiz && (!quiz.ownerId || quiz.ownerId === ownerId); }
  async findLibrary(ownerId: string, query: QuizLibraryQuery): Promise<QuizLibraryResult> {
    let items = (await this.findAllByOwner(ownerId)).filter((quiz) => query.scope === 'mine' ? quiz.ownerId === ownerId : query.scope === 'legacy' ? !quiz.ownerId : true)
      .filter((quiz) => !query.category || quiz.category === query.category)
      .filter((quiz) => !query.search || `${quiz.title} ${quiz.description ?? ''}`.toLocaleLowerCase('pt-BR').includes(query.search.toLocaleLowerCase('pt-BR')));
    items.sort((a, b) => query.sort === 'title-asc' ? a.title.localeCompare(b.title, 'pt-BR') || b.updatedAt.localeCompare(a.updatedAt) : query.sort === 'title-desc' ? b.title.localeCompare(a.title, 'pt-BR') || b.updatedAt.localeCompare(a.updatedAt) : query.sort === 'oldest' ? a.createdAt.localeCompare(b.createdAt) : b.createdAt.localeCompare(a.createdAt));
    const total = items.length;
    items = items.slice(query.offset, query.offset + query.limit);
    return { total, items: items.map((quiz) => ({ id: quiz.id, title: quiz.title, description: quiz.description ?? null, category: quiz.category, questionCount: quiz.questions.length, coverImageUrl: quiz.questions.find((q) => q.imageUrl)?.imageUrl ?? null, createdAt: quiz.createdAt, updatedAt: quiz.updatedAt, ownerId: quiz.ownerId ?? null, ownerName: null, isLegacy: !quiz.ownerId })) };
  }
  async updateOwned(quiz: Quiz, ownerId: string): Promise<Quiz> {
    const current = this.quizzes.get(quiz.id);
    if (!current) throw new DomainError('QUIZ_NOT_FOUND', 404, 'Quiz não encontrado.');
    if (current.ownerId !== ownerId) throw new DomainError('FORBIDDEN', 403, 'Somente o proprietário pode alterar este quiz.');
    return this.update(quiz);
  }
  async deleteOwned(id: string, ownerId: string): Promise<void> {
    const current = this.quizzes.get(id);
    if (!current) throw new DomainError('QUIZ_NOT_FOUND', 404, 'Quiz não encontrado.');
    if (current.ownerId !== ownerId) throw new DomainError('FORBIDDEN', 403, 'Somente o proprietário pode excluir este quiz.');
    this.quizzes.delete(id);
  }
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
