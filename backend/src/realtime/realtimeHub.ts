import type { IncomingMessage, Server } from 'node:http';
import { WebSocket, WebSocketServer, type RawData } from 'ws';
import { DomainError } from '../domain/errors.js';
import type { GameService } from '../services/gameService.js';
import type { RoomService } from '../services/roomService.js';
import { ProtocolError, parseCommand, type ClientCommand, type ServerEvent } from './protocol.js';

type Role = 'host' | 'player';
interface RealtimeIdentity { id: string; email: string }
interface AuthenticatedUpgradeRequest extends IncomingMessage { quizUser?: RealtimeIdentity }
interface ConnectionContext { roomPin?: string; playerId?: string; role?: Role; user?: RealtimeIdentity }
interface RealtimeServices {
  roomService: Pick<RoomService, 'createRoomWithHostToken' | 'getRoomByPin' | 'joinRoom' | 'leaveRoom' | 'closeRoom' | 'isValidHostToken' | 'isValidPlayerToken'>;
  gameService: Pick<GameService, 'startGame' | 'getGame' | 'startQuestion' | 'isQuestionExpired' | 'submitAnswer' | 'getRanking' | 'beginQuestionResults' | 'advanceAfterResults' | 'finishGame' | 'hasAnswered' | 'advanceIfAllAnswered'>;
}
interface RealtimeHubDependencies { nowMs?: () => number; authenticate?: (cookie?: string) => Promise<RealtimeIdentity | null> }

/** Owns WebSocket membership and routes commands through the existing domain services. */
export class RealtimeHub {
  private readonly contexts = new Map<WebSocket, ConnectionContext>();
  private readonly socketsByRoom = new Map<string, Set<WebSocket>>();
  private readonly roomVersions = new Map<string, number>();
  private readonly endedQuestions = new Set<string>();
  private readonly questionTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private readonly resultsTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private server: WebSocketServer | undefined;
  private shuttingDown = false;

  private readonly nowMs: () => number;
  private readonly authenticate?: RealtimeHubDependencies['authenticate'];

  constructor(private readonly services: RealtimeServices, dependencies: RealtimeHubDependencies = {}) {
    this.nowMs = dependencies.nowMs ?? Date.now;
    this.authenticate = dependencies.authenticate;
  }

  attach(httpServer: Server, path = '/realtime', allowedOrigins: readonly string[] = []): WebSocketServer {
    if (this.server) throw new Error('RealtimeHub já está conectado a um servidor HTTP.');
    const server = new WebSocketServer({
      server: httpServer, path, maxPayload: 64 * 1024,
      verifyClient: (info, callback) => {
        void (async () => {
          if (info.origin && !allowedOrigins.includes(info.origin)) { callback(false, 403, 'Origem não permitida.'); return; }
          if (this.authenticate) {
            const identity = await this.authenticate(info.req.headers.cookie);
            if (!identity) { callback(false, 401, 'Entre com sua conta para participar da partida.'); return; }
            (info.req as AuthenticatedUpgradeRequest).quizUser = identity;
          }
          callback(true);
        })().catch(() => callback(false, 503, 'Não foi possível validar sua sessão.'));
      },
    });
    this.server = server;
    server.on('connection', (socket, request) => this.accept(socket, (request as AuthenticatedUpgradeRequest).quizUser));
    server.on('error', () => { /* Connection errors are reported to their socket; keep the HTTP process alive. */ });
    return server;
  }

  get connectionCount(): number { return this.contexts.size; }
  roomConnectionCount(roomPin: string): number { return this.socketsByRoom.get(roomPin)?.size ?? 0; }

  async close(): Promise<void> {
    this.shuttingDown = true;
    for (const socket of this.contexts.keys()) {
      try { socket.close(1001, 'Servidor encerrando'); } catch { /* best effort */ }
      socket.terminate();
    }
    this.contexts.clear();
    this.socketsByRoom.clear();
    this.roomVersions.clear();
    for (const timer of this.questionTimers.values()) clearTimeout(timer);
    this.questionTimers.clear();
    for (const timer of this.resultsTimers.values()) clearTimeout(timer);
    this.resultsTimers.clear();
    const server = this.server;
    this.server = undefined;
    if (server) await new Promise<void>((resolve) => server.close(() => resolve()));
  }

