import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { PrismaClient } from '@prisma/client';
import { AuthService, type GoogleIdentityClient } from './authService.js';

function setup() {
  let now = new Date('2026-10-05T12:00:00Z');
  let attempt: { id: string; nonce: string; codeVerifier: string; returnTo: string; expiresAt: Date } | undefined;
  let user: { id: string; googleId: string; email: string; name: string; avatarUrl: string | null } | undefined;
  let upserts = 0;
  const sessions = new Map<string, { id: string; userId: string; csrfToken: string; expiresAt: Date }>();
  let claims: Record<string, unknown> = {};
  const db = {
    oAuthState: {
      create: async ({ data }: { data: NonNullable<typeof attempt> }) => { attempt = data; return data; },
      findUnique: async ({ where }: { where: { id: string } }) => attempt?.id === where.id ? attempt : null,
      delete: async ({ where }: { where: { id: string } }) => { if (attempt?.id === where.id) attempt = undefined; return {}; },
      deleteMany: async () => ({ count: 0 }),
    },
    user: { upsert: async ({ where, create, update }: { where: { googleId: string }; create: typeof user; update: Partial<NonNullable<typeof user>> }) => {
      upserts++;
      if (!user) user = { id: 'user-1', googleId: where.googleId, email: create!.email, name: create!.name, avatarUrl: create!.avatarUrl };
      else if (user.googleId === where.googleId) user = { ...user, ...update };
      else throw new Error('UNIQUE_CONSTRAINT');
      return { id: user.id, name: user.name, email: user.email, avatarUrl: user.avatarUrl };
    } },
    authSession: {
      create: async ({ data }: { data: NonNullable<ReturnType<typeof sessions.get>> }) => { sessions.set(data.id, data); return data; },
      findUnique: async ({ where }: { where: { id: string } }) => { const session = sessions.get(where.id); return session && user ? { ...session, user: { id: user.id, name: user.name, email: user.email, avatarUrl: user.avatarUrl } } : null; },
      delete: async ({ where }: { where: { id: string } }) => { sessions.delete(where.id); return {}; },
      deleteMany: async ({ where }: { where: { id: string } }) => ({ count: Number(sessions.delete(where.id)) }),
    },
  } as unknown as PrismaClient;
  const google = {
    generateCodeVerifierAsync: async () => ({ codeVerifier: 'verifier', codeChallenge: 'challenge' }),
    generateAuthUrl: (options: { state: string; nonce: string }) => `https://accounts.google.com/auth?state=${options.state}&nonce=${options.nonce}`,
    getToken: async () => ({ tokens: { id_token: 'signed-id-token' } }),
    verifyIdToken: async () => ({ getPayload: () => claims }),
  } as unknown as GoogleIdentityClient;
  const auth = new AuthService(db, { clientId: 'client-id', clientSecret: 'secret', callbackUrl: 'http://localhost:3000/auth/google/callback', frontendOrigin: 'http://localhost:5173', secureCookies: false, sessionSecret: 'test-secret-at-least-32-characters-long' }, () => now, google);
  const identity = (nonce: string) => { claims = { iss: 'https://accounts.google.com', aud: 'client-id', exp: now.getTime() / 1000 + 600, nonce, email_verified: true, sub: 'google-subject', email: 'person@example.com', name: 'Pessoa', picture: 'https://example.com/avatar.png' }; };
  const login = async () => {
    const authorization = await auth.createAuthorizationUrl('/criar');
    const url = new URL(authorization.url);
    identity(url.searchParams.get('nonce')!);
    return auth.finishGoogleLogin('authorization-code', url.searchParams.get('state')!);
  };
  return { auth, login, sessions, get upserts() { return upserts; }, advanceTime: (date: Date) => { now = date; } };
}

describe('Google session service', () => {
  it('creates one persistent user and reuses it on the next Google login', async () => {
    const state = setup();
    const first = await state.login();
    const second = await state.login();
    assert.equal(first.user.id, second.user.id);
    assert.equal(second.user.email, 'person@example.com');
    assert.equal(state.upserts, 2);
  });

  it('issues an opaque persistent session and removes it on logout', async () => {
    const { auth, login } = setup();
    const { sessionToken } = await login();
    const session = await auth.getSession(sessionToken);
    assert.ok(session);
    assert.ok(session.csrfToken.length >= 32);
    await auth.logout(session.sessionId);
    assert.equal(await auth.getSession(sessionToken), null);
  });

  it('rejects an expired OAuth state before exchanging its authorization code', async () => {
    const state = setup();
    const authorization = await state.auth.createAuthorizationUrl();
    const url = new URL(authorization.url);
    state.advanceTime(new Date('2026-10-05T12:11:00Z'));
    await assert.rejects(() => state.auth.finishGoogleLogin('authorization-code', url.searchParams.get('state')!), /INVALID_OAUTH_STATE/u);
  });
});
