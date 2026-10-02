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
# familytreeapp
