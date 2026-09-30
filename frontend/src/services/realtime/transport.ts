import type { ClientCommand, ServerEvent } from '@/types/realtime';

export interface RealtimeTransport {
  connect(): Promise<void> | void;
  disconnect(): void;
  send(command: ClientCommand): void;
  subscribe(handler: (event: ServerEvent) => void): () => void;
}

/** Deliberately inert until a real transport/backend is implemented. */
export const inertRealtimeTransport: RealtimeTransport = {
  connect: () => undefined,
  disconnect: () => undefined,
  send: () => undefined,
  subscribe: () => () => undefined,
};
