import 'dotenv/config';
import { app } from '../app.js';
import { loadConfig } from '../config/env.js';
import { prisma } from '../lib/prisma.js';

const { port } = loadConfig();
async function start(): Promise<void> {
  await prisma.$connect();
  const server = app.listen(port, '0.0.0.0', () => {
    console.info(`Quiz SEPLAG backend ativo na porta ${port}.`);
  });
  server.on('error', (error: NodeJS.ErrnoException) => {
    console.error('Não foi possível iniciar o servidor.', error.message);
    process.exitCode = 1;
  });

  for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    process.on(signal, () => {
      server.close((error) => {
        if (error) {
          console.error('Erro ao encerrar o servidor.', error.message);
          process.exitCode = 1;
        }
        void prisma.$disconnect();
      });
    });
  }
}

void start().catch(async (error: unknown) => {
  console.error('Não foi possível conectar ao PostgreSQL e iniciar o servidor.', error instanceof Error ? error.message : 'Erro desconhecido.');
  await prisma.$disconnect();
  process.exitCode = 1;
});
