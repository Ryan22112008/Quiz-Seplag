import { create } from 'zustand';
import { API_BASE_URL } from '@/config/environment';

export interface AuthUser { id: string; name: string; email: string; avatarUrl: string | null }
type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';
interface AuthReply { user: AuthUser; csrfToken: string }
interface AuthState { status: AuthStatus; user: AuthUser | null; csrfToken: string | null; initialize: () => Promise<void>; login: (email: string, password: string) => Promise<void>; register: (email: string, password: string) => Promise<void>; requestPasswordReset: (email: string) => Promise<string>; resetPassword: (email: string, code: string, password: string) => Promise<void>; logout: () => Promise<void> }

async function post<T>(path: string, body?: unknown, csrfToken?: string | null): Promise<T> {
  let response: Response;
  try { response = await fetch(`${API_BASE_URL}${path}`, { method: 'POST', credentials: 'include', headers: { ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) }); }
  catch { throw new Error('Não foi possível conectar ao servidor.'); }
  const data = await response.json().catch(() => null) as (T & { error?: { message?: string } }) | null;
  if (!response.ok) throw new Error(data?.error?.message ?? 'Não foi possível concluir a solicitação.');
  return data as T;
}

function acceptSession(data: AuthReply) { return { status: 'authenticated' as const, user: data.user, csrfToken: data.csrfToken }; }

export const useAuthStore = create<AuthState>((set, get) => ({
  status: 'loading', user: null, csrfToken: null,
  initialize: async () => {
    set({ status: 'loading' });
    try {
      const response = await fetch(`${API_BASE_URL}/auth/me`, { credentials: 'include' });
      if (!response.ok) { set({ status: 'unauthenticated', user: null, csrfToken: null }); return; }
      set(acceptSession(await response.json() as AuthReply));
    } catch { set({ status: 'unauthenticated', user: null, csrfToken: null }); }
  },
  login: async (email, password) => set(acceptSession(await post<AuthReply>('/auth/login', { email, password }, get().csrfToken))),
  register: async (email, password) => set(acceptSession(await post<AuthReply>('/auth/register', { email, password }, get().csrfToken))),
  requestPasswordReset: async (email) => (await post<{ message: string }>('/auth/password/forgot', { email })).message,
  resetPassword: async (email, code, password) => { await post<void>('/auth/password/reset', { email, code, password }); },
  logout: async () => {
    const csrfToken = get().csrfToken;
    let response: Response;
    try { response = await fetch(`${API_BASE_URL}/auth/logout`, { method: 'POST', credentials: 'include', headers: csrfToken ? { 'X-CSRF-Token': csrfToken } : {} }); }
    catch { throw new Error('Não foi possível conectar ao servidor.'); }
    if (!response.ok && response.status !== 401) throw new Error('Não foi possível encerrar a sessão.');
    set({ status: 'unauthenticated', user: null, csrfToken: null });
  },
}));
