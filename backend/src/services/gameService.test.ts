import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { DomainError } from '../domain/errors.js';
import { InMemoryGameRepository } from '../repositories/gameRepository.js';
import { InMemoryQuizRepository } from '../repositories/quizRepository.js';
import { InMemoryRoomRepository } from '../repositories/roomRepository.js';
import { GameService } from './gameService.js';
import { QuizService } from './quizService.js';
import { RoomService } from './roomService.js';

async function createSetup(emptyQuiz = false, questionCount = 1, clock?: { value: number }) {
  let quizId = 0; let roomId = 0; let gameId = 0;
  const quizService = new QuizService(new InMemoryQuizRepository(), () => `quiz-${++quizId}`);
  const quiz = await quizService.createQuiz({
    title: 'Quiz de partida', category: 'geral', questions: emptyQuiz ? [] : Array.from({ length: questionCount }, (_, index) => ({
      question: `Pergunta ${index + 1}`, options: [
        { id: 'client-a', text: 'A' }, { id: 'client-b', text: 'B' }, { id: 'client-c', text: 'C' }, { id: 'client-d', text: 'D' },
      ], correctOptionId: 'client-c', timeLimit: index === 1 ? 5 : 20, points: 1000,
    })),
  });
  const roomService = new RoomService(new InMemoryRoomRepository(), quizService, {
    createId: () => `room-id-${++roomId}`, generatePin: () => '123456',
  });
  const room = await roomService.createRoom(quiz.id);
  const gameRepository = new InMemoryGameRepository();
  const gameService = new GameService(gameRepository, roomService, quizService, {
    createId: () => `game-id-${++gameId}`, now: () => '2026-10-02T12:00:00.000Z',
    ...(clock ? { nowMs: () => clock.value } : {}),
  });
  return { quiz, room, roomService, gameRepository, gameService };
}

async function expectDomainError(action: () => Promise<unknown>, code: string, statusCode: number) {
  await assert.rejects(action, (error: unknown) =>
    error instanceof DomainError && error.code === code && error.statusCode === statusCode,
  );
}

