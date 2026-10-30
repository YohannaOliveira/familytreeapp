# Árvore Genealógica

Aplicação web para cadastrar uma família grande e navegar por ela como um **grafo de relacionamentos**: pais biológicos e adotivos, meio-irmãos, casamentos, ancestrais repetidos. A tela mostra o subgrafo ao redor de uma pessoa e deixa expandir os ramos.

Backend: Java 21 + Spring Boot 3 · Frontend: React + Vite + TypeScript + Tailwind · Banco: PostgreSQL 16

## Como rodar do zero

Requisitos: **JDK 21**, **Maven**, **Node 22**, **Docker** (banco local e testes de integração).

```bash
# 1. Banco
cp .env.example .env              # só para o docker compose; ajuste a senha do Postgres
docker compose up -d db           # PostgreSQL em localhost:5432

# 2. Backend (porta 8080). Ele lê variáveis do ambiente, NÃO do .env: exporte antes.
#    Hash BCrypt da senha do administrador (troque SUA_SENHA):
docker run --rm httpd:2.4-alpine htpasswd -nbBC 10 "" 'SUA_SENHA' | tr -d ':\n' | sed 's/$2y/$2a/'
export ADMIN_USER=admin
export ADMIN_PASSWORD_HASH='<hash acima>'
export JWT_SECRET="$(openssl rand -base64 48)"
export DB_PASSWORD=<a mesma senha do .env>   # DB_URL/DB_USER têm padrão para o compose
cd backend && mvn spring-boot:run

# 3. Frontend (porta 5173, com proxy para a API em :8080)
cd frontend && npm install && npm run dev
```

Abra http://localhost:5173 e entre com o usuário e a senha definidos. As migrações do banco (Flyway) rodam sozinhas ao subir o backend.

### Variáveis de ambiente (backend)

| Variável | Padrão | Para quê |
|---|---|---|
| `ADMIN_USER`, `ADMIN_PASSWORD_HASH`, `JWT_SECRET` | **obrigatórias** | Login do administrador; segredo do JWT com ≥ 32 caracteres. A API não sobe sem elas |
| `DB_URL`, `DB_USER`, `DB_PASSWORD` | `jdbc:postgresql://localhost:5432/familytree`, `familytree`, `familytree` | Banco |
| `PORT` | `8080` | Porta da API |
| `CORS_ALLOWED_ORIGINS` | `http://localhost:5173` | Origens do front, separadas por vírgula |
| `JWT_TTL`, `LOGIN_MAX_ATTEMPTS`, `API_MAX_REQUESTS` | `30m`, `5`/min, `300`/min | Sessão e rate limit por IP |
| `FORWARD_HEADERS_STRATEGY` | `none` | Use `native` atrás do proxy do Render, para o rate limit ver o IP real |
| `R2_ENDPOINT`, `R2_BUCKET`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_PUBLIC_BASE_URL` | vazias | Fotos (opcional; sem elas o upload responde 503 e o resto funciona) |

Frontend: `VITE_API_URL` (URL da API, vazio = mesmo domínio / proxy do Vite) e `VITE_PHOTO_BASE_URL` (base pública das fotos). Lista completa e comentários em `.env.example`.

## Testes

```bash
cd backend  && mvn verify          # unidade + integração (Testcontainers sobe um Postgres; precisa de Docker)
cd frontend && npm test            # vitest (componentes e regras do front)
cd frontend && npm run e2e         # Playwright, desktop e celular (ver abaixo)
```

- **E2E.** Os specs `a11y`, `states-and-layout` simulam a API e rodam sem backend. O `family-flow` (login → criar pessoa → adicionar filho → buscar → centralizar → excluir) usa um backend e um banco **descartáveis**. Antes, instale o navegador uma vez com `npx playwright install chromium`. O servidor de desenvolvimento do teste usa a porta 5174, então o backend precisa de `CORS_ALLOWED_ORIGINS=http://localhost:5174`; aponte o proxy com `BACKEND_URL=http://localhost:8080` e informe a senha em `E2E_PASSWORD` (`E2E_USER` padrão: `admin`).
- **CI** (`.github/workflows/ci.yml`): backend, frontend (build + vitest) e e2e em todo push na `main` e em todo PR.
- **Dados grandes e desempenho:** `tools/seed` gera uma família sintética (`seed.mjs` apaga as pessoas do banco alvo: use só um banco descartável) e mede a API. Passo a passo e resultados em [docs/performance.md](docs/performance.md).

## Segurança

Toda a API (`/api/v1/**`) exige login; só `POST /auth/login` e `GET /actuator/health` são públicos. JWT curto no header `Authorization` (sem cookie), rate limit por IP, CORS restrito, headers de segurança na API e CSP restritiva no front (`frontend/public/_headers`). Credenciais **só** em variáveis de ambiente. Dependabot semanal para Maven, npm e GitHub Actions. Decisões e riscos: [ADR 0002](docs/adr/0002-autenticacao-jwt-em-header.md) e [ADR 0006](docs/adr/0006-hospedagem-e-seguranca-do-front.md).

## Estrutura

```
backend/     API Spring Boot (pacotes: person, relationship, graph, photo, security, common) + migrações Flyway
frontend/    App React (src/features/*, src/pages, src/components/ui) e testes e2e (e2e/)
tools/seed/  Gerador de família sintética, bench da API e EXPLAIN
docs/        api.md, performance.md e adr/ (decisões de arquitetura)
.github/     CI e Dependabot
```

## Documentação

- [docs/api.md](docs/api.md): rotas, regras e formato de erro
- [docs/adr/](docs/adr/README.md): por que o projeto é como é (grafo, autenticação, regras, layout, fotos, hospedagem)
- [docs/performance.md](docs/performance.md): medições (API, banco, layout e navegador)

## Hospedagem prevista

Cloudflare Pages (front) + Render (API) + Neon (Postgres) + Cloudflare R2 (fotos), todos em planos gratuitos. O deploy é o milestone 14.
