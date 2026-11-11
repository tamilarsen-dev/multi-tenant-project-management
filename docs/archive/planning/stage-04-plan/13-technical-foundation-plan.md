**Project:** Multi-Tenant Project Management API  
**Workflow Stage:** 04 — Plan  
**Document:** 13  
**Version:** 1.0  
**Status:** Approved

---

# Technical Foundation Plan

## 1. Purpose

This document defines the engineering preparation required before implementing Slice 1 — Identity & Organization.

The Technical Foundation ensures that the repository has an environment, runtime, application foundation, database tooling, testing, and CI that can be run consistently.

The Technical Foundation is not a product feature and does not implement business-domain capabilities such as User Registration, Login, Organization, Project, or Issue.

## 2. Technology Stack

| Area | Technology |
|---|---|
| Runtime | Node.js 24 |
| Language | TypeScript |
| Package manager | pnpm |
| Workspace | pnpm workspace / monorepo |
| HTTP framework | Express 5 |
| Database | PostgreSQL 18 |
| Database runtime | Docker Compose |
| ORM | Prisma 7 |
| Validation | Zod |
| Testing | Vitest |
| HTTP testing | Supertest |
| Logging | Pino |
| HTTP request logging | pino-http |
| API documentation | OpenAPI / Swagger UI |
| Linting | ESLint + typescript-eslint |
| CI | GitHub Actions |

Redis and additional infrastructure services are not part of the initial foundation.

## 3. Repository Structure

The repository uses a pnpm workspace:

```text
multi-tenant-project-management/
├── .github/
│   └── workflows/
│       └── ci.yml
├── apps/
│   ├── api/
│   │   ├── prisma/
│   │   ├── src/
│   │   ├── test/
│   │   ├── package.json
│   │   └── tsconfig.json
│   └── web/
├── docs/
├── compose.yaml
├── eslint.config.js
├── package.json
├── pnpm-lock.yaml
├── pnpm-workspace.yaml
└── README.md
```

Initial implementation focuses on `apps/api`.

The actual structure may evolve as feature requirements emerge. Folders or abstractions must not be created merely to make the structure look complete.

## 4. TF-01 — Repository and Workspace

**Objective:** Prepare a reproducible repository and dependency-management setup.

Scope:

- pnpm workspace.
- Root package configuration.
- API workspace package.
- Shared lockfile.
- `.gitignore`.
- `.gitattributes`.
- Environment-file exclusion.
- Generated-artifact exclusion.

Verification:

- `pnpm install --frozen-lockfile`.
- Workspace packages can be discovered through pnpm.
- API scripts can be run through the root workspace.
- Generated output and secrets are excluded from version control.

Completion criteria:

The repository can be checked out and dependencies can be installed reproducibly.

## 5. TF-02 — Node.js and TypeScript

**Objective:** Establish the runtime and compiler configuration.

Scope:

- Node.js 24.
- TypeScript strict configuration.
- ESM using NodeNext module semantics.
- TypeScript build configuration.
- Development execution through `tsx`.
- Separate build output.
- Type-safety checks.

Verification:

```powershell
pnpm --filter api typecheck
pnpm --filter api build
```

Completion criteria:

- Source code can be type-checked.
- Production JavaScript can be built.
- ESM imports work in the Node.js runtime.
- Build output excludes source-only development files.

## 6. TF-03 — Express Application Foundation

**Objective:** Prepare the Express application lifecycle and HTTP middleware foundation.

Scope:

- Express application instance.
- JSON request parsing.
- Request logging middleware.
- Not-found handler.
- Centralized error handler.
- Health endpoint.
- Disable unnecessary framework-identifying headers.

Middleware order:

```text
Incoming Request
      ↓
Request Logger
      ↓
JSON Parser
      ↓
Application Routes
      ↓
Not Found Handler
      ↓
Central Error Handler
```

The testing foundation must be able to create a test application without starting the production server.

Completion criteria:

- Middleware order is correct.
- Error responses are processed consistently.
- The health endpoint works.
- The test application can be tested independently.

## 7. TF-04 — Environment Configuration

**Objective:** Separate configuration and secrets from source code.

Scope:

- Environment schema validation using Zod.
- `NODE_ENV`.
- `PORT`.
- `DATABASE_URL`.
- Root `.env` for Docker Compose.
- `apps/api/.env` for API runtime.
- `.env.example` as a template.

Configuration rules:

- Required environment variables must be validated.
- Invalid configuration must stop startup.
- Secrets must not be hardcoded.
- The environment example must not contain production credentials.

Completion criteria:

- Invalid configuration is rejected.
- An environment example is available.
- The actual `.env` files are excluded from Git.
- Runtime and Compose read environment variables according to their respective responsibilities.

## 8. TF-05 — PostgreSQL and Docker

**Objective:** Provide a reproducible local PostgreSQL environment.

Scope:

- PostgreSQL 18 Alpine.
- Docker Compose service.
- Named volume.
- Port mapping.
- Database/user configuration.
- Healthcheck using `pg_isready`.

Verification:

```powershell
docker compose up -d db
docker compose ps
```

The database must report a healthy status and accept connections.

Completion criteria:

- The database can be started through Docker Compose.
- Data persists through a named volume.
- The healthcheck works.
- Configuration does not require hardcoded credentials in the Compose file.

## 9. TF-06 — Prisma and Migration Foundation

**Objective:** Prepare Prisma Client, the PostgreSQL adapter, schema location, and migration workflow.

Scope:

- Prisma 7 configuration.
- PostgreSQL datasource.
- Prisma Client generation.
- PostgreSQL driver adapter.
- Prisma Client initialization.
- Migration directory and workflow.
- Database connection verification.

