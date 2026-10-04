import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { DomainError } from '../domain/errors.js';
import { InMemoryQuizRepository } from '../repositories/quizRepository.js';
import { QuizService } from './quizService.js';

function setup() {
  let id = 0;
  return new QuizService(new InMemoryQuizRepository(), () => `server-${++id}`, () => '2026-01-01T00:00:00.000Z');
}
const payload = () => ({
  id: 'client-quiz-id', title: ' Quiz válido ', category: 'geral', description: ' Descrição ',
  questions: [{ id: 'client-question-id', question: ' Pergunta? ', options: [
    { id: 'a', text: ' A ' }, { id: 'b', text: 'B' }, { id: 'c', text: 'C' }, { id: 'd', text: 'D' },
  ], correctOptionId: 'c', timeLimit: 20, points: 1000 }],
});

describe('QuizService', () => {
  it('cria quiz, perguntas e alternativas com ids e datas do servidor', async () => {
    const service = setup(); const quiz = await service.createQuiz(payload());
    assert.equal(quiz.id, 'server-6');
    assert.equal(quiz.questions[0]?.id, 'server-5');
    assert.deepEqual(quiz.questions[0]?.options.map((o) => o.id), ['server-1', 'server-2', 'server-3', 'server-4']);
    assert.equal(quiz.questions[0]?.correctOptionId, 'server-3');
    assert.equal(quiz.title, 'Quiz válido');
    assert.equal(quiz.createdAt, quiz.updatedAt);
    assert.equal((await service.listQuizzes()).length, 1);
    assert.equal((await service.getQuizById(quiz.id)).id, quiz.id);
  });
  it('rejeita dados inválidos, inclusive alternativa correta ausente', async () => {
    const service = setup();
    await assert.rejects(() => service.createQuiz({ ...payload(), title: ' ' }), (e) => e instanceof DomainError && e.code === 'INVALID_QUIZ');
    await assert.rejects(() => service.createQuiz({ ...payload(), score: 999999 }), (e) => e instanceof DomainError && e.code === 'INVALID_QUIZ');
    const withInjectedOptionField = payload();
    (withInjectedOptionField.questions[0]!.options[0] as { id: string; text: string; score?: number }).score = 999999;
    await assert.rejects(() => service.createQuiz(withInjectedOptionField), (e) => e instanceof DomainError && e.code === 'INVALID_QUIZ');
    const bad = payload(); bad.questions[0]!.correctOptionId = 'unknown';
    await assert.rejects(() => service.createQuiz(bad), (e) => e instanceof DomainError && e.code === 'INVALID_QUIZ');
  });
  it('retorna erro consistente para quiz inexistente', async () => {
    await assert.rejects(() => setup().getQuizById('missing'), (e) => e instanceof DomainError && e.code === 'QUIZ_NOT_FOUND' && e.statusCode === 404);
  });
});
