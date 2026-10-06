import { createHmac, randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import type { PrismaClient } from '@prisma/client';
import { DomainError } from '../domain/errors.js';

const randomToken = () => randomBytes(32).toString('base64url');
const PASSWORD_COST = 1 << 14;
const PASSWORD_KEY_LENGTH = 64;
export interface PublicUser { id: string; name: string; email: string; avatarUrl: string | null }
export interface EmailPasswordAuthConfig { secureCookies: boolean; sessionSecret: string; frontendOrigin: string; allowedOrigins: string[]; resendApiKey?: string; emailFrom?: string; exposeVerificationUrl: boolean }
export interface EmailVerificationSender { send(to: string, verificationUrl: string): Promise<void> }

function derivePassword(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => scryptCallback(password, salt, PASSWORD_KEY_LENGTH, { N: PASSWORD_COST, r: 8, p: 1 }, (error, key) => error ? reject(error) : resolve(key)));
}

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await derivePassword(password, salt);
  return `scrypt$${salt.toString('base64url')}$${key.toString('base64url')}`;
}

async function passwordMatches(password: string, encoded: string): Promise<boolean> {
  const [scheme, saltText, keyText] = encoded.split('$');
  if (scheme !== 'scrypt' || !saltText || !keyText) return false;
  const salt = Buffer.from(saltText, 'base64url');
  const expected = Buffer.from(keyText, 'base64url');
  if (salt.length !== 16 || expected.length !== PASSWORD_KEY_LENGTH) return false;
  const actual = await derivePassword(password, salt);
  return timingSafeEqual(actual, expected);
}

function normaliseEmail(email: unknown): string {
  if (typeof email !== 'string') throw new DomainError('INVALID_CREDENTIALS', 400, 'Informe um e-mail válido e uma senha de 10 a 128 caracteres.');
  const normalized = email.trim().toLowerCase();
  if (normalized.length > 191 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(normalized)) throw new DomainError('INVALID_CREDENTIALS', 400, 'Informe um e-mail válido e uma senha de 10 a 128 caracteres.');
  return normalized;
}

function validPassword(password: unknown): password is string {
  return typeof password === 'string' && password.length >= 10 && password.length <= 128 && !/[\u0000-\u001f\u007f]/u.test(password);
}

function displayNameFromEmail(email: string): string {
  const localPart = email.split('@')[0] ?? 'Usuário';
  const name = localPart.replace(/[._+-]+/gu, ' ').trim().slice(0, 191);
  return name || 'Usuário';
}

function isUniqueConflict(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002';
}

export class AuthService {
  constructor(private readonly db: PrismaClient, private readonly config: EmailPasswordAuthConfig, private readonly now = () => new Date(), private readonly emailSender?: EmailVerificationSender) {}

  async register(emailInput: unknown, passwordInput: unknown): Promise<{ email: string; verificationUrl?: string }> {
    const email = normaliseEmail(emailInput);
    if (!validPassword(passwordInput)) throw new DomainError('INVALID_CREDENTIALS', 400, 'A senha deve ter entre 10 e 128 caracteres.');
    const passwordHash = await hashPassword(passwordInput);
    const existing = await this.db.user.findUnique({ where: { email }, select: { id: true, passwordHash: true } });
    if (existing?.passwordHash) throw new DomainError('EMAIL_ALREADY_REGISTERED', 409, 'Este e-mail já possui uma conta.');
    if (existing) return { email, ...(await this.issueVerification(existing.id, email, passwordHash)) };
    let user: PublicUser;
    try {
      user = await this.db.user.create({ data: { email, name: displayNameFromEmail(email), passwordHash }, select: { id: true, name: true, email: true, avatarUrl: true } });
    } catch (error) {
      if (isUniqueConflict(error)) throw new DomainError('EMAIL_ALREADY_REGISTERED', 409, 'Este e-mail já possui uma conta.');
      throw error;
    }
    return { email, ...(await this.issueVerification(user.id, email)) };
  }

  async login(emailInput: unknown, passwordInput: unknown): Promise<{ user: PublicUser; sessionToken: string; csrfToken: string }> {
    const email = normaliseEmail(emailInput);
    if (!validPassword(passwordInput)) throw new DomainError('INVALID_CREDENTIALS', 401, 'E-mail ou senha inválidos.');
    const user = await this.db.user.findUnique({ where: { email }, select: { id: true, name: true, email: true, avatarUrl: true, passwordHash: true, emailVerifiedAt: true } });
    if (!user?.passwordHash) {
      await derivePassword(passwordInput, Buffer.alloc(16));
      throw new DomainError('INVALID_CREDENTIALS', 401, 'E-mail ou senha inválidos.');
    }
    if (!await passwordMatches(passwordInput, user.passwordHash)) throw new DomainError('INVALID_CREDENTIALS', 401, 'E-mail ou senha inválidos.');
    if (!user.emailVerifiedAt) throw new DomainError('EMAIL_NOT_VERIFIED', 403, 'Confirme seu e-mail antes de entrar.');
    const publicUser: PublicUser = { id: user.id, name: user.name, email: user.email, avatarUrl: user.avatarUrl };
    return { user: publicUser, ...await this.createSession(user.id) };
  }