Important distinctions:

- `prisma generate` generates Prisma Client.
- `prisma migrate dev` is used in development to create and apply migrations.
- `prisma migrate deploy` applies existing migrations during deployment.
- `prisma migrate status` checks migration status.
- `prisma validate` validates the schema.

Domain models and feature migrations are outside the Technical Foundation scope. The first model will be added when Slice 1 is designed and implemented.

Completion criteria:

- The Prisma schema is valid.
- Prisma Client can be generated.
- The adapter can connect to PostgreSQL.
- The migration workflow is understood and documented.
- The generated client does not need to be committed to Git.

## 10. TF-07 — Logging Foundation

**Objective:** Provide structured logging for HTTP requests and application errors.

Scope:

- Pino logger.
- Environment-aware log level.
- Pretty output in development.
- JSON output in production.
- HTTP request logging.
- Request method, path, status, and request identifier when available.
- Centralized error logging.

Security constraints:

- Do not log passwords, session tokens, secrets, or sensitive request bodies.
- Do not expose internal details through error responses.
- Potentially sensitive query parameters must not be included in logs.

Completion criteria:

- Requests and errors produce structured logs.
- Error responses do not expose internal stacks or secrets.
- Development and production logging use formats appropriate to their needs.

## 11. TF-08 — Testing Foundation

**Objective:** Prepare automated testing for the HTTP application and error behavior.

Scope:

- Vitest.
- Supertest.
- Test application helper.
- Health endpoint test.
- Error-handling tests.
- Test scripts.

Verification:

```powershell
pnpm test
```

Initial tests cover:

- Health endpoint.
- Not-found behavior.
- Application error.
- Validation error.
- Malformed JSON.
- Oversized payload.
- Error-response information leakage.

Completion criteria:

- The test runner works.
- HTTP endpoints can be tested without the production server.
- Tests can be run consistently from the root workspace.

## 12. TF-09 — API Foundation

**Objective:** Combine HTTP, configuration, logging, error handling, and server lifecycle into the application foundation.

Scope:

- `app.ts` for Express application configuration.
- `server.ts` for HTTP server lifecycle.
- Centralized error handling.
- Not-found handling.
- Health endpoint.
- Graceful shutdown.
- Prisma disconnection during shutdown.

Design boundary:

```text
app.ts
  └── HTTP application configuration

server.ts
  └── HTTP server startup and shutdown
```

Business routes, controllers, services, and domain modules are not created until a slice requires them.

Completion criteria:

- The application can be started.
- The HTTP server can shut down gracefully.
- The Prisma connection lifecycle is handled.
- The application can be tested without starting the server lifecycle.

## 13. TF-10 — CI and Git Workflow

**Objective:** Ensure changes can be verified automatically and the Git workflow remains consistent.

### Git workflow

- Main branch as the integration baseline.
- Feature/fix branches for isolated changes.
- Conventional Commits.
- Staged diff review.
- Whitespace validation.
- Lockfile consistency.

### CI workflow

GitHub Actions runs:

1. Check out the repository.
2. Set up pnpm.
3. Set up Node.js.
4. Install dependencies using the frozen lockfile.
5. Generate Prisma Client.
6. Lint.
7. Typecheck.
8. Build.
9. Test.

CI does not require a live PostgreSQL instance while the test suite does not require database integration.

Verification:

```powershell
pnpm lint
pnpm typecheck
pnpm build
pnpm test
```

Completion criteria:

- All local quality checks pass.
- GitHub Actions runs the workflow on pushes and pull requests to `main`.
- CI succeeds on the GitHub runner.
- Prisma Client generation runs before typecheck/build.

## 14. TF-11 — Documentation

**Objective:** Make the repository understandable, runnable, and maintainable by other developers.

Scope:

### Project planning and design

- Stage 01 — Understand.
- Stage 02 — Specify.
- Stage 03 — Design.
- Stage 04 — Plan.

### Developer documentation

- Project README.
- Local setup.
- Environment configuration.
- Docker and PostgreSQL.
- Prisma and migration workflow.
- Testing.
- Lint and build.
- CI workflow.

Documentation rules:

- Document the actual repository state.
- Do not write instructions that have not been verified.
- Do not duplicate business rules across multiple documents.
- Planning/design documents are the source of product and domain decisions.
- Developer documentation explains how to run and extend the system.

Completion criteria:

- Stage 01–04 documents are stored in the repository.
- The README explains the project and documentation entry points.
- Developers can follow the local setup instructions.
- Database, migration, testing, and CI instructions are available.
- File names and the manifest are consistent.
- Document statuses reflect the latest approvals.

## 15. Technical Foundation Definition of Done

The Technical Foundation is complete when:

- [x] TF-01 — Repository and Workspace
- [x] TF-02 — Node.js and TypeScript
- [x] TF-03 — Express Application Foundation
- [x] TF-04 — Environment Configuration
- [x] TF-05 — PostgreSQL and Docker
- [x] TF-06 — Prisma and Migration Foundation
- [x] TF-07 — Logging Foundation
- [x] TF-08 — Testing Foundation
- [x] TF-09 — API Foundation
- [x] TF-10 — CI and Git Workflow
- [x] TF-11 — Documentation

This checklist reflects the implementation and documentation progress confirmed at the time of final approval.

## 16. Out of Scope

The Technical Foundation does not include:

- User registration and login.
- Authentication and authorization business flows.
- Organization creation.
- Project and Issue management.
- Membership and Invitation.
- Redis.
- Microservices.
- Kubernetes.
- Production deployment.
- Production monitoring infrastructure.

These features will be implemented in subsequent vertical slices or deployment/operations stages.
