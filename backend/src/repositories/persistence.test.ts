import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { describe, it } from 'node:test';
import { prisma } from '../lib/prisma.js';
import { PrismaQuizRepository } from './quizRepository.js';
import { PrismaRoomRepository } from './roomRepository.js';
import type { Quiz } from '../domain/quiz.js';
import type { Room } from '../domain/room.js';
import { DomainError } from '../domain/errors.js';

const databaseTest = (name: string, run: () => Promise<void>) =>
  it(name, { skip: process.env.RUN_DATABASE_TESTS !== 'true' }, run);

describe('Prisma repositories (MySQL)', () => {
  databaseTest('persiste quiz, relações, sala e jogadores após reconectar ao banco', async () => {
    const quizId = randomUUID(); const questionId = randomUUID(); const optionIds = Array.from({ length: 4 }, () => randomUUID());
    const roomId = randomUUID(); const playerId = randomUUID();
    const quizRepo = new PrismaQuizRepository(prisma); const roomRepo = new PrismaRoomRepository(prisma);
    const quiz: Quiz = {
      id: quizId, title: 'Persistência de teste', category: 'geral', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      questions: [{ id: questionId, question: 'Pergunta de teste?', timeLimit: 20, points: 1000, correctOptionId: optionIds[2]!, options: optionIds.map((id, i) => ({ id, text: `Opção ${i + 1}` })) }],
    };
    const room: Room = { id: roomId, pin: String(100000 + Math.floor(Math.random() * 900000)), quizId, status: 'WAITING', players: [{ id: playerId, name: 'Jogador teste' }] };

    try {
      await quizRepo.create(quiz);
      const createdRoom = await roomRepo.create({ ...room, players: [] });
      assert.equal(createdRoom.players.length, 0);
      await roomRepo.addPlayer(roomId, room.players[0]!);
      await prisma.$disconnect();
      await prisma.$connect();

      const storedQuiz = await quizRepo.findById(quizId);
      const storedRoom = await roomRepo.findByPin(room.pin);
      assert.equal(storedQuiz?.questions[0]?.correctOptionId, optionIds[2]);
      assert.deepEqual(storedQuiz?.questions[0]?.options.map((o) => o.id), optionIds);
      assert.deepEqual(storedRoom?.players, [{ id: playerId, name: 'Jogador teste' }]);
      assert.equal(storedRoom?.quizId, quizId);
      assert.equal('correctOptionId' in (storedRoom ?? {}), false);

      const renamedQuiz = await quizRepo.update({ ...storedQuiz!, title: 'Quiz atualizado', updatedAt: new Date().toISOString() });
      assert.equal(renamedQuiz.title, 'Quiz atualizado');
      const updatedRoom = await roomRepo.update({ ...storedRoom!, status: 'STARTING' });
      assert.equal(updatedRoom.status, 'STARTING');
      await assert.rejects(() => roomRepo.addPlayer(roomId, { id: randomUUID(), name: 'jOGADOR TESTE' }), (error) => error instanceof DomainError && error.code === 'PLAYER_ALREADY_EXISTS');
      assert.deepEqual((await roomRepo.removePlayer(roomId, playerId)).players, []);
      assert.equal(await roomRepo.delete(roomId), true);
      assert.equal(await roomRepo.findByPin(room.pin), undefined);
      assert.equal(await quizRepo.delete(quizId), true);
      assert.equal(await quizRepo.findById(quizId), undefined);
    } finally {
      await roomRepo.delete(roomId);
      await quizRepo.delete(quizId);
    }
  });
});
