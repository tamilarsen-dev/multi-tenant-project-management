# Multi-Tenant Project Management

A Jira/Linear-style project management platform built as an engineering portfolio project. Organizations are isolated tenants; a User can belong to several Organizations with a different role in each; work is tracked as Projects and Issues with assignment, status workflow, comments, an audit trail, and notifications.

The focus is on the parts that are hard to get right in a real backend: tenant isolation, role-based authorization, relational integrity, transactions, concurrency control, and a stable API contract.

## Stack

| Area | Choice |
|---|---|
| API | Node.js 24, TypeScript, Express 5, Zod 4 |
| Data | PostgreSQL 18, Prisma 7 |
| Testing | Vitest, Supertest, real PostgreSQL |
| Observability | Pino, pino-http, request IDs |
| API docs | OpenAPI 3.1 (modular YAML), Scalar at `/docs` |
| Web | Next.js (`apps/web`) |
| Tooling | pnpm workspace, ESLint, Docker Compose, GitHub Actions |

## Status

Milestone **M1 — Identity & Organization** is in progress. Registration, login, logout, current user, and Organization creation exist; aligning them with the contract and adding session refresh and Organization list/read/update are next. The [Roadmap](docs/plan/roadmap.md) is the source of truth for what is implemented.

## Repository layout

```text
apps/api     Express API, Prisma schema and migrations, tests, OpenAPI
apps/web     Next.js web client
docs/        product, design, ADRs, engineering, roadmap
```

## Local development

Prerequisites: Node.js 24, pnpm 12, Docker.

```bash
pnpm install

# PostgreSQL on localhost:5433
cp .env.example .env              # set POSTGRES_PASSWORD
docker compose up -d db

# API configuration
cp apps/api/.env.example apps/api/.env   # set DATABASE_URL and CORS_ORIGINS
pnpm --filter api prisma migrate deploy

pnpm dev:api                      # http://localhost:3000, docs at /docs
```

Tests use a separate database named `project_management_test`, configured in `apps/api/.env.test`; the suite refuses to run against any other database.

```bash
pnpm --filter api db:test:migrate
pnpm test
pnpm lint && pnpm typecheck && pnpm build
```

## Documentation

Start at [`docs/README.md`](docs/README.md). Key entry points:

- [PRD](docs/product/prd.md) — why the product exists and what V1 includes
- [Architecture](docs/design/architecture.md) and [ADRs](docs/adr/README.md) — how it is built and why
- [API Contract](docs/design/api/contract.md) — every endpoint
- [Roadmap](docs/plan/roadmap.md) — what is done, what is next

## License

See [LICENSE](LICENSE).
