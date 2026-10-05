import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { Request, Response } from 'express';
import { requireAuth, requireCsrf } from './middleware.js';

describe('authentication middleware', () => {
  it('returns 401 when a protected endpoint has no authenticated session', () => {
    let status = 0;
    let payload: unknown;
    let continued = false;
    const response = { status(value: number) { status = value; return this; }, json(value: unknown) { payload = value; return this; } } as Response;
    requireAuth({} as Request, response, () => { continued = true; });
    assert.equal(status, 401);
    assert.equal((payload as { error: { code: string } }).error.code, 'UNAUTHENTICATED');
    assert.equal(continued, false);
  });

  it('rejects unsafe session requests without an origin and matching CSRF token', () => {
    let status = 0;
    let continued = false;
    const request = { auth: { user: { id: 'u', name: 'User', email: 'u@example.com', avatarUrl: null }, csrfToken: 'secret-csrf', sessionId: 'session' }, headers: {}, get: () => undefined } as unknown as Request;
    const response = { status(value: number) { status = value; return this; }, json() { return this; } } as unknown as Response;
    requireCsrf(['https://frontend.example'])(request, response, () => { continued = true; });
    assert.equal(status, 403);
    assert.equal(continued, false);
  });
});
