# Quiz SEPLAG backend

API em Node.js, TypeScript e Express 5. **MySQL** é o banco oficial atual, acessado pelo Prisma, para quizzes, perguntas, alternativas, salas e jogadores. Partidas, respostas, pontuação, tokens contextuais e conexões continuam em memória. O frontend usa API REST e WebSocket no mesmo servidor HTTP.

## Requisitos

- Node.js 18.18.0 ou superior e npm
- MySQL compatível com o provider Prisma, local ou acessível pela rede

Crie o banco vazio, por exemplo com `CREATE DATABASE quiz_seplag;`, e copie a configuração:

```powershell
cd backend
Copy-Item .env.example .env
```

Edite `backend/.env` e configure `DATABASE_URL` com as credenciais do MySQL. O exemplo usa apenas placeholders:

```env
DATABASE_URL="mysql://USER:PASSWORD@localhost:3306/quiz_seplag"
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
npm test                testes unitários sem banco
npm run test:persistence testes de repositories, requer MySQL
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

Os testes unitários exercitam validação e regras de negócio sem banco. Para testar os repositories, configure `DATABASE_URL`, aplique migrations e rode no PowerShell:

```powershell
$env:RUN_DATABASE_TESTS = 'true'
npm run test:persistence
Remove-Item Env:RUN_DATABASE_TESTS
```

O teste de persistência cria quiz, pergunta, opções, sala e jogador; desconecta e reconecta ao banco; depois consulta os mesmos registros e verifica suas relações. Isso valida a durabilidade no MySQL configurado. A execução de produção local e do fluxo completo via navegador ainda depende de TLS e origens públicas acessíveis.

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
POST   /rooms/:pin/start
GET    /rooms/:pin/game
POST   /rooms/:pin/game/finish
POST   /rooms/:pin/game/question/start
GET    /rooms/:pin/game/question
POST   /rooms/:pin/game/question/next
POST   /rooms/:pin/game/question/answer
GET    /rooms/:pin/game/ranking
```

Os contratos e erros HTTP da etapa anterior foram mantidos. `POST /rooms` consulta o quiz persistido e responde `404 QUIZ_NOT_FOUND` quando não existe. Nomes de jogador são validados no service e também protegidos por índice único no MySQL; colisões concorrentes viram `409 PLAYER_ALREADY_EXISTS`. Erros de acesso ao banco são retornados como indisponibilidade de armazenamento.

## Domínio da partida

Uma partida começa com status `IN_PROGRESS` (a sala percorre `WAITING → STARTING → IN_PROGRESS`) e pode terminar em `FINISHED`. O estado inicial registra `roomId`, `roomPin`, `quizId`, `currentQuestionIndex` igual a zero, total de perguntas e timestamps do servidor. A primeira pergunta só é ativada por `POST /rooms/:pin/game/question/start`. O service registra `questionStartedAt` e `questionEndsAt` como timestamps absolutos UTC, calculados uma vez com o `timeLimit` da própria pergunta. `GET /rooms/:pin/game/question` devolve a pergunta pública atual e suas opções sem a resposta correta. `POST /rooms/:pin/game/question/next` só avança quando o relógio do servidor alcança `questionEndsAt`; o índice e a transição são protegidos por compare-and-set no repository em memória. Ao expirar a última pergunta, a partida e a sala passam para `FINISHED` e `finishedAt` é preenchido. É necessário que a sala esteja aguardando ou em preparação e que o quiz tenha ao menos uma pergunta. O projeto ainda não define mínimo de jogadores, então esta regra não foi inventada.

O estado público contém referências, timestamps oficiais e somente a pergunta atual (texto e opções com ID/texto); não inclui `correctOptionId` nem dados internos como pontos. O repositório da partida fica em memória e se perde quando o backend reinicia; salas persistidas com estado `IN_PROGRESS` não serão recuperadas como partida até existir persistência de Game. O service não depende de timer agendado: expiração é determinada comparando o relógio atual com `questionEndsAt` absoluto.

## Respostas, pontuação e ranking

`POST /rooms/:pin/game/question/answer` exige exatamente `playerId`, `questionId` e `optionId`. IDs e associação à sala/pergunta/opção são validados pelo backend; tempo, correção e pontos nunca são aceitos do cliente. A resposta recebe `answeredAt` do relógio do servidor e é recusada quando `answeredAt >= questionEndsAt`. Um jogador só pode responder uma vez por pergunta. A gravação da resposta e a atualização do score são atômicas no repository em memória.

