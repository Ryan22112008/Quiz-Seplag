import { realtimeTransport } from './transport';
import type { ClientCommand, ServerEvent } from '@/types/realtime';
import { useRealtimeStore } from '@/stores/realtimeStore';

type Role = 'host' | 'player';
interface ActiveSession { roomPin: string; playerId?: string; playerToken?: string; hostToken?: string; role: Role }
interface PendingEvent {
  accept: (event: ServerEvent) => boolean;
  resolve: (event: ServerEvent) => void;
  reject: (error: Error) => void;
  timer: number;
}
class RealtimeSessionError extends Error { constructor(readonly code: string, message: string) { super(message); } }

let activeSession: ActiveSession | null = null;
let retryTimer: number | null = null;
let retryDelay = 1000;
let inFlight: Promise<void> | null = null;
const pending = new Set<PendingEvent>();

realtimeTransport.subscribe((event) => {
  for (const item of [...pending]) {
    if (event.type === 'REALTIME_ERROR') finish(item, new RealtimeSessionError(event.payload.code, friendlyError(event.payload.code)));
    else if (item.accept(event)) finish(item, undefined, event);
  }
  if (event.type === 'ROOM_SUBSCRIBED' && activeSession?.roomPin === event.payload.roomPin && activeSession.role === event.payload.role) {
    useRealtimeStore.getState().setSession(activeSession);
  }
  if (event.type === 'ROOM_SYNCED' && activeSession?.roomPin === event.payload.room.pin) useRealtimeStore.getState().setSynced();
  if (event.type === 'ROOM_CLOSED' && activeSession?.roomPin === event.payload.roomPin) endRealtimeSession();
});

realtimeTransport.subscribeLifecycle((event) => {
  if (event !== 'close' || !activeSession) return;
  rejectPending(new Error('A conexão realtime foi interrompida.'));
  useRealtimeStore.getState().setConnectionState('reconnecting');
  scheduleReconnect();
});

if (typeof window !== 'undefined') window.addEventListener('online', () => {
  if (activeSession) scheduleReconnect(0);
});

export async function subscribeRoom(roomPin: string, playerId?: string, hostToken?: string, playerToken?: string): Promise<void> {
  if (playerId && !playerToken) throw new RealtimeSessionError('FORBIDDEN', 'A credencial desta sessão não está disponível nesta aba. Entre novamente na sala.');
  if (!playerId && !hostToken) throw new RealtimeSessionError('FORBIDDEN', 'A credencial de host não está disponível nesta aba.');
  const session: ActiveSession = { roomPin, ...(playerId ? { playerId } : {}), ...(hostToken ? { hostToken } : {}), ...(playerToken ? { playerToken } : {}), role: playerId ? 'player' : 'host' };
  if (activeSession?.roomPin === roomPin && activeSession.playerId === playerId && activeSession.hostToken === hostToken && activeSession.playerToken === playerToken && useRealtimeStore.getState().connectionState === 'synced') return;
  if (activeSession && (activeSession.roomPin !== roomPin || activeSession.playerId !== playerId || activeSession.hostToken !== hostToken || activeSession.playerToken !== playerToken)) endRealtimeSession();
  activeSession = session;
  retryDelay = 1000;
  clearRetryTimer();
  return connectAndSync(session, false);
}

export function sendCommand(command: ClientCommand): void {
  if ('roomPin' in command.payload && (!activeSession || useRealtimeStore.getState().connectionState !== 'synced' || activeSession.roomPin !== command.payload.roomPin)) {
    throw new Error('A conexão ainda está sincronizando esta sala. Aguarde um instante.');
  }
  realtimeTransport.send(command);
}

export async function submitAnswerRealtime(roomPin: string, questionId: string, optionId: string): Promise<void> {
  const playerId = activeSession?.playerId;
  if (!playerId || activeSession?.roomPin !== roomPin || useRealtimeStore.getState().connectionState !== 'synced') {
    throw new Error('A conexão do jogador não está sincronizada. Aguarde a reconexão.');
  }
  const accepted = waitFor((event) => event.type === 'ANSWER_SUBMITTED' && event.payload.roomPin === roomPin && event.payload.playerId === playerId);
  sendCommand({ type: 'SUBMIT_ANSWER', payload: { roomPin, questionId, optionId } });
  await accepted;
}

export async function leaveRoomRealtime(roomPin: string, playerId: string): Promise<void> {
  const left = waitFor((event) => event.type === 'PLAYER_LEFT' && event.payload.roomPin === roomPin && event.payload.playerId === playerId);
  sendCommand({ type: 'LEAVE_ROOM', payload: { roomPin, playerId } });
  await left;
  endRealtimeSession();
}

