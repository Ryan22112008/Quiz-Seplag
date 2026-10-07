import { createHmac, randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import type { PrismaClient } from '@prisma/client';
import { CodeChallengeMethod, OAuth2Client } from 'google-auth-library';
import { DomainError } from '../domain/errors.js';

const digest = (value: string, secret: string) => createHmac('sha256', secret).update(value).digest('hex');
const randomToken = () => randomBytes(32).toString('base64url');
const PASSWORD_COST = 1 << 14;
const PASSWORD_KEY_LENGTH = 64;

export interface PublicUser { id: string; name: string; email: string; avatarUrl: string | null }
export interface AuthConfig { clientId: string; clientSecret: string; callbackUrl: string; frontendOrigin: string; allowedOrigins: string[]; secureCookies: boolean; sessionSecret: string }
export type GoogleIdentityClient = Pick<OAuth2Client, 'generateCodeVerifierAsync' | 'generateAuthUrl' | 'getToken' | 'verifyIdToken'>;

function derivePassword(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => scryptCallback(password, salt, PASSWORD_KEY_LENGTH, { N: PASSWORD_COST, r: 8, p: 1 }, (error, key) => error ? reject(error) : resolve(key)));
}
async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  return `scrypt$${salt.toString('base64url')}$${(await derivePassword(password, salt)).toString('base64url')}`;
}
async function passwordMatches(password: string, encoded: string): Promise<boolean> {
  const [scheme, saltText, keyText] = encoded.split('$');
  if (scheme !== 'scrypt' || !saltText || !keyText) return false;
  const salt = Buffer.from(saltText, 'base64url');
  const expected = Buffer.from(keyText, 'base64url');
  if (salt.length !== 16 || expected.length !== PASSWORD_KEY_LENGTH) return false;
  return timingSafeEqual(await derivePassword(password, salt), expected);
}
function validEmail(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length <= 191 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(value.trim());
}
function validPassword(value: unknown): value is string {
  return typeof value === 'string' && value.length >= 10 && value.length <= 128 && !/[\u0000-\u001f\u007f]/u.test(value);
}
function displayNameFromEmail(email: string): string { return (email.split('@')[0] ?? 'Usuário').replace(/[._+-]+/gu, ' ').trim().slice(0, 191) || 'Usuário'; }

export class AuthService {
  private readonly google: GoogleIdentityClient;
  constructor(private readonly db: PrismaClient, private readonly config: AuthConfig, private readonly now = () => new Date(), google?: GoogleIdentityClient) {
    this.google = google ?? new OAuth2Client(config.clientId, config.clientSecret, config.callbackUrl);
  }

  get googleEnabled(): boolean { return !!(this.config.clientId && this.config.clientSecret && this.config.callbackUrl); }
  get frontendOrigin(): string { return this.config.frontendOrigin; }
  isAllowedOrigin(origin?: string): boolean { return !!origin && this.config.allowedOrigins.includes(origin); }

  async register(emailInput: unknown, passwordInput: unknown): Promise<{ user: PublicUser; sessionToken: string; csrfToken: string }> {
    if (!validEmail(emailInput) || !validPassword(passwordInput)) throw new DomainError('INVALID_CREDENTIALS', 400, 'Informe um e-mail válido e uma senha de 10 a 128 caracteres.');
    const email = emailInput.trim().toLowerCase();
    const passwordHash = await hashPassword(passwordInput);
    try {
      const user = await this.db.user.create({ data: { email, name: displayNameFromEmail(email), passwordHash }, select: { id: true, name: true, email: true, avatarUrl: true } });
      return { user, ...await this.createSession(user.id) };
    } catch (error) {
      if (isUniqueConflict(error)) throw new DomainError('EMAIL_ALREADY_REGISTERED', 409, 'Este e-mail já está cadastrado. Entre ou use outro endereço.');
      throw error;
    }
  }

  async login(emailInput: unknown, passwordInput: unknown): Promise<{ user: PublicUser; sessionToken: string; csrfToken: string }> {
    if (!validEmail(emailInput) || !validPassword(passwordInput)) throw new DomainError('INVALID_CREDENTIALS', 401, 'E-mail ou senha inválidos.');
    const email = emailInput.trim().toLowerCase();
    const user = await this.db.user.findUnique({ where: { email }, select: { id: true, name: true, email: true, avatarUrl: true, passwordHash: true } });
    if (!user?.passwordHash) {
      await derivePassword(passwordInput, Buffer.alloc(16));
      throw new DomainError('INVALID_CREDENTIALS', 401, 'E-mail ou senha inválidos.');
    }
    if (!await passwordMatches(passwordInput, user.passwordHash)) throw new DomainError('INVALID_CREDENTIALS', 401, 'E-mail ou senha inválidos.');
    const { passwordHash: _passwordHash, ...publicUser } = user;
    return { user: publicUser, ...await this.createSession(user.id) };
  }

