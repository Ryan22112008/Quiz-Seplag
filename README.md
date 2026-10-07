# Quiz SEPLAG

Plataforma para criar quizzes, conduzir partidas ao vivo e acompanhar seus resultados. O projeto reúne uma aplicação web em React e uma API em Node.js, com atualizações de partida em tempo real por WebSocket e persistência MySQL.

## Recursos

- Cadastro e login com e-mail e senha; login com Google pode ser habilitado por configuração.
- Criação e edição de quizzes, perguntas, alternativas e imagens.
- Salas de partida com PIN, link ou QR Code. Para participar, o jogador precisa entrar na conta e pode escolher o nome que será exibido no jogo.
- Partidas ao vivo, ranking durante o jogo e pódio final.
- Avatares com personagens selecionáveis.
- Biblioteca para organizar quizzes e relatórios de partidas com visão geral, participantes e perguntas.
- Recuperação de senha por código quando o envio de e-mail estiver configurado.

## Tecnologias

- **Frontend:** React 18, TypeScript, Vite, Tailwind CSS, React Router e Zustand.
- **Backend:** Node.js, TypeScript, Express 5 e WebSocket.
- **Banco de dados:** MySQL, acessado pelo Prisma ORM.

## Requisitos

- Node.js 18.18 ou superior e npm.
- MySQL local ou acessível pela rede.

## Executar localmente

O frontend e o backend são instalados e executados em terminais separados.

### 1. Configurar o backend

Crie um banco MySQL vazio, por exemplo `quiz_seplag`, e configure o arquivo de ambiente:

```powershell
cd backend
Copy-Item .env.example .env
```

Edite `backend/.env` e informe a conexão com o MySQL:

```env
DATABASE_URL="mysql://USUARIO:SENHA@localhost:3306/quiz_seplag"
```

Instale as dependências, gere o cliente Prisma, aplique as migrations e inicie a API:

```powershell
npm install
npm run prisma:generate
npm run db:migrate
npm run dev
```

A API local usa `http://localhost:3000` e o WebSocket `ws://localhost:3000/realtime` por padrão.

### 2. Configurar o frontend

Em outro terminal, na raiz do repositório:

```powershell
cd frontend
Copy-Item .env.example .env
npm install
npm run dev
```

Abra o endereço informado pelo Vite, normalmente `http://localhost:5173`.

## Variáveis de ambiente

### Backend (`backend/.env`)

| Variável | Uso |
| --- | --- |
| `DATABASE_URL` | Conexão MySQL usada pelo Prisma. |
| `PORT` | Porta HTTP e WebSocket; localmente, o padrão é `3000`. |
| `FRONTEND_ORIGINS` | Origens autorizadas, separadas por vírgula. Em produção, use as origens HTTPS reais. |
| `FRONTEND_URL` | Origem do frontend, usada nos fluxos de autenticação. |
| `SESSION_SECRET` | Segredo para assinatura das sessões; configure um valor aleatório forte em produção. |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Credenciais OAuth do Google; necessárias somente para habilitar esse login. |
| `GOOGLE_CALLBACK_URL` | URL de retorno OAuth cadastrada no Google. Em produção, deve usar HTTPS. |
| `RESEND_API_KEY`, `EMAIL_FROM` | Configuração opcional de envio de códigos para recuperação de senha. |
| `UPLOADS_DIR` | Diretório para arquivos enviados; o backend usa `uploads` por padrão. |

Os valores de exemplo estão em [`backend/.env.example`](backend/.env.example). Não publique arquivos `.env`, senhas, chaves OAuth ou tokens.

### Frontend (`frontend/.env`)

| Variável | Uso |
| --- | --- |
| `VITE_API_URL` | URL pública da API. Localmente, `http://localhost:3000`. |
| `VITE_WS_URL` | URL WebSocket da API. Localmente, `ws://localhost:3000/realtime`. |

As variáveis `VITE_*` são incluídas no bundle público; nunca coloque segredos nelas. Consulte [`frontend/.env.example`](frontend/.env.example).

## Comandos úteis

Execute cada comando a partir da pasta correspondente (`frontend` ou `backend`).

| Comando | Descrição |
| --- | --- |
| `npm run dev` | Inicia o servidor de desenvolvimento. |
| `npm run build` | Gera a versão de produção. |
| `npm run typecheck` | Verifica os tipos TypeScript. |
| `npm run lint` | Executa o ESLint — disponível no frontend. |
| `npm run prisma:generate` | Gera o Prisma Client — backend. |
| `npm run db:migrate` | Cria/aplica migrations de desenvolvimento — backend. |
| `npm run db:deploy` | Aplica migrations existentes no ambiente de deploy — backend. |
| `npm start` | Inicia a API compilada — backend. |

## Deploy

O repositório inclui [`render.yaml`](render.yaml) e [`Dockerfile`](Dockerfile) para configurar os serviços no Render. O blueprint descreve a API, o site estático e as variáveis necessárias; banco MySQL, URLs públicas e credenciais precisam ser configurados no provedor.

Antes de disponibilizar o serviço:

1. Configure `DATABASE_URL` com uma conexão MySQL válida.
2. Defina `FRONTEND_ORIGINS` e `FRONTEND_URL` com a origem HTTPS do frontend.
3. Configure `VITE_API_URL` e `VITE_WS_URL` com os endereços HTTPS e WSS da API.
4. Use HTTPS/WSS e configure `SESSION_SECRET` com um segredo forte.
5. Mantenha uma única instância da API: o estado das partidas em andamento e das conexões em tempo real fica em memória.
6. Configure Google OAuth e Resend somente se esses recursos forem usados.

As migrations versionadas são aplicadas no deploy por `npm run db:deploy`. O endpoint `/health` pode ser usado como verificação de saúde da API.

## Estrutura do repositório

```text
backend/     API, autenticação, WebSocket, Prisma e migrations
frontend/    Aplicação web React
Dockerfile   Imagem de produção do backend
render.yaml  Blueprint de deploy no Render
```

## Segurança

Não envie `.env`, credenciais OAuth, segredos de sessão ou URLs de banco com senha ao GitHub. Em produção, armazene esses valores no gerenciador de variáveis do provedor de hospedagem.
