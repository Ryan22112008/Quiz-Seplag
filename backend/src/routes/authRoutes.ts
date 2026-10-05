import { Router } from 'express';
import type { AuthService } from '../auth/authService.js';
import { CSRF_COOKIE, requireAuth, SESSION_COOKIE } from '../auth/middleware.js';
const OAUTH_STATE_COOKIE = 'quiz_oauth_state';
export function createAuthRoutes(auth: AuthService) {
  const router = Router();
  router.get('/auth/google', async (request, response, next) => {
    try {
      const authorization = await auth.createAuthorizationUrl(typeof request.query.returnTo === 'string' ? request.query.returnTo : '/');
      response.cookie(OAUTH_STATE_COOKIE, authorization.state, { ...auth.clearCookieOptions(), maxAge: 10 * 60_000 });
      response.redirect(302, authorization.url);
    }
    catch (error) { next(error); }
  });
  router.get('/auth/google/callback', async (request, response) => {
    const { code, state } = request.query;
    const rawStateCookie = request.headers.cookie?.split(';').map((item) => item.trim()).find((item) => item.startsWith(`${OAUTH_STATE_COOKIE}=`))?.slice(OAUTH_STATE_COOKIE.length + 1);
    let stateCookie: string | undefined;
    try { stateCookie = rawStateCookie ? decodeURIComponent(rawStateCookie) : undefined; } catch { stateCookie = undefined; }
    response.clearCookie(OAUTH_STATE_COOKIE, auth.clearCookieOptions());
    if (typeof code !== 'string' || typeof state !== 'string' || !stateCookie || stateCookie !== state) { response.redirect(`${authFrontend(auth)}/login?error=google_login_failed`); return; }
    try {
      const result = await auth.finishGoogleLogin(code, state);
      response.cookie(SESSION_COOKIE, result.sessionToken, auth.cookieOptions());
      response.cookie(CSRF_COOKIE, result.csrfToken, { ...auth.cookieOptions(), httpOnly: false });
      response.redirect(302, new URL(result.returnTo, authFrontend(auth)).toString());
    } catch { response.redirect(`${authFrontend(auth)}/login?error=google_login_failed`); }
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
function authFrontend(auth: AuthService): string { return auth.frontendOrigin; }
