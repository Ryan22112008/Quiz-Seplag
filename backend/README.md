# Quiz SEPLAG backend

API em Node.js, TypeScript e Express 5. O PostgreSQL é a fonte persistente para quizzes, perguntas, alternativas, salas e jogadores. O frontend continua sem integração com esta API nesta etapa.

## Requisitos

- Node.js 18 ou superior e npm
- PostgreSQL 14 ou superior, local ou acessível pela rede

Crie o banco vazio, por exemplo com `CREATE DATABASE quiz_seplag;`, e copie a configuração:

```powershell
cd backend
Copy-Item .env.example .env
```

Edite `backend/.env` e configure `DATABASE_URL` com as credenciais do seu PostgreSQL. O exemplo usa apenas placeholders:

```env
DATABASE_URL="postgresql://USER:PASSWORD@localhost:5432/quiz_seplag?schema=public"
```

Não versione `.env` nem credenciais. O Prisma Client lê `DATABASE_URL` e o backend só começa a escutar depois de conectar ao banco.

## Instalação, migration e execução

```powershell
npm install
npm run prisma:generate
npm run db:migrate
npm run dev
```

Neste ambiente, o proxy de rede apresenta uma CA confiável pelo Windows que não estava na CA padrão do Node. Se a geração do Prisma falhar por certificado em uma máquina com uma CA confiável instalada no repositório do sistema, use o repositório de certificados do sistema apenas na sessão do PowerShell:

```powershell
$env:NODE_OPTIONS = '--use-system-ca'
npm run prisma:generate
npm run db:migrate
Remove-Item Env:NODE_OPTIONS
```

Isso mantém a verificação TLS ativa; não use `NODE_TLS_REJECT_UNAUTHORIZED=0`. O ajuste não fica salvo no projeto nem altera a configuração global do npm.

`db:migrate` executa `prisma migrate dev` e aplica as migrations versionadas. Para implantar migrations já existentes em um ambiente configurado, use `npm run db:deploy`. Não substitua migrations por `db push`.

Scripts disponíveis:

```text
npm run dev             servidor de desenvolvimento
npm run prisma:generate gera o Prisma Client
npm run db:migrate      aplica/cria migrations de desenvolvimento
npm run db:deploy       aplica migrations existentes
npm run typecheck       verifica os tipos TypeScript
npm run build           compila para dist/
npm test                testes unitários sem PostgreSQL
npm run test:persistence testes de repository, requer PostgreSQL
npm start               inicia o build de produção
```

## Modelagem

- `Quiz` tem título, descrição opcional, categoria e timestamps.
- `Question` pertence a um quiz e persiste o texto, ordem, tempo, pontos e o `correctOptionId` existente no domínio.
- `Option` pertence a uma pergunta e tem ID, texto e ordem. A opção correta continua identificada uma única vez pelo ID guardado em `Question.correctOptionId`; o schema não duplica a informação com uma flag `isCorrect`.
- `Room` tem ID próprio, PIN único de seis dígitos, estado, timestamps e relação obrigatória com `Quiz`.
- `RoomPlayer` pertence a uma sala, guarda ID, nome e posição. Uma chave normalizada garante no banco que nomes não se repitam na mesma sala, sem diferenciar maiúsculas/minúsculas.

Apagar perguntas remove suas alternativas (`Cascade`). Apagar um quiz remove perguntas e alternativas, mas é bloqueado enquanto salas o referenciam (`Restrict`). Apagar uma sala remove seus jogadores (`Cascade`). IDs e PINs continuam gerados pelo backend. A alternativa correta permanece nas rotas de gestão de quiz já existentes; respostas públicas de sala/jogador não fazem join nem retornam `correctOptionId`.

O schema fica em `prisma/schema.prisma`, a migration inicial em `prisma/migrations/` e o cliente centralizado em `src/lib/prisma.ts`. Em produção, `routes/index.ts` injeta `PrismaQuizRepository` e `PrismaRoomRepository`; os doubles em memória são usados pelos testes unitários isolados. Os services não acessam o Prisma diretamente.

## Testes de persistência

Os testes unitários exercitam validação e regras de negócio sem PostgreSQL. Para testar os repositories, configure `DATABASE_URL`, aplique migrations e rode no PowerShell:

```powershell
$env:RUN_DATABASE_TESTS = 'true'
npm run test:persistence
Remove-Item Env:RUN_DATABASE_TESTS
```

O teste de persistência cria quiz, pergunta, opções, sala e jogador; desconecta e reconecta ao banco; depois consulta os mesmos registros e verifica suas relações. Isso valida a durabilidade do PostgreSQL no mesmo processo. Para comprovar o ciclo completo do servidor, crie um quiz e uma sala pela API, pare e reinicie `npm run dev`, e consulte o quiz por `GET /quizzes/:id` e a sala por `GET /rooms/:pin` usando os valores recebidos na criação. Este ciclo completo não pôde ser executado neste ambiente sem um servidor PostgreSQL configurado.

## Endpoints HTTP

```text
GET    /health
POST   /quizzes
GET    /quizzes
GET    /quizzes/:id
POST   /rooms
GET    /rooms/:pin
POST   /rooms/:pin/players
DELETE /rooms/:pin/players/:playerId
```

Os contratos e erros HTTP da etapa anterior foram mantidos. `POST /rooms` consulta o quiz persistido e responde `404 QUIZ_NOT_FOUND` quando não existe. Nomes de jogador são validados no service e também protegidos por índice único no PostgreSQL; colisões concorrentes viram `409 PLAYER_ALREADY_EXISTS`. Erros de acesso ao banco são retornados como indisponibilidade de armazenamento.

## Limites desta etapa

Não há autenticação, gestão de partidas, pontuação, ranking, WebSocket nem integração do frontend. A capacidade depende da infraestrutura, configuração e testes de carga; não há alegação de participantes ilimitados.
