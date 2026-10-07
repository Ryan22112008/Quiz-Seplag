import type { Prisma, PrismaClient } from '@prisma/client';
import { DomainError } from '../domain/errors.js';
import type { Room } from '../domain/room.js';

export interface RoomRepository {
  create(room: Room): Promise<Room>;
  findById(roomId: string): Promise<Room | undefined>;
  findByPin(pin: string): Promise<Room | undefined>;
  update(room: Room): Promise<Room>;
  addPlayer(roomId: string, player: Room['players'][number]): Promise<Room>;
  removePlayer(roomId: string, playerId: string): Promise<Room>;
  delete(roomId: string): Promise<boolean>;
}

function cloneRoom(room: Room): Room { return { ...room, players: room.players.map((p) => ({ ...p })) }; }
const roomInclude = { players: { orderBy: [{ position: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }] } } satisfies Prisma.RoomInclude;
type RoomRow = Prisma.RoomGetPayload<{ include: typeof roomInclude }>;
function mapRoom(row: RoomRow): Room {
  return { id: row.id, pin: row.pin, quizId: row.quizId, status: row.status as Room['status'], players: row.players.map(({ id, name, avatarCharacterId, avatarAccessoryId }) => ({ id, name, avatarCharacterId, avatarAccessoryId })) };
}

export class PrismaRoomRepository implements RoomRepository {
  constructor(private readonly client: PrismaClient) {}
  async create(room: Room): Promise<Room> {
    try {
      const saved = await this.client.room.create({ data: { id: room.id, pin: room.pin, quizId: room.quizId, status: room.status }, include: roomInclude });
      return mapRoom(saved);
    } catch (error) { throw mapRoomStoreError(error); }
  }
  async findById(roomId: string): Promise<Room | undefined> {
    try {
      const row = await this.client.room.findUnique({ where: { id: roomId }, include: roomInclude });
      return row ? mapRoom(row) : undefined;
    } catch (error) { throw mapRoomStoreError(error); }
  }
  async findByPin(pin: string): Promise<Room | undefined> {
    try {
      const row = await this.client.room.findUnique({ where: { pin }, include: roomInclude });
      return row ? mapRoom(row) : undefined;
    } catch (error) { throw mapRoomStoreError(error); }
  }
  async update(room: Room): Promise<Room> {
    try {
      const saved = await this.client.room.update({ where: { id: room.id }, data: { pin: room.pin, quizId: room.quizId, status: room.status }, include: roomInclude });
      return mapRoom(saved);
    } catch (error) { throw mapRoomStoreError(error); }
  }
  async addPlayer(roomId: string, player: Room['players'][number]): Promise<Room> {
    try {
      return await this.client.$transaction(async (tx) => {
        const aggregate = await tx.roomPlayer.aggregate({ where: { roomId }, _max: { position: true } });
        await tx.roomPlayer.create({ data: {
          id: player.id, roomId, name: player.name, normalizedName: player.name.toLocaleLowerCase('pt-BR'), avatarCharacterId: player.avatarCharacterId ?? 'bear', avatarAccessoryId: player.avatarAccessoryId ?? 'none',
          position: (aggregate._max.position ?? -1) + 1,
        } });
        return mapRoom(await tx.room.findUniqueOrThrow({ where: { id: roomId }, include: roomInclude }));
      });
    } catch (error) { throw mapRoomStoreError(error); }
  }
  async removePlayer(roomId: string, playerId: string): Promise<Room> {
    try {
      return await this.client.$transaction(async (tx) => {
        const deleted = await tx.roomPlayer.deleteMany({ where: { roomId, id: playerId } });
        if (deleted.count === 0) throw new DomainError('PLAYER_NOT_FOUND', 404, 'Jogador não encontrado nesta sala.');
        const players = await tx.roomPlayer.findMany({ where: { roomId }, orderBy: [{ position: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }] });
        for (const [position, player] of players.entries()) await tx.roomPlayer.update({ where: { id: player.id }, data: { position } });
        return mapRoom(await tx.room.findUniqueOrThrow({ where: { id: roomId }, include: roomInclude }));
      });
    } catch (error) { throw mapRoomStoreError(error); }
  }
  async delete(roomId: string): Promise<boolean> {
    try { return (await this.client.room.deleteMany({ where: { id: roomId } })).count > 0; }
    catch (error) { throw mapRoomStoreError(error); }
  }
}

