import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { after, describe, it } from 'node:test';
import { WebSocket as ClientWebSocket } from 'ws';
import { InMemoryGameRepository } from '../repositories/gameRepository.js';
import { InMemoryQuizRepository } from '../repositories/quizRepository.js';
import { InMemoryRoomRepository } from '../repositories/roomRepository.js';
import { GameService } from '../services/gameService.js';
import { QuizService } from '../services/quizService.js';
import { RoomService } from '../services/roomService.js';
import { parseCommand, ProtocolError, type ServerEvent } from './protocol.js';
import { RealtimeHub } from './realtimeHub.js';

describe('Realtime protocol', () => {
  it('parses typed commands and rejects malformed JSON, unknown commands, and invalid payloads', () => {
    assert.deepEqual(parseCommand('{"type":"START_GAME","payload":{"roomPin":"123456"}}'), {
      type: 'START_GAME', payload: { roomPin: '123456' },
    });
    assert.throws(() => parseCommand('{'), (error) => error instanceof ProtocolError && error.code === 'INVALID_JSON');
    assert.throws(() => parseCommand('{"type":"BOGUS","payload":{}}'), (error) => error instanceof ProtocolError && error.code === 'UNKNOWN_COMMAND');
    assert.throws(() => parseCommand('{"type":"SUBMIT_ANSWER","payload":{"roomPin":"123456","questionId":"q"}}'), (error) => error instanceof ProtocolError && error.code === 'INVALID_PAYLOAD');
    assert.throws(() => parseCommand('{"type":"START_GAME","payload":{"roomPin":"123456","score":999999}}'), (error) => error instanceof ProtocolError && error.code === 'INVALID_PAYLOAD');
    assert.throws(() => parseCommand('{"type":"START_GAME","payload":{"roomPin":"123456"},"admin":true}'), (error) => error instanceof ProtocolError && error.code === 'INVALID_MESSAGE');
    assert.throws(() => parseCommand('{"type":"SUBSCRIBE_GAME","payload":{"roomPin":"123456","playerId":"player"}}'), (error) => error instanceof ProtocolError && error.code === 'INVALID_PAYLOAD');
  });
});

