import { create } from 'zustand';
import { API_BASE_URL } from '@/config/environment';
import { authStateFromResponse, initialAuthState } from '@/lib/authState.mjs';

export interface AuthUser { id: string; name: string; email: string; avatarUrl: string | null }
type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';
interface AuthState { status: AuthStatus; user: AuthUser | null; csrfToken: string | null; initialize: () => Promise<void>; logout: () => Promise<void> }
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
  logout: async () => {
    const csrfToken = get().csrfToken ?? document.cookie.split('; ').find((item) => item.startsWith('quiz_csrf='))?.split('=').slice(1).join('=');
    const response = await fetch(`${API_BASE_URL}/auth/logout`, { method: 'POST', credentials: 'include', headers: csrfToken ? { 'X-CSRF-Token': decodeURIComponent(csrfToken) } : {} });
    if (!response.ok && response.status !== 401) throw new Error('Não foi possível encerrar a sessão.');
    set({ status: 'unauthenticated', user: null, csrfToken: null });
  },
}));
