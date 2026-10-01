import type { AppConfig } from '../types/environment.js';

function readPort(value: string | undefined): number {
  if (value === undefined || value.trim() === '') return 3000;

  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT deve ser um número inteiro entre 1 e 65535.');
  }

  return port;
}

function readFrontendOrigins(value: string | undefined): string[] {
  const origins = (value ?? 'http://localhost:5173,http://127.0.0.1:5173')
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

  return origins;
}

export function loadConfig(environment: NodeJS.ProcessEnv = process.env): AppConfig {
  return {
    port: readPort(environment.PORT),
    frontendOrigins: readFrontendOrigins(environment.FRONTEND_ORIGINS),
  };
}
