import cors from 'cors';
import express, { type ErrorRequestHandler } from 'express';
import { loadConfig } from './config/env.js';
import { DomainError } from './domain/errors.js';
import { routes } from './routes/index.js';
import { createUploadRoutes } from './routes/uploadRoutes.js';
import { authService } from './routes/index.js';
import { createOptionalAuth, requireAuth, requireCsrf } from './auth/middleware.js';

const config = loadConfig();
export const app = express();

app.disable('x-powered-by');
app.use(cors({
  credentials: true,
  origin(origin, callback) {
    if (!origin || config.frontendOrigins.includes(origin)) {
      callback(null, true);
      return;
    }
    callback(null, false);
  },
}));
app.use(express.json({ limit: '1mb' }));
app.use(createOptionalAuth(authService));
app.use(requireCsrf(config.frontendOrigins));
app.use(createUploadRoutes(requireAuth));
app.use(routes);

app.use((_request, response) => {
  response.status(404).json({
    error: { code: 'NOT_FOUND', message: 'Rota não encontrada.' },
  });
});

const errorHandler: ErrorRequestHandler = (error: unknown, _request, response, _next) => {
  if (error instanceof DomainError) {
    response.status(error.statusCode).json({
      error: { code: error.code, message: error.message },
    });
    return;
  }

  const status = typeof error === 'object' && error !== null && 'status' in error
    ? error.status
    : undefined;

  if (status === 400) {
    response.status(400).json({
      error: { code: 'INVALID_JSON', message: 'O corpo da requisição contém JSON inválido.' },
    });
    return;
  }

  console.error('Falha interna ao processar requisição.', error instanceof Error ? error.name : 'UnknownError');
  response.status(500).json({
    error: { code: 'INTERNAL_ERROR', message: 'Ocorreu um erro interno.' },
  });
};

app.use(errorHandler);
