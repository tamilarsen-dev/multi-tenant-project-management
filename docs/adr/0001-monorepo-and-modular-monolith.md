# 0001. Monorepo with a modular monolith API

- Status: Accepted
- Date: 2026-11-09

## Context

The product has a backend API and a web client, built and maintained by one developer, deployed to a single VPS. The domain has many interacting rules (tenant isolation, ownership invariants, transactional history) that are easiest to keep correct inside one database transaction. The project must still show clear internal boundaries, because it is meant to be read and evolved.

## Decision

1. **Repository:** one pnpm workspace with `apps/api` and `apps/web`. Applications never import each other's source. A shared package is created only when two applications genuinely consume it (for example a client generated from OpenAPI).
2. **Backend deployment:** one deployable API application. The Outbox worker is a second process started from the same codebase, not a separate service.
3. **Internal structure:** modules organized by domain capability (`identity`, `organization`, `membership`, …), communicating in-process through exported functions. Modules do not read or write each other's tables except through those functions.
4. **Layering ("pragmatic Clean Architecture"):** presentation (Express) → application (use cases, authorization, transactions) → domain (pure rules). Infrastructure (Prisma, email provider, logging) is used by the application layer. Domain code imports neither Express nor Prisma. Interfaces are introduced only where a real boundary needs one ([ADR-0009](0009-pragmatic-persistence-boundary.md)).

## Alternatives considered

- **Layered monolith by file type** (`controllers/`, `services/`, `repositories/` at the top level). Simple to start, but every feature touches every folder and ownership of rules becomes unclear. Rejected.
- **Microservices.** Would require distributed transactions or eventual consistency for invariants that are trivial inside one PostgreSQL transaction, plus service discovery, multiple pipelines, and network failure handling, for one developer and no scaling need. Rejected.
- **Separate repositories for API and web.** Cross-cutting changes (an endpoint and its UI) would need coordinated PRs and versioned contracts from day one. Rejected for V1.

## Consequences

- Positive: one transaction can enforce cross-module invariants; one CI pipeline; one history; modules can be extracted later because their boundaries are explicit.
- Negative: boundaries are enforced by convention and review, not by the network; a careless import can couple modules. Lint rules or dependency checks may be added if this happens.
- Workspace discipline is required: dependencies are declared by the package that uses them, and root `package.json` holds only workspace scripts and shared tooling.
