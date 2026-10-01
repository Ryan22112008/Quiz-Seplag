import { randomInt, randomUUID } from 'node:crypto';
import { DomainError } from '../domain/errors.js';
import type { RoomPlayer } from '../domain/player.js';
import type { Room, RoomStatus } from '../domain/room.js';
import type { RoomRepository } from '../repositories/roomRepository.js';
import type { QuizService } from './quizService.js';

const MAX_PIN_ATTEMPTS = 32;
const MAX_PLAYER_NAME_LENGTH = 24;

const ALLOWED_STATUS_TRANSITIONS: Record<RoomStatus, readonly RoomStatus[]> = {
  WAITING: ['STARTING', 'FINISHED'],
  STARTING: ['WAITING', 'IN_PROGRESS', 'FINISHED'],
  IN_PROGRESS: ['FINISHED'],
  FINISHED: [],
};

interface RoomServiceDependencies {
  createId?: () => string;
  generatePin?: () => string;
  maxPinAttempts?: number;
}

export interface JoinedRoom {
  room: Room;
  player: RoomPlayer;
}

function securePin(): string {
  return String(randomInt(100_000, 1_000_000));
}

function normalizePlayerName(name: unknown): string {
  if (typeof name !== 'string') {
    throw new DomainError('INVALID_PLAYER_NAME', 400, 'Informe um nome válido.');
  }
  if (/[\u0000-\u001f\u007f]/u.test(name)) {
    throw new DomainError('INVALID_PLAYER_NAME', 400, 'O nome contém caracteres inválidos.');
  }

  const normalized = name.trim().replace(/\s+/g, ' ');
  const length = Array.from(normalized).length;
  if (length < 1 || length > MAX_PLAYER_NAME_LENGTH) {
    throw new DomainError(
      'INVALID_PLAYER_NAME',
      400,
      `O nome deve conter entre 1 e ${MAX_PLAYER_NAME_LENGTH} caracteres válidos.`,
    );
  }

  return normalized;
}

function validatePin(pin: string): void {
  if (!/^\d{6}$/u.test(pin)) {
    throw new DomainError('INVALID_ROOM_PIN', 400, 'O PIN da sala deve conter exatamente 6 dígitos.');
  }
}

export class RoomService {
  private readonly createId: () => string;
  private readonly generatePin: () => string;
  private readonly maxPinAttempts: number;

  constructor(
    private readonly repository: RoomRepository,
    private readonly quizService: Pick<QuizService, 'getQuizById'>,
    dependencies: RoomServiceDependencies = {},
  ) {
    this.createId = dependencies.createId ?? randomUUID;
    this.generatePin = dependencies.generatePin ?? securePin;
    this.maxPinAttempts = dependencies.maxPinAttempts ?? MAX_PIN_ATTEMPTS;
  }

  async createRoom(quizId: unknown): Promise<Room> {
    if (typeof quizId !== 'string' || quizId.trim().length < 1 || quizId.trim().length > 128) {
      throw new DomainError('INVALID_QUIZ_ID', 400, 'Informe um quizId válido.');
    }

    const id = this.createId();
    const normalizedQuizId = quizId.trim();
    await this.quizService.getQuizById(normalizedQuizId);

    for (let attempt = 0; attempt < this.maxPinAttempts; attempt += 1) {
      const pin = this.generatePin();
      validatePin(pin);

      try {
        return await this.repository.create({
          id,
          pin,
          quizId: normalizedQuizId,
          status: 'WAITING',
          players: [],
        });
      } catch (error) {
        if (error instanceof DomainError && error.code === 'ROOM_PIN_CONFLICT') continue;
        throw error;
      }
    }

    throw new DomainError('ROOM_STORE_ERROR', 503, 'Não foi possível reservar um PIN livre. Tente novamente.');
  }

  async getRoomById(roomId: string): Promise<Room> {
    const room = await this.repository.findById(roomId);
    if (!room) throw new DomainError('ROOM_NOT_FOUND', 404, 'Sala não encontrada.');
    return room;
  }

  async getRoomByPin(pin: string): Promise<Room> {
    validatePin(pin);
    const room = await this.repository.findByPin(pin);
    if (!room) throw new DomainError('ROOM_NOT_FOUND', 404, 'Sala não encontrada.');
    return room;
  }

  async joinRoom(pin: string, playerName: unknown): Promise<JoinedRoom> {
    const room = await this.getRoomByPin(pin);
    if (room.status !== 'WAITING') {
      throw new DomainError('ROOM_NOT_JOINABLE', 409, 'Esta sala não está aceitando jogadores.');
    }

    const name = normalizePlayerName(playerName);
    const normalizedForComparison = name.toLocaleLowerCase('pt-BR');
    if (room.players.some((player) => player.name.toLocaleLowerCase('pt-BR') === normalizedForComparison)) {
      throw new DomainError('PLAYER_ALREADY_EXISTS', 409, 'Já existe um jogador com esse nome nesta sala.');
    }

    const player: RoomPlayer = { id: this.createId(), name };
    const updatedRoom = await this.repository.addPlayer(room.id, player);
    return { room: updatedRoom, player };
  }

  async leaveRoom(pin: string, playerId: string): Promise<Room> {
    const room = await this.getRoomByPin(pin);
    const playerExists = room.players.some((player) => player.id === playerId);
    if (!playerExists) throw new DomainError('PLAYER_NOT_FOUND', 404, 'Jogador não encontrado nesta sala.');

    return this.repository.removePlayer(room.id, playerId);
  }

  async setRoomStatus(roomId: string, nextStatus: RoomStatus): Promise<Room> {
    const room = await this.getRoomById(roomId);
    if (room.status === nextStatus) return room;
    if (!ALLOWED_STATUS_TRANSITIONS[room.status].includes(nextStatus)) {
      throw new DomainError(
        'INVALID_ROOM_TRANSITION',
        409,
        `Não é permitido alterar o estado de ${room.status} para ${nextStatus}.`,
      );
    }

    return this.repository.update({ ...room, status: nextStatus });
  }

  closeRoom(roomId: string): Promise<Room> {
    return this.setRoomStatus(roomId, 'FINISHED');
  }
}