describe('RealtimeHub with real WebSocket clients and domain services', () => {
  let nowMs = Date.now();
  const quizService = new QuizService(new InMemoryQuizRepository());
  const roomService = new RoomService(new InMemoryRoomRepository(), quizService);
  const gameService = new GameService(new InMemoryGameRepository(), roomService, quizService, { nowMs: () => nowMs });
  const hub = new RealtimeHub({ roomService, gameService });
  const httpServer = createServer((_request, response) => { response.writeHead(404).end(); });
  hub.attach(httpServer, '/realtime', ['https://quiz.example']);
  httpServer.listen(0, '127.0.0.1');

  let endpoint = '';
  let hostA: ClientWebSocket;
  let hostB: ClientWebSocket;
  let playerA1: ClientWebSocket;
  let playerA2: ClientWebSocket;
  let playerB1: ClientWebSocket;

  after(async () => {
    for (const socket of [hostA, hostB, playerA1, playerA2, playerB1]) {
      if (socket && socket.readyState !== ClientWebSocket.CLOSED) socket.terminate();
    }
    await hub.close();
    if (httpServer.listening) await new Promise<void>((resolve) => httpServer.close(() => resolve()));
  });

  it('keeps room broadcasts isolated and routes the complete game flow through services', async () => {
    await once(httpServer, 'listening');
    const address = httpServer.address();
    assert.ok(address && typeof address !== 'string');
    endpoint = `ws://127.0.0.1:${address.port}/realtime`;
    await assert.rejects(async () => {
      const denied = new ClientWebSocket(endpoint, { headers: { Origin: 'https://attacker.example' } });
      await once(denied, 'open');
    });
    const oversized = await connect(endpoint);
    const oversizedClose = once(oversized, 'close');
    oversized.send('x'.repeat(65 * 1024));
    const [closeCode] = await oversizedClose as [number, Buffer];
    assert.equal(closeCode, 1009);
    const clients = await Promise.all(Array.from({ length: 5 }, () => connect(endpoint)));
    hostA = clients[0]!;
    hostB = clients[1]!;
    playerA1 = clients[2]!;
    playerA2 = clients[3]!;
    playerB1 = clients[4]!;

    const quiz = await quizService.createQuiz({
      title: 'Quiz realtime', category: 'geral', questions: [0, 1].map((index) => ({
        id: `source-question-${index}`, question: `Pergunta ${index + 1}?`, timeLimit: 5, revealTime: index === 0 ? 2 : 0, points: 100,
        correctOptionId: `source-option-${index}-0`,
        options: [0, 1, 2, 3].map((option) => ({ id: `source-option-${index}-${option}`, text: `Alternativa ${option + 1}` })),
      })),
    });

    const createdA = waitForType(hostA, 'ROOM_CREATED');
    send(hostA, { type: 'CREATE_ROOM', payload: { quizId: quiz.id } });
    const roomA = (await createdA).payload.room;
    const { room: roomB, hostToken: hostBToken } = await roomService.createRoomWithHostToken(quiz.id);
    const hostBSubscribed = waitForType(hostB, 'ROOM_SUBSCRIBED');
    const hostBSynced = waitForType(hostB, 'ROOM_SYNCED');
    send(hostB, { type: 'SUBSCRIBE_GAME', payload: { roomPin: roomB.pin, hostToken: hostBToken } });
    assert.equal((await hostBSubscribed).payload.role, 'host');
    assert.equal((await hostBSynced).payload.game, null);
    assert.notEqual(roomA.pin, roomB.pin);

    const noContext = waitForType(playerB1, 'REALTIME_ERROR');
    send(playerB1, { type: 'SUBSCRIBE_GAME', payload: { roomPin: roomB.pin } });
    assert.equal((await noContext).payload.code, 'FORBIDDEN');
    const stolenPinCannotClaimHost = waitForType(playerB1, 'REALTIME_ERROR');
    send(playerB1, { type: 'SUBSCRIBE_GAME', payload: { roomPin: roomB.pin, hostToken: 'guessable-pin-is-not-a-token' } });
    assert.equal((await stolenPinCannotClaimHost).payload.code, 'FORBIDDEN');

    const joinedA1 = waitForType(hostA, 'PLAYER_JOINED');
    const subscribedA1 = waitForType(playerA1, 'ROOM_SUBSCRIBED');
    send(playerA1, { type: 'JOIN_ROOM', payload: { roomPin: roomA.pin, playerName: 'Jogador A1' } });
    const playerOne = (await joinedA1).payload.player;
    const playerOneToken = (await subscribedA1).payload.playerToken!;

    const joinedA2 = waitForType(hostA, 'PLAYER_JOINED');
    const subscribedA2 = waitForType(playerA2, 'ROOM_SUBSCRIBED');
    send(playerA2, { type: 'JOIN_ROOM', payload: { roomPin: roomA.pin, playerName: 'Jogador A2' } });
    const playerTwo = (await joinedA2).payload.player;
    const playerTwoToken = (await subscribedA2).payload.playerToken!;

    const subscribedB = waitForType(playerB1, 'ROOM_SUBSCRIBED');
    const joinedB1 = waitForType(playerB1, 'PLAYER_JOINED');
    send(playerB1, { type: 'JOIN_ROOM', payload: { roomPin: roomB.pin, playerName: 'Jogador B1' } });
    const playerB = await joinedB1;
    const playerBToken = (await subscribedB).payload.playerToken!;
    const forgedPlayerCapability = waitForType(playerB1, 'REALTIME_ERROR');
    send(playerB1, { type: 'SUBSCRIBE_GAME', payload: { roomPin: roomB.pin, playerId: playerB.payload.player.id, playerToken: 'forged' } });
    assert.equal((await forgedPlayerCapability).payload.code, 'FORBIDDEN');
    assert.equal(playerB.payload.player.name, 'Jogador B1');
    assert.equal(hub.roomConnectionCount(roomA.pin), 3);
    assert.equal(hub.roomConnectionCount(roomB.pin), 2);

    const crossRoomError = waitForType(playerB1, 'REALTIME_ERROR');
    send(playerB1, { type: 'START_GAME', payload: { roomPin: roomA.pin } });
    assert.equal((await crossRoomError).payload.code, 'ROOM_CONTEXT_MISMATCH');
    const roleError = waitForType(playerA1, 'REALTIME_ERROR');
    send(playerA1, { type: 'START_GAME', payload: { roomPin: roomA.pin } });
    assert.equal((await roleError).payload.code, 'FORBIDDEN');
    for (const command of [
      { type: 'START_QUESTION', payload: { roomPin: roomA.pin } },
      { type: 'END_QUESTION', payload: { roomPin: roomA.pin, questionId: 'question' } },
      { type: 'NEXT_QUESTION', payload: { roomPin: roomA.pin } },
      { type: 'FINISH_GAME', payload: { roomPin: roomA.pin } },
      { type: 'CLOSE_ROOM', payload: { roomPin: roomA.pin } },
    ] as const) {
      const forbidden = waitForType(playerA1, 'REALTIME_ERROR');
      send(playerA1, command);
      assert.equal((await forbidden).payload.code, 'FORBIDDEN');
    }

    const forgedIdentity = waitForType(playerA1, 'REALTIME_ERROR');
    send(playerA1, { type: 'SUBMIT_ANSWER', payload: { roomPin: roomA.pin, questionId: 'q', optionId: 'o', playerId: playerTwo.id } });
    assert.equal((await forgedIdentity).payload.code, 'INVALID_PAYLOAD');

    const crossRoomSubscribe = waitForType(playerB1, 'REALTIME_ERROR');
    send(playerB1, { type: 'SUBSCRIBE_GAME', payload: { roomPin: roomA.pin, playerId: playerB.payload.player.id, playerToken: playerBToken } });
    assert.equal((await crossRoomSubscribe).payload.code, 'ROOM_CONTEXT_MISMATCH');

    const gameStartedA = Promise.all([waitForType(hostA, 'GAME_STARTED'), waitForType(playerA1, 'GAME_STARTED'), waitForType(playerA2, 'GAME_STARTED')]);
    send(hostA, { type: 'START_GAME', payload: { roomPin: roomA.pin } });
    const startEvent = (await gameStartedA)[0]!;
    assert.equal(startEvent.payload.totalQuestions, 2);
    await assertNoMessage(playerB1);

    const questionStartedA = Promise.all([waitForType(hostA, 'QUESTION_STARTED'), waitForType(playerA1, 'QUESTION_STARTED'), waitForType(playerA2, 'QUESTION_STARTED')]);
    send(hostA, { type: 'START_QUESTION', payload: { roomPin: roomA.pin } });
    const questionEvent = (await questionStartedA)[0]!;
    assert.equal(questionEvent.payload.question.questionEndsAt, new Date(nowMs + 5_000).toISOString());
    assert.equal(questionEvent.payload.question.questionRevealAt, new Date(nowMs + 2_000).toISOString());
    assert.equal(JSON.stringify(questionEvent).includes('correctOptionId'), false);
    assert.equal(JSON.stringify(questionEvent).includes('points'), false);
    await assertNoMessage(playerB1);

    const earlyAnswer = waitForType(playerA1, 'REALTIME_ERROR');
    send(playerA1, { type: 'SUBMIT_ANSWER', payload: { roomPin: roomA.pin, questionId: questionEvent.payload.questionId, optionId: questionEvent.payload.question.options[0]!.id } });
    assert.equal((await earlyAnswer).payload.code, 'QUESTION_NOT_REVEALED');

    const revealDisconnect = once(playerA2, 'close');
    playerA2.close();
    await revealDisconnect;
    await waitUntil(() => hub.roomConnectionCount(roomA.pin) === 2);
    playerA2 = await connect(endpoint);
    const revealSubscribed = waitForType(playerA2, 'ROOM_SUBSCRIBED');
    const revealSnapshot = waitForType(playerA2, 'ROOM_SYNCED');
    send(playerA2, { type: 'SUBSCRIBE_GAME', payload: { roomPin: roomA.pin, playerId: playerTwo.id, playerToken: playerTwoToken } });
    await revealSubscribed;
    const duringReveal = (await revealSnapshot).payload.game?.currentQuestion;
    assert.equal(duringReveal?.questionRevealAt, questionEvent.payload.question.questionRevealAt);
    assert.equal(Date.parse(duringReveal!.questionRevealAt) > nowMs, true);

    nowMs = Date.parse(questionEvent.payload.question.questionRevealAt);

    const answerEvents = Promise.all([
      waitForType(hostA, 'ANSWER_SUBMITTED'), waitForType(hostA, 'RANKING_UPDATED'),
      waitForType(playerA1, 'ANSWER_SUBMITTED'), waitForType(playerA1, 'RANKING_UPDATED'),
      waitForType(playerA2, 'ANSWER_SUBMITTED'), waitForType(playerA2, 'RANKING_UPDATED'),
    ]);
    send(playerA1, { type: 'SUBMIT_ANSWER', payload: { roomPin: roomA.pin, questionId: questionEvent.payload.questionId, optionId: questionEvent.payload.question.options[0]!.id } });
    const events = await answerEvents;
    assert.equal(events[1]!.payload.ranking[0]!.playerId, playerOne.id);
    assert.equal(events[2]!.payload.playerId, playerOne.id);
    await assertNoMessage(playerB1);

    const disconnected = once(playerA1, 'close');
    playerA1.close();
    await disconnected;
    await waitUntil(() => hub.roomConnectionCount(roomA.pin) === 2);
    playerA1 = await connect(endpoint);
    const reconnectSubscribed = waitForType(playerA1, 'ROOM_SUBSCRIBED');
    const reconnectSnapshot = waitForType(playerA1, 'ROOM_SYNCED');
    send(playerA1, { type: 'SUBSCRIBE_GAME', payload: { roomPin: roomA.pin, playerId: playerOne.id, playerToken: playerOneToken } });
    await reconnectSubscribed;
    const activeSnapshot = (await reconnectSnapshot).payload;
    assert.equal(activeSnapshot.game?.currentQuestion?.questionId, questionEvent.payload.questionId);
    assert.equal(activeSnapshot.game?.currentQuestion?.questionStartedAt, questionEvent.payload.questionStartedAt);
    assert.equal(activeSnapshot.game?.currentQuestion?.questionEndsAt, questionEvent.payload.questionEndsAt);
    assert.equal(activeSnapshot.game?.currentQuestion?.questionRevealAt, questionEvent.payload.question.questionRevealAt);
    assert.equal(activeSnapshot.hasAnsweredCurrentQuestion, true);
    assert.equal((await roomService.getRoomByPin(roomA.pin)).players.length, 2, 'reconexão não cria jogador duplicado');

    nowMs = Date.parse(questionEvent.payload.questionEndsAt) + 1;
    const ended = Promise.all([waitForType(hostA, 'QUESTION_ENDED'), waitForType(playerA1, 'QUESTION_ENDED')]);
    send(hostA, { type: 'END_QUESTION', payload: { roomPin: roomA.pin, questionId: questionEvent.payload.questionId } });
    await ended;

    const lockedSubscribed = waitForType(playerA2, 'ROOM_SUBSCRIBED');
    const lockedSnapshot = waitForType(playerA2, 'ROOM_SYNCED');
    send(playerA2, { type: 'SUBSCRIBE_GAME', payload: { roomPin: roomA.pin, playerId: playerTwo.id, playerToken: playerTwoToken } });
    await lockedSubscribed;
    assert.equal((await lockedSnapshot).payload.questionEnded, true);

    const nextQuestion = Promise.all([waitForType(hostA, 'QUESTION_STARTED'), waitForType(playerA2, 'QUESTION_STARTED')]);
    send(hostA, { type: 'NEXT_QUESTION', payload: { roomPin: roomA.pin } });
    const secondQuestion = (await nextQuestion)[0]!;
    assert.equal(secondQuestion.payload.questionIndex, 1);

    nowMs = Date.parse(secondQuestion.payload.questionEndsAt) + 1;
    const finalEvents = Promise.all([waitForType(hostA, 'GAME_FINISHED'), waitForType(playerA1, 'GAME_FINISHED'), waitForType(playerA2, 'GAME_FINISHED')]);
    send(hostA, { type: 'NEXT_QUESTION', payload: { roomPin: roomA.pin } });
    const finished = (await finalEvents)[0]!;
    assert.equal(finished.payload.ranking.find((entry) => entry.playerId === playerOne.id)?.score, 60);
    await assertNoMessage(playerB1);

    const finishedSubscribed = waitForType(playerA1, 'ROOM_SUBSCRIBED');
    const finishedSnapshot = waitForType(playerA1, 'ROOM_SYNCED');
    send(playerA1, { type: 'SUBSCRIBE_GAME', payload: { roomPin: roomA.pin, playerId: playerOne.id, playerToken: playerOneToken } });
    await finishedSubscribed;
    const finalSnapshot = (await finishedSnapshot).payload;
    assert.equal(finalSnapshot.game?.status, 'FINISHED');
    assert.equal(finalSnapshot.ranking.find((entry) => entry.playerId === playerOne.id)?.score, 60);

    const invalidJson = waitForType(playerB1, 'REALTIME_ERROR');
    playerB1.send('{');
    assert.equal((await invalidJson).payload.code, 'INVALID_JSON');
    const unknownCommand = waitForType(playerB1, 'REALTIME_ERROR');
    playerB1.send('{"type":"BOGUS","payload":{}}');
    assert.equal((await unknownCommand).payload.code, 'UNKNOWN_COMMAND');

    const playerLeft = waitForType(hostB, 'PLAYER_LEFT');
    send(playerB1, { type: 'LEAVE_ROOM', payload: { roomPin: roomB.pin, playerId: playerB.payload.player.id } });
    assert.equal((await playerLeft).payload.playerId, playerB.payload.player.id);
    assert.equal((await roomService.getRoomByPin(roomB.pin)).players.length, 0);
    const joinedB2 = waitForType(hostB, 'PLAYER_JOINED');
    const subscribedB2 = waitForType(playerB1, 'ROOM_SUBSCRIBED');
    const playerB2FromRest = await roomService.joinRoom(roomB.pin, 'Jogador B2');
    send(playerB1, { type: 'SUBSCRIBE_GAME', payload: { roomPin: roomB.pin, playerId: playerB2FromRest.player.id, playerToken: playerB2FromRest.playerToken } });
    const playerB2 = await joinedB2;
    assert.equal(playerB2.payload.player.id, playerB2FromRest.player.id);
    await subscribedB2;
    playerB1.close();
    await waitUntil(() => hub.connectionCount === 4);
    await waitUntil(() => hub.roomConnectionCount(roomB.pin) === 1);
    const remainingPlayers = (await roomService.getRoomByPin(roomB.pin)).players;
    assert.equal(remainingPlayers.length, 1, 'disconnect não remove o jogador do domínio');
    assert.equal(remainingPlayers[0]!.id, playerB2.payload.player.id);

    const gameStartedB = waitForType(hostB, 'GAME_STARTED');
    send(hostB, { type: 'START_GAME', payload: { roomPin: roomB.pin } });
    await gameStartedB;
    const gameFinishedB = waitForType(hostB, 'GAME_FINISHED');
    send(hostB, { type: 'FINISH_GAME', payload: { roomPin: roomB.pin } });
    assert.equal((await gameFinishedB).payload.ranking[0]!.playerId, playerB2.payload.player.id);
    const roomClosed = waitForType(hostB, 'ROOM_CLOSED');
    send(hostB, { type: 'CLOSE_ROOM', payload: { roomPin: roomB.pin } });
    await roomClosed;
    assert.equal(hub.connectionCount, 4);
  });
});

