import { randomUUID } from 'node:crypto';
import { DomainError } from '../domain/errors.js';
import type { Question, Quiz, QuizOption } from '../domain/quiz.js';
import type { QuizLibraryQuery, QuizLibraryResult, QuizRepository } from '../repositories/quizRepository.js';

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
function text(value: unknown, min: number, max: number): value is string {
  return typeof value === 'string' && value.trim().length >= min && value.trim().length <= max && !/[\u0000-\u001f\u007f]/u.test(value);
}

export class QuizService {
  constructor(private readonly repository: QuizRepository, private readonly createId: () => string = randomUUID, private readonly now: () => string = () => new Date().toISOString()) {}

  async createQuiz(input: unknown, ownerId?: string): Promise<Quiz> {
    return this.repository.create(this.normalizeQuiz(input, ownerId));
  }

  async updateQuiz(id: string, input: unknown, ownerId: string): Promise<Quiz> {
    const existing = await this.getQuizById(id);
    this.assertOwner(existing, ownerId);
    const updated = this.normalizeQuiz(input, ownerId, id, existing.createdAt);
    if (this.repository.updateOwned) return this.repository.updateOwned(updated, ownerId);
    return this.repository.update(updated);
  }

  async duplicateQuiz(id: string, ownerId: string): Promise<Quiz> {
    const original = await this.getQuizById(id);
    if (original.ownerId && original.ownerId !== ownerId) throw new DomainError('FORBIDDEN', 403, 'Você não pode duplicar este quiz.');
    const titleSuffix = ' (cópia)';
    const title = `${original.title.slice(0, 100 - titleSuffix.length)}${titleSuffix}`;
    return this.createQuiz({ title, description: original.description, category: original.category, questions: original.questions }, ownerId);
  }

  async deleteQuiz(id: string, ownerId: string): Promise<void> {
    const quiz = await this.getQuizById(id);
    this.assertOwner(quiz, ownerId);
    if (this.repository.deleteOwned) {
      await this.repository.deleteOwned(id, ownerId);
      return;
    }
    if (!await this.repository.delete(id)) throw new DomainError('QUIZ_NOT_FOUND', 404, 'Quiz não encontrado.');
  }

  listQuizzes(): Promise<Quiz[]> { return this.repository.findAll(); }
  listQuizzesByOwner(ownerId: string): Promise<Quiz[]> { return this.repository.findAllByOwner ? this.repository.findAllByOwner(ownerId) : this.repository.findAll(); }
  listLibrary(ownerId: string, query: QuizLibraryQuery): Promise<QuizLibraryResult> {
    if (this.repository.findLibrary) return this.repository.findLibrary(ownerId, query);
    return (this.repository.findAllByOwner ? this.repository.findAllByOwner(ownerId) : this.repository.findAll()).then((quizzes) => {
      const normalized = query.search?.toLocaleLowerCase('pt-BR');
      const filtered = quizzes.filter((quiz) => (query.scope === 'mine' ? quiz.ownerId === ownerId : query.scope === 'legacy' ? !quiz.ownerId : true)
        && (!query.category || quiz.category === query.category)
        && (!normalized || `${quiz.title} ${quiz.description ?? ''}`.toLocaleLowerCase('pt-BR').includes(normalized)));
      filtered.sort((a, b) => compareQuiz(a, b, query.sort));
      return { total: filtered.length, items: filtered.slice(query.offset, query.offset + query.limit).map((quiz) => ({ id: quiz.id, title: quiz.title, description: quiz.description ?? null, category: quiz.category, questionCount: quiz.questions.length, coverImageUrl: quiz.questions.find((question) => question.imageUrl)?.imageUrl ?? null, createdAt: quiz.createdAt, updatedAt: quiz.updatedAt, ownerId: quiz.ownerId ?? null, ownerName: null, isLegacy: !quiz.ownerId })) };
    });
  }
  ownsQuiz(id: string, ownerId: string): Promise<boolean> { return this.repository.owns ? this.repository.owns(id, ownerId) : this.getQuizById(id).then((quiz) => quiz.ownerId === ownerId); }
  canUseQuiz(id: string, userId: string): Promise<boolean> { return this.repository.canUse ? this.repository.canUse(id, userId) : this.getQuizById(id).then((quiz) => !quiz.ownerId || quiz.ownerId === userId); }

  async getQuizById(id: unknown): Promise<Quiz> {
    if (typeof id !== 'string' || !id.trim() || id.length > 128) throw new DomainError('INVALID_QUIZ_ID', 400, 'Informe um identificador de quiz válido.');
    const quiz = await this.repository.findById(id);
    if (!quiz) throw new DomainError('QUIZ_NOT_FOUND', 404, 'Quiz não encontrado.');
    return quiz;
  }

  private assertOwner(quiz: Quiz, ownerId: string): void {
    if (!quiz.ownerId || quiz.ownerId !== ownerId) throw new DomainError('FORBIDDEN', 403, 'Somente o proprietário pode alterar este quiz.');
  }

