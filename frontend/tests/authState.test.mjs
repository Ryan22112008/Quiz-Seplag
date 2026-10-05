import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { authStateFromResponse, initialAuthState, protectedRouteDecision } from '../src/lib/authState.mjs';

describe('frontend authentication state', () => {
  it('starts in loading state so protected content is not shown before session lookup', () => {
    assert.deepEqual(initialAuthState, { status: 'loading', user: null, csrfToken: null });
    assert.deepEqual(protectedRouteDecision(initialAuthState.status, '/criar'), { kind: 'loading' });
  });
  it('represents an authenticated user and allows the protected route', () => {
    const user = { id: 'u1', name: 'Pessoa', email: 'pessoa@example.com', avatarUrl: null };
    const state = authStateFromResponse(true, user, 'csrf-value');
    assert.deepEqual(state, { status: 'authenticated', user, csrfToken: 'csrf-value' });
    assert.deepEqual(protectedRouteDecision(state.status, '/criar'), { kind: 'render' });
  });
  it('does not mark a user authenticated without the CSRF token needed for writes', () => {
    assert.deepEqual(authStateFromResponse(true, { id: 'u1', name: 'Pessoa', email: 'pessoa@example.com', avatarUrl: null }), { status: 'unauthenticated', user: null, csrfToken: null });
  });
  it('represents an unauthenticated session and preserves the requested location for return', () => {
    const state = authStateFromResponse(false);
    assert.deepEqual(state, { status: 'unauthenticated', user: null, csrfToken: null });
    assert.deepEqual(protectedRouteDecision(state.status, '/criar/quiz-1?tab=perguntas'), { kind: 'redirect', to: '/login?returnTo=%2Fcriar%2Fquiz-1%3Ftab%3Dperguntas' });
  });
});