  private accept(socket: WebSocket, user?: RealtimeIdentity): void {
    if (this.shuttingDown) { socket.close(1001, 'Servidor encerrando'); return; }
    this.contexts.set(socket, user ? { user } : {});
    socket.on('message', (data) => { void this.processMessage(socket, data); });
    socket.on('close', () => this.detach(socket));
    socket.on('error', () => this.detach(socket));
  }

  private async processMessage(socket: WebSocket, data: RawData): Promise<void> {
    let command: ClientCommand;
    try { command = parseCommand(rawDataToString(data)); }
    catch (error) { this.sendError(socket, error); return; }
    try { await this.execute(socket, command); }
    catch (error) { this.sendError(socket, error); }
  }

  private async execute(socket: WebSocket, command: ClientCommand): Promise<void> {
    switch (command.type) {
      case 'CREATE_ROOM': {
        this.requireUnbound(socket);
        const { room, hostToken } = await this.services.roomService.createRoomWithHostToken(command.payload.quizId);
        this.bind(socket, room.pin, 'host');
        this.send(socket, { type: 'ROOM_CREATED', payload: { room: toClientRoom(room), hostToken } });
        return;
      }
      case 'JOIN_ROOM': {
        this.requireUnbound(socket);
        const context = this.context(socket);
        if (this.authenticate && !context.user) this.fail('UNAUTHENTICATED', 'Entre com sua conta para participar da partida.');
        const joined = await this.services.roomService.joinRoom(command.payload.roomPin, command.payload.playerName, command.payload.avatarCharacterId, command.payload.avatarAccessoryId, context.user ? { userId: context.user.id, email: context.user.email } : undefined);
        this.bind(socket, joined.room.pin, 'player', joined.player.id);
        this.broadcast(joined.room.pin, { type: 'PLAYER_JOINED', payload: { roomPin: joined.room.pin, player: toClientPlayer(joined.player) } });
        this.send(socket, { type: 'ROOM_SUBSCRIBED', payload: { roomPin: joined.room.pin, role: 'player', playerToken: joined.playerToken } });
        return;
      }
      case 'SUBSCRIBE_GAME': {
        const context = this.context(socket);
        if (context.roomPin && context.roomPin !== command.payload.roomPin) this.fail('ROOM_CONTEXT_MISMATCH', 'Esta conexão já está associada a outra sala.');
        const room = await this.services.roomService.getRoomByPin(command.payload.roomPin);
        let role: Role;
        let playerId: string | undefined;
        if (command.payload.playerId !== undefined && command.payload.playerToken !== undefined) {
          const player = room.players.find((item) => item.id === command.payload.playerId);
          if (!player) this.fail('PLAYER_NOT_FOUND', 'Jogador não pertence a esta sala.');
          if (this.authenticate && (!context.user || player.userId !== context.user.id)) this.fail('FORBIDDEN', 'Entre com a conta associada a este participante.');
          if (!this.services.roomService.isValidPlayerToken(room.id, player.id, command.payload.playerToken)) this.fail('FORBIDDEN', 'A identidade do jogador não foi comprovada.');
          role = 'player';
          playerId = player.id;
        } else if (context.role === 'host' && context.roomPin === room.pin) {
          role = 'host';
        } else if (command.payload.hostToken !== undefined && this.services.roomService.isValidHostToken(room.id, command.payload.hostToken)) {
          role = 'host';
        } else {
          this.fail('FORBIDDEN', 'É necessário o contexto de host ou de jogador para entrar na sala.');
        }
        if (context.roomPin === room.pin && context.role !== role) this.fail('FORBIDDEN', 'O papel desta conexão não pode ser alterado.');
        const isNewPlayerSubscription = role === 'player' && (context.roomPin !== room.pin || context.playerId !== playerId);
        this.bind(socket, room.pin, role, playerId);
        this.send(socket, { type: 'ROOM_SUBSCRIBED', payload: { roomPin: room.pin, role } });
        // REST creates the official player record; subscribing publishes that record to the lobby.
        if (isNewPlayerSubscription && playerId) {
          const player = room.players.find((item) => item.id === playerId);
          if (player) this.broadcast(room.pin, { type: 'PLAYER_JOINED', payload: { roomPin: room.pin, player: toClientPlayer(player) } });
        }
        let synced = false;
        let syncedRoom = room;
        let syncedGame: Awaited<ReturnType<GameService['getGame']>> | null = null;
        while (!synced) {
          const version = this.roomVersions.get(room.pin) ?? 0;
          let game: Awaited<ReturnType<GameService['getGame']>> | null = null;
          let ranking: Awaited<ReturnType<GameService['getRanking']>> = [];
          let questionEnded = false;
          let hasAnsweredCurrentQuestion = false;
          try {
            game = await this.services.gameService.getGame(room.pin);
            ranking = await this.services.gameService.getRanking(room.pin);
            if (game.currentQuestion) {
              questionEnded = game.status === 'FINISHED' || await this.services.gameService.isQuestionExpired(game.id);
              if (playerId) hasAnsweredCurrentQuestion = await this.services.gameService.hasAnswered(room.pin, game.currentQuestion.questionId, playerId);
            }
          } catch (error) {
            if (!(error instanceof DomainError) || error.code !== 'GAME_NOT_FOUND') throw error;
          }
          const currentRoom = await this.services.roomService.getRoomByPin(room.pin);
          if (version !== (this.roomVersions.get(room.pin) ?? 0)) continue;
          syncedRoom = currentRoom;
          syncedGame = game;
          this.send(socket, { type: 'ROOM_SYNCED', payload: {
            room: toClientRoom(currentRoom), game, ranking, hasAnsweredCurrentQuestion, questionEnded,
          } });
          if (game?.phase === 'QUESTION_RESULTS' && game.currentQuestion && game.resultsEndsAt) {
            this.scheduleResultsEnd(game.roomPin, game.id, game.currentQuestion.questionId, game.resultsEndsAt);
          }
          synced = true;
        }
        if (syncedRoom.status === 'FINISHED' && syncedGame?.status !== 'FINISHED') {
          this.send(socket, { type: 'ROOM_CLOSED', payload: { roomPin: room.pin } });
        }
        return;
      }
      case 'LEAVE_ROOM': {
        const context = this.requireRoom(socket, command.payload.roomPin);
        if (context.role === 'host') {
          if (command.payload.playerId !== undefined) this.fail('FORBIDDEN', 'O host não pode sair em nome de um jogador.');
          this.unbind(socket);
          return;
        }
        if (!context.playerId || (command.payload.playerId !== undefined && command.payload.playerId !== context.playerId)) {
          this.fail('FORBIDDEN', 'O jogador informado não corresponde a esta conexão.');
        }
        await this.services.roomService.leaveRoom(context.roomPin!, context.playerId);
        this.broadcast(context.roomPin!, { type: 'PLAYER_LEFT', payload: { roomPin: context.roomPin!, playerId: context.playerId } });
        await this.advanceIfAllAnswered(context.roomPin!);
        this.unbind(socket);
        return;
      }
      case 'START_GAME': {
        this.requireHost(socket, command.payload.roomPin);
        const game = await this.services.gameService.startGame(command.payload.roomPin);
        this.broadcast(game.roomPin, { type: 'GAME_STARTED', payload: { quizId: game.quizId, roomPin: game.roomPin, totalQuestions: game.totalQuestions } });
        return;
      }
      case 'START_QUESTION': {
        this.requireHost(socket, command.payload.roomPin);
        const current = await this.services.gameService.getGame(command.payload.roomPin);
        const game = await this.services.gameService.startQuestion(current.id);
        this.broadcastQuestion(game);
        return;
      }
      case 'END_QUESTION': {
        this.requireHost(socket, command.payload.roomPin);
        const game = await this.services.gameService.getGame(command.payload.roomPin);
        if (game.currentQuestion?.questionId !== command.payload.questionId) this.fail('QUESTION_NOT_CURRENT', 'A pergunta informada não está ativa.');
        if (!(await this.services.gameService.isQuestionExpired(game.id))) this.fail('QUESTION_NOT_EXPIRED', 'O tempo da pergunta ainda não terminou.');
        await this.startResults(game.roomPin, game.id, command.payload.questionId, true);
        return;
      }
      case 'NEXT_QUESTION': {
        this.requireHost(socket, command.payload.roomPin);
        const current = await this.services.gameService.getGame(command.payload.roomPin);
        if (!current.currentQuestion) this.fail('QUESTION_NOT_STARTED', 'Não há uma pergunta ativa.');
        await this.startResults(current.roomPin, current.id, current.currentQuestion.questionId, false);
        return;
      }
      case 'SUBMIT_ANSWER': {
        const context = this.requirePlayer(socket, command.payload.roomPin);
        const game = await this.services.gameService.getGame(command.payload.roomPin);
        const result = await this.services.gameService.submitAnswer(game.id, {
          playerId: context.playerId!, questionId: command.payload.questionId, optionId: command.payload.optionId,
        });
        if (!result.accepted) this.fail('INVALID_ANSWER', 'A resposta não foi aceita.');
        this.broadcast(command.payload.roomPin, { type: 'ANSWER_SUBMITTED', payload: { roomPin: command.payload.roomPin, playerId: context.playerId! } });
        const ranking = await this.services.gameService.getRanking(command.payload.roomPin);
        this.broadcast(command.payload.roomPin, { type: 'RANKING_UPDATED', payload: { roomPin: command.payload.roomPin, ranking } });
        await this.advanceIfAllAnswered(command.payload.roomPin, command.payload.questionId);
        return;
      }
      case 'FINISH_GAME': {
        this.requireHost(socket, command.payload.roomPin);
        const game = await this.services.gameService.finishGame(command.payload.roomPin);
        this.clearQuestionTimer(game.roomPin);
        this.clearResultsTimer(game.roomPin);
        const ranking = await this.services.gameService.getRanking(game.roomPin);
        this.broadcast(game.roomPin, { type: 'GAME_FINISHED', payload: { roomPin: game.roomPin, ranking } });
        return;
      }
      case 'CLOSE_ROOM': {
        this.requireHost(socket, command.payload.roomPin);
        await this.services.roomService.closeRoom((await this.services.roomService.getRoomByPin(command.payload.roomPin)).id);
        this.clearQuestionTimer(command.payload.roomPin);
        this.clearResultsTimer(command.payload.roomPin);
        this.broadcast(command.payload.roomPin, { type: 'ROOM_CLOSED', payload: { roomPin: command.payload.roomPin } });
        this.unbindRoom(command.payload.roomPin);
        return;
      }
      default: return assertNever(command);
    }
  }

