import { realtimeTransport } from './transport';
import type { ClientCommand } from '@/types/realtime';

const subscriptions = new Set<string>();
export async function subscribeRoom(roomPin: string, playerId?: string): Promise<void> {
  const key = `${roomPin}:${playerId ?? 'host'}`;
  if (subscriptions.has(key)) return;
  await realtimeTransport.connect();
  const command: ClientCommand = { type: 'SUBSCRIBE_GAME', payload: { roomPin, ...(playerId ? { playerId } : {}) } };
  realtimeTransport.send(command);
  subscriptions.add(key);
}
export function sendCommand(command: ClientCommand): void { realtimeTransport.send(command); }
