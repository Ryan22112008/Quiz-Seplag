import type { Quiz } from '@/types/quiz';
import type { Room, RoomPlayer } from '@/types/room';
import type { GameReport } from '@/types/report';
import { API_BASE_URL } from '@/config/environment';
import { useAuthStore } from '@/stores/authStore';

export interface ApiRoom { id: string; pin: string; quizId: string; status: 'WAITING' | 'STARTING' | 'IN_PROGRESS' | 'FINISHED'; players: Array<{ id: string; name: string; avatarCharacterId?: string; avatarAccessoryId?: string }> }
export interface CreatedApiRoom extends ApiRoom { hostToken: string }
export interface PublicQuestion { questionId: string; questionIndex: number; text: string; imageUrl?: string; options: Array<{ id: string; text: string; imageUrl?: string }>; timeLimit: number; questionRevealAt: string; questionStartedAt: string; questionEndsAt: string }
export interface PublicGame { id: string; roomId: string; roomPin: string; quizId: string; status: 'IN_PROGRESS' | 'FINISHED'; currentQuestionIndex: number; totalQuestions: number; questionStartedAt: string | null; questionEndsAt: string | null; currentQuestion: PublicQuestion | null }
export interface AnswerResult { accepted: true; isCorrect: boolean; points: number; totalScore: number }
export interface ApiRankingEntry { position: number; playerId: string; playerName: string; avatarCharacterId?: string; avatarAccessoryId?: string; score: number; answeredQuestions?: number; correctAnswers?: number }

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  const csrfToken = useAuthStore.getState().csrfToken;
  try { response = await fetch(`${API_BASE_URL}${path}`, { ...init, credentials: 'include', headers: { ...(init?.body ? { 'Content-Type': 'application/json' } : {}), ...(csrfToken && !['GET', 'HEAD'].includes(init?.method?.toUpperCase() ?? 'GET') ? { 'X-CSRF-Token': csrfToken } : {}), ...init?.headers } }); }
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
    const csrfToken = useAuthStore.getState().csrfToken;
    try { response = await fetch(`${API_BASE_URL}/uploads`, { method: 'POST', credentials: 'include', headers: csrfToken ? { 'X-CSRF-Token': csrfToken } : {}, body: form }); }
    catch { throw new Error('Não foi possível enviar a imagem.'); }
    const data = await response.json().catch(() => null) as { imageUrl?: string; error?: { message?: string } } | null;
    if (!response.ok || !data?.imageUrl) throw new Error(data?.error?.message ?? `O servidor não aceitou a imagem (HTTP ${response.status}).`);
    return data.imageUrl;
  },
  createQuiz: (quiz: Omit<Quiz, 'id' | 'createdAt' | 'updatedAt'>) => request<Quiz>('/quizzes', { method: 'POST', body: JSON.stringify(quiz) }),
  getMyQuizzes: () => request<Quiz[]>('/quizzes'),
  getQuizTrash: () => request<Quiz[]>('/quizzes/trash'),
  getQuiz: (id: string) => request<Quiz>(`/quizzes/${encodeURIComponent(id)}`),
  updateQuiz: (id: string, quiz: Pick<Quiz, 'title' | 'category' | 'questions'> & { description?: string }) => request<Quiz>(`/quizzes/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(quiz) }),
  duplicateQuiz: (id: string) => request<Quiz>(`/quizzes/${encodeURIComponent(id)}/duplicate`, { method: 'POST' }),
  deleteQuiz: (id: string) => request<void>(`/quizzes/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  restoreQuiz: (id: string) => request<void>(`/quizzes/${encodeURIComponent(id)}/restore`, { method: 'PATCH' }),
  permanentlyDeleteQuiz: (id: string) => request<void>(`/quizzes/${encodeURIComponent(id)}/permanent`, { method: 'DELETE' }),
  getReports: () => request<GameReport[]>('/reports'),
  getReportTrash: () => request<GameReport[]>('/reports/trash'),
  getReport: (id: string) => request<GameReport>(`/reports/${encodeURIComponent(id)}`),
  deleteReport: (id: string) => request<void>(`/reports/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  restoreReport: (id: string) => request<void>(`/reports/${encodeURIComponent(id)}/restore`, { method: 'PATCH' }),
  permanentlyDeleteReport: (id: string) => request<void>(`/reports/${encodeURIComponent(id)}/permanent`, { method: 'DELETE' }),
  createRoom: (quizId: string) => request<CreatedApiRoom>('/rooms', { method: 'POST', body: JSON.stringify({ quizId }) }),
  getRoom: (pin: string) => request<ApiRoom>(`/rooms/${encodeURIComponent(pin)}`),
  getHostQuiz: (pin: string, hostToken: string) => request<Quiz>(`/rooms/${encodeURIComponent(pin)}/quiz`, { headers: { 'X-Host-Token': hostToken } }),
  joinRoom: (pin: string, name: string, avatarCharacterId = 'bear', avatarAccessoryId = 'none') => request<{ room: ApiRoom; player: RoomPlayer; playerToken: string }>(`/rooms/${encodeURIComponent(pin)}/players`, { method: 'POST', body: JSON.stringify({ name, avatarCharacterId, avatarAccessoryId }) }),
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
  return { id: room.id, pin: room.pin, quizId: room.quizId, status: ({ WAITING: 'waiting', STARTING: 'starting', IN_PROGRESS: 'in-progress', FINISHED: 'finished' } as const)[room.status], players: room.players.map(({ id, name, avatarCharacterId, avatarAccessoryId }) => ({ id, name, avatarCharacterId, avatarAccessoryId })), ...('hostToken' in room ? { hostToken: room.hostToken } : {}) };
}