  private broadcastQuestion(game: Awaited<ReturnType<GameService['startQuestion']>>): void {
    const question = game.currentQuestion;
    if (!question || !game.questionEndsAt) this.fail('QUESTION_NOT_STARTED', 'O serviço não retornou uma pergunta ativa.');
    this.broadcast(game.roomPin, { type: 'QUESTION_STARTED', payload: {
      roomPin: game.roomPin, gameId: game.id, questionId: question.questionId, questionIndex: question.questionIndex,
      endsAt: Date.parse(question.questionEndsAt), questionStartedAt: question.questionStartedAt,
      questionEndsAt: question.questionEndsAt, question,
    } });
    this.scheduleQuestionEnd(game.roomPin, question.questionId, game.id, question.questionEndsAt);
  }

  private announceQuestionEnded(roomPin: string, questionId: string, timedOut = true): void {
    const key = `${roomPin}:${questionId}`;
    if (this.endedQuestions.has(key)) return;
    const timer = this.questionTimers.get(key);
    if (timer) clearTimeout(timer);
    this.questionTimers.delete(key);
    this.endedQuestions.add(key);
    this.broadcast(roomPin, { type: 'QUESTION_ENDED', payload: { roomPin, timedOut } });
  }

  private async advanceIfAllAnswered(roomPin: string, expectedQuestionId?: string): Promise<void> {
    let current: Awaited<ReturnType<GameService['getGame']>>;
    try { current = await this.services.gameService.getGame(roomPin); }
    catch (error) {
      if (error instanceof DomainError && error.code === 'GAME_NOT_FOUND') return;
      throw error;
    }
    const question = current.currentQuestion;
    if (!question || (expectedQuestionId && question.questionId !== expectedQuestionId)) return;
    const result = await this.services.gameService.advanceIfAllAnswered(roomPin, question.questionId);
    if (!result?.started) return;
    await this.publishResults(roomPin, question.questionId, result.state, false);
  }

