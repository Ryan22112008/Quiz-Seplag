import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { PrismaClient } from '@prisma/client';
import { DomainError } from '../domain/errors.js';
import { AuthService, type EmailVerificationSender, type PublicUser } from './authService.js';

function setup(sender?: EmailVerificationSender, exposeVerificationUrl = true) {
  let now = new Date('2026-10-05T12:00:00Z');
  const users = new Map<string, PublicUser & { passwordHash: string | null; emailVerifiedAt: Date | null }>();
  const tokens = new Map<string, { id: string; userId: string; pendingPasswordHash?: string; expiresAt: Date }>();
  const sessions = new Map<string, { id: string; userId: string; csrfToken: string; expiresAt: Date }>();
  const db = {
    user: {
      create: async ({ data }: { data: { email: string; name: string; passwordHash: string } }) => {
        if (users.has(data.email)) throw Object.assign(new Error('duplicate'), { code: 'P2002' });
        const user = { id: `user-${users.size + 1}`, email: data.email, name: data.name, avatarUrl: null, passwordHash: data.passwordHash, emailVerifiedAt: null };
        users.set(user.email, user); return { id: user.id, email: user.email, name: user.name, avatarUrl: user.avatarUrl };
      },
      findUnique: async ({ where }: { where: { email?: string; id?: string } }) => [...users.values()].find((user) => (where.email ? user.email === where.email : user.id === where.id)) ?? null,
      update: async ({ where, data }: { where: { id: string }; data: { emailVerifiedAt: Date; passwordHash?: string } }) => {
        const user = [...users.values()].find((item) => item.id === where.id)!; user.emailVerifiedAt = data.emailVerifiedAt; if (data.passwordHash) user.passwordHash = data.passwordHash;
        return { id: user.id, email: user.email, name: user.name, avatarUrl: user.avatarUrl };
      },
    },
    emailVerificationToken: {
      create: async ({ data }: { data: { id: string; userId: string; pendingPasswordHash?: string; expiresAt: Date } }) => { tokens.set(data.id, data); return data; },
      findUnique: async ({ where }: { where: { id: string } }) => { const token = tokens.get(where.id); const user = token && [...users.values()].find((item) => item.id === token.userId); return token && user ? { ...token, user: { id: user.id, email: user.email, name: user.name, avatarUrl: user.avatarUrl } } : null; },
      findFirst: async ({ where }: { where: { userId: string } }) => [...tokens.values()].find((token) => token.userId === where.userId) ?? null,
      deleteMany: async ({ where }: { where?: { userId?: string; id?: string; expiresAt?: { gt: Date } } } = {}) => {
        let count = 0;
        for (const [id, token] of tokens) if ((!where?.userId || token.userId === where.userId) && (!where?.id || token.id === where.id) && (!where?.expiresAt || token.expiresAt > where.expiresAt.gt)) { tokens.delete(id); count++; }
        return { count };
      },
    },
    authSession: {
      create: async ({ data }: { data: { id: string; userId: string; csrfToken: string; expiresAt: Date } }) => { sessions.set(data.id, data); return data; },
      findUnique: async ({ where }: { where: { id: string } }) => { const session = sessions.get(where.id); const user = session && [...users.values()].find((item) => item.id === session.userId); return session && user ? { ...session, user: { id: user.id, name: user.name, email: user.email, avatarUrl: user.avatarUrl } } : null; },
      delete: async ({ where }: { where: { id: string } }) => { sessions.delete(where.id); return {}; },
      deleteMany: async ({ where }: { where: { id: string } }) => ({ count: Number(sessions.delete(where.id)) }),
    },
  } as unknown as PrismaClient;
  const auth = new AuthService(db, { frontendOrigin: 'http://localhost:5173', allowedOrigins: ['http://localhost:5173'], secureCookies: false, sessionSecret: 'test-secret-at-least-32-characters-long', exposeVerificationUrl }, () => now, sender);
  return { auth, users, tokens, sessions, advanceTime: (date: Date) => { now = date; } };
}

const validEmail = 'Person.Example@example.com';
const validPassword = 'correct-horse-91';
const code = (promise: Promise<unknown>, expectedCode: string) => assert.rejects(promise, (error) => error instanceof DomainError && error.code === expectedCode);

describe('email/password authentication', () => {
  it('creates a pending account, verifies its email, and starts an authenticated session', async () => {
    const state = setup();
    const registration = await state.auth.register(validEmail, validPassword);
    assert.equal(registration.email, 'person.example@example.com');
    assert.ok(registration.verificationUrl);
    assert.equal(state.users.size, 1);
    await code(state.auth.login(validEmail, validPassword), 'EMAIL_NOT_VERIFIED');
    const token = new URL(registration.verificationUrl!).searchParams.get('token')!;
    const verified = await state.auth.verifyEmail(token);
    assert.equal(verified.user.email, 'person.example@example.com');
    assert.ok(await state.auth.getSession(verified.sessionToken));
    const loggedIn = await state.auth.login(validEmail, validPassword);
    assert.equal(loggedIn.user.id, verified.user.id);
  });

  it('rejects malformed emails, weak passwords, duplicate accounts, and incorrect passwords', async () => {
    const state = setup();
    await code(state.auth.register('not-an-email', validPassword), 'INVALID_CREDENTIALS');
    await code(state.auth.register(validEmail, 'short'), 'INVALID_CREDENTIALS');
    await state.auth.register(validEmail, validPassword);
    await code(state.auth.register(validEmail.toLowerCase(), validPassword), 'EMAIL_ALREADY_REGISTERED');
    await code(state.auth.login(validEmail, 'wrong-password-123'), 'INVALID_CREDENTIALS');
  });

  it('expires verification links and consumes a valid link only once', async () => {
    const state = setup();
    const { verificationUrl } = await state.auth.register(validEmail, validPassword);
    const token = new URL(verificationUrl!).searchParams.get('token')!;
    await state.auth.verifyEmail(token);
    await code(state.auth.verifyEmail(token), 'INVALID_VERIFICATION_TOKEN');
    const second = await state.auth.register('second@example.com', validPassword);
    const expiredToken = new URL(second.verificationUrl!).searchParams.get('token')!;
    state.advanceTime(new Date('2026-10-06T12:00:01Z'));
    await code(state.auth.verifyEmail(expiredToken), 'INVALID_VERIFICATION_TOKEN');
  });

  it('sends production verification messages through the configured mailer', async () => {
    const sent: Array<{ email: string; link: string }> = [];
    const state = setup({ send: async (email, link) => { sent.push({ email, link }); } }, false);
    const result = await state.auth.register(validEmail, validPassword);
    assert.equal(sent.length, 1);
    assert.equal(sent[0]?.email, 'person.example@example.com');
    assert.equal(new URL(sent[0]!.link).pathname, '/verificar-email');
    assert.equal(result.verificationUrl, undefined);
  });

  it('issues opaque persistent sessions and removes them on logout', async () => {
    const state = setup();
    const registration = await state.auth.register(validEmail, validPassword);
    const token = new URL(registration.verificationUrl!).searchParams.get('token')!;
    const { sessionToken } = await state.auth.verifyEmail(token);
    const session = await state.auth.getSession(sessionToken);
    assert.ok(session);
    assert.ok(session.csrfToken.length >= 32);
    await state.auth.logout(session.sessionId);
    assert.equal(await state.auth.getSession(sessionToken), null);
  });
});
