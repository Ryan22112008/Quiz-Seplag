import type { ClientCommand, ServerEvent } from '@/types/realtime';
import { useRealtimeStore } from '@/stores/realtimeStore';

export interface RealtimeTransport {
  connect(): Promise<void>;
  disconnect(): void;
  send(command: ClientCommand): void;
  subscribe(handler: (event: ServerEvent) => void): () => void;
}

const WS_URL = import.meta.env.VITE_WS_URL ?? 'ws://localhost:3000/realtime';
const EVENT_TYPES = new Set(['ROOM_CREATED','PLAYER_JOINED','PLAYER_LEFT','GAME_STARTED','ROOM_SUBSCRIBED','REALTIME_ERROR','QUESTION_STARTED','ANSWER_SUBMITTED','QUESTION_ENDED','QUESTION_RESULT','RANKING_UPDATED','GAME_FINISHED','ROOM_CLOSED']);

export class WebSocketRealtimeTransport implements RealtimeTransport {
  private socket: WebSocket | null = null;
  private opening: Promise<void> | null = null;
  private handlers = new Set<(event: ServerEvent) => void>();

  connect(): Promise<void> {
    if (this.socket?.readyState === WebSocket.OPEN) return Promise.resolve();
    if (this.opening) return this.opening;
    useRealtimeStore.getState().setConnectionState('connecting');
    const opening = new Promise<void>((resolve, reject) => {
      const socket = new WebSocket(WS_URL);
      this.socket = socket;
      const timeout = window.setTimeout(() => { socket.close(); reject(new Error('Tempo esgotado ao conectar ao servidor realtime.')); }, 8000);
      socket.onopen = () => { window.clearTimeout(timeout); useRealtimeStore.getState().setConnectionState('connected'); resolve(); };
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
      socket.onerror = () => { useRealtimeStore.getState().setConnectionState('error'); if (socket.readyState !== WebSocket.OPEN) { window.clearTimeout(timeout); reject(new Error('Falha ao conectar ao servidor realtime.')); } };
      socket.onclose = () => { window.clearTimeout(timeout); if (this.socket === socket) this.socket = null; this.opening = null; useRealtimeStore.getState().setConnectionState('disconnected'); };
    }).finally(() => { this.opening = null; });
    this.opening = opening;
    return opening;
  }

  disconnect(): void { this.socket?.close(1000, 'Cliente desconectado'); this.socket = null; useRealtimeStore.getState().setConnectionState('disconnected'); }
  send(command: ClientCommand): void {
    if (this.socket?.readyState !== WebSocket.OPEN) throw new Error('A conexão realtime não está disponível.');
    this.socket.send(JSON.stringify(command));
  }
  subscribe(handler: (event: ServerEvent) => void): () => void { this.handlers.add(handler); return () => this.handlers.delete(handler); }
}

function isServerEvent(value: unknown): value is ServerEvent {
  return typeof value === 'object' && value !== null && 'type' in value && 'payload' in value && typeof value.type === 'string' && EVENT_TYPES.has(value.type) && typeof value.payload === 'object' && value.payload !== null;
}

export const realtimeTransport = new WebSocketRealtimeTransport();
