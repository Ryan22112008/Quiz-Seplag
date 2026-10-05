import 'dotenv/config';
import { createServer } from 'node:http';
import { app } from '../app.js';
import { loadConfig } from '../config/env.js';
import { prisma } from '../lib/prisma.js';
import { authService, gameService, quizService, roomService } from '../routes/index.js';
import { readSessionCookie } from '../auth/middleware.js';
import { RealtimeHub } from '../realtime/realtimeHub.js';

const { port, frontendOrigins, nodeEnv } = loadConfig();
async function start(): Promise<void> {
  await prisma.$connect();
  console.info(`Conexão com o banco estabelecida (${nodeEnv}).`);
  const server = createServer(app);
  const realtimeHub = new RealtimeHub({ roomService, gameService, quizService }, { authenticateRequest: async (request) => (await authService.getSession(readSessionCookie(request.headers.cookie)))?.user.id });
  realtimeHub.attach(server, '/realtime', frontendOrigins);
  server.listen(port, '0.0.0.0', () => {
    console.info(`Quiz SEPLAG backend ativo na porta ${port}.`);
  });
  server.on('error', (error: NodeJS.ErrnoException) => {
    console.error('Não foi possível iniciar o servidor.', error.code ?? 'ERRO_DE_SERVIDOR');
    process.exitCode = 1;
  });

  let stopping = false;
  const shutdown = async () => {
    if (stopping) return;
    stopping = true;
    console.info('Encerramento solicitado; fechando HTTP, WebSocket e banco.');
    const httpClosed = new Promise<void>((resolve) => server.close((error) => {
      if (error) {
        console.error('Erro ao encerrar o servidor HTTP.', 'code' in error ? error.code : 'ERRO_DE_SERVIDOR');
        process.exitCode = 1;
      }
      resolve();
    }));
    try {
      await realtimeHub.close();
      await httpClosed;
      await prisma.$disconnect();
      console.info('Backend encerrado com sucesso.');
    } catch {
      console.error('O encerramento do backend encontrou uma falha.');
      process.exitCode = 1;
      await prisma.$disconnect().catch(() => undefined);
    }
  };
  for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    process.once(signal, () => { void shutdown(); });
  }
}

void start().catch(async () => {
  // Prisma connection errors may embed DATABASE_URL; never log their raw message.
  console.error('Não foi possível conectar ao banco e iniciar o servidor.');
  await prisma.$disconnect();
  process.exitCode = 1;
});
