import type { Quiz } from '@/types/quiz';
import type { Room, RoomPlayer } from '@/types/room';
import { API_BASE_URL } from '@/config/environment';

export interface ApiRoom { id: string; pin: string; quizId: string; status: 'WAITING' | 'STARTING' | 'IN_PROGRESS' | 'FINISHED'; players: Array<{ id: string; name: string }> }
export interface CreatedApiRoom extends ApiRoom { hostToken: string }
export interface PublicQuestion { questionId: string; questionIndex: number; text: string; imageUrl?: string; options: Array<{ id: string; text: string; imageUrl?: string }>; timeLimit: number; questionStartedAt: string; questionEndsAt: string }
export interface PublicGame { id: string; roomId: string; roomPin: string; quizId: string; status: 'IN_PROGRESS' | 'FINISHED'; currentQuestionIndex: number; totalQuestions: number; questionStartedAt: string | null; questionEndsAt: string | null; currentQuestion: PublicQuestion | null }
export interface AnswerResult { accepted: true; isCorrect: boolean; points: number; totalScore: number }
export interface ApiRankingEntry { position: number; playerId: string; playerName: string; score: number; correctAnswers?: number }

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try { response = await fetch(`${API_BASE_URL}${path}`, { ...init, headers: { ...(init?.body ? { 'Content-Type': 'application/json' } : {}), ...init?.headers } }); }
  catch { throw new Error('Não foi possível conectar. Confira sua internet e tente novamente.'); }
  if (!response.ok) {
    const data = await response.json().catch(() => null) as { error?: { code?: string; message?: string } } | null;
    throw new Error(data?.error?.message ?? 'Não foi possível concluir a solicitação.');
  }
  return response.status === 204 ? undefined as T : response.json() as Promise<T>;
}

export const api = {
  uploadImage: async (file: File): Promise<string> => {
    let response: Response;
    const form = new FormData();
    form.append('image', file);
    try { response = await fetch(`${API_BASE_URL}/uploads`, { method: 'POST', body: form }); }
    catch { throw new Error('Não foi possível enviar a imagem.'); }
    const data = await response.json() as { imageUrl?: string; error?: { message?: string } };
    if (!response.ok || !data.imageUrl) throw new Error(data.error?.message ?? 'Não foi possível enviar a imagem.');
    return data.imageUrl;
  },
  createQuiz: (quiz: Omit<Quiz, 'id' | 'createdAt' | 'updatedAt'>) => request<Quiz>('/quizzes', { method: 'POST', body: JSON.stringify(quiz) }),
  getQuiz: (id: string) => request<Quiz>(`/quizzes/${encodeURIComponent(id)}`),
  createRoom: (quizId: string) => request<CreatedApiRoom>('/rooms', { method: 'POST', body: JSON.stringify({ quizId }) }),
  getRoom: (pin: string) => request<ApiRoom>(`/rooms/${encodeURIComponent(pin)}`),
  getHostQuiz: (pin: string, hostToken: string) => request<Quiz>(`/rooms/${encodeURIComponent(pin)}/quiz`, { headers: { 'X-Host-Token': hostToken } }),
  joinRoom: (pin: string, name: string) => request<{ room: ApiRoom; player: RoomPlayer; playerToken: string }>(`/rooms/${encodeURIComponent(pin)}/players`, { method: 'POST', body: JSON.stringify({ name }) }),
  leaveRoom: (pin: string, playerId: string) => request<void>(`/rooms/${encodeURIComponent(pin)}/players/${encodeURIComponent(playerId)}`, { method: 'DELETE' }),
  getGame: (pin: string) => request<PublicGame>(`/rooms/${encodeURIComponent(pin)}/game`),
  startGame: (pin: string) => request<PublicGame>(`/rooms/${encodeURIComponent(pin)}/start`, { method: 'POST' }),
  startQuestion: (pin: string) => request<PublicGame>(`/rooms/${encodeURIComponent(pin)}/game/question/start`, { method: 'POST' }),
  nextQuestion: (pin: string) => request<PublicGame>(`/rooms/${encodeURIComponent(pin)}/game/question/next`, { method: 'POST' }),
  submitAnswer: (pin: string, playerId: string, questionId: string, optionId: string) => request<AnswerResult>(`/rooms/${encodeURIComponent(pin)}/game/question/answer`, { method: 'POST', body: JSON.stringify({ playerId, questionId, optionId }) }),
  getRanking: (pin: string) => request<ApiRankingEntry[]>(`/rooms/${encodeURIComponent(pin)}/game/ranking`),
  finishGame: (pin: string) => request<PublicGame>(`/rooms/${encodeURIComponent(pin)}/game/finish`, { method: 'POST' }),
};

export function toFrontendRoom(room: ApiRoom | CreatedApiRoom): Room {
  return { id: room.id, pin: room.pin, quizId: room.quizId, status: ({ WAITING: 'waiting', STARTING: 'starting', IN_PROGRESS: 'in-progress', FINISHED: 'finished' } as const)[room.status], players: room.players.map(({ id, name }) => ({ id, name })), ...('hostToken' in room ? { hostToken: room.hostToken } : {}) };
}
