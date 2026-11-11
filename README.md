# ViraLaço

Estrutura inicial de desenvolvimento em monorepo pnpm. O projeto contém somente a configuração técnica, uma página inicial estática e um endpoint de saúde que verifica a conexão com o banco. Não há regras de negócio, autenticação, modelos de domínio ou migrations iniciais.

## Tecnologias e versões

| Camada      | Tecnologias                                                                           |
| ----------- | ------------------------------------------------------------------------------------- |
| Frontend    | Vue 3.5.45, TypeScript 6.0.3, Vite 8.3.8, Vue Router 5.5.0, Pinia 4.1.0, Axios 1.21.1 |
| Backend     | NestJS 12.4.2, TypeScript 6.0.3, Prisma ORM 7.10.1 e adaptador PostgreSQL             |
| Banco       | PostgreSQL 18 em Docker Compose, com volume persistente e healthcheck                 |
| Ferramentas | pnpm 10.34.9, ESLint 10, Prettier 3 e GitHub Actions                                  |

As dependências diretas têm versões exatas; o `pnpm-lock.yaml` fixa a resolução completa. Prisma 7 foi escolhido por ser a linha estável; Prisma 8 ainda está em pré-lançamento. TypeScript 6 atende ao NestJS 12 e à faixa suportada pelo typescript-eslint.

## Pré-requisitos

- Node.js **22.23.1**, indicado em `.nvmrc` e `.node-version`. Também são aceitos Node 22.22.3+, 24.15+ e 26+ nas faixas definidas em `package.json`.
- pnpm **10.34.9**.
- Docker Desktop iniciado, usando containers Linux, ou Docker Engine com o plugin Compose v2+.

Se usar nvm, execute `nvm install 22.23.1` e `nvm use 22.23.1`.

Para disponibilizar pnpm pelo Corepack do Node 22:

```sh
corepack enable
corepack pnpm --version
```

Se não puder habilitar os atalhos globais, use `corepack pnpm` no lugar de `pnpm` em todos os comandos abaixo. Se sua instalação do Node não incluir Corepack, instale o pnpm com `npm install --global pnpm@10.34.9`.

## Executar localmente

Na raiz do repositório:

```sh
pnpm install
pnpm setup:dev
pnpm db:up
pnpm db:check
pnpm dev
```

`pnpm setup:dev` copia os três `.env.example` para seus respectivos `.env`, preserva arquivos existentes e gera o Prisma Client. A geração não exige conexão com o banco. `pnpm db:up` inicia o PostgreSQL e aguarda o healthcheck.

| Serviço                 | Endereço                           |
| ----------------------- | ---------------------------------- |
| Frontend                | <http://localhost:5173>            |
| API                     | <http://localhost:3000/api>        |
| Saúde da API e do banco | <http://localhost:3000/api/health> |
| PostgreSQL              | `localhost:5432`                   |

Com o banco disponível, `GET /api/health` retorna `{"status":"ok","database":"up"}`. A API conecta ao PostgreSQL ao iniciar e encerra a conexão ao receber o sinal de desligamento.

Para executar cada aplicação separadamente, use `pnpm dev:web` e `pnpm dev:api` em terminais diferentes. Encerre os servidores com `Ctrl+C`. `pnpm db:down` encerra o PostgreSQL e preserva seu volume.

## Estrutura

```text
.
├── apps/
│   ├── web/
│   │   ├── src/
│   │   │   ├── router/          # Vue Router
│   │   │   ├── services/api.ts  # Instância Axios
│   │   │   ├── views/           # Página estática inicial
│   │   │   └── main.ts          # Inicialização do Vue e Pinia
│   │   └── .env.example
│   └── api/
│       ├── prisma/             # Schema vazio e consulta técnica
│       ├── prisma.config.ts    # Configuração do Prisma 7
│       ├── src/
│       │   ├── health/         # Endpoint técnico
│       │   ├── prisma/         # Módulo e serviço Prisma
│       │   └── generated/      # Client gerado; ignorado pelo Git
│       └── .env.example
├── scripts/                    # Preparação dos .env e smoke test
├── .github/workflows/ci.yml
├── compose.yaml
├── .env.example
├── eslint.config.mjs
├── pnpm-workspace.yaml
└── pnpm-lock.yaml
```

## Variáveis de ambiente