/** Test double used by isolated service tests; production is wired to PrismaRoomRepository. */
export class InMemoryRoomRepository implements RoomRepository {
  private readonly roomsById = new Map<string, Room>();
  private readonly roomIdByPin = new Map<string, string>();
  async create(room: Room): Promise<Room> {
    if (this.roomsById.has(room.id)) throw new DomainError('ROOM_ID_CONFLICT', 409, 'O identificador da sala já está em uso.');
    if (this.roomIdByPin.has(room.pin)) throw new DomainError('ROOM_PIN_CONFLICT', 409, 'O PIN da sala já está em uso.');
    const saved = cloneRoom(room); this.roomsById.set(saved.id, saved); this.roomIdByPin.set(saved.pin, saved.id); return cloneRoom(saved);
  }
  async findById(roomId: string): Promise<Room | undefined> { const room = this.roomsById.get(roomId); return room ? cloneRoom(room) : undefined; }
  async findByPin(pin: string): Promise<Room | undefined> { const id = this.roomIdByPin.get(pin); return id ? this.findById(id) : undefined; }
  async update(room: Room): Promise<Room> {
    if (!this.roomsById.has(room.id)) throw new DomainError('ROOM_NOT_FOUND', 404, 'Sala não encontrada.');
    const conflicting = this.roomIdByPin.get(room.pin);
    if (conflicting && conflicting !== room.id) throw new DomainError('ROOM_PIN_CONFLICT', 409, 'O PIN da sala já está em uso.');
    const previous = this.roomsById.get(room.id)!;
    if (previous.pin !== room.pin) this.roomIdByPin.delete(previous.pin);
    const saved = cloneRoom(room); this.roomsById.set(saved.id, saved); this.roomIdByPin.set(saved.pin, saved.id); return cloneRoom(saved);
  }
  async addPlayer(roomId: string, player: Room['players'][number]): Promise<Room> {
    const room = this.roomsById.get(roomId);
    if (!room) throw new DomainError('ROOM_NOT_FOUND', 404, 'Sala não encontrada.');
    const nameKey = player.name.toLocaleLowerCase('pt-BR');
    if (room.players.some((existing) => existing.name.toLocaleLowerCase('pt-BR') === nameKey)) throw new DomainError('PLAYER_ALREADY_EXISTS', 409, 'Já existe um jogador com esse nome nesta sala.');
    return this.update({ ...room, players: [...room.players, player] });
  }
  async removePlayer(roomId: string, playerId: string): Promise<Room> {
    const room = this.roomsById.get(roomId);
    if (!room) throw new DomainError('ROOM_NOT_FOUND', 404, 'Sala não encontrada.');
    if (!room.players.some((player) => player.id === playerId)) throw new DomainError('PLAYER_NOT_FOUND', 404, 'Jogador não encontrado nesta sala.');
    return this.update({ ...room, players: room.players.filter((player) => player.id !== playerId) });
  }
  async delete(roomId: string): Promise<boolean> {
    const room = this.roomsById.get(roomId); if (!room) return false;
    this.roomsById.delete(roomId); this.roomIdByPin.delete(room.pin); return true;
  }
}

function mapRoomStoreError(error: unknown): DomainError {
  if (error instanceof DomainError) return error;
  if (isPrismaKnownError(error)) {
    if (error.code === 'P2002') {
      const target = Array.isArray(error.meta?.target) ? error.meta.target.join(',') : String(error.meta?.target ?? '');
      if (target.includes('normalizedName')) return new DomainError('PLAYER_ALREADY_EXISTS', 409, 'Já existe um jogador com esse nome nesta sala.');
      if (target.includes('pin')) return new DomainError('ROOM_PIN_CONFLICT', 409, 'O PIN da sala já está em uso.');
      if (target.includes('id')) return new DomainError('ROOM_ID_CONFLICT', 409, 'O identificador da sala já está em uso.');
      return new DomainError('ROOM_STORE_ERROR', 503, 'Não foi possível salvar os dados da sala.');
    }
    if (error.code === 'P2025') return new DomainError('ROOM_NOT_FOUND', 404, 'Sala não encontrada.');
    if (error.code === 'P2003') return new DomainError('QUIZ_NOT_FOUND', 404, 'O quiz associado à sala não existe.');
  }
  return new DomainError('ROOM_STORE_ERROR', 503, 'Não foi possível acessar os dados da sala.');
}

function isPrismaKnownError(error: unknown): error is { code: string; meta?: { target?: unknown } } {
  return typeof error === 'object' && error !== null && 'code' in error && typeof error.code === 'string' && error.code.startsWith('P');
}
