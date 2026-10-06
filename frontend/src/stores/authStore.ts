import { create } from 'zustand';
import { API_BASE_URL } from '@/config/environment';
import { authStateFromResponse, initialAuthState } from '@/lib/authState.mjs';

export interface AuthUser { id: string; name: string; email: string; avatarUrl: string | null }
type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';
export class AuthRequestError extends Error { constructor(message: string, readonly code?: string) { super(message); this.name = 'AuthRequestError'; } }
interface AuthReply { user: AuthUser; csrfToken: string }
interface AuthState { status: AuthStatus; user: AuthUser | null; csrfToken: string | null; initialize: () => Promise<void>; login: (email: string, password: string) => Promise<void>; register: (email: string, password: string) => Promise<{ verificationUrl?: string }>; resendVerification: (email: string) => Promise<{ verificationUrl?: string }>; verifyEmail: (token: string) => Promise<void>; logout: () => Promise<void> }

async function authRequest<T>(path: string, body: unknown): Promise<T> {
  let response: Response;
  try { response = await fetch(`${API_BASE_URL}${path}`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); }
  catch { throw new AuthRequestError('Não foi possível conectar ao servidor.'); }
  const data = await response.json().catch(() => null) as (T & { error?: { code?: string; message?: string } }) | null;
  if (!response.ok) throw new AuthRequestError(data?.error?.message ?? 'Não foi possível concluir a solicitação.', data?.error?.code);
  return data as T;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  ...initialAuthState,
  initialize: async () => {
    set({ status: 'loading' });
    try {
      const response = await fetch(`${API_BASE_URL}/auth/me`, { credentials: 'include' });
      if (!response.ok) { set(authStateFromResponse(false)); return; }
      const data = await response.json() as { user: AuthUser; csrfToken: string };
      set(authStateFromResponse(true, data.user, data.csrfToken));
    } catch { set(authStateFromResponse(false)); }
  },
  login: async (email, password) => {
    const data = await authRequest<AuthReply>('/auth/login', { email, password });
    set(authStateFromResponse(true, data.user, data.csrfToken));
  },
  register: (email, password) => authRequest<{ verificationUrl?: string }>('/auth/register', { email, password }),
  resendVerification: (email) => authRequest<{ verificationUrl?: string }>('/auth/resend-verification', { email }),
  verifyEmail: async (token) => {
    const data = await authRequest<AuthReply>('/auth/verify-email', { token });
    set(authStateFromResponse(true, data.user, data.csrfToken));
  },
  logout: async () => {
    const csrfToken = get().csrfToken ?? document.cookie.split('; ').find((item) => item.startsWith('quiz_csrf='))?.split('=').slice(1).join('=');
    const response = await fetch(`${API_BASE_URL}/auth/logout`, { method: 'POST', credentials: 'include', headers: csrfToken ? { 'X-CSRF-Token': decodeURIComponent(csrfToken) } : {} });
    if (!response.ok && response.status !== 401) throw new Error('Não foi possível encerrar a sessão.');
    set({ status: 'unauthenticated', user: null, csrfToken: null });
  },
}));
