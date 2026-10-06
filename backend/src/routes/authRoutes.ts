import { Router } from 'express';
import type { AuthService } from '../auth/authService.js';
import { CSRF_COOKIE, requireAuth, SESSION_COOKIE } from '../auth/middleware.js';
export function createAuthRoutes(auth: AuthService) {
  const router = Router();
  router.post('/auth/register', async (request, response, next) => {
    if (!auth.isAllowedOrigin(request.get('origin'))) { response.status(403).json({ error: { code: 'ORIGIN_REJECTED', message: 'Origem não autorizada.' } }); return; }
    try { response.status(201).json(await auth.register(request.body?.email, request.body?.password)); } catch (error) { next(error); }
  });
  router.post('/auth/login', async (request, response, next) => {
    if (!auth.isAllowedOrigin(request.get('origin'))) { response.status(403).json({ error: { code: 'ORIGIN_REJECTED', message: 'Origem não autorizada.' } }); return; }
    try {
      const result = await auth.login(request.body?.email, request.body?.password);
      setSessionCookies(response, result, auth);
      response.set('Cache-Control', 'no-store').json({ user: result.user, csrfToken: result.csrfToken });
    } catch (error) { next(error); }
  });
  router.post('/auth/verify-email', async (request, response, next) => {
    if (!auth.isAllowedOrigin(request.get('origin'))) { response.status(403).json({ error: { code: 'ORIGIN_REJECTED', message: 'Origem não autorizada.' } }); return; }
    try {
      const result = await auth.verifyEmail(request.body?.token);
      setSessionCookies(response, result, auth);
      response.set('Cache-Control', 'no-store').json({ user: result.user, csrfToken: result.csrfToken });
    } catch (error) { next(error); }
  });
  router.post('/auth/resend-verification', async (request, response, next) => {
    if (!auth.isAllowedOrigin(request.get('origin'))) { response.status(403).json({ error: { code: 'ORIGIN_REJECTED', message: 'Origem não autorizada.' } }); return; }
    try { response.status(202).json(await auth.resendVerification(request.body?.email)); } catch (error) { next(error); }
  });
  router.get('/auth/me', requireAuth, (request, response) => response.set('Cache-Control', 'no-store').json({ user: request.auth!.user, csrfToken: request.auth!.csrfToken }));
  router.post('/auth/logout', async (request, response, next) => {
    try {
      if (request.auth) await auth.logout(request.auth.sessionId);
      response.clearCookie(SESSION_COOKIE, auth.clearCookieOptions());
      response.clearCookie(CSRF_COOKIE, { ...auth.clearCookieOptions(), httpOnly: false });
      response.status(204).send();
    } catch (error) { next(error); }
  });
  return router;
}
function setSessionCookies(response: import('express').Response, result: { sessionToken: string; csrfToken: string }, auth: AuthService) {
  response.cookie(SESSION_COOKIE, result.sessionToken, auth.cookieOptions());
  response.cookie(CSRF_COOKIE, result.csrfToken, { ...auth.cookieOptions(), httpOnly: false });
}
