import { randomUUID } from 'node:crypto';
import { DomainError } from '../domain/errors.js';
import type { Question, Quiz, QuizOption } from '../domain/quiz.js';
import type { QuizRepository } from '../repositories/quizRepository.js';

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
function text(value: unknown, min: number, max: number): value is string {
  return typeof value === 'string' && value.trim().length >= min && value.trim().length <= max && !/[\u0000-\u001f\u007f]/u.test(value);
}

export class QuizService {
  constructor(private readonly repository: QuizRepository, private readonly createId: () => string = randomUUID, private readonly now: () => string = () => new Date().toISOString()) {}

  async createQuiz(input: unknown): Promise<Quiz> {
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
    const quiz: Quiz = {
      id: this.createId(), title: input.title.trim(), category: input.category.trim(), questions,
      createdAt: timestamp, updatedAt: timestamp,
      ...(typeof input.description === 'string' && input.description.trim() ? { description: input.description.trim() } : {}),
    };
    return this.repository.create(quiz);
  }

  listQuizzes(): Promise<Quiz[]> { return this.repository.findAll(); }
  async getQuizById(id: unknown): Promise<Quiz> {
    if (typeof id !== 'string' || !id.trim() || id.length > 128) throw new DomainError('INVALID_QUIZ_ID', 400, 'Informe um identificador de quiz válido.');
    const quiz = await this.repository.findById(id);
    if (!quiz) throw new DomainError('QUIZ_NOT_FOUND', 404, 'Quiz não encontrado.');
    return quiz;
  }
}

function hasOnlyKeys(value: Record<string, unknown>, allowed: string[]): boolean {
  return Object.keys(value).every((key) => allowed.includes(key));
}

function isIdentifier(value: unknown): value is string { return typeof value === 'string' && value.trim().length > 0 && value.length <= 128; }
function validOptionalId(value: unknown): boolean { return value === undefined || isIdentifier(value); }
function validImageUrl(value: unknown): value is string { return typeof value === 'string' && /^\/uploads\/[a-f0-9-]{36}\.(?:png|jpg|webp)$/u.test(value); }
function validOptionalImageUrl(value: unknown): boolean { return value === undefined || validImageUrl(value); }