  private async startResults(roomPin: string, gameId: string, questionId: string, timedOut: boolean): Promise<void> {
    try {
      const result = await this.services.gameService.beginQuestionResults(gameId, questionId);
      if (!result.started) return;
      await this.publishResults(roomPin, questionId, result.state, timedOut);
    } catch (error) {
      if (error instanceof DomainError && error.code === 'QUESTION_STATE_CHANGED') return;
      throw error;
    }
  }

  private async publishResults(roomPin: string, questionId: string, state: Awaited<ReturnType<GameService['getGame']>>, timedOut: boolean): Promise<void> {
    if (!state.resultsStartedAt || !state.resultsEndsAt) return;
    this.announceQuestionEnded(roomPin, questionId, timedOut);
    const ranking = await this.services.gameService.getRanking(roomPin);
    this.broadcast(roomPin, { type: 'QUESTION_RESULTS', payload: { roomPin, questionId, ranking, resultsStartedAt: state.resultsStartedAt, resultsEndsAt: state.resultsEndsAt } });
    this.scheduleResultsEnd(roomPin, state.id, questionId, state.resultsEndsAt);
  }

  private scheduleResultsEnd(roomPin: string, gameId: string, questionId: string, resultsEndsAt: string): void {
    const key = `${roomPin}:${questionId}`;
    const previous = this.resultsTimers.get(key);
    if (previous) clearTimeout(previous);
    const timer = setTimeout(() => {
      this.resultsTimers.delete(key);
      void this.services.gameService.advanceAfterResults(gameId).then(async (next) => {
        if (!next) return;
        if (next.status === 'FINISHED') {
          const ranking = await this.services.gameService.getRanking(roomPin);
          this.broadcast(roomPin, { type: 'GAME_FINISHED', payload: { roomPin, ranking } });
        } else this.broadcastQuestion(next);
      }).catch(() => { /* Stale result timers cannot advance a changed game. */ });
    }, Math.max(0, Date.parse(resultsEndsAt) - this.nowMs()));
    this.resultsTimers.set(key, timer);
  }

