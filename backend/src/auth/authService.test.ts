import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AuthService } from './authService.js';

function setup() {
  const users = new Map<string, { id: string; email: string; name: string; avatarUrl: null; passwordHash: string; emailVerifiedAt: null }>();
  const sessions = new Map<string, { userId: string; csrfToken: string; expiresAt: Date }>();
  const db = {
    user: {
      create: async ({ data }: any) => {
        if (users.has(data.email)) throw { code: 'P2002' };
        const user = { id: 'user-1', email: data.email, name: data.name, avatarUrl: null, passwordHash: data.passwordHash, emailVerifiedAt: null };
        users.set(data.email, user);
        return { id: user.id, email: user.email, name: user.name, avatarUrl: user.avatarUrl };
      },
      findUnique: async ({ where }: any) => users.get(where.email) ?? null,
    },
    authSession: {
      create: async ({ data }: any) => { sessions.set(data.id, data); return data; },
      findUnique: async ({ where }: any) => {
        const session = sessions.get(where.id);
        const user = [...users.values()].find((candidate) => candidate.id === session?.userId);
        return session && user ? { ...session, ...where, user: { id: user.id, name: user.name, email: user.email, avatarUrl: user.avatarUrl } } : null;
      },
      delete: async ({ where }: any) => sessions.delete(where.id),
      deleteMany: async ({ where }: any) => sessions.delete(where.id),
    },
  } as any;
  const service = new AuthService(db, { clientId: '', clientSecret: '', callbackUrl: '', frontendOrigin: 'http://localhost:5173', allowedOrigins: ['http://localhost:5173'], secureCookies: false, sessionSecret: 'test-secret' });
  return { service, users };
}

test('register creates an unverified account and authenticated session without email delivery', async () => {
  const { service, users } = setup();
  const result = await service.register('new@example.com', 'correct horse battery');
  assert.equal(result.user.email, 'new@example.com');
  assert.ok(result.sessionToken);
  assert.ok(result.csrfToken);
  assert.equal(users.get('new@example.com')?.emailVerifiedAt, null);
  assert.notEqual(users.get('new@example.com')?.passwordHash, 'correct horse battery');
  assert.equal((await service.getSession(result.sessionToken))?.user.email, 'new@example.com');
});

test('login accepts an existing unverified account but still rejects an incorrect password', async () => {
  const { service } = setup();
  await service.register('old@example.com', 'correct horse battery');
  assert.equal((await service.login('old@example.com', 'correct horse battery')).user.email, 'old@example.com');
  await assert.rejects(service.login('old@example.com', 'incorrect horse battery'), { code: 'INVALID_CREDENTIALS' });
});