| Arquivo         | Variável            | Padrão local / finalidade                                     |
| --------------- | ------------------- | ------------------------------------------------------------- |
| `.env`          | `POSTGRES_DB`       | `viralaco`                                                    |
| `.env`          | `POSTGRES_USER`     | `viralaco`                                                    |
| `.env`          | `POSTGRES_PASSWORD` | `viralaco_local`, senha de desenvolvimento                    |
| `.env`          | `POSTGRES_PORT`     | `5432`, porta exposta em `127.0.0.1`                          |
| `apps/api/.env` | `NODE_ENV`          | `development`                                                 |
| `apps/api/.env` | `HOST`              | `127.0.0.1`                                                   |
| `apps/api/.env` | `PORT`              | `3000`                                                        |
| `apps/api/.env` | `CORS_ORIGIN`       | `http://localhost:5173`; aceita origens separadas por vírgula |
| `apps/api/.env` | `DATABASE_URL`      | URL PostgreSQL com os mesmos dados do `.env` da raiz          |
| `apps/web/.env` | `VITE_API_URL`      | `http://localhost:3000/api`                                   |

Os arquivos `.env` são ignorados pelo Git. Variáveis do ambiente do processo têm precedência sobre os arquivos. Valores `VITE_*` são públicos e incorporados ao build; não coloque segredos neles e refaça o build após alterá-los.

Ao trocar a porta ou credenciais do PostgreSQL, atualize também `DATABASE_URL`. As credenciais do Compose só inicializam um volume novo; para um volume existente, altere as credenciais no próprio PostgreSQL. Ao mudar a porta do frontend, ajuste `CORS_ORIGIN` e execute `pnpm dev:web --port NOVA_PORTA`.

## Banco de dados e Prisma

```sh
pnpm db:up             # Iniciar e aguardar o PostgreSQL
pnpm db:logs           # Acompanhar logs
pnpm db:check          # Executar SELECT 1 via Prisma CLI
pnpm db:validate       # Validar o schema
pnpm db:format         # Formatar o schema
pnpm db:generate       # Gerar o Prisma Client
pnpm db:studio         # Abrir o Prisma Studio
pnpm db:down           # Parar containers; preservar dados
```

O schema está intencionalmente sem modelos. O Prisma 7.10 permite gerar o client nessa condição, compilar a API e testar a conexão sem criar tabelas de negócio. O Prisma Client é gerado antes de iniciar a API em desenvolvimento, compilar ou conferir os tipos.

Quando os primeiros modelos forem definidos em `apps/api/prisma/schema.prisma`:

```sh
pnpm db:migrate --name init
pnpm db:generate
```

Versione as migrations geradas. Em um ambiente de implantação, aplique migrations existentes com `pnpm db:deploy`. O Prisma 7 não regenera o client automaticamente ao executar migrations.

## Qualidade e build

```sh
pnpm lint
pnpm format:check
pnpm typecheck
pnpm db:validate
pnpm build
pnpm test:smoke
```

`pnpm format` formata os arquivos e `pnpm lint:fix` aplica correções automáticas do ESLint. O schema Prisma usa seu próprio formatador: `pnpm db:format`.

O smoke test exige `pnpm build` e PostgreSQL ativo. Ele inicia temporariamente a API compilada e o preview do frontend, verifica Prisma/PostgreSQL, CORS, HTML e o bundle JavaScript, e encerra os processos. Usa as portas `3300` e `4174`; configure `SMOKE_API_PORT` e `SMOKE_WEB_PORT` no ambiente se necessário.

Os builds ficam em `apps/web/dist` e `apps/api/dist`. Para inspecioná-los localmente:

```sh
pnpm start:api
# Em outro terminal:
pnpm preview:web
```

O preview usa <http://localhost:4173>. Inclua essa origem em `CORS_ORIGIN` caso use o frontend de preview para acessar a API.

## GitHub Actions

O workflow executa em pull requests, pushes para `main` e acionamento manual. Ele instala dependências com lockfile congelado, prepara o ambiente, verifica formatação, ESLint, schema, conexão PostgreSQL e TypeScript, compila as aplicações e executa o smoke test com um PostgreSQL 18 temporário.

Os builds aprovados são disponibilizados como artefatos por sete dias. Isso prepara a etapa de entrega; o deploy externo depende da escolha de hospedagem, configuração de variáveis e credenciais do ambiente de destino. Os artefatos da API contêm código compilado e exigem suas dependências de produção para execução.

## Referências de compatibilidade

- [Vue: início rápido](https://vuejs.org/guide/quick-start.html)
- [Vite: requisitos do Node.js](https://vite.dev/guide/)
- [NestJS 12: requisitos e migração](https://docs.nestjs.com/migration-guide)
- [Prisma: situação das versões 7 e 8](https://www.prisma.io/docs/orm/release-status)
- [Prisma CLI: geração sem modelos](https://docs.prisma.io/docs/orm/reference/prisma-cli-reference)
- [Docker: persistência do PostgreSQL 18](https://docs.docker.com/guides/postgresql/immediate-setup-and-data-persistence/)