export async function closeRoomRealtime(roomPin: string): Promise<void> {
  const closed = waitFor((event) => event.type === 'ROOM_CLOSED' && event.payload.roomPin === roomPin);
  sendCommand({ type: 'CLOSE_ROOM', payload: { roomPin } });
  await closed;
}

export function endRealtimeSession(): void {
  activeSession = null;
  clearRetryTimer();
  inFlight = null;
  rejectPending(new Error('A sessão realtime foi encerrada.'));
  useRealtimeStore.getState().clearSession();
  realtimeTransport.disconnect();
}

async function connectAndSync(session: ActiveSession, reconnecting: boolean): Promise<void> {
  if (inFlight) return inFlight;
  const work = (async () => {
    useRealtimeStore.getState().setConnectionState(reconnecting ? 'reconnecting' : 'connecting');
    await realtimeTransport.connect();
    useRealtimeStore.getState().setConnectionState('syncing');
    const subscribed = waitFor((event) => event.type === 'ROOM_SUBSCRIBED' && event.payload.roomPin === session.roomPin && event.payload.role === session.role);
    const snapshot = waitFor((event) => event.type === 'ROOM_SYNCED' && event.payload.room.pin === session.roomPin);
    realtimeTransport.send({ type: 'SUBSCRIBE_GAME', payload: { roomPin: session.roomPin, ...(session.playerId ? { playerId: session.playerId } : {}), ...(session.playerToken ? { playerToken: session.playerToken } : {}), ...(session.hostToken ? { hostToken: session.hostToken } : {}) } });
    await Promise.all([subscribed, snapshot]);
    if (activeSession?.roomPin === session.roomPin) {
      retryDelay = 1000;
      clearRetryTimer();
      useRealtimeStore.getState().setSynced();
    }
  })();
  inFlight = work;
  try { await work; }
  catch (error) {
    const terminal = error instanceof RealtimeSessionError && ['ROOM_NOT_FOUND', 'PLAYER_NOT_FOUND', 'ROOM_CLOSED', 'INVALID_ROOM_PIN', 'FORBIDDEN'].includes(error.code);
    if (terminal && activeSession?.roomPin === session.roomPin) endRealtimeSession();
    throw error;
  } finally {
    if (inFlight === work) inFlight = null;
    if (!reconnecting && activeSession?.roomPin === session.roomPin && useRealtimeStore.getState().connectionState !== 'synced') scheduleReconnect();
  }
}

function scheduleReconnect(delay = retryDelay): void {
  if (!activeSession || retryTimer !== null || inFlight) return;
  retryTimer = window.setTimeout(() => {
    retryTimer = null;
    const session = activeSession;
    if (!session) return;
    void connectAndSync(session, true).catch(() => {
      if (!activeSession) return;
      retryDelay = Math.min(retryDelay * 2, 16000);
      scheduleReconnect();
    });
  }, delay);
}

function clearRetryTimer(): void {
  if (retryTimer !== null) window.clearTimeout(retryTimer);
  retryTimer = null;
}
function waitFor(accept: (event: ServerEvent) => boolean): Promise<ServerEvent> {
  return new Promise((resolve, reject) => {
  const item: PendingEvent = { accept, resolve, reject, timer: window.setTimeout(() => finish(item, new Error('A conexão demorou para responder. Tente novamente.')), 8000) };
    pending.add(item);
  });
}
function finish(item: PendingEvent, error?: Error, event?: ServerEvent): void {
  if (!pending.delete(item)) return;
  window.clearTimeout(item.timer);
  if (error) item.reject(error); else if (event) item.resolve(event);
}
function rejectPending(error: Error): void { for (const item of [...pending]) finish(item, error); }
function friendlyError(code: string): string {
  const messages: Record<string, string> = {
    ROOM_NOT_FOUND: 'Sala não encontrada.', INVALID_ROOM_PIN: 'O PIN informado é inválido.', ROOM_CLOSED: 'Esta sala já foi encerrada.',
    ROOM_NOT_JOINABLE: 'Esta sala não está aceitando novos jogadores.', PLAYER_ALREADY_EXISTS: 'Já existe um jogador com esse nome nesta sala.',
    PLAYER_NOT_FOUND: 'Este jogador não pertence mais à sala.', INVALID_PLAYER_NAME: 'Informe um nome válido para entrar na sala.',
    QUESTION_NOT_EXPIRED: 'Aguarde a pergunta terminar antes de avançar.', QUESTION_EXPIRED: 'O tempo para responder terminou.',
    NOT_SUBSCRIBED: 'A conexão com a sala não está ativa.',
  };
  return messages[code] ?? 'Não foi possível concluir esta ação. Tente novamente.';
}
