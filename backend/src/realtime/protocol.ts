import type { PublicGameState, PublicRankingEntry } from '../domain/game.js';

export type ClientCommand =
  | { type: 'CREATE_ROOM'; payload: { quizId: string } }
  | { type: 'JOIN_ROOM'; payload: { roomPin: string; playerName: string; avatarCharacterId?: string; avatarAccessoryId?: string } }
  | { type: 'SUBSCRIBE_GAME'; payload: { roomPin: string; playerId?: string; playerToken?: string; hostToken?: string } }
  | { type: 'LEAVE_ROOM'; payload: { roomPin: string; playerId?: string } }
  | { type: 'START_GAME'; payload: { roomPin: string } }
  | { type: 'START_QUESTION'; payload: { roomPin: string } }
  | { type: 'END_QUESTION'; payload: { roomPin: string; questionId: string } }
  | { type: 'NEXT_QUESTION'; payload: { roomPin: string } }
  | { type: 'SUBMIT_ANSWER'; payload: { roomPin: string; questionId: string; optionId: string } }
  | { type: 'FINISH_GAME'; payload: { roomPin: string } }
  | { type: 'CLOSE_ROOM'; payload: { roomPin: string } };

export type ServerEvent =
  | { type: 'ROOM_CREATED'; payload: { room: { id: string; pin: string; quizId: string; status: 'waiting' | 'starting' | 'in-progress' | 'finished'; players: Array<{ id: string; name: string; avatarCharacterId?: string; avatarAccessoryId?: string }> }; hostToken: string } }
  | { type: 'ROOM_SUBSCRIBED'; payload: { roomPin: string; role: 'host' | 'player'; playerToken?: string } }
  | { type: 'ROOM_SYNCED'; payload: { room: Extract<ServerEvent, { type: 'ROOM_CREATED' }>['payload']['room']; game: PublicGameState | null; ranking: PublicRankingEntry[]; hasAnsweredCurrentQuestion: boolean; questionEnded: boolean } }
  | { type: 'PLAYER_JOINED'; payload: { roomPin: string; player: { id: string; name: string; avatarCharacterId?: string; avatarAccessoryId?: string } } }
  | { type: 'PLAYER_LEFT'; payload: { roomPin: string; playerId: string } }
  | { type: 'GAME_STARTED'; payload: { quizId: string; roomPin: string; totalQuestions: number } }
  | { type: 'QUESTION_STARTED'; payload: { roomPin: string; questionId: string; questionIndex: number; endsAt: number; gameId: string; question: { questionId: string; questionIndex: number; text: string; imageUrl?: string; options: ReadonlyArray<{ id: string; text: string; imageUrl?: string }>; timeLimit: number; questionRevealAt: string; questionStartedAt: string; questionEndsAt: string }; questionStartedAt: string; questionEndsAt: string } }
  | { type: 'ANSWER_SUBMITTED'; payload: { roomPin: string; playerId: string } }
  | { type: 'QUESTION_ENDED'; payload: { roomPin: string; timedOut: boolean } }
  | { type: 'QUESTION_RESULTS'; payload: { roomPin: string; questionId: string; ranking: PublicRankingEntry[]; resultsStartedAt: string; resultsEndsAt: string } }
  | { type: 'RANKING_UPDATED'; payload: { roomPin: string; ranking: PublicRankingEntry[] } }
  | { type: 'GAME_FINISHED'; payload: { roomPin: string; ranking: PublicRankingEntry[] } }
  | { type: 'ROOM_CLOSED'; payload: { roomPin: string } }
  | { type: 'REALTIME_ERROR'; payload: { code: string; message: string } };

export class ProtocolError extends Error {
  constructor(readonly code: string, message: string) {
    super(message);
    this.name = 'ProtocolError';
  }
}

const COMMAND_TYPES = new Set<ClientCommand['type']>([
  'CREATE_ROOM', 'JOIN_ROOM', 'SUBSCRIBE_GAME', 'LEAVE_ROOM', 'START_GAME', 'START_QUESTION',
  'END_QUESTION', 'NEXT_QUESTION', 'SUBMIT_ANSWER', 'FINISH_GAME', 'CLOSE_ROOM',
]);