  private normalizeQuiz(input: unknown, ownerId?: string, fixedId?: string, createdAt?: string): Quiz {
    if (!isRecord(input) || !hasOnlyKeys(input, ['id', 'title', 'description', 'category', 'questions']) || !validOptionalId(input.id) || !text(input.title, 3, 100) || !text(input.category, 1, 80) ||
      (input.description !== undefined && !text(input.description, 0, 300)) || !Array.isArray(input.questions) || input.questions.length > 100) {
      throw new DomainError('INVALID_QUIZ', 400, 'Os dados do quiz são inválidos.');
    }

    const questions: Question[] = input.questions.map((raw): Question => {
      if (!isRecord(raw) || !hasOnlyKeys(raw, ['id', 'question', 'imageUrl', 'options', 'correctOptionId', 'timeLimit', 'revealTime', 'points']) || !validOptionalId(raw.id) || !text(raw.question, 0, 300) || (!raw.question.trim() && !validImageUrl(raw.imageUrl)) || !validOptionalImageUrl(raw.imageUrl) || !Array.isArray(raw.options) || raw.options.length < 2 || raw.options.length > 8 ||
        !Number.isInteger(raw.timeLimit) || ![5, 10, 15, 20, 30, 60].includes(raw.timeLimit as number) ||
        (raw.revealTime !== undefined && (!Number.isInteger(raw.revealTime) || (raw.revealTime as number) < 0 || (raw.revealTime as number) > 10 || (raw.revealTime as number) >= (raw.timeLimit as number))) ||
        !Number.isInteger(raw.points) || ![100, 200, 500, 1000].includes(raw.points as number)) {
        throw new DomainError('INVALID_QUIZ', 400, 'Uma pergunta ou suas configurações são inválidas.');
      }
      const sourceOptions = raw.options as unknown[];
      if (!sourceOptions.every((o) => isRecord(o) && hasOnlyKeys(o, ['id', 'text', 'imageUrl']) && text(o.text, 0, 100) && (o.text.trim().length > 0 || validImageUrl(o.imageUrl)) && validOptionalImageUrl(o.imageUrl))) {
        throw new DomainError('INVALID_QUIZ', 400, 'Cada alternativa deve conter texto ou uma imagem válida.');
      }
      const oldIds = sourceOptions.map((o) => isRecord(o) && isIdentifier(o.id) ? o.id : '');
      if (oldIds.some((id) => id.length === 0) || new Set(oldIds).size !== oldIds.length || typeof raw.correctOptionId !== 'string' || !oldIds.includes(raw.correctOptionId)) {
        throw new DomainError('INVALID_QUIZ', 400, 'A pergunta deve indicar uma alternativa correta válida.');
      }
      const options: QuizOption[] = sourceOptions.map((o) => ({ id: this.createId(), text: ((o as Record<string, unknown>).text as string).trim(), ...((o as Record<string, unknown>).imageUrl ? { imageUrl: (o as Record<string, unknown>).imageUrl as string } : {}) }));
      return { id: this.createId(), question: (raw.question as string).trim(), ...(raw.imageUrl ? { imageUrl: raw.imageUrl as string } : {}), options, correctOptionId: options[oldIds.indexOf(raw.correctOptionId)]!.id, timeLimit: raw.timeLimit as number, revealTime: (raw.revealTime as number | undefined) ?? 0, points: raw.points as number };
    });
    const timestamp = this.now();
    return {
      id: fixedId ?? this.createId(), title: input.title.trim(), category: input.category.trim(), questions,
      ...(ownerId ? { ownerId } : {}), createdAt: createdAt ?? timestamp, updatedAt: timestamp,
      ...(typeof input.description === 'string' && input.description.trim() ? { description: input.description.trim() } : {}),
    };
  }
}

function hasOnlyKeys(value: Record<string, unknown>, allowed: string[]): boolean { return Object.keys(value).every((key) => allowed.includes(key)); }
function isIdentifier(value: unknown): value is string { return typeof value === 'string' && value.trim().length > 0 && value.length <= 128; }
function validOptionalId(value: unknown): boolean { return value === undefined || isIdentifier(value); }
function validImageUrl(value: unknown): value is string { return typeof value === 'string' && /^\/uploads\/[a-f0-9-]{36}\.(?:png|jpg|webp)$/u.test(value); }
function validOptionalImageUrl(value: unknown): boolean { return value === undefined || validImageUrl(value); }
function compareQuiz(a: Quiz, b: Quiz, sort: QuizLibraryQuery['sort']): number {
  if (sort === 'title-asc') return a.title.localeCompare(b.title, 'pt-BR') || b.updatedAt.localeCompare(a.updatedAt);
  if (sort === 'title-desc') return b.title.localeCompare(a.title, 'pt-BR') || b.updatedAt.localeCompare(a.updatedAt);
  return sort === 'oldest' ? a.createdAt.localeCompare(b.createdAt) : b.createdAt.localeCompare(a.createdAt);
}