describe('GameService', () => {
  it('inicia uma partida válida com referências, estado e timestamps do servidor', async () => {
    const { quiz, room, gameService, roomService } = await createSetup();
    const state = await gameService.startGame(room.pin);

    assert.equal(state.id, 'game-id-1');
    assert.equal(state.roomId, room.id);
    assert.equal(state.roomPin, room.pin);
    assert.equal(state.quizId, quiz.id);
    assert.equal(state.status, 'IN_PROGRESS');
    assert.equal(state.currentQuestionIndex, 0);
    assert.equal(state.totalQuestions, 1);
    assert.equal(state.startedAt, '2026-10-02T12:00:00.000Z');
    assert.equal(state.createdAt, state.startedAt);
    assert.equal(state.finishedAt, null);
    assert.equal((await roomService.getRoomByPin(room.pin)).status, 'IN_PROGRESS');
  });

  it('obtém o estado público da partida da sala', async () => {
    const { room, gameService } = await createSetup();
    const started = await gameService.startGame(room.pin);
    assert.deepEqual(await gameService.getGame(room.pin), started);
    assert.deepEqual(await gameService.getGameState(room.pin), started);
  });

  it('impede uma segunda partida simultânea na mesma sala', async () => {
    const { room, gameService } = await createSetup();
    await gameService.startGame(room.pin);
    await expectDomainError(() => gameService.startGame(room.pin), 'GAME_ALREADY_IN_PROGRESS', 409);
  });

  it('finaliza a partida e fecha a sala', async () => {
    const { room, gameService, roomService } = await createSetup();
    await gameService.startGame(room.pin);
    const finished = await gameService.finishGame(room.pin);
    assert.equal(finished.status, 'FINISHED');
    assert.equal(finished.finishedAt, '2026-10-02T12:00:00.000Z');
    assert.equal((await roomService.getRoomByPin(room.pin)).status, 'FINISHED');
  });

  it('impede finalizar a mesma partida duas vezes', async () => {
    const { room, gameService } = await createSetup();
    await gameService.startGame(room.pin);
    await gameService.finishGame(room.pin);
    await expectDomainError(() => gameService.finishGame(room.pin), 'GAME_ALREADY_FINISHED', 409);
  });

  it('serializa duas tentativas simultâneas de finalizar a mesma partida', async () => {
    const { room, gameService } = await createSetup();
    await gameService.startGame(room.pin);
    const results = await Promise.allSettled([gameService.finishGame(room.pin), gameService.finishGame(room.pin)]);
    assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1);
    const rejection = results.find((result) => result.status === 'rejected');
    assert.ok(rejection?.status === 'rejected' && rejection.reason instanceof DomainError);
    assert.equal(rejection.reason.code, 'GAME_ALREADY_FINISHED');
  });

  it('rejeita consulta e finalização quando a sala ainda não tem partida', async () => {
    const { room, gameService } = await createSetup();
    await expectDomainError(() => gameService.getGame(room.pin), 'GAME_NOT_FOUND', 404);
    await expectDomainError(() => gameService.finishGame(room.pin), 'GAME_NOT_FOUND', 404);
  });

  it('rejeita sala inexistente ao iniciar', async () => {
    const { gameService } = await createSetup();
    await expectDomainError(() => gameService.startGame('999999'), 'ROOM_NOT_FOUND', 404);
  });

  it('rejeita início em sala encerrada e quiz sem perguntas', async () => {
    const closedSetup = await createSetup();
    await closedSetup.roomService.closeRoom(closedSetup.room.id);
    await expectDomainError(() => closedSetup.gameService.startGame(closedSetup.room.pin), 'ROOM_NOT_STARTABLE', 409);

    const emptySetup = await createSetup(true);
    await expectDomainError(() => emptySetup.gameService.startGame(emptySetup.room.pin), 'QUIZ_NOT_STARTABLE', 409);
  });

  it('não expõe perguntas, opções ou correctOptionId no estado público', async () => {
    const { room, quiz, gameService } = await createSetup();
    const privateCorrectOptionId = quiz.questions[0]!.correctOptionId;
    const state = await gameService.startGame(room.pin);
    const serialized = JSON.stringify(state);

    assert.equal('correctOptionId' in state, false);
    assert.equal('questions' in state, false);
    assert.equal('options' in state, false);
    assert.equal(serialized.includes(privateCorrectOptionId), false);
  });

  it('retorna erro de partida inexistente para identificador ausente', async () => {
    const { gameRepository } = await createSetup();
    await expectDomainError(() => gameRepository.update({
      id: 'missing', roomId: 'room', roomPin: '111111', quizId: 'quiz', status: 'FINISHED',
      currentQuestionIndex: 0, totalQuestions: 0, currentQuestionId: null, questionStartedAt: null,
      questionEndsAt: null, startedAt: '', finishedAt: '', createdAt: '',
    }), 'GAME_NOT_FOUND', 404);
  });

  it('inicia a pergunta com timestamps absolutos e projeção sem resposta correta', async () => {
    const clock = { value: Date.parse('2026-10-02T12:00:00.000Z') };
    const { room, gameService } = await createSetup(false, 2, clock);
    const game = await gameService.startGame(room.pin);
    const state = await gameService.startQuestion(game.id);
    assert.equal(state.currentQuestionIndex, 0);
    assert.equal(state.currentQuestion?.text, 'Pergunta 1');
    assert.equal(state.currentQuestion?.options.length, 4);
    assert.equal(state.questionStartedAt, '2026-10-02T12:00:00.000Z');
    assert.equal(state.questionEndsAt, '2026-10-02T12:00:20.000Z');
    assert.ok(Date.parse(state.questionEndsAt!) > Date.parse(state.questionStartedAt!));
    assert.equal(JSON.stringify(state).includes('correctOptionId'), false);
    assert.equal(await gameService.isQuestionExpired(game.id), false);
    clock.value += 20_000;
    assert.equal(await gameService.isQuestionExpired(game.id), true);
  });

  it('recusa início duplicado e avanço antes do prazo', async () => {
    const clock = { value: Date.parse('2026-10-02T12:00:00.000Z') };
    const { room, gameService } = await createSetup(false, 2, clock);
    const game = await gameService.startGame(room.pin);
    await gameService.startQuestion(game.id);
    await expectDomainError(() => gameService.startQuestion(game.id), 'QUESTION_ALREADY_ACTIVE', 409);
    await expectDomainError(() => gameService.nextQuestion(game.id), 'QUESTION_NOT_EXPIRED', 409);
  });

  it('avança após expirar e usa a duração definida na próxima questão', async () => {
    const clock = { value: Date.parse('2026-10-02T12:00:00.000Z') };
    const { room, gameService } = await createSetup(false, 2, clock);
    const game = await gameService.startGame(room.pin);
    await gameService.startQuestion(game.id);
    clock.value += 20_000;
    const second = await gameService.nextQuestion(game.id);
    assert.equal(second.currentQuestionIndex, 1);
    assert.equal(second.currentQuestion?.text, 'Pergunta 2');
    assert.equal(second.questionStartedAt, '2026-10-02T12:00:20.000Z');
    assert.equal(second.questionEndsAt, '2026-10-02T12:00:25.000Z');
  });

  it('finaliza após a última pergunta expirar e fecha a sala', async () => {
    const clock = { value: Date.parse('2026-10-02T12:00:00.000Z') };
    const { room, gameService, roomService } = await createSetup(false, 1, clock);
    const game = await gameService.startGame(room.pin);
    await gameService.startQuestion(game.id);
    clock.value += 20_000;
    const finished = await gameService.nextQuestion(game.id);
    assert.equal(finished.status, 'FINISHED');
    assert.equal(finished.finishedAt, '2026-10-02T12:00:20.000Z');
    assert.equal(finished.currentQuestion?.text, 'Pergunta 1');
    assert.equal((await roomService.getRoomByPin(room.pin)).status, 'FINISHED');
    await expectDomainError(() => gameService.startQuestion(game.id), 'GAME_NOT_IN_PROGRESS', 409);
  });

  it('rejeita início simultâneo duplicado sem divergir o estado', async () => {
    const clock = { value: Date.parse('2026-10-02T12:00:00.000Z') };
    const { room, gameService } = await createSetup(false, 2, clock);
    const game = await gameService.startGame(room.pin);
    const results = await Promise.allSettled([gameService.startQuestion(game.id), gameService.startQuestion(game.id)]);
    assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1);
    assert.equal((await gameService.getGame(room.pin)).currentQuestionIndex, 0);
  });

  it('impede duas transições simultâneas de avançarem mais de uma pergunta', async () => {
    const clock = { value: Date.parse('2026-10-02T12:00:00.000Z') };
    const { room, gameService } = await createSetup(false, 3, clock);
    const game = await gameService.startGame(room.pin);
    await gameService.startQuestion(game.id);
    clock.value += 20_000;
    const results = await Promise.allSettled([gameService.nextQuestion(game.id), gameService.nextQuestion(game.id)]);
    assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1);
    assert.equal((await gameService.getGame(room.pin)).currentQuestionIndex, 1);
  });

  it('retorna erros consistentes para partida inexistente, finalizada ou sem pergunta ativa', async () => {
    const clock = { value: Date.parse('2026-10-02T12:00:00.000Z') };
    const { room, gameService } = await createSetup(false, 2, clock);
    await expectDomainError(() => gameService.startQuestion('missing'), 'GAME_NOT_FOUND', 404);
    await expectDomainError(() => gameService.nextQuestion('missing'), 'GAME_NOT_FOUND', 404);
    const game = await gameService.startGame(room.pin);
    await expectDomainError(() => gameService.nextQuestion(game.id), 'QUESTION_NOT_STARTED', 409);
    await gameService.finishGame(room.pin);
    await expectDomainError(() => gameService.nextQuestion(game.id), 'GAME_NOT_IN_PROGRESS', 409);
  });

  it('registra acerto e erro calculando pontos e horário exclusivamente no servidor', async () => {
    const clock = { value: Date.parse('2026-10-02T12:00:00.000Z') };
    const { room, quiz, gameService, roomService, gameRepository } = await createSetup(false, 2, clock);
    const { player: correctPlayer } = await roomService.joinRoom(room.pin, 'Ana');
    const { player: wrongPlayer } = await roomService.joinRoom(room.pin, 'Bia');
    const game = await gameService.startGame(room.pin);
    const question = quiz.questions[0]!;
    await gameService.startQuestion(game.id);
    clock.value += 10_000;

    const correct = await gameService.submitAnswer(game.id, {
      playerId: correctPlayer.id, questionId: question.id, optionId: question.correctOptionId,
    });
    const wrong = await gameService.submitAnswer(game.id, {
      playerId: wrongPlayer.id, questionId: question.id,
      optionId: question.options.find((option) => option.id !== question.correctOptionId)!.id,
    });
    assert.deepEqual(correct, { accepted: true, isCorrect: true, points: 500, totalScore: 500 });
    assert.deepEqual(wrong, { accepted: true, isCorrect: false, points: 0, totalScore: 0 });
    const saved = await gameRepository.findAnswer(game.id, question.id, correctPlayer.id);
    assert.equal(saved?.answeredAt, '2026-10-02T12:00:10.000Z');
    assert.equal(saved?.isCorrect, true);
    assert.equal(saved?.points, 500);
  });

  it('limita acerto ao máximo da questão e rejeita campos de pontuação enviados pelo cliente', async () => {
    const clock = { value: Date.parse('2026-10-02T12:00:00.000Z') };
    const { room, quiz, gameService, roomService } = await createSetup(false, 1, clock);
    const { player } = await roomService.joinRoom(room.pin, 'Rápido');
    const game = await gameService.startGame(room.pin);
    const question = quiz.questions[0]!;
    await gameService.startQuestion(game.id);
    const result = await gameService.submitAnswer(game.id, {
      playerId: player.id, questionId: question.id, optionId: question.correctOptionId,
    });
    assert.equal(result.points, question.points);
    await expectDomainError(() => gameService.submitAnswer(game.id, {
      playerId: player.id, questionId: question.id, optionId: question.correctOptionId,
      points: 999999, isCorrect: false, answeredAt: '2000-01-01T00:00:00.000Z', score: 999999,
    }), 'INVALID_ANSWER', 400);
  });

  it('rejeita resposta no limite exato do prazo e mantém as respostas válidas já registradas', async () => {
    const clock = { value: Date.parse('2026-10-02T12:00:00.000Z') };
    const { room, quiz, gameService, roomService, gameRepository } = await createSetup(false, 1, clock);
    const { player } = await roomService.joinRoom(room.pin, 'Jogadora');
    const { player: latePlayer } = await roomService.joinRoom(room.pin, 'Atrasada');
    const game = await gameService.startGame(room.pin);
    const question = quiz.questions[0]!;
    await gameService.startQuestion(game.id);
    const answer = { playerId: player.id, questionId: question.id, optionId: question.correctOptionId };
    clock.value += 19_999;
    await gameService.submitAnswer(game.id, answer);
    clock.value += 1;
    await expectDomainError(() => gameService.submitAnswer(game.id, {
      playerId: latePlayer.id, questionId: question.id, optionId: question.correctOptionId,
    }), 'QUESTION_EXPIRED', 409);
    assert.ok(await gameRepository.findAnswer(game.id, question.id, player.id));
  });

  it('valida partida, estado, pergunta, jogador e alternativa antes de aceitar resposta', async () => {
    const clock = { value: Date.parse('2026-10-02T12:00:00.000Z') };
    const { room, quiz, gameService, roomService } = await createSetup(false, 2, clock);
    const { player } = await roomService.joinRoom(room.pin, 'Membro');
    const game = await gameService.startGame(room.pin);
    const first = quiz.questions[0]!;
    const second = quiz.questions[1]!;
    await expectDomainError(() => gameService.submitAnswer('missing', {
      playerId: player.id, questionId: first.id, optionId: first.options[0]!.id,
    }), 'GAME_NOT_FOUND', 404);
    await expectDomainError(() => gameService.submitAnswer(game.id, {
      playerId: player.id, questionId: first.id, optionId: first.options[0]!.id,
    }), 'QUESTION_NOT_STARTED', 409);
    await gameService.startQuestion(game.id);
    await expectDomainError(() => gameService.submitAnswer(game.id, {
      playerId: player.id, questionId: 'not-a-question', optionId: first.options[0]!.id,
    }), 'QUESTION_NOT_FOUND', 404);
    await expectDomainError(() => gameService.submitAnswer(game.id, {
      playerId: 'not-in-room', questionId: first.id, optionId: first.options[0]!.id,
    }), 'PLAYER_NOT_FOUND', 404);
    await expectDomainError(() => gameService.submitAnswer(game.id, {
      playerId: player.id, questionId: first.id, optionId: 'not-an-option',
    }), 'OPTION_NOT_FOUND', 404);
    await expectDomainError(() => gameService.submitAnswer(game.id, {
      playerId: player.id, questionId: first.id, optionId: second.options[0]!.id,
    }), 'OPTION_NOT_FOUND', 404);
    await gameService.finishGame(room.pin);
    await expectDomainError(() => gameService.submitAnswer(game.id, {
      playerId: player.id, questionId: first.id, optionId: first.options[0]!.id,
    }), 'GAME_NOT_IN_PROGRESS', 409);
  });

  it('rejeita resposta duplicada sem substituir a primeira nem somar pontos outra vez', async () => {
    const clock = { value: Date.parse('2026-10-02T12:00:00.000Z') };
    const { room, quiz, gameService, roomService, gameRepository } = await createSetup(false, 1, clock);
    const { player } = await roomService.joinRoom(room.pin, 'Única');
    const game = await gameService.startGame(room.pin);
    const question = quiz.questions[0]!;
    await gameService.startQuestion(game.id);
    const firstOption = question.correctOptionId;
    const otherOption = question.options.find((option) => option.id !== firstOption)!.id;
    await gameService.submitAnswer(game.id, { playerId: player.id, questionId: question.id, optionId: firstOption });
    await expectDomainError(() => gameService.submitAnswer(game.id, {
      playerId: player.id, questionId: question.id, optionId: otherOption,
    }), 'ANSWER_ALREADY_SUBMITTED', 409);
    assert.equal((await gameRepository.findAnswer(game.id, question.id, player.id))?.selectedOptionId, firstOption);
    assert.equal((await gameRepository.listScores(game.id))[0]?.score, 1000);
  });

  it('ordena ranking, mantém participantes sem resposta e desempata de forma determinística', async () => {
    const clock = { value: Date.parse('2026-10-02T12:00:00.000Z') };
    const { room, quiz, gameService, roomService } = await createSetup(false, 1, clock);
    const { player: bruna } = await roomService.joinRoom(room.pin, 'Bruna');
    const { player: ana } = await roomService.joinRoom(room.pin, 'Ana');
    const { player: caio } = await roomService.joinRoom(room.pin, 'Caio');
    const game = await gameService.startGame(room.pin);
    const question = quiz.questions[0]!;
    await gameService.startQuestion(game.id);
    await gameService.submitAnswer(game.id, { playerId: bruna.id, questionId: question.id, optionId: question.correctOptionId });
    const ranking = await gameService.getRanking(room.pin);
    assert.deepEqual(ranking.map((entry) => [entry.position, entry.playerName, entry.score, entry.correctAnswers]), [
      [1, 'Bruna', 1000, 1], [2, 'Ana', 0, 0], [3, 'Caio', 0, 0],
    ]);
    assert.ok(ranking.some((entry) => entry.playerId === ana.id));
    assert.ok(ranking.some((entry) => entry.playerId === caio.id));
  });

  it('acumula a pontuação do mesmo jogador entre perguntas e reflete a soma no ranking', async () => {
    const clock = { value: Date.parse('2026-10-02T12:00:00.000Z') };
    const { room, quiz, gameService, roomService } = await createSetup(false, 2, clock);
    const { player } = await roomService.joinRoom(room.pin, 'Acumulador');
    const game = await gameService.startGame(room.pin);
    const [first, second] = quiz.questions;
    await gameService.startQuestion(game.id);
    clock.value += 10_000;
    const firstAnswer = await gameService.submitAnswer(game.id, {
      playerId: player.id, questionId: first!.id, optionId: first!.correctOptionId,
    });
    clock.value += 10_000;
    await gameService.nextQuestion(game.id);
    const secondAnswer = await gameService.submitAnswer(game.id, {
      playerId: player.id, questionId: second!.id, optionId: second!.correctOptionId,
    });
    assert.equal(firstAnswer.totalScore, 500);
    assert.equal(secondAnswer.totalScore, 1500);
    assert.equal((await gameService.getRanking(room.pin))[0]?.score, 1500);
  });

  it('aceita respostas simultâneas de pessoas distintas, mas apenas uma para a mesma pessoa', async () => {
    const clock = { value: Date.parse('2026-10-02T12:00:00.000Z') };
    const { room, quiz, gameService, roomService, gameRepository } = await createSetup(false, 1, clock);
    const { player: one } = await roomService.joinRoom(room.pin, 'Um');
    const { player: two } = await roomService.joinRoom(room.pin, 'Dois');
    const game = await gameService.startGame(room.pin);
    const question = quiz.questions[0]!;
    await gameService.startQuestion(game.id);
    const correct = { questionId: question.id, optionId: question.correctOptionId };
    const competing = await Promise.allSettled([
      gameService.submitAnswer(game.id, { ...correct, playerId: one.id }),
      gameService.submitAnswer(game.id, { ...correct, playerId: one.id }),
    ]);
    assert.equal(competing.filter((result) => result.status === 'fulfilled').length, 1);
    const differentPlayers = await Promise.allSettled([
      gameService.submitAnswer(game.id, { ...correct, playerId: one.id }),
      gameService.submitAnswer(game.id, { ...correct, playerId: two.id }),
    ]);
    assert.equal(differentPlayers.filter((result) => result.status === 'fulfilled').length, 1);
    assert.ok(differentPlayers.some((result) => result.status === 'fulfilled' && result.value.totalScore === 1000 && result.value.isCorrect));
    assert.equal((await gameRepository.listScores(game.id)).length, 2);
  });
});
