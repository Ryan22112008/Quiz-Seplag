import { Router, type Response } from 'express';
import type { AuthService } from '../auth/authService.js';
import { CSRF_COOKIE, readCookie, requireAuth, SESSION_COOKIE } from '../auth/middleware.js';

const OAUTH_STATE_COOKIE = 'quiz_oauth_state';
export function createAuthRoutes(auth: AuthService) {
  const router = Router();
  router.get('/auth/providers', (_request, response) => response.set('Cache-Control', 'no-store').json({ google: auth.googleEnabled }));
  router.post('/auth/register', async (request, response, next) => {
    if (!auth.isAllowedOrigin(request.get('origin'))) { response.status(403).json({ error: { code: 'ORIGIN_REJECTED', message: 'Origem não autorizada.' } }); return; }
    try { const result = await auth.register(request.body?.email, request.body?.password); setSessionCookies(response, result, auth); response.status(201).set('Cache-Control', 'no-store').json({ user: result.user, csrfToken: result.csrfToken }); }
    catch (error) { next(error); }
  });
  router.post('/auth/login', async (request, response, next) => {
    if (!auth.isAllowedOrigin(request.get('origin'))) { response.status(403).json({ error: { code: 'ORIGIN_REJECTED', message: 'Origem não autorizada.' } }); return; }
    try { const result = await auth.login(request.body?.email, request.body?.password); setSessionCookies(response, result, auth); response.set('Cache-Control', 'no-store').json({ user: result.user, csrfToken: result.csrfToken }); }
    catch (error) { next(error); }
  });
  router.post('/auth/google', async (request, response, next) => {
    if (!auth.isAllowedOrigin(request.get('origin'))) { response.status(403).json({ error: { code: 'ORIGIN_REJECTED', message: 'Origem não autorizada.' } }); return; }
    try {
      const result = await auth.loginWithGoogleIdToken(request.body?.credential ?? request.body?.idToken);
      setSessionCookies(response, result, auth);
      response.set('Cache-Control', 'no-store').json({ user: result.user, csrfToken: result.csrfToken });
    } catch (error) { next(error); }
  });
  router.post('/auth/password/forgot', async (request, response, next) => {
    if (!auth.isAllowedOrigin(request.get('origin'))) { response.status(403).json({ error: { code: 'ORIGIN_REJECTED', message: 'Origem não autorizada.' } }); return; }
    try { await auth.requestPasswordReset(request.body?.email); response.status(202).set('Cache-Control', 'no-store').json({ message: 'Se houver uma conta com esse e-mail, enviaremos um código para redefinir sua senha.' }); }
    catch (error) { next(error); }
  });
  router.post('/auth/password/reset', async (request, response, next) => {
    if (!auth.isAllowedOrigin(request.get('origin'))) { response.status(403).json({ error: { code: 'ORIGIN_REJECTED', message: 'Origem não autorizada.' } }); return; }
    try { await auth.resetPassword(request.body?.email, request.body?.code, request.body?.password); response.status(204).set('Cache-Control', 'no-store').send(); }
    catch (error) { next(error); }
  });
  router.get('/auth/google', async (request, response, next) => {
    try {
      const authorization = await auth.createAuthorizationUrl(typeof request.query.returnTo === 'string' ? request.query.returnTo : '/');
      response.cookie(OAUTH_STATE_COOKIE, authorization.state, { ...auth.clearCookieOptions(), maxAge: 10 * 60_000 });
      response.redirect(302, authorization.url);
    } catch (error) { next(error); }
  });
  router.get('/auth/google/callback', async (request, response) => {
    const { code, state } = request.query;
    const stateCookie = readCookie(request.headers.cookie, OAUTH_STATE_COOKIE);
    response.clearCookie(OAUTH_STATE_COOKIE, auth.clearCookieOptions());
    if (typeof code !== 'string' || typeof state !== 'string' || !stateCookie || stateCookie !== state) { response.redirect(302, `${auth.frontendOrigin}/login?error=google_login_failed`); return; }
    try {
      const result = await auth.finishGoogleLogin(code, state);
      setSessionCookies(response, result, auth);
      response.redirect(302, new URL(result.returnTo, auth.frontendOrigin).toString());
    } catch { response.redirect(302, `${auth.frontendOrigin}/login?error=google_login_failed`); }
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

function setSessionCookies(response: Response, result: { sessionToken: string; csrfToken: string }, auth: AuthService) {
  response.cookie(SESSION_COOKIE, result.sessionToken, auth.cookieOptions());
  response.cookie(CSRF_COOKIE, result.csrfToken, { ...auth.cookieOptions(), httpOnly: false });
}
