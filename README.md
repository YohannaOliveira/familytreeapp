# Árvore Genealógica

Aplicação web para cadastrar uma família grande e navegar por ela como um **grafo de relacionamentos**.
Plano completo de arquitetura: `docs/` (a ser expandido a cada milestone).

## Stack
Backend: Java 21 + Spring Boot 3 · Frontend: React + Vite + TypeScript + Tailwind · Banco: PostgreSQL 16

## Desenvolvimento local
```bash
cp .env.example .env          # ajuste as variáveis
docker compose up -d db       # PostgreSQL local
cd backend && mvn spring-boot:run     # API em :8080
cd frontend && npm install && npm run dev   # app em :5173
```
Credenciais ficam sempre em variáveis de ambiente — nunca no código.

## Segurança
Toda a API (`/api/v1/**`) exige login; só `POST /auth/login` e `/actuator/health` são públicos.
- **Autenticação:** `POST /auth/login` (`{username, password}`) devolve um JWT curto (`accessToken`); envie em `Authorization: Bearer <token>`. `GET /auth/me` mostra o usuário; `POST /auth/logout` é no-op no servidor (o cliente descarta o token). Escolha de JWT em header, e não cookie, porque front (Cloudflare Pages) e API (Render) ficam em domínios diferentes.
- **Rate limit** por IP: login (padrão 5/min) e geral (padrão 300/min); excedido responde `429` com `Retry-After`.
- **CORS** restrito a `CORS_ALLOWED_ORIGINS`.
- **Variáveis obrigatórias** (a API não sobe sem elas): `ADMIN_USER`, `ADMIN_PASSWORD_HASH` (BCrypt), `JWT_SECRET` (≥ 32 chars). Demais opções e como gerar o hash: `.env.example`.
- O backend lê variáveis do ambiente (não do `.env`): exporte-as antes de `mvn spring-boot:run`.
# familytreeapp
