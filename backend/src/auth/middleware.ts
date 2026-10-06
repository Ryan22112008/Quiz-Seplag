import { timingSafeEqual } from 'node:crypto';
import type { RequestHandler } from 'express';
import type { AuthService, PublicUser } from './authService.js';
export const SESSION_COOKIE = 'quiz_session';
export const CSRF_COOKIE = 'quiz_csrf';
export function readSessionCookie(header?: string): string | undefined {
  const pair = header?.split(';').map((item) => item.trim()).find((item) => item.startsWith(`${SESSION_COOKIE}=`));
  if (!pair) return undefined;
  try { return decodeURIComponent(pair.slice(SESSION_COOKIE.length + 1)); } catch { return undefined; }
}
declare global { namespace Express { interface Request { auth?: { user: PublicUser; csrfToken: string; sessionId: string } } } }
function cookie(request: import('express').Request, name: string): string | undefined {
  const pair = request.headers.cookie?.split(';').map((item) => item.trim()).find((item) => item.startsWith(`${name}=`));
  if (!pair) return undefined;
  try { return decodeURIComponent(pair.slice(name.length + 1)); } catch { return undefined; }
}
export function createOptionalAuth(auth: AuthService): RequestHandler {
  return async (request, _response, next) => { try { const session = await auth.getSession(cookie(request, SESSION_COOKIE)); if (session) request.auth = session; else delete request.auth; next(); } catch (error) { next(error); } };
}
export const requireAuth: RequestHandler = (request, response, next) => {
  if (!request.auth) { response.status(401).json({ error: { code: 'UNAUTHENTICATED', message: 'Entre com sua conta para continuar.' } }); return; }
  next();
};
export function requireCsrf(allowedOrigins: readonly string[]): RequestHandler {
  return (request, response, next) => {
    if (!request.auth) { next(); return; }
    const origin = request.get('origin');
    const header = request.get('x-csrf-token');
    const cookieToken = cookie(request, CSRF_COOKIE);
    const equal = (a?: string, b?: string) => !!a && !!b && a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));
    if (!origin || !allowedOrigins.includes(origin) || !equal(header, request.auth.csrfToken) || !equal(cookieToken, request.auth.csrfToken)) {
      response.status(403).json({ error: { code: 'CSRF_REJECTED', message: 'Não foi possível validar a solicitação.' } }); return;
    }
    next();
  };
}
