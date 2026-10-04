import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { DomainError } from '../domain/errors.js';
import { InMemoryRoomRepository } from '../repositories/roomRepository.js';
import { RoomService } from './roomService.js';

function createService(pins: string[] = ['482931']) {
  let id = 0;
  let pinIndex = 0;
  const repository = new InMemoryRoomRepository();
  const quizzes = {
    async getQuizById(id: unknown) {
      if (typeof id === 'string' && id.startsWith('quiz-')) return { id, title: 'Fixture', category: 'geral', questions: [], createdAt: '', updatedAt: '' };
      throw new DomainError('QUIZ_NOT_FOUND', 404, 'Quiz não encontrado.');
    },
  };
  const service = new RoomService(repository, quizzes, {
    createId: () => `server-id-${++id}`,
    generatePin: () => pins[pinIndex++] ?? '654321',
  });
  return { repository, service };
}

async function expectDomainError(action: () => Promise<unknown>, code: string, statusCode: number): Promise<void> {
  await assert.rejects(action, (error: unknown) =>
    error instanceof DomainError && error.code === code && error.statusCode === statusCode,
  );
}

describe('RoomService', () => {
  it('cria uma sala com id separado do PIN, PIN de seis dígitos e estado WAITING', async () => {
    const { service } = createService();
    const room = await service.createRoom('quiz-123');

    assert.equal(room.id, 'server-id-1');
    assert.notEqual(room.id, room.pin);
    assert.match(room.pin, /^\d{6}$/u);
    assert.equal(room.quizId, 'quiz-123');
    assert.equal(room.status, 'WAITING');
    assert.deepEqual(room.players, []);
  });

  it('emite capacidades aleatórias e as vincula exclusivamente à sala e ao jogador', async () => {
    const { service } = createService();
    const { room, hostToken } = await service.createRoomWithHostToken('quiz-1');
    const joined = await service.joinRoom(room.pin, 'Ryan');
    assert.equal(hostToken.length, 43);
    assert.equal(service.isValidHostToken(room.id, hostToken), true);
    assert.equal(service.isValidHostToken(room.id, `${hostToken}x`), false);
    assert.equal(service.isValidPlayerToken(room.id, joined.player.id, joined.playerToken), true);
    assert.equal(service.isValidPlayerToken(room.id, 'outro-jogador', joined.playerToken), false);
    assert.equal(service.isValidPlayerToken('outra-sala', joined.player.id, joined.playerToken), false);
    await service.leaveRoom(room.pin, joined.player.id);
    assert.equal(service.isValidPlayerToken(room.id, joined.player.id, joined.playerToken), false);
  });

  it('gera outro PIN quando o PIN já está ocupado', async () => {
    const { service } = createService(['482931', '482931', '654321']);
    const first = await service.createRoom('quiz-1');
    const second = await service.createRoom('quiz-2');

    assert.equal(first.pin, '482931');
    assert.equal(second.pin, '654321');
  });

  it('rejeita quizId vazio ou inválido', async () => {
    const { service } = createService();
    await expectDomainError(() => service.createRoom('  '), 'INVALID_QUIZ_ID', 400);
    await expectDomainError(() => service.createRoom(42), 'INVALID_QUIZ_ID', 400);
  });

  it('rejeita criar sala para quiz inexistente', async () => {
    const { service } = createService();
    await expectDomainError(() => service.createRoom('missing-quiz'), 'QUIZ_NOT_FOUND', 404);
  });

  it('permite entrar e gera a identidade do jogador no servidor', async () => {
    const { service } = createService();
    const room = await service.createRoom('quiz-1');
    const joined = await service.joinRoom(room.pin, '  Ryan   Mendes  ');

    assert.deepEqual(joined.player, { id: 'server-id-2', name: 'Ryan Mendes' });
    assert.equal(joined.room.players.length, 1);
    assert.deepEqual((await service.getRoomByPin(room.pin)).players, [joined.player]);
  });

  it('rejeita PIN inválido e sala inexistente', async () => {
    const { service } = createService();
    await expectDomainError(() => service.getRoomByPin('123'), 'INVALID_ROOM_PIN', 400);
    await expectDomainError(() => service.getRoomByPin('111111'), 'ROOM_NOT_FOUND', 404);
  });

  it('rejeita nome vazio, longo demais ou com caracteres de controle', async () => {
    const { service } = createService();
    const room = await service.createRoom('quiz-1');
    await expectDomainError(() => service.joinRoom(room.pin, '  '), 'INVALID_PLAYER_NAME', 400);
    await expectDomainError(() => service.joinRoom(room.pin, 'x'.repeat(25)), 'INVALID_PLAYER_NAME', 400);
    await expectDomainError(() => service.joinRoom(room.pin, 'nome\ninválido'), 'INVALID_PLAYER_NAME', 400);
  });

  it('rejeita nomes duplicados sem diferenciar maiúsculas e minúsculas', async () => {
    const { service } = createService();
    const room = await service.createRoom('quiz-1');
    await service.joinRoom(room.pin, 'Ryan');
    await expectDomainError(() => service.joinRoom(room.pin, ' rYaN '), 'PLAYER_ALREADY_EXISTS', 409);
  });

  it('rejeita entrada quando a sala não está mais aguardando', async () => {
    const { service } = createService();
    const room = await service.createRoom('quiz-1');
    await service.setRoomStatus(room.id, 'STARTING');
    await expectDomainError(() => service.joinRoom(room.pin, 'Ryan'), 'ROOM_NOT_JOINABLE', 409);
  });

  it('remove um jogador e rejeita jogador ou sala inexistentes', async () => {
    const { service } = createService();
    const room = await service.createRoom('quiz-1');
    const { player } = await service.joinRoom(room.pin, 'Ryan');

    assert.deepEqual((await service.leaveRoom(room.pin, player.id)).players, []);
    await expectDomainError(() => service.leaveRoom(room.pin, player.id), 'PLAYER_NOT_FOUND', 404);
    await expectDomainError(() => service.leaveRoom('111111', player.id), 'ROOM_NOT_FOUND', 404);
  });

  it('permite transições definidas e rejeita transições arbitrárias', async () => {
    const { service } = createService();
    const room = await service.createRoom('quiz-1');
    assert.equal((await service.setRoomStatus(room.id, 'STARTING')).status, 'STARTING');
    assert.equal((await service.setRoomStatus(room.id, 'IN_PROGRESS')).status, 'IN_PROGRESS');
    assert.equal((await service.closeRoom(room.id)).status, 'FINISHED');
    await expectDomainError(() => service.setRoomStatus(room.id, 'WAITING'), 'INVALID_ROOM_TRANSITION', 409);
  });

  it('repository atualiza e remove salas e libera o PIN removido', async () => {
    const { repository, service } = createService(['482931', '482931']);
    const room = await service.createRoom('quiz-1');
    assert.equal((await repository.findById(room.id))?.pin, room.pin);
    assert.equal(await repository.delete(room.id), true);
    assert.equal(await repository.findByPin(room.pin), undefined);
    assert.equal(await repository.delete(room.id), false);
    assert.equal((await service.createRoom('quiz-2')).pin, '482931');
  });
});
