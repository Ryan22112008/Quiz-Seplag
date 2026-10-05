export const initialAuthState = Object.freeze({ status: 'loading', user: null, csrfToken: null });

export function authStateFromResponse(responseOk, user = null, csrfToken = null) {
  return responseOk && user && csrfToken
    ? { status: 'authenticated', user, csrfToken }
    : { status: 'unauthenticated', user: null, csrfToken: null };
}

export function protectedRouteDecision(status, requestedPath) {
  if (status === 'loading') return { kind: 'loading' };
  if (status !== 'authenticated') return { kind: 'redirect', to: `/login?returnTo=${encodeURIComponent(requestedPath)}` };
  return { kind: 'render' };
}
