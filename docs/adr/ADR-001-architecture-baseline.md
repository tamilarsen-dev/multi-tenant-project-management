# ADR-001: Monorepo with Modular Monolith and Pragmatic Clean Architecture

| Field | Value |
|---|---|
| Project | Multi-Tenant Project Management |
| ADR ID | ADR-001 |
| Status | **Accepted** |
| Decision date | 2026-11-09 |
| Scope | V1 repository and backend architecture |
| Supersedes | None |
| Related document | `docs/architecture.md` |

## Context

The project is a multi-tenant project-management application intended to demonstrate end-to-end backend engineering. V1 supports multiple Organizations on one platform. Organization is the tenant boundary, and a User may belong to multiple Organizations with a different Membership role in each.

The repository currently uses a pnpm workspace monorepo. The visible application layout includes:

- `apps/api`: backend API
- `apps/web`: web application
- `docs`: project and engineering documentation

The API repository currently contains areas such as `src/common`, `src/config`, `src/generated`, `src/middleware`, `src/modules`, and `src/types`. The `identity` and `organization` modules are visible under `src/modules`.

V1 is planned for a single-VPS deployment with one API application and one PostgreSQL database. The product needs clear domain ownership, tenant isolation, transactional consistency, background invitation-email delivery, and meaningful automated tests. It does not currently require independent domain-service deployment or distributed infrastructure.

The architecture must provide enough structure to preserve business rules and module boundaries without imposing abstractions or operational complexity that the current scope cannot justify.

## Decision

Adopt a **pnpm workspace monorepo** at repository level and a **Modular Monolith with Pragmatic Clean Architecture** inside `apps/api`.

These are complementary decisions at different levels:

- The monorepo defines how applications and workspace packages are organized and developed together.
- The modular monolith defines how the backend is organized internally and deployed as one API application.
- Pragmatic Clean Architecture defines the dependency and responsibility boundaries inside the backend.

### 1. Repository architecture

- Keep `apps/api` and `apps/web` as separate applications in the same pnpm workspace.
- Keep repository-wide configuration, CI, and documentation at the root where appropriate.
- Add shared workspace packages only when there is a real cross-application consumer and a clear package responsibility.
- Do not allow one application to import another application's private source files.
- Do not expose backend persistence models as frontend contracts. Use explicit API contracts or generated clients where appropriate.

### 2. Backend architecture

- Deploy the V1 backend as one API application.
- Organize backend code around domain capabilities, not only technical file types.
- Keep module ownership explicit and module public surfaces small.
- Use in-process application coordination for cross-module use cases.
- Do not introduce microservices, a message broker, Redis, Kubernetes, or multi-instance infrastructure without a concrete requirement and a separate decision.

### 3. Responsibility boundaries

Use four conceptual responsibility areas:

- **Presentation:** Express routes, middleware, request parsing and validation, authentication context extraction, and HTTP response mapping.
- **Application:** use-case orchestration, authorization requiring actor/resource context, cross-module coordination, and transaction boundaries.
- **Domain:** business concepts, invariants, and valid state transitions.
- **Infrastructure:** Prisma/PostgreSQL integration, persistence adapters, email provider integration, Outbox workers, logging integrations, and other technical mechanisms.

Not every module must have four corresponding directories. Use the smallest structure that preserves a meaningful boundary.

### 4. Dependency direction

- Domain must not depend on Express, Prisma, database drivers, or provider SDKs.
- Application may depend on Domain and defines narrow technical ports when a real boundary requires them.
- Presentation calls Application and maps results to HTTP.
- Infrastructure implements technical dependencies required by Application.
- The composition root wires concrete implementations.
- Avoid circular dependencies and imports into another module's private implementation.
- Do not create an interface for every class or repository by default.

### 5. Module ownership

The logical V1 domain modules are:

- Identity
- Organizations
- Memberships
- Invitations
- Projects
- Issues
- Comments
- Activities
- Notifications

Outbox is an infrastructure mechanism, not a general-purpose domain module. Invitation owns invitation delivery policy; infrastructure owns durable dispatch and retry mechanics.

These are logical ownership boundaries. This ADR does not require that every module already exists as a complete folder in the repository.

### 6. Transactions and persistence

- PostgreSQL is the source of truth for persisted application state.
- Prisma is the primary data-access tool, with carefully scoped SQL where PostgreSQL-specific behavior is required.
- Application use cases define business transaction boundaries.
- A cross-module use case that requires atomicity must coordinate participating operations in the same database transaction.
- Prisma transaction types must not leak into Domain.
- Database constraints enforce integrity that must hold under concurrent requests.
- Use explicit locking or optimistic concurrency controls where required by the authoritative Database and API Specifications.
- Prisma Migrate is the migration authority; `prisma db push` is not the production migration strategy.

### 7. Multi-tenancy and authorization

Every organization-scoped use case must establish the authenticated User, relevant active Membership, applicable permission, and tenant ownership of the target resource.

