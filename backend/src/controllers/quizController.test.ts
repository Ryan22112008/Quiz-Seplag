import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { toPublicQuiz } from './quizController.js';

describe('public quiz projection', () => {
  it('omits correct option identifiers from public quiz data', () => {
    const quiz = toPublicQuiz({
      id: 'quiz', title: 'Quiz', category: 'geral', createdAt: 'now', updatedAt: 'now',
      questions: [{ id: 'question', question: 'Pergunta?', correctOptionId: 'secret', timeLimit: 10, points: 100,
        options: [{ id: 'secret', text: 'Resposta' }, { id: 'other', text: 'Outra' }] }],
    });
    assert.equal('correctOptionId' in quiz.questions[0]!, false);
    assert.equal(JSON.stringify(quiz).includes('correctOptionId'), false);
    assert.deepEqual(quiz.questions[0]?.options[0], { id: 'secret', text: 'Resposta' });
  });
});
