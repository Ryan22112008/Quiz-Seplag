import type { ClientCommand, ServerEvent } from '@/types/realtime';
import { useRealtimeStore } from '@/stores/realtimeStore';
import { WS_BASE_URL } from '@/config/environment';

export interface RealtimeTransport {
  connect(): Promise<void>;
  disconnect(): void;
  send(command: ClientCommand): void;
  subscribe(handler: (event: ServerEvent) => void): () => void;
  subscribeLifecycle(handler: (event: 'close') => void): () => void;
}

const EVENT_TYPES = new Set(['ROOM_CREATED','PLAYER_JOINED','PLAYER_LEFT','GAME_STARTED','ROOM_SUBSCRIBED','ROOM_SYNCED','REALTIME_ERROR','QUESTION_STARTED','ANSWER_SUBMITTED','QUESTION_ENDED','RANKING_UPDATED','GAME_FINISHED','ROOM_CLOSED']);

export class WebSocketRealtimeTransport implements RealtimeTransport {
  private socket: WebSocket | null = null;
  private opening: Promise<void> | null = null;
  private openingToken: symbol | null = null;
  private handlers = new Set<(event: ServerEvent) => void>();
  private lifecycleHandlers = new Set<(event: 'close') => void>();

  connect(): Promise<void> {
    if (this.socket?.readyState === WebSocket.OPEN) return Promise.resolve();
    if (this.opening) return this.opening;
    useRealtimeStore.getState().setConnectionState('connecting');
    const token = Symbol('websocket-opening');
    const opening = new Promise<void>((resolve, reject) => {
      const socket = new WebSocket(WS_BASE_URL);
      this.socket = socket;
      let opened = false;
      const timeout = window.setTimeout(() => { socket.close(); reject(new Error('Tempo esgotado ao conectar ao servidor realtime.')); }, 8000);
      socket.onopen = () => { opened = true; window.clearTimeout(timeout); useRealtimeStore.getState().setConnectionState('connected'); resolve(); };
      socket.onmessage = (message) => {
        try {
          const parsed: unknown = JSON.parse(String(message.data));
          if (!isServerEvent(parsed)) throw new Error('Mensagem realtime inválida.');
          for (const handler of this.handlers) handler(parsed);
        } catch (error) {
          const reason = error instanceof Error ? error.message : 'Mensagem realtime inválida.';
          for (const handler of this.handlers) handler({ type: 'REALTIME_ERROR', payload: { code: 'INVALID_SERVER_MESSAGE', message: reason } });
        }
      };
      socket.onerror = () => { useRealtimeStore.getState().setConnectionState('error'); if (!opened) { window.clearTimeout(timeout); reject(new Error('Falha ao conectar ao servidor realtime.')); } };
      socket.onclose = () => {
        window.clearTimeout(timeout);
        if (!opened) reject(new Error('A conexão realtime foi encerrada antes de conectar.'));
        if (this.socket !== socket) return;
        this.socket = null;
        if (this.openingToken === token) { this.opening = null; this.openingToken = null; }
        useRealtimeStore.getState().setConnectionState('disconnected');
        useRealtimeStore.getState().clearSession();
        for (const handler of this.lifecycleHandlers) handler('close');
      };
    });
    const tracked = opening.finally(() => { if (this.openingToken === token) { this.opening = null; this.openingToken = null; } });
    this.opening = tracked;
    this.openingToken = token;
    return tracked;
  }

  disconnect(): void { const socket = this.socket; this.socket = null; this.opening = null; this.openingToken = null; socket?.close(1000, 'Cliente desconectado'); useRealtimeStore.getState().setConnectionState('disconnected'); useRealtimeStore.getState().clearSession(); }
  send(command: ClientCommand): void {
    if (this.socket?.readyState !== WebSocket.OPEN) throw new Error('A conexão realtime não está disponível.');
    this.socket.send(JSON.stringify(command));
  }
  subscribe(handler: (event: ServerEvent) => void): () => void { this.handlers.add(handler); return () => this.handlers.delete(handler); }
  subscribeLifecycle(handler: (event: 'close') => void): () => void { this.lifecycleHandlers.add(handler); return () => this.lifecycleHandlers.delete(handler); }
}

function isServerEvent(value: unknown): value is ServerEvent {
  return typeof value === 'object' && value !== null && 'type' in value && 'payload' in value && typeof value.type === 'string' && EVENT_TYPES.has(value.type) && typeof value.payload === 'object' && value.payload !== null;
}

export const realtimeTransport = new WebSocketRealtimeTransport();