A fórmula desta etapa usa `points` da questão como máximo: resposta errada vale zero; resposta correta recebe `floor(points × tempo restante / duração total)`. Assim, responder no início pode valer o máximo e responder perto do limite vale menos, sem ultrapassar o máximo. O ranking inclui todos os participantes ainda vinculados à sala, inclusive quem não respondeu (score zero), ordenados por score decrescente, quantidade de acertos decrescente e, persistindo empate, nome em ordem alfabética pt-BR sem diferenciar caixa, seguido pelo ID. Essa ordenação produz posições distintas determinísticas. `GET /rooms/:pin/game/ranking` retorna somente posição, identidade pública/nome, score e acertos. Respostas e scores são voláteis e desaparecem quando o processo reinicia; sua persistência ficará para etapa posterior.

O `playerId` recebido é validado contra os participantes da sala, mas não prova que a requisição pertence àquele jogador. A autenticação foi removida temporariamente: a rota de listagem `/quizzes` não existe; `GET /quizzes/:id` devolve a configuração completa, incluindo a resposta correta, para permitir editar um quiz sem conta. Compartilhe o endereço de edição apenas com quem pode ver as respostas. A pergunta do jogo, o envio de resposta e o ranking não incluem `correctOptionId`.

## Limites desta etapa

Não há autenticação. Respostas, pontuação, ranking e estado de partida permanecem voláteis em memória e desaparecem quando o processo reinicia. A capacidade depende da infraestrutura, configuração e testes de carga; não há alegação de participantes ilimitados. A validação real de persistência segue pendente. O deployment suportado é um único processo/backend; múltiplas instâncias não compartilham estado realtime.

## Realtime e recuperação de sessão

O servidor também aceita conexões WebSocket no endpoint `/realtime`. O cliente usa o protocolo `SUBSCRIBE_GAME` já existente para se inscrever na sala e recebe `ROOM_SYNCED` com o estado atual autoritativo da sala, partida, ranking e confirmação de resposta para a questão atual. A sincronização é um snapshot atual, não a reprodução de eventos perdidos. O `RealtimeHub` coordena transporte e serviços; regras de sala, resposta e partida permanecem nos services.

O frontend conserva o nome, `playerId` e sala no armazenamento local e a capacidade de player no armazenamento da aba para sobreviver a reloads. Reabrir a sessão reutiliza o ID e a capacidade, sem cadastrar outro jogador. Quedas inesperadas usam reconexão com backoff; uma saída deliberada encerra a sessão e cancela novas tentativas. A interface permanece em sincronização até receber o snapshot, e não enfileira nem reenvia respostas automaticamente.

Os campos `questionStartedAt` e `questionEndsAt` enviados pelo servidor são timestamps absolutos. O timer visual calcula o tempo restante a partir de `questionEndsAt` e do relógio atual; uma reconexão não reinicia a duração nem avança a questão. Após o término, o snapshot mantém o ranking final. Salas fechadas, inexistentes ou jogadores removidos encerram a tentativa de reconexão e exigem o fluxo apropriado de entrada.

## Segurança contextual da Etapa 20

O backend trata todo payload como entrada não confiável. O `GameService` calcula correção, horário, pontuação e ranking; comandos realtime rejeitam campos desconhecidos, e o WebSocket limita cada mensagem a 64 KiB. Origens de navegador são conferidas contra `FRONTEND_ORIGINS` tanto no CORS HTTP quanto no handshake WebSocket. Leituras públicas de quiz omitem `correctOptionId`; o endpoint contextual `GET /rooms/:pin/quiz` só revela a chave ao apresentar o `X-Host-Token` da sala.

Ao criar uma sala, o servidor emite um `hostToken` aleatório; ao entrar, emite um `playerToken` aleatório. `SUBSCRIBE_GAME` exige a capacidade do papel solicitado e associa o papel/ID ao socket. O frontend guarda essas capacidades apenas no `sessionStorage` para suportar reload na mesma aba. A credencial não é enviada nas projeções públicas nem em eventos de broadcast. Ações mutáveis de sala e partida ficam no WebSocket: os endpoints REST antigos sem contexto de host/player retornam `405 REALTIME_REQUIRED`.

Esses tokens são capacidades bearer contextuais à sala, não autenticação de usuário. Não há contas, revogação distribuída, proteção contra roubo por XSS, limitação de taxa ou prevenção de criação/entrada abusiva. As capacidades e o estado de partida são mantidos em memória; reiniciar o backend encerra a validade delas e perde o estado volátil. Configure HTTPS/WSS em produção para proteger tokens em trânsito e restrinja `FRONTEND_ORIGINS` às origens reais.