Client-supplied identifiers and relationships are untrusted until validated against authenticated and persisted context. Tenant-scoped queries and database constraints should enforce Organization boundaries. The Permissions, API, Domain, and Database Specifications remain authoritative for detailed rules.

### 8. Background processing

Use a database-backed Outbox for durable asynchronous work where a business transaction must atomically record the intent to perform that work. A worker may run as a separate process or container while remaining part of the same application codebase and deployment architecture.

Retry policy, terminal failure handling, and retention are defined by the requirements and Database Specifications, not redefined by this ADR.

## Alternatives considered

### A. Layered monolith organized primarily by technical type

A conventional layered monolith could separate controllers, services, and repositories while keeping one deployment.

**Why not selected:** it can be adequate for small applications, but organizing primarily by technical type makes domain ownership and module boundaries less explicit as the product grows. The selected approach retains a monolithic deployment while making business capabilities visible.

### B. Modular monolith with pragmatic Clean Architecture

One backend deployment, organized into domain modules, with explicit but selective boundaries between presentation, application, domain, and infrastructure.

**Why selected:** it matches the single-VPS V1 constraints, keeps operational complexity low, supports transactional workflows, and provides enough structure to protect domain rules and tenant boundaries without requiring a framework-heavy implementation.

### C. Microservices

Split domain capabilities into independently deployed services communicating over network protocols and/or messaging infrastructure.

**Why not selected:** V1 does not have independent scaling, team ownership, availability, or deployment requirements that justify distributed-system complexity. Microservices would introduce network failure modes, service-to-service security, distributed observability, deployment coordination, and cross-service consistency concerns prematurely.

### D. Separate repositories for API and web

Maintain backend and frontend in independent repositories.

**Why not selected:** the current project benefits from coordinated changes, shared CI conventions, and one workspace workflow. Separate repositories can be reconsidered if ownership, release cadence, access control, or build constraints materially diverge.

## Consequences

### Positive consequences

- API and web development share one repository and coordinated workflow.
- Backend modules have explicit domain ownership while remaining one deployable application.
- Cross-module workflows can use local calls and ordinary database transactions.
- Business rules can remain independent of Express and Prisma.
- The architecture can evolve without prematurely introducing distributed infrastructure.
- Testing can target domain rules, use cases, persistence behavior, HTTP contracts, and end-to-end workflows separately.

### Costs and constraints

- Workspace boundaries and dependency declarations require discipline.
- A monolith requires deliberate module boundaries to avoid becoming a tightly coupled codebase.
- Application use cases spanning modules need explicit orchestration and transaction design.
- Pragmatic boundaries require judgment; too little separation creates coupling, while too much creates needless abstractions.
- A single VPS and database remain operational single points of failure for V1.
- A monorepo does not automatically provide safe shared code; shared packages need clear ownership and stable contracts.

### Explicitly rejected defaults

This decision does not require:

- An interface for every repository or class
- A rich domain model for every persisted entity
- A generic service layer
- A generic event bus
- CQRS or event sourcing
- One package or service per domain module
- A separate database per module
- Redis, a broker, Kubernetes, or multi-region deployment

Any of these may be reconsidered only when a concrete requirement and an explicit decision justify the cost.

## Implementation guidance

1. Preserve the current repository layout unless an implementation need justifies a structural change.
2. Treat the visible `apps/api/src/modules/identity` and `organization` directories as existing repository structure, not proof that all architectural boundaries are already satisfied.
3. Introduce or refine module internals incrementally through vertical slices.
4. Define transaction boundaries before implementing multi-record or cross-module use cases.
5. Test tenant isolation, authorization, database constraints, concurrency, and rollback behavior at the appropriate integration boundaries.
6. Keep this ADR and `docs/architecture.md` aligned when an accepted architectural decision changes.

## Validation and review triggers

Revisit this decision if one or more of the following become true:

- API and web require materially independent access control, release, or repository ownership.
- A domain capability needs independent scaling or deployment for demonstrated reasons.
- A module's workload or reliability needs cannot be met within the current application process.
- Team ownership creates persistent coordination bottlenecks around module boundaries.
- Operational measurements show that the single-VPS topology no longer meets established requirements.
- A concrete product requirement cannot be met without changing the current dependency or consistency model.

Do not revisit the architecture merely because a different pattern is fashionable.

## Related decisions and specifications

- `docs/architecture.md`
- PRD V1.2
- Requirements Specification V1.2
- Domain Map V1.2
- Permissions Specification V1.1
- API Specification
- Database Specification V1.3
- Implementation Plan

## Decision record

**Accepted.** The V1 repository architecture is a pnpm workspace monorepo. The V1 backend architecture is a Modular Monolith with Pragmatic Clean Architecture boundaries. Detailed implementation structure may evolve, but changes must preserve the decisions above or be recorded through a superseding ADR.
