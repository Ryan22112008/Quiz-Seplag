export type AuthUserState = { id: string; name: string; email: string; avatarUrl: string | null };
export const initialAuthState: Readonly<{ status: 'loading'; user: null; csrfToken: null }>;
export function authStateFromResponse(responseOk: boolean, user?: AuthUserState | null, csrfToken?: string | null): { status: 'authenticated'; user: AuthUserState; csrfToken: string } | { status: 'unauthenticated'; user: null; csrfToken: null };
export function protectedRouteDecision(status: 'loading' | 'authenticated' | 'unauthenticated', requestedPath: string): { kind: 'loading' } | { kind: 'redirect'; to: string } | { kind: 'render' };