export function parseCommand(raw: string): ClientCommand {
  let value: unknown;
  try { value = JSON.parse(raw) as unknown; }
  catch { throw new ProtocolError('INVALID_JSON', 'A mensagem deve conter JSON válido.'); }
  if (!isRecord(value) || Object.keys(value).length !== 2 || typeof value.type !== 'string' || !('payload' in value)) {
    throw new ProtocolError('INVALID_MESSAGE', 'A mensagem deve conter type e payload.');
  }
  if (!COMMAND_TYPES.has(value.type as ClientCommand['type'])) {
    throw new ProtocolError('UNKNOWN_COMMAND', 'O comando realtime não é reconhecido.');
  }
  if (!isRecord(value.payload)) throw new ProtocolError('INVALID_PAYLOAD', 'O payload do comando deve ser um objeto.');
  const payload = value.payload;
  switch (value.type) {
    case 'CREATE_ROOM': exact(payload, ['quizId']); stringField(payload, 'quizId'); break;
    case 'JOIN_ROOM':
      if (Object.keys(payload).some((key) => !['roomPin', 'playerName', 'avatarCharacterId', 'avatarAccessoryId'].includes(key))) invalidPayload();
      stringField(payload, 'roomPin'); stringField(payload, 'playerName');
      if ('avatarCharacterId' in payload) stringField(payload, 'avatarCharacterId');
      if ('avatarAccessoryId' in payload) stringField(payload, 'avatarAccessoryId');
      break;
    case 'SUBSCRIBE_GAME':
      if (Object.keys(payload).some((key) => !['roomPin', 'playerId', 'hostToken', 'playerToken'].includes(key)) ||
        (('playerId' in payload || 'playerToken' in payload) && 'hostToken' in payload) ||
        (('playerId' in payload) !== ('playerToken' in payload))) invalidPayload();
      stringField(payload, 'roomPin');
      if ('playerId' in payload) stringField(payload, 'playerId');
      if ('hostToken' in payload) stringField(payload, 'hostToken');
      if ('playerToken' in payload) stringField(payload, 'playerToken');
      break;
    case 'LEAVE_ROOM':
      if (Object.keys(payload).some((key) => key !== 'roomPin' && key !== 'playerId')) invalidPayload();
      stringField(payload, 'roomPin');
      if ('playerId' in payload) stringField(payload, 'playerId');
      break;
    case 'START_GAME': case 'START_QUESTION': case 'NEXT_QUESTION': case 'FINISH_GAME': case 'CLOSE_ROOM':
      exact(payload, ['roomPin']); stringField(payload, 'roomPin'); break;
    case 'END_QUESTION': exact(payload, ['roomPin', 'questionId']); stringField(payload, 'roomPin'); stringField(payload, 'questionId'); break;
    case 'SUBMIT_ANSWER': exact(payload, ['roomPin', 'questionId', 'optionId']); stringField(payload, 'roomPin'); stringField(payload, 'questionId'); stringField(payload, 'optionId'); break;
    default: throw new ProtocolError('UNKNOWN_COMMAND', 'O comando realtime não é reconhecido.');
  }
  return value as unknown as ClientCommand;
}

function exact(value: Record<string, unknown>, keys: string[]): void {
  if (Object.keys(value).length !== keys.length || keys.some((key) => !Object.hasOwn(value, key))) invalidPayload();
}
function stringField(value: Record<string, unknown>, key: string): void {
  const maxLength = key === 'playerName' ? 24 : key === 'hostToken' ? 128 : 128;
  if (typeof value[key] !== 'string' || value[key].trim().length === 0 || value[key].length > maxLength) invalidPayload();
}
function invalidPayload(): never { throw new ProtocolError('INVALID_PAYLOAD', 'Os campos do payload são inválidos.'); }
function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === 'object' && value !== null && !Array.isArray(value); }