  async createAuthorizationUrl(returnTo = '/'): Promise<{ url: string; state: string }> {
    if (!this.googleEnabled) throw new DomainError('GOOGLE_OAUTH_NOT_CONFIGURED', 503, 'O login do Google ainda não foi configurado neste servidor.');
    let safeReturnTo = '/';
    try { const parsed = new URL(returnTo, this.config.frontendOrigin); if (returnTo.startsWith('/') && !returnTo.startsWith('//') && parsed.origin === this.config.frontendOrigin) safeReturnTo = returnTo.slice(0, 500); } catch { /* Use the home page for invalid return destinations. */ }
    const state = randomToken();
    const nonce = randomToken();
    const { codeVerifier, codeChallenge } = await this.google.generateCodeVerifierAsync();
    if (!codeChallenge) throw new Error('PKCE_UNAVAILABLE');
    const expiresAt = new Date(this.now().getTime() + 10 * 60_000);
    await this.db.oAuthState.deleteMany({ where: { expiresAt: { lt: this.now() } } });
    await this.db.oAuthState.create({ data: { id: digest(state, this.config.sessionSecret), nonce, codeVerifier, returnTo: safeReturnTo, expiresAt } });
    return { url: this.google.generateAuthUrl({ access_type: 'online', scope: ['openid', 'email', 'profile'], state, nonce, code_challenge: codeChallenge, code_challenge_method: CodeChallengeMethod.S256 }), state };
  }

  async finishGoogleLogin(code: string, state: string): Promise<{ user: PublicUser; sessionToken: string; csrfToken: string; returnTo: string }> {
    const stateId = digest(state, this.config.sessionSecret);
    const attempt = await this.db.oAuthState.findUnique({ where: { id: stateId } });
    if (!attempt || attempt.expiresAt <= this.now()) throw new Error('INVALID_OAUTH_STATE');
    await this.db.oAuthState.delete({ where: { id: stateId } });
    const { tokens } = await this.google.getToken({ code, codeVerifier: attempt.codeVerifier, redirect_uri: this.config.callbackUrl });
    if (!tokens.id_token) throw new Error('MISSING_ID_TOKEN');
    const ticket = await this.google.verifyIdToken({ idToken: tokens.id_token, audience: this.config.clientId });
    const claims = ticket.getPayload();
    if (!claims || (claims.iss !== 'https://accounts.google.com' && claims.iss !== 'accounts.google.com') || claims.aud !== this.config.clientId || claims.exp * 1000 <= this.now().getTime() || claims.nonce !== attempt.nonce || claims.email_verified !== true || !claims.sub || !validEmail(claims.email)) throw new Error('INVALID_GOOGLE_IDENTITY');

    let user = await this.db.user.findUnique({ where: { googleId: claims.sub }, select: { id: true, name: true, email: true, avatarUrl: true } });
    if (!user) {
      const sameEmail = await this.db.user.findUnique({ where: { email: claims.email.toLowerCase() }, select: { id: true, googleId: true } });
      if (sameEmail?.googleId && sameEmail.googleId !== claims.sub) throw new Error('GOOGLE_ACCOUNT_CONFLICT');
      try {
        user = sameEmail
          ? await this.db.user.update({ where: { id: sameEmail.id }, data: { googleId: claims.sub, emailVerifiedAt: this.now(), ...(claims.name ? { name: claims.name } : {}), avatarUrl: claims.picture ?? null }, select: { id: true, name: true, email: true, avatarUrl: true } })
          : await this.db.user.create({ data: { googleId: claims.sub, email: claims.email.toLowerCase(), name: claims.name ?? displayNameFromEmail(claims.email), avatarUrl: claims.picture ?? null, emailVerifiedAt: this.now() }, select: { id: true, name: true, email: true, avatarUrl: true } });
      } catch (error) { if (isUniqueConflict(error)) throw new Error('GOOGLE_ACCOUNT_CONFLICT'); throw error; }
    }
    return { user, ...await this.createSession(user.id), returnTo: attempt.returnTo };
  }

  async getSession(token?: string): Promise<{ user: PublicUser; csrfToken: string; sessionId: string } | null> {
    if (!token) return null;
    const id = this.sessionDigest(token);
    const session = await this.db.authSession.findUnique({ where: { id }, include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } } });
    if (!session) return null;
    if (session.expiresAt <= this.now()) { await this.db.authSession.delete({ where: { id } }); return null; }
    return { user: session.user, csrfToken: session.csrfToken, sessionId: id };
  }

  async logout(sessionId: string): Promise<void> { await this.db.authSession.deleteMany({ where: { id: sessionId } }); }
  private async createSession(userId: string): Promise<{ sessionToken: string; csrfToken: string }> {
    const sessionToken = randomToken();
    const csrfToken = randomToken();
    await this.db.authSession.create({ data: { id: this.sessionDigest(sessionToken), userId, csrfToken, expiresAt: new Date(this.now().getTime() + 30 * 24 * 60 * 60_000) } });
    return { sessionToken, csrfToken };
  }
  private sessionDigest(token: string): string { return digest(token, this.config.sessionSecret); }
  cookieOptions() { return { httpOnly: true, secure: this.config.secureCookies, sameSite: this.config.secureCookies ? 'none' as const : 'lax' as const, path: '/', maxAge: 30 * 24 * 60 * 60_000 }; }
  clearCookieOptions() { return { httpOnly: true, secure: this.config.secureCookies, sameSite: this.config.secureCookies ? 'none' as const : 'lax' as const, path: '/' }; }
}

function isUniqueConflict(error: unknown): boolean { return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002'; }