async function connect(url: string): Promise<ClientWebSocket> {
  const socket = new ClientWebSocket(url);
  await once(socket, 'open');
  return socket;
}

function send(socket: ClientWebSocket, message: unknown): void { socket.send(JSON.stringify(message)); }

function waitForType<T extends ServerEvent['type']>(socket: ClientWebSocket, type: T): Promise<Extract<ServerEvent, { type: T }>> {
  return new Promise((resolve, reject) => {
    const seen: string[] = [];
    const timeout = setTimeout(() => { cleanup(); reject(new Error(`Tempo esgotado aguardando ${type}; recebidos: ${seen.join(', ')}.`)); }, 2_000);
    const onMessage = (data: Buffer) => {
      let value: unknown;
      try { value = JSON.parse(data.toString('utf8')) as unknown; } catch (error) { cleanup(); reject(error); return; }
      if (isServerEvent(value)) seen.push(value.type === 'REALTIME_ERROR' ? `${value.type}:${value.payload.code}:${value.payload.message}` : value.type);
      if (isServerEvent(value) && value.type === type) { cleanup(); resolve(value as Extract<ServerEvent, { type: T }>); }
    };
    const cleanup = () => { clearTimeout(timeout); socket.off('message', onMessage); };
    socket.on('message', onMessage);
  });
}

async function assertNoMessage(socket: ClientWebSocket): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const onMessage = (data: Buffer) => { cleanup(); reject(new Error(`Evento inesperado recebido: ${data.toString('utf8')}`)); };
    const cleanup = () => { clearTimeout(timeout); socket.off('message', onMessage); };
    const timeout = setTimeout(() => { cleanup(); resolve(); }, 80);
    socket.on('message', onMessage);
  });
}

async function waitUntil(predicate: () => boolean): Promise<void> {
  const deadline = Date.now() + 2_000;
  while (!predicate()) {
    if (Date.now() >= deadline) throw new Error('Estado esperado não foi atingido.');
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

function isServerEvent(value: unknown): value is ServerEvent {
  return typeof value === 'object' && value !== null && 'type' in value && 'payload' in value;
}
