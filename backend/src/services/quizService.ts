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
    if (!isRecord(input) || !text(input.title, 3, 100) || !text(input.category, 1, 80) ||
      (input.description !== undefined && !text(input.description, 0, 300)) || !Array.isArray(input.questions) || input.questions.length > 100) {
      throw new DomainError('INVALID_QUIZ', 400, 'Os dados do quiz são inválidos.');
    }

    const questions: Question[] = input.questions.map((raw): Question => {
      if (!isRecord(raw) || !text(raw.question, 1, 300) || !Array.isArray(raw.options) || raw.options.length !== 4 ||
        !Number.isInteger(raw.timeLimit) || ![5, 10, 15, 20, 30, 60].includes(raw.timeLimit as number) ||
        !Number.isInteger(raw.points) || ![100, 200, 500, 1000].includes(raw.points as number)) {
        throw new DomainError('INVALID_QUIZ', 400, 'Uma pergunta ou suas configurações são inválidas.');
      }
      const sourceOptions = raw.options as unknown[];
      if (!sourceOptions.every((o) => isRecord(o) && text(o.text, 1, 100))) {
        throw new DomainError('INVALID_QUIZ', 400, 'Cada alternativa deve conter um texto válido.');
      }
      const oldIds = sourceOptions.map((o) => isRecord(o) && typeof o.id === 'string' ? o.id : '');
      if (oldIds.some((id) => id.length === 0) || new Set(oldIds).size !== oldIds.length || typeof raw.correctOptionId !== 'string' || !oldIds.includes(raw.correctOptionId)) {
        throw new DomainError('INVALID_QUIZ', 400, 'A pergunta deve indicar uma alternativa correta válida.');
      }
      const options: QuizOption[] = sourceOptions.map((o) => ({ id: this.createId(), text: ((o as Record<string, unknown>).text as string).trim() }));
      return { id: this.createId(), question: (raw.question as string).trim(), options, correctOptionId: options[oldIds.indexOf(raw.correctOptionId)]!.id, timeLimit: raw.timeLimit as number, points: raw.points as number };
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
