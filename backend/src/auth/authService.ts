import { createHash, createHmac, randomBytes } from 'node:crypto';
import type { PrismaClient } from '@prisma/client';
import { CodeChallengeMethod, OAuth2Client } from 'google-auth-library';

const digest = (value: string) => createHash('sha256').update(value).digest('hex');
const randomToken = () => randomBytes(32).toString('base64url');
export interface PublicUser { id: string; name: string; email: string; avatarUrl: string | null }
export interface GoogleAuthConfig { clientId: string; clientSecret: string; callbackUrl: string; frontendOrigin: string; secureCookies: boolean; sessionSecret: string }
export type GoogleIdentityClient = Pick<OAuth2Client, 'generateCodeVerifierAsync' | 'generateAuthUrl' | 'getToken' | 'verifyIdToken'>;

export class AuthService {
  private readonly google: GoogleIdentityClient;
  constructor(private readonly db: PrismaClient, private readonly config: GoogleAuthConfig, private readonly now = () => new Date(), google?: GoogleIdentityClient) {
    this.google = google ?? new OAuth2Client(config.clientId, config.clientSecret, config.callbackUrl);
  }

  async createAuthorizationUrl(returnTo = '/'): Promise<{ url: string; state: string }> {
    if (!this.config.clientId || !this.config.clientSecret || !this.config.callbackUrl) throw new Error('GOOGLE_OAUTH_NOT_CONFIGURED');
    let safeReturnTo = '/';
    try {
      const parsedReturnTo = new URL(returnTo, this.config.frontendOrigin);
      if (returnTo.startsWith('/') && !returnTo.startsWith('//') && parsedReturnTo.origin === this.config.frontendOrigin) safeReturnTo = returnTo.slice(0, 500);
    } catch { /* malformed return destinations fall back to the app home */ }
    const state = randomToken();
    const nonce = randomToken();
    const { codeVerifier, codeChallenge } = await this.google.generateCodeVerifierAsync();
    if (!codeChallenge) throw new Error('PKCE_UNAVAILABLE');
    const expiresAt = new Date(this.now().getTime() + 10 * 60_000);
    await this.db.oAuthState.deleteMany({ where: { expiresAt: { lt: this.now() } } });
    await this.db.authSession.deleteMany({ where: { expiresAt: { lt: this.now() } } });
    await this.db.oAuthState.create({ data: { id: digest(state), nonce, codeVerifier, returnTo: safeReturnTo, expiresAt } });
    return { url: this.google.generateAuthUrl({ access_type: 'online', scope: ['openid', 'email', 'profile'], state, nonce, code_challenge: codeChallenge, code_challenge_method: CodeChallengeMethod.S256 }), state };
  }

  async finishGoogleLogin(code: string, state: string): Promise<{ user: PublicUser; sessionToken: string; csrfToken: string; returnTo: string }> {
    const stateId = digest(state);
    const attempt = await this.db.oAuthState.findUnique({ where: { id: stateId } });
    if (!attempt || attempt.expiresAt <= this.now()) throw new Error('INVALID_OAUTH_STATE');
    await this.db.oAuthState.delete({ where: { id: stateId } });
    const { tokens } = await this.google.getToken({ code, codeVerifier: attempt.codeVerifier, redirect_uri: this.config.callbackUrl });
    if (!tokens.id_token) throw new Error('MISSING_ID_TOKEN');
    const ticket = await this.google.verifyIdToken({ idToken: tokens.id_token, audience: this.config.clientId });
    const claims = ticket.getPayload();
    if (!claims || claims.iss !== 'https://accounts.google.com' && claims.iss !== 'accounts.google.com' || claims.aud !== this.config.clientId || claims.exp * 1000 <= this.now().getTime() || claims.nonce !== attempt.nonce || claims.email_verified !== true || !claims.sub || !claims.email || !claims.name) throw new Error('INVALID_GOOGLE_IDENTITY');
    const user = await this.db.user.upsert({
      where: { googleId: claims.sub },
      create: { googleId: claims.sub, email: claims.email, name: claims.name, avatarUrl: claims.picture ?? null },
      update: { email: claims.email, name: claims.name, avatarUrl: claims.picture ?? null },
      select: { id: true, name: true, email: true, avatarUrl: true },
    });
    const sessionToken = randomToken();
    const csrfToken = randomToken();
    await this.db.authSession.create({ data: { id: this.sessionDigest(sessionToken), userId: user.id, csrfToken, expiresAt: new Date(this.now().getTime() + 30 * 24 * 60 * 60_000) } });
    return { user, sessionToken, csrfToken, returnTo: attempt.returnTo };
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
  get frontendOrigin(): string { return this.config.frontendOrigin; }
  private sessionDigest(token: string): string { return createHmac('sha256', this.config.sessionSecret).update(token).digest('hex'); }
  cookieOptions() { return { httpOnly: true, secure: this.config.secureCookies, sameSite: this.config.secureCookies ? 'none' as const : 'lax' as const, path: '/', maxAge: 30 * 24 * 60 * 60_000 }; }
  clearCookieOptions() { return { httpOnly: true, secure: this.config.secureCookies, sameSite: this.config.secureCookies ? 'none' as const : 'lax' as const, path: '/' }; }
}
