import type { AppConfig } from '../types/environment.js';

function isLoopbackHostname(hostname: string): boolean {
  const normalized = hostname.toLowerCase().replace(/^\[|\]$/gu, '');
  return normalized === 'localhost' || normalized.endsWith('.localhost') || normalized === '::1' || normalized.startsWith('127.');
}

function readPort(value: string | undefined): number {
  if (value === undefined || value.trim() === '') return 3000;

  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT deve ser um número inteiro entre 1 e 65535.');
  }

  return port;
}

function readFrontendOrigins(value: string | undefined, nodeEnv: string): string[] {
  const origins = (value ?? (nodeEnv === 'production' ? '' : 'http://localhost:5173,http://127.0.0.1:5173'))
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  for (const origin of origins) {
    try {
      const parsedOrigin = new URL(origin);
      if (parsedOrigin.origin !== origin) throw new Error();
    } catch {
      throw new Error(`Origem inválida em FRONTEND_ORIGINS: ${origin}`);
    }
  }

  if (nodeEnv === 'production') {
    if (origins.length === 0) throw new Error('FRONTEND_ORIGINS é obrigatório em produção.');
    if (origins.some((origin) => {
      const parsed = new URL(origin);
      return parsed.protocol !== 'https:' || isLoopbackHostname(parsed.hostname);
    })) throw new Error('FRONTEND_ORIGINS deve conter apenas origens HTTPS públicas em produção.');
  }

  return origins;
}

export function loadConfig(environment: NodeJS.ProcessEnv = process.env): AppConfig {
  const nodeEnv = environment.NODE_ENV ?? 'development';
  if (!['development', 'production', 'test'].includes(nodeEnv)) {
    throw new Error('NODE_ENV deve ser development, production ou test.');
  }
  if (nodeEnv === 'production') {
    if (!environment.DATABASE_URL) throw new Error('DATABASE_URL é obrigatório em produção.');
    let databaseUrl: URL;
    try { databaseUrl = new URL(environment.DATABASE_URL); }
    catch { throw new Error('DATABASE_URL deve ser uma URL válida para MySQL.'); }
    if (databaseUrl.protocol !== 'mysql:') throw new Error('DATABASE_URL deve usar o provider MySQL definido no schema Prisma.');
  }
  const frontendOrigins = readFrontendOrigins(environment.FRONTEND_ORIGINS, nodeEnv);
  const frontendUrl = environment.FRONTEND_URL?.trim() || frontendOrigins[0] || 'http://localhost:5173';
  try { if (new URL(frontendUrl).origin !== frontendUrl) throw new Error(); }
  catch { throw new Error('FRONTEND_URL deve ser uma origem válida, sem caminho.'); }
  if (nodeEnv === 'production' && !frontendOrigins.includes(frontendUrl)) throw new Error('FRONTEND_URL deve estar incluída em FRONTEND_ORIGINS.');
  const googleCallbackUrl = environment.GOOGLE_CALLBACK_URL?.trim() || (nodeEnv === 'production' ? '' : 'http://localhost:3000/auth/google/callback');
  if (environment.GOOGLE_CALLBACK_URL?.trim()) {
    const callback = new URL(googleCallbackUrl);
    if (nodeEnv === 'production' && callback.protocol !== 'https:') throw new Error('GOOGLE_CALLBACK_URL deve usar HTTPS em produção.');
  }
  return {
    nodeEnv: nodeEnv as AppConfig['nodeEnv'],
    port: readPort(environment.PORT),
    frontendOrigins,
    frontendUrl,
    googleClientId: environment.GOOGLE_CLIENT_ID?.trim() ?? '',
    googleClientSecret: environment.GOOGLE_CLIENT_SECRET?.trim() ?? '',
    googleCallbackUrl,
    secureCookies: nodeEnv === 'production',
    sessionSecret: environment.SESSION_SECRET?.trim() || environment.DATABASE_URL || 'development-only-session-secret-change-me',
  };
}