## Produção e deploy

Não há uma plataforma de hospedagem definida pelo projeto. O backend usa Express e WebSocket persistente no mesmo servidor HTTP, escuta em `0.0.0.0`, e espera TLS encerrado por um proxy/load balancer HTTPS que encaminhe HTTP e upgrades WebSocket para a mesma instância. Configure o hosting para manter conexões WebSocket abertas e não encaminhar sessões de uma instância para outra. Não use uma plataforma que encerre sockets ou execute a API como função efêmera.

### Variáveis de ambiente do backend

Configure no ambiente do processo (não no bundle frontend):

| Variável | Obrigatória | Uso |
| --- | --- | --- |
| `NODE_ENV` | Sim em produção | `production`; local use `development`. |
| `PORT` | Não | Porta HTTP, padrão `3000`. |
| `DATABASE_URL` | Sim | URL `mysql://...` compatível com o provider atualmente definido em `prisma/schema.prisma`. |
| `FRONTEND_ORIGINS` | Sim em produção | Lista separada por vírgulas de origens HTTPS exatas, sem caminho, por exemplo `https://quiz.sua-organizacao.gov.br`. Não use `*` nem localhost. |

`FRONTEND_ORIGINS` protege CORS e o handshake WebSocket. O backend não serve TLS: configure certificado e HTTPS/WSS no proxy da hospedagem. O endpoint `GET /health` retorna somente `{ "status": "ok" }`; liveness não revela estado de banco. O processo só começa a escutar depois de estabelecer conexão com o banco.

### Build e inicialização

Use Node compatível com `engines.node` (`>=18.18.0`, requisito do Prisma 6; o workspace desta etapa foi exercitado com Node 24.19.0). O build gera o Prisma Client e compila o backend; inicialização não usa watcher:

```powershell
cd backend
npm ci
npm run build
npm run db:deploy
$env:NODE_ENV = 'production'
$env:PORT = '3000'
$env:DATABASE_URL = 'mysql://USER:PASSWORD@HOST:3306/quiz_seplag'
$env:FRONTEND_ORIGINS = 'https://quiz.sua-organizacao.gov.br'
npm start
```

Configure segredos no gerenciador de variáveis do ambiente, não no shell salvo nem em arquivos versionados. Em PowerShell, evite colocar a senha real no histórico. `npm run db:deploy` executa somente `prisma migrate deploy`, próprio de migrations versionadas; `npm run db:migrate` (`migrate dev`) é exclusivo do desenvolvimento. O build depende do Prisma CLI listado nas devDependencies, então execute-o num estágio de build com dependências de desenvolvimento instaladas e publique `dist`, cliente Prisma gerado e dependências de runtime.

`SIGTERM` e `SIGINT` iniciam encerramento: o processo para de aceitar conexões, fecha WebSockets/HTTP e desconecta Prisma, emitindo logs de início e conclusão. O estado de partida e os tokens em memória são perdidos no restart; somente quizzes, perguntas, opções, salas e jogadores mantidos no banco sobrevivem. Clientes precisam reentrar/recriar contexto de host, e não há recuperação de partida em andamento.

### Frontend estático, HTTPS e WSS

Configure `frontend/.env.production` (não versionado) antes de compilar, ou injete os valores públicos no ambiente do build:

```env
VITE_API_URL=https://api.sua-organizacao.gov.br
VITE_WS_URL=wss://api.sua-organizacao.gov.br/realtime
```

São URLs públicas, embutidas no bundle Vite. Nunca use `DATABASE_URL`, tokens administrativos ou credenciais privadas em `VITE_*`. Em build de produção, o código falha cedo se API/WS estiverem ausentes, locais ou sem HTTPS/WSS. Em desenvolvimento, as URLs padrão são localhost e WSS deriva automaticamente de `VITE_API_URL` caso `VITE_WS_URL` não seja definida.

```powershell
cd frontend
npm ci
npm run lint
npm run typecheck
npm run build
```

Publique `frontend/dist/` em hosting estático com fallback de rotas SPA para `/index.html`. Configure o frontend para HTTPS, API no domínio de backend e upgrade WSS; o host deve permitir tráfego de WebSocket e encaminhar `/realtime` ao mesmo processo da API.

### Estado da validação de persistência e deploy