  private scheduleQuestionEnd(roomPin: string, questionId: string, gameId: string, questionEndsAt: string): void {
    const key = `${roomPin}:${questionId}`;
    const previous = this.questionTimers.get(key);
    if (previous) clearTimeout(previous);
    const delay = Math.max(0, Date.parse(questionEndsAt) - this.nowMs());
    const timer = setTimeout(() => {
      this.questionTimers.delete(key);
      void this.services.gameService.getGame(roomPin)
        .then(async (game) => {
          if (game.currentQuestion?.questionId === questionId && await this.services.gameService.isQuestionExpired(gameId)) {
            await this.startResults(roomPin, gameId, questionId, true);
          }
        })
        .catch(() => { /* The GameService remains authoritative; stale game timers are ignored. */ });
    }, delay);
    this.questionTimers.set(key, timer);
  }

  private clearQuestionTimer(roomPin: string): void {
    for (const [key, timer] of this.questionTimers) {
      if (!key.startsWith(`${roomPin}:`)) continue;
      clearTimeout(timer);
      this.questionTimers.delete(key);
    }
  }

  private clearResultsTimer(roomPin: string): void {
    for (const [key, timer] of this.resultsTimers) {
      if (!key.startsWith(`${roomPin}:`)) continue;
      clearTimeout(timer);
      this.resultsTimers.delete(key);
    }
  }

