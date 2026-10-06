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
  it('associa o proprietário vindo do contexto do servidor e rejeita ownerId enviado pelo cliente', async () => {
    const service = setup();
    const created = await service.createQuiz(payload(), 'user-42');
    assert.equal(created.ownerId, 'user-42');
    await assert.rejects(() => service.createQuiz({ ...payload(), ownerId: 'user-forjado' }, 'user-42'), (error) => error instanceof DomainError && error.code === 'INVALID_QUIZ');
    assert.equal(await service.ownsQuiz(created.id, 'user-42'), true);
    assert.equal(await service.ownsQuiz(created.id, 'other-user'), false);
    const legacy = await service.createQuiz(payload());
    assert.equal(await service.canUseQuiz(legacy.id, 'any-authenticated-user'), true);
    assert.deepEqual((await service.listQuizzesByOwner('user-42')).map(({ id }) => id), [created.id, legacy.id]);
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
  it('aceita de duas a oito alternativas e rejeita os limites fora do intervalo', async () => {
    const service = setup();
    const two = payload();
    two.questions[0]!.options.splice(2);
    two.questions[0]!.correctOptionId = 'b';
    assert.equal((await service.createQuiz(two)).questions[0]?.options.length, 2);
    const tooFew = payload();
    tooFew.questions[0]!.options.splice(1);
    tooFew.questions[0]!.correctOptionId = 'a';
    await assert.rejects(() => service.createQuiz(tooFew), (e) => e instanceof DomainError && e.code === 'INVALID_QUIZ');
    const tooMany = payload();
    tooMany.questions[0]!.options.push(...Array.from({ length: 5 }, (_, index) => ({ id: `extra-${index}`, text: 'Extra' })));
    await assert.rejects(() => service.createQuiz(tooMany), (e) => e instanceof DomainError && e.code === 'INVALID_QUIZ');
  });
  it('aceita imagens armazenadas pela aplicação nas perguntas e alternativas', async () => {
    const data = payload();
    data.questions[0]!.question = '';
    Object.assign(data.questions[0]!, { imageUrl: '/uploads/00000000-0000-0000-0000-000000000000.png' });
    Object.assign(data.questions[0]!.options[0]!, { text: '', imageUrl: '/uploads/11111111-1111-1111-1111-111111111111.webp' });
    const quiz = await setup().createQuiz(data);
    assert.equal(quiz.questions[0]?.imageUrl, '/uploads/00000000-0000-0000-0000-000000000000.png');
    assert.equal(quiz.questions[0]?.options[0]?.imageUrl, '/uploads/11111111-1111-1111-1111-111111111111.webp');
  });
  it('usa revealTime zero por padrão e rejeita valores negativos, acima do limite ou do timeLimit', async () => {
    const service = setup();
    assert.equal((await service.createQuiz(payload())).questions[0]?.revealTime, 0);
    const delayed = payload(); Object.assign(delayed.questions[0]!, { revealTime: 5 });
    assert.equal((await service.createQuiz(delayed)).questions[0]?.revealTime, 5);
    for (const revealTime of [-1, 11, 20, 2.5, '5']) {
      const invalid = payload(); Object.assign(invalid.questions[0]!, { revealTime });
      await assert.rejects(() => service.createQuiz(invalid), (error) => error instanceof DomainError && error.code === 'INVALID_QUIZ');
    }
  });
  it('retorna erro consistente para quiz inexistente', async () => {
    await assert.rejects(() => setup().getQuizById('missing'), (e) => e instanceof DomainError && e.code === 'QUIZ_NOT_FOUND' && e.statusCode === 404);
  });
  it('busca, filtra, ordena e pagina apenas quizzes visíveis ao usuário', async () => {
    const service = setup();
    const beta = await service.createQuiz({ ...payload(), title: 'Beta Geografia' }, 'user-a');
    await service.createQuiz({ ...payload(), title: 'Alfa História', category: 'historia' }, 'user-a');
    await service.createQuiz({ ...payload(), title: 'Quiz privado de outra pessoa' }, 'user-b');
    const legacy = await service.createQuiz({ ...payload(), title: 'Geografia legado' });
    const result = await service.listLibrary('user-a', { search: 'geografia', scope: 'all', sort: 'title-asc', offset: 0, limit: 10 });
    assert.equal(result.total, 2);
    assert.deepEqual(result.items.map((item) => item.title), ['Beta Geografia', 'Geografia legado']);
    assert.equal(result.items[1]?.isLegacy, true);
    assert.equal(result.items[0]?.questionCount, 1);
    const mine = await service.listLibrary('user-a', { scope: 'mine', sort: 'title-asc', offset: 0, limit: 10 });
    assert.equal(mine.total, 2);
    assert.equal(mine.items.some((item) => item.id === legacy.id), false);
    assert.equal(mine.items.some((item) => item.id === beta.id), true);
    const noResults = await service.listLibrary('user-a', { search: 'inexistente', scope: 'all', sort: 'recent', offset: 0, limit: 10 });
    assert.deepEqual(noResults, { total: 0, items: [] });
  });
  it('permite editar e excluir apenas o quiz próprio', async () => {
    const service = setup();
    const quiz = await service.createQuiz(payload(), 'user-a');
    const changed = await service.updateQuiz(quiz.id, { title: 'Título atualizado', description: quiz.description, category: quiz.category, questions: quiz.questions }, 'user-a');
    assert.equal(changed.title, 'Título atualizado');
    assert.equal(changed.ownerId, 'user-a');
    await assert.rejects(() => service.updateQuiz(quiz.id, { title: 'Alteração alheia', category: quiz.category, questions: quiz.questions }, 'user-b'), (error) => error instanceof DomainError && error.code === 'FORBIDDEN');
    const legacy = await service.createQuiz(payload());
    await assert.rejects(() => service.updateQuiz(legacy.id, { title: 'Alteração legada', category: legacy.category, questions: legacy.questions }, 'user-a'), (error) => error instanceof DomainError && error.code === 'FORBIDDEN');
    await assert.rejects(() => service.deleteQuiz(quiz.id, 'user-b'), (error) => error instanceof DomainError && error.code === 'FORBIDDEN');
    await assert.rejects(() => service.deleteQuiz(legacy.id, 'user-a'), (error) => error instanceof DomainError && error.code === 'FORBIDDEN');
    await service.deleteQuiz(quiz.id, 'user-a');
    await assert.rejects(() => service.getQuizById(quiz.id), (error) => error instanceof DomainError && error.code === 'QUIZ_NOT_FOUND');
  });
  it('duplica quizzes próprios e legados com novos identificadores e propriedade atual', async () => {
    const service = setup();
    const legacy = await service.createQuiz(payload());
    const duplicate = await service.duplicateQuiz(legacy.id, 'user-a');
    assert.equal(duplicate.ownerId, 'user-a');
    assert.equal(duplicate.title, `${legacy.title} (cópia)`);
    assert.notEqual(duplicate.id, legacy.id);
    assert.notEqual(duplicate.questions[0]?.id, legacy.questions[0]?.id);
    assert.notEqual(duplicate.questions[0]?.options[0]?.id, legacy.questions[0]?.options[0]?.id);
    assert.equal(duplicate.questions[0]?.correctOptionId, duplicate.questions[0]?.options[2]?.id);
    const owned = await service.createQuiz(payload(), 'user-a');
    assert.equal((await service.duplicateQuiz(owned.id, 'user-a')).ownerId, 'user-a');
    await assert.rejects(() => service.duplicateQuiz(owned.id, 'user-b'), (error) => error instanceof DomainError && error.code === 'FORBIDDEN');
  });
});