  async verifyEmail(tokenInput: unknown): Promise<{ user: PublicUser; sessionToken: string; csrfToken: string }> {
    if (typeof tokenInput !== 'string' || !/^[A-Za-z0-9_-]{40,64}$/u.test(tokenInput)) throw new DomainError('INVALID_VERIFICATION_TOKEN', 400, 'O link de confirmação é inválido ou expirou.');
    const tokenId = createHmac('sha256', this.config.sessionSecret).update(tokenInput).digest('hex');
    const token = await this.db.emailVerificationToken.findUnique({ where: { id: tokenId }, include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } } });
    if (!token || token.expiresAt <= this.now()) throw new DomainError('INVALID_VERIFICATION_TOKEN', 400, 'O link de confirmação é inválido ou expirou.');
    const consumed = await this.db.emailVerificationToken.deleteMany({ where: { id: tokenId, expiresAt: { gt: this.now() } } });
    if (consumed.count !== 1) throw new DomainError('INVALID_VERIFICATION_TOKEN', 400, 'O link de confirmação é inválido ou expirou.');
    const user = await this.db.user.update({ where: { id: token.userId }, data: { emailVerifiedAt: this.now(), ...(token.pendingPasswordHash ? { passwordHash: token.pendingPasswordHash } : {}) }, select: { id: true, name: true, email: true, avatarUrl: true } });
    return { user, ...await this.createSession(user.id) };
  }

  async resendVerification(emailInput: unknown): Promise<{ verificationUrl?: string }> {
    if (typeof emailInput !== 'string') return {};
    const email = emailInput.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(email) || email.length > 191) return {};
    const user = await this.db.user.findUnique({ where: { email }, select: { id: true, emailVerifiedAt: true } });
    if (!user || user.emailVerifiedAt) return {};
    const pending = await this.db.emailVerificationToken.findFirst({ where: { userId: user.id }, orderBy: { createdAt: 'desc' }, select: { pendingPasswordHash: true } });
    return this.issueVerification(user.id, email, pending?.pendingPasswordHash ?? undefined);
  }

  private async issueVerification(userId: string, email: string, pendingPasswordHash?: string): Promise<{ verificationUrl?: string }> {
    const tokenValue = randomToken();
    const tokenId = createHmac('sha256', this.config.sessionSecret).update(tokenValue).digest('hex');
    await this.db.emailVerificationToken.deleteMany({ where: { userId } });
    await this.db.emailVerificationToken.create({ data: { id: tokenId, userId, ...(pendingPasswordHash ? { pendingPasswordHash } : {}), expiresAt: new Date(this.now().getTime() + 24 * 60 * 60_000) } });
    const verificationUrl = new URL(`/verificar-email?token=${encodeURIComponent(tokenValue)}`, this.config.frontendOrigin).toString();
    if (this.emailSender) await this.emailSender.send(email, verificationUrl);
    else if (this.config.resendApiKey && this.config.emailFrom) await this.sendWithResend(email, verificationUrl);
    else if (!this.config.exposeVerificationUrl) throw new DomainError('EMAIL_DELIVERY_FAILED', 503, 'O envio do e-mail de confirmação não está configurado.');
    return this.config.exposeVerificationUrl ? { verificationUrl } : {};
  }

  private async sendWithResend(to: string, verificationUrl: string): Promise<void> {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.config.resendApiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: this.config.emailFrom, to: [to], subject: 'Confirme seu e-mail — Quiz SEPLAG', html: `<p>Para confirmar seu endereço de e-mail, <a href="${verificationUrl}">clique neste link</a>.</p><p>O link expira em 24 horas.</p>` }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new DomainError('EMAIL_DELIVERY_FAILED', 503, 'Não foi possível enviar o e-mail de confirmação. Tente novamente.');
  }

  private async createSession(userId: string): Promise<{ sessionToken: string; csrfToken: string }> {
    const sessionToken = randomToken();
    const csrfToken = randomToken();
    await this.db.authSession.create({ data: { id: this.sessionDigest(sessionToken), userId, csrfToken, expiresAt: new Date(this.now().getTime() + 30 * 24 * 60 * 60_000) } });
    return { sessionToken, csrfToken };
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
  isAllowedOrigin(origin?: string): boolean { return !!origin && this.config.allowedOrigins.includes(origin); }
  private sessionDigest(token: string): string { return createHmac('sha256', this.config.sessionSecret).update(token).digest('hex'); }
  cookieOptions() { return { httpOnly: true, secure: this.config.secureCookies, sameSite: this.config.secureCookies ? 'none' as const : 'lax' as const, path: '/', maxAge: 30 * 24 * 60 * 60_000 }; }
  clearCookieOptions() { return { httpOnly: true, secure: this.config.secureCookies, sameSite: this.config.secureCookies ? 'none' as const : 'lax' as const, path: '/' }; }
}