  private requireUnbound(socket: WebSocket): void {
    if (this.context(socket).roomPin) this.fail('ROOM_CONTEXT_MISMATCH', 'Esta conexão já está associada a uma sala.');
  }
  private requireRoom(socket: WebSocket, roomPin: string): ConnectionContext & { roomPin: string; role: Role } {
    const context = this.context(socket);
    if (!context.roomPin || !context.role) this.fail('NOT_SUBSCRIBED', 'Inscreva esta conexão em uma sala antes de enviar comandos.');
    if (context.roomPin !== roomPin) this.fail('ROOM_CONTEXT_MISMATCH', 'O comando referencia outra sala.');
    return context as ConnectionContext & { roomPin: string; role: Role };
  }
  private requireHost(socket: WebSocket, roomPin: string): void {
    if (this.requireRoom(socket, roomPin).role !== 'host') this.fail('FORBIDDEN', 'Somente o host pode executar este comando.');
  }
  private requirePlayer(socket: WebSocket, roomPin: string): ConnectionContext & { roomPin: string; role: 'player'; playerId: string } {
    const context = this.requireRoom(socket, roomPin);
    if (context.role !== 'player' || !context.playerId) this.fail('FORBIDDEN', 'Este comando exige uma conexão de jogador.');
    return context as ConnectionContext & { roomPin: string; role: 'player'; playerId: string };
  }
  private context(socket: WebSocket): ConnectionContext {
    const context = this.contexts.get(socket);
    if (!context) this.fail('NOT_CONNECTED', 'A conexão realtime não está ativa.');
    return context;
  }
  private bind(socket: WebSocket, roomPin: string, role: Role, playerId?: string): void {
    this.unbind(socket);
    const context: ConnectionContext = { roomPin, role, ...(playerId ? { playerId } : {}) };
    this.contexts.set(socket, context);
    const group = this.socketsByRoom.get(roomPin) ?? new Set<WebSocket>();
    group.add(socket);
    this.socketsByRoom.set(roomPin, group);
  }
  private unbind(socket: WebSocket): void {
    const context = this.contexts.get(socket);
    if (context?.roomPin) {
      const group = this.socketsByRoom.get(context.roomPin);
      group?.delete(socket);
      if (group?.size === 0) this.socketsByRoom.delete(context.roomPin);
    }
    if (this.contexts.has(socket)) this.contexts.set(socket, {});
  }
  private unbindRoom(roomPin: string): void {
    for (const socket of this.socketsByRoom.get(roomPin) ?? []) this.unbind(socket);
  }
  private detach(socket: WebSocket): void {
    this.unbind(socket);
    this.contexts.delete(socket);
  }
  private broadcast(roomPin: string, event: ServerEvent): void {
    this.roomVersions.set(roomPin, (this.roomVersions.get(roomPin) ?? 0) + 1);
    for (const socket of this.socketsByRoom.get(roomPin) ?? []) this.send(socket, event);
  }
  private send(socket: WebSocket, event: ServerEvent): void {
    if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(event));
  }
  private sendError(socket: WebSocket, error: unknown): void {
    if (error instanceof DomainError) {
      this.send(socket, { type: 'REALTIME_ERROR', payload: { code: error.code, message: error.message } });
    } else if (error instanceof ProtocolError) {
      this.send(socket, { type: 'REALTIME_ERROR', payload: { code: error.code, message: error.message } });
    } else {
      this.send(socket, { type: 'REALTIME_ERROR', payload: { code: 'INTERNAL_ERROR', message: 'Ocorreu um erro interno no servidor realtime.' } });
    }
  }
  private fail(code: string, message: string): never { throw new ProtocolError(code, message); }
}

function rawDataToString(data: RawData): string {
  if (typeof data === 'string') return data;
  if (data instanceof ArrayBuffer) return Buffer.from(data).toString('utf8');
  if (Array.isArray(data)) return Buffer.concat(data).toString('utf8');
  return data.toString('utf8');
}

function toClientRoom(room: Awaited<ReturnType<RoomService['createRoom']>>): Extract<ServerEvent, { type: 'ROOM_CREATED' }>['payload']['room'] {
  const status = ({ WAITING: 'waiting', STARTING: 'starting', IN_PROGRESS: 'in-progress', FINISHED: 'finished' } as const)[room.status];
  return { id: room.id, pin: room.pin, quizId: room.quizId, status, players: room.players.map(toClientPlayer) };
}

function toClientPlayer(player: import('../domain/player.js').RoomPlayer) {
  return { id: player.id, name: player.name, avatarCharacterId: player.avatarCharacterId ?? 'bear', avatarAccessoryId: player.avatarAccessoryId ?? 'none' };
}

function assertNever(command: never): never { throw new Error(`Comando não tratado: ${String(command)}`); }