O schema (`provider = "mysql"`) e a migration versionada usam MySQL. `DATABASE_URL` deve usar o formato `mysql://...`. A validação no banco local configurado passou: `prisma validate`, `prisma generate`, `prisma migrate status` (uma migration, schema atualizado), `prisma migrate deploy` (nenhuma pendente) e `test:persistence` (1 teste passou).

### Auditoria de dependências

Em 2026-10-04, `npm audit` e `npm audit --omit=dev` reportaram 4 vulnerabilidades altas: `prisma`/`@prisma/config` e suas dependências `deepmerge-ts` e `effect`. O audit sugere `prisma@6.12.0`, um downgrade, que não foi aplicado. `prisma@6.19.3` é a versão estável mais recente consultada na linha 6 e ainda está dentro da faixa afetada. `prisma@7.10.0` não é uma atualização compatível automática: além do salto de major, sua configuração continua usando `deepmerge-ts@7.1.5`, cuja advisory cobre versões anteriores à 8. O Prisma 8 encontrado no registry ainda é release candidate. Por esses motivos não alterei Prisma CLI nem Client; os quatro findings permanecem para reavaliação quando houver release estável corrigida e compatível.

## Plataforma alvo de deploy

A plataforma alvo escolhida é **Render** para o backend persistente (Web Service, uma instância) e para o frontend estático, com **Aiven for MySQL** como serviço de banco. Render documenta suporte a WebSocket persistente no Web Service e hosting estático com TLS gerenciado; Aiven documenta provisionamento e conexão a MySQL. Confira [WebSockets no Render](https://render.com/docs/websocket), [Static Sites do Render](https://render.com/docs/static-sites), [Web Services do Render](https://render.com/docs/web-services) e [Aiven for MySQL](https://aiven.io/docs/products/mysql/get-started).

O blueprint inicial está em [`render.yaml`](../render.yaml). Ele define o backend com uma instância e migration em pre-deploy, e o frontend estático com rewrite SPA. O Render exige plano pago para executar pre-deploy commands; o plano de backend deve ser always-on para disponibilidade contínua. A criação real no dashboard pedirá os valores marcados `sync: false`.

Configuração alvo no dashboard, após conectar o repositório:

| Serviço | Diretório | Build | Execução/publicação |
| --- | --- | --- | --- |
| Backend Render Web Service | `backend` | `npm ci && npm run build` | `npm start`; instâncias fixadas em 1; `/health` como health check. |
| Frontend Render Static Site | `frontend` | `npm ci && npm run lint && npm run typecheck && npm run build` | publicar `dist`; rewrite `/*` para `/index.html` com status 200. |
| Aiven MySQL | gerenciado no Aiven | aplicar migration versionada com `npm run db:deploy` no pre-deploy do serviço | fornecer `DATABASE_URL` como secret somente ao backend, com TLS verificado (Prisma: `sslaccept=strict`; `sslcert` quando o provedor solicitar CA). |

No backend, configurar `NODE_ENV=production`, `PORT` conforme a porta injetada pelo serviço, `DATABASE_URL` obtida do Aiven e `FRONTEND_ORIGINS` com a origem HTTPS gerada para o Static Site (ou domínio próprio depois de validado). No Static Site, preencher `VITE_API_URL` e `VITE_WS_URL` com as URLs HTTPS/WSS reais do Web Service. Essas duas variáveis são públicas e entram no bundle. Não configure mais de uma instância do backend: estado e tokens realtime não são compartilhados.

**Estado do provisionamento:** Render, Aiven, domínio e URLs ainda não foram provisionados neste workspace. Não existem credenciais de conta nem repositório conectado para autodeploy, e nenhum domínio próprio foi informado. Portanto, os nomes de host e valores de produção ainda não podem ser preenchidos ou testados; não execute o fluxo de navegador contra URLs de exemplo. Quando os serviços forem criados, aplicar migrations primeiro, configurar origins/URLs, e então validar HTTPS, WSS e o fluxo completo no navegador antes de chamar o deploy de pronto.
# Acesso atual

O produto está temporariamente sem contas, login, biblioteca e relatórios. A criação, edição, revisão e condução de quizzes continuam disponíveis sem sessão. A lista da biblioteca e suas rotas de busca foram removidas. O ranking e o pódio ao final da partida continuam disponíveis como parte do fluxo do jogo.

As migrations antigas e as tabelas de contas e ownership já aplicadas são mantidas para preservar o banco existente; a aplicação não oferece login nem usa essas tabelas no fluxo atual. Quizzes com salas registradas continuam protegidos contra exclusão para preservar o histórico da partida. `FRONTEND_ORIGINS` continua necessária para CORS e WebSocket.
