# Architecture

| Field | Value |
|---|---|
| Status | Active |
| Owner | T. Tamil Arsen |
| Last updated | 2026-11-11 |
| Style | pnpm monorepo · modular monolith · pragmatic Clean Architecture |

This document explains how the code is organized and which dependencies are allowed. The reasoning behind each structural choice is recorded in the [ADRs](../adr/README.md).

---

## 1. Purpose

This document answers:

- How is the codebase organized?
- How are applications and packages separated inside the repository?
- How is the backend structured internally?
- Which dependencies and communication patterns are allowed?
- Where do business rules, transactions, persistence, and external integrations belong?
- Which architectural constraints must remain true as the system evolves?

The project is a portfolio engineering project. A documented design is not evidence that a feature has been implemented, tested, deployed, or validated in production. Implementation claims must be supported by repository code and verification results.

## 2. System context

The product is a multi-tenant project-management application. Multiple Organizations use one platform, while each Organization's members, projects, issues, and related operational data remain isolated.

A User may belong to multiple Organizations. The User's role is contextual to each Membership, not global to the User account.

**Organization is the tenant boundary.** Tenant isolation is a system-wide security and data-integrity requirement, not merely a role check.

V1 is designed for small teams and a single-VPS operational environment. It prioritizes a coherent end-to-end backend over distributed infrastructure.

### 2.1 V1 capabilities

The architecture supports these product areas:

- Identity and session management
- Organizations, memberships, and invitations
- Projects
- Issues, assignment, status, priority, and labels
- Comments and activity history
- In-app notifications
- Durable asynchronous invitation-email delivery through an Outbox

V1 roles are `OWNER`, `ADMIN`, and `MEMBER`. `GUEST` and arbitrary/custom permission systems are out of scope.

### 2.2 Explicit non-goals

Do not introduce the following without a new product requirement and an explicit architecture decision:

- Microservices or independently deployed domain services
- Kubernetes or multi-region deployment
- Multi-instance/high-availability infrastructure
- Redis or a separate message broker
- Event sourcing or system-wide CQRS
- Elasticsearch or a dedicated search platform
- Real-time collaborative editing or push infrastructure
- A generic plugin/module framework
- A generic repository, service, or dependency-injection framework without a demonstrated need

These are not statements that the technologies are inherently bad. They are scope and complexity controls for V1.

---

## 3. Architecture decisions

| Decision | Record |
|---|---|
| pnpm monorepo; backend as a modular monolith; pragmatic Clean Architecture; in-process module communication | [ADR-0001](../adr/0001-monorepo-and-modular-monolith.md) |
| Prisma confined to infrastructure through repositories and one transaction helper; no port interfaces by default | [ADR-0009](../adr/0009-pragmatic-persistence-boundary.md) |
| PostgreSQL as source of truth, tenant isolation by scoped queries plus composite foreign keys, no RLS in V1 | [ADR-0006](../adr/0006-tenant-isolation-strategy.md) |
| Database-backed Outbox for invitation email | [ADR-0008](../adr/0008-transactional-outbox-for-email.md) |

### 3.1 Why monorepo

A monorepo is a repository organization strategy. It allows multiple applications and internal packages to be versioned and developed together.

It does **not** mean that all code belongs in one runtime process, nor does it mean that applications must share every dependency.

Benefits for this project:

- One source-control history and review workflow
- Shared repository-level tooling and CI configuration
- Coordinated API and web changes
- A controlled place for genuinely shared contracts or utilities
- Easier local development across the applications

Trade-offs:

- Workspace configuration and dependency boundaries require discipline
- A change in a shared package can affect multiple applications
- CI may need path-aware tasks as the repository grows
- Shared packages can become dumping grounds if ownership is not explicit

A package belongs in the workspace only when it has a clear purpose, ownership, and consumer. Do not create shared packages pre-emptively.

### 3.2 Why modular monolith

A modular monolith is one deployable application whose code is divided into cohesive modules with explicit responsibilities and boundaries.

For V1, this avoids:

- Network communication between domain services
- Distributed transactions and eventual-consistency problems across services
- Service discovery, orchestration, and independent deployment pipelines
- Operational overhead that does not solve a current product problem

The modules should remain cohesive and loosely coupled so that a future extraction is possible if evidence justifies it. Designing every module as a future microservice now is not a requirement.

### 3.3 Why Pragmatic Clean Architecture

The architecture separates business policy from technical mechanisms where the boundary protects the system:

- Domain rules should not depend on Express or Prisma.
- Application use cases coordinate behavior and transaction boundaries.
- Presentation translates HTTP input and output.
- Infrastructure implements database, email, logging, and other technical mechanisms.

“Pragmatic” is intentional. This project does not require an interface for every class, a repository abstraction for every table, rich domain objects for every entity, or four folders in every module. Use the simplest structure that preserves an important boundary and makes behavior understandable and testable.

---

## 4. Repository architecture

The repository uses pnpm workspace and contains separate application directories.

```text
repository/
├── .github/workflows/        # CI
├── apps/
│   ├── api/                  # Express API (layout in §7.2)
│   │   ├── docs/openapi/     # OpenAPI source (modular YAML) and generated bundle
│   │   ├── prisma/           # schema.prisma and migrations
│   │   ├── scripts/
│   │   ├── src/
│   │   └── test/
│   └── web/                  # Next.js web client
├── docs/                     # this documentation
├── compose.yaml              # local PostgreSQL
├── package.json              # workspace scripts only
├── pnpm-lock.yaml
└── pnpm-workspace.yaml
```

### 4.1 Workspace responsibilities

**Repository root**

Owns workspace configuration, shared scripts where appropriate, lockfile, repository-wide tooling, Docker Compose configuration, CI configuration, and project documentation.

**`apps/api`**

Owns the backend application, its runtime dependencies, database integration, API tests, and API-specific configuration.

**`apps/web`**

Owns the web application and its frontend-specific dependencies, build, and tests.

**`docs`**

Owns product and engineering specifications, architecture documentation, decision records, and implementation guidance.

### 4.2 Workspace package rules

1. Applications must not import another application's private source files.
2. Cross-application code sharing must happen through an explicitly designed workspace package or a deliberately shared contract.
3. Do not create a shared package just to avoid a small amount of duplication.
4. Keep dependencies declared by the package that uses them.
5. Use the pnpm workspace protocol for internal workspace dependencies where applicable.
6. Avoid circular package dependencies.
7. Do not make the web application depend on backend implementation details such as Prisma models or database types.
8. If API and web need a shared contract, define a stable contract package or generate a client from the API contract. Do not expose persistence models as public API types.

The exact package list beyond `apps/api` and `apps/web` is not fixed by this document.

---

## 5. Backend application architecture

`apps/api` is one deployable backend application. Its internal organization is a modular monolith.

### 5.1 Domain modules and ownership

| Module | Owns |
|---|---|
| `identity` | Global User identity, registration, authentication, and Session lifecycle |
| `organization` | Organization lifecycle and organization-level behavior |
| `membership` | Membership lifecycle, organization-scoped roles, activation, and removal |
| `invitation` | Invitation creation, resend policy, acceptance, revocation, and expiration behavior |
| `project` | Project lifecycle and organization ownership |
| `issue` | Issue lifecycle, numbering, status, priority, assignment, and Issue–Label association |
| `label` | Organization-scoped Label catalogue |
| `comment` | Comment creation, editing/deletion behavior, and comment lifecycle |
| `activity` | Append-only history records for defined meaningful actions |
| `notification` | User notification inbox and read/unread lifecycle |

Module folders under `apps/api/src/modules/` use these singular names. A module folder is created by the slice that first needs it, not in advance.

### 5.2 Module ownership rules

- A module owns the rules and operations for its domain behavior.
- A module may expose a small public application-facing API to other modules.
- Other modules must not import private files or directly manipulate another module's persistence tables as a shortcut.
- A module must not become a generic home for unrelated code.
- Shared technical concerns belong in common infrastructure only when they are genuinely cross-cutting.
- Domain ownership does not imply one database per module. V1 uses one PostgreSQL database.

### 5.3 Outbox is infrastructure, not a domain module

Outbox is a persistence-backed mechanism for durable asynchronous work. It is not a general-purpose business module.

For invitation email:

1. The Invitations use case applies invitation rules.
2. The invitation state change and Outbox record are committed in the same database transaction.
3. A worker reads pending Outbox records and attempts delivery.
4. Delivery failures follow the retry and terminal-failure policy in the Database design and requirements.
5. Email provider delivery does not determine whether the invitation transaction itself committed.

The invitation domain owns the invitation delivery policy. Infrastructure owns the generic mechanics for claiming, retrying, and dispatching Outbox work.

---

## 6. Internal responsibility boundaries

The API uses four conceptual responsibility areas. They do not have to map one-to-one to folders in every module.

### 6.1 Presentation

Responsible for:

- Express application and route composition
- HTTP middleware
- Parsing path, query, header, and body input
- Request-shape validation at the transport boundary
- Extracting authenticated request context
- Calling application use cases
- Mapping application outcomes to HTTP status codes and response envelopes

Must not:

- Implement business rules
- Own multi-step business transactions
- Contain complex persistence queries
- Bypass application authorization or domain invariants

### 6.2 Application

Responsible for:

- Use-case orchestration
- Coordinating domain behavior
- Authorization decisions requiring actor, membership, and resource context
- Defining transaction boundaries
- Coordinating cross-module operations
- Calling domain operations and required technical ports/adapters
- Translating expected business outcomes into application-level results or errors

Application is the orchestration boundary. It should make the use case's sequence and atomicity requirements visible.

### 6.3 Domain

Responsible for:

- Domain concepts and terminology
- Business invariants
- Valid state transitions
- Rules that must remain true regardless of HTTP framework or persistence technology

Domain code must not import:

- Express
- Prisma Client or Prisma transaction types
- Database drivers
- Email provider SDKs
- HTTP request/response types

Not every entity requires a class. Typed structures and focused functions are valid when they express the rule more clearly.

### 6.4 Infrastructure

Responsible for:

- Prisma and PostgreSQL integration
- Persistence queries and repository implementations where useful
- Transaction adapter details
- Email provider integration
- Outbox worker and scheduled cleanup jobs
- Logging integrations
- Other external systems and technical mechanisms

Infrastructure implements technical needs required by Application. It must not become the owner of business policy simply because the policy is convenient to implement next to a database query.

---

## 7. Dependency rules

The intended dependency direction is:

```text
HTTP / Presentation
        |
        v
Application / Use Cases
        |
        v
Domain

Infrastructure implements technical dependencies
required by Application.
```

Apply these rules:

1. Domain must not depend on Application, Presentation, or Infrastructure.
2. Application may depend on Domain.
3. Presentation may depend on Application, but not on infrastructure implementations directly for business operations.
4. Infrastructure may depend on Application-defined ports/contracts and Domain types as needed to implement technical behavior.
5. The composition root wires concrete infrastructure implementations into the application.
6. Avoid circular dependencies between modules and between layers.
7. Do not pass Express request/response objects into Application or Domain.
8. Do not pass Prisma model or transaction types into Domain.
9. Do not expose raw database/provider errors beyond the infrastructure boundary.
10. Do not create interfaces solely to make every dependency look abstract.

### 7.1 Dependency inversion and ports

When Application needs a technical capability that should be replaceable or isolated, define a narrow port at the application boundary and implement it in Infrastructure.

Examples may include:

- User/session persistence operations
- Invitation email dispatch
- Clock access when deterministic time is important for tests
- Transaction execution where use-case coordination requires it

A port is justified when it protects a real boundary, supports meaningful testing, or isolates a likely change. A concrete Prisma adapter may be sufficient for straightforward queries when an additional abstraction adds no value.

Do not build a generic dependency-injection framework for V1. Explicit composition is sufficient unless the code demonstrates a stronger need.

### 7.2 Concrete layout and persistence boundary

[ADR-0009](../adr/0009-pragmatic-persistence-boundary.md) turns the rules above into one concrete convention:

```text
src/
├── app.ts                    # Express app: middleware, routes, error handler (no listen)
├── server.ts                 # composition root: listen, graceful shutdown
├── config/                   # env (Zod-validated), logger
├── db/
│   ├── client.ts             # the only module that constructs PrismaClient
│   └── transaction.ts        # runInTransaction(fn) and the Db/Tx types
├── http/                     # error envelope, validation middleware, pagination, request id
└── modules/<module>/
    ├── <module>.routes.ts      # presentation: routes + middleware
    ├── <module>.controller.ts  # presentation: parse → call service → map response
    ├── <module>.schema.ts      # presentation: Zod request schemas
    ├── <module>.service.ts     # application: use cases, authorization, transaction boundary
    ├── <module>.rules.ts       # domain: pure functions (transitions, invariants); optional
    ├── <module>.repository.ts  # infrastructure: Prisma queries, accepts a Db handle
    └── <module>.mapper.ts      # presentation: persistence → response DTO; optional
```

Rules:

- Only `db/` and `*.repository.ts` import the Prisma client or generated Prisma types.
- A service never imports `prisma`. It calls `runInTransaction(async (tx) => …)` and passes `tx` to repositories. `Tx` is an opaque type alias exported by `db/transaction.ts`; services treat it as a handle and never call Prisma methods on it.
- Every repository function for an organization-scoped table takes `organizationId` as a required parameter and includes it in the `WHERE` clause.
- `*.rules.ts` imports nothing from Express, Prisma, or other layers.
- A module may call another module's service or repository only through that module's exported functions, inside the same transaction when atomicity requires it.
- Database errors that represent expected conflicts (unique violation, zero-row conditional update) are translated to application errors in the repository or service, never in the controller.

---

## 8. Cross-module communication

Modules communicate in-process. They do not call one another over HTTP and do not publish every internal operation to a message broker.

Preferred mechanisms:

- Application-level orchestration for use cases spanning multiple modules
- Explicit exported operations or narrow module-facing contracts
- Domain events only when they represent meaningful domain facts and have a clear consumer

Avoid:

- Importing another module's private repository or service
- Direct cross-module database writes
- Circular module dependencies
- Generic event buses without a concrete requirement
- Hidden side effects inside controllers

### 8.1 Example: create an Issue

A create-Issue use case may need to:

1. Establish the authenticated User and active Membership.
2. Authorize the action within the Organization.
3. Verify the Project belongs to that Organization and is usable.
4. Validate assignment against an eligible Membership in the same Organization.
5. Create the Issue.
6. Record the required Activity.
7. Create any Notification required by the defined business rules.

The Application use case coordinates this workflow. If the specification requires these database changes to succeed or fail together, they share one transaction. The controller does not orchestrate the steps.

This is an architectural example, not a claim that the use case is already implemented.

---

## 9. Transaction management and consistency

PostgreSQL is the source of truth for persisted state.

### 9.1 Transaction ownership

- Application use cases define the business transaction boundary.
- Infrastructure provides the transaction mechanism.
- A transaction spanning multiple modules is coordinated by one application use case.
- Modules participating in that use case must use the same transaction context for operations that must be atomic.
- Modules must not independently commit nested or separate transactions that break the use case's atomicity.
- Prisma transaction objects remain inside the infrastructure/application adapter boundary; they must not leak into Domain.

### 9.2 Database integrity

Use database constraints as a final integrity boundary, especially for tenant relationships and invariants that must survive concurrent requests.

Use transactions for multi-record operations that must be atomic.

Use explicit row locking or other database-level concurrency controls for invariants that can be violated by concurrent operations.

Use optimistic concurrency control where the API contract defines version-based conflict detection.

Do not assume that multiple database calls are atomic unless they execute inside the same transaction.

Detailed constraints, indexes, locking order, retention, and transaction requirements belong to the Database design. This document does not redefine them.

### 9.3 Migrations

- Prisma Migrate is the migration authority.
- Do not use `prisma db push` as the production migration strategy.
- Use carefully scoped SQL migrations or raw SQL when PostgreSQL-specific features are required and Prisma does not express them adequately.
- Review migrations for locking, data-loss, rollback, and deployment implications.
- Never treat generated Prisma types as a replacement for database integrity constraints.

---

## 10. Multi-tenancy, authentication, and authorization

These are related but distinct responsibilities.

### 10.1 Authentication

Authentication establishes the global User identity and the validity of the current Session.

The identity/session implementation follows the Domain Model and API Contract. Do not infer identity from client-supplied identifiers.

### 10.2 Tenant context

For an organization-scoped request, the application must establish the Organization context and the authenticated User's relevant active Membership.

A client-supplied `organizationId`, `membershipId`, `userId`, or resource relationship is untrusted until validated against persisted and authenticated context.

### 10.3 Authorization

Authorization determines whether the actor's Membership role and the applicable resource state permit the requested action.

The permission matrix and role-specific rules belong to the Permissions. Do not duplicate or invent permission rules here.

### 10.4 Resource and tenant integrity

A resource identifier does not grant access.

- Scope resource access to the Organization context.
- Verify that related resources belong to the same Organization.
- Validate assignment against an eligible Membership in the same Organization.
- Enforce tenant relationships with database constraints where specified.
- Avoid globally fetching a tenant-scoped resource and only later checking its Organization when a tenant-scoped query can enforce the boundary directly.
- Follow the API contract's not-found behavior for inaccessible or cross-tenant resources.
- Do not leak protected resource existence in client-facing errors.

Tenant isolation must be verified with negative tests, not only successful same-tenant requests.

---

## 11. Persistence and data access

### 11.1 Baseline

- Database: PostgreSQL 18
- ORM/data access: Prisma 7 with the configured PostgreSQL adapter
- Migrations: Prisma Migrate, with custom SQL migrations where necessary

Use the versions and APIs installed in the repository. Prisma 7 adapter setup differs from older Prisma configurations; do not copy older examples without checking compatibility against the installed version.

### 11.2 Data access principles

- Keep persistence queries in Infrastructure or the agreed persistence adapter boundary.
- Keep business invariants in Domain/Application and reinforce them with database constraints where appropriate.
- Prefer explicit, tenant-scoped queries.
- Avoid leaking Prisma-specific types into domain contracts.
- Use raw SQL selectively for database features that need it, such as partial indexes, row locks, or other PostgreSQL-specific behavior.
- Do not add a repository abstraction for every model by default.
- Do not let the frontend become the authority for data integrity.

---

## 12. Background processing and Outbox

V1 requires durable asynchronous processing for invitation email and scheduled maintenance tasks.

The Outbox pattern is used where a business transaction must reliably record that asynchronous work is required.

Principles:

1. The business state change and corresponding Outbox record are committed atomically.
2. A worker processes pending records independently of the original HTTP request.
3. Workers must tolerate process interruption and retryable failures.
4. Processing must be safe against duplicate execution where the operation can be repeated.
5. Retry policy, maximum attempts, terminal failure behavior, and record retention follow the authoritative requirements and Database design.
6. A provider delivery failure must not retroactively roll back an already committed business transaction.
7. Do not introduce Redis, a broker, or a separate worker service unless measured requirements justify the added infrastructure.

The worker may run as a separate process/container while remaining part of the same deployable application codebase. A separate process does not make the domain architecture microservices.

---

## 13. Error handling

Keep error categories distinct:

- **Domain errors:** a business rule or state transition is invalid.
- **Application errors:** a use case cannot proceed because of authorization, missing context, or an expected application condition.
- **Infrastructure errors:** database, network, provider, or other technical failures.
- **HTTP errors:** transport-level validation and response mapping.

The Presentation boundary maps expected failures to the API Contract's status codes and error envelope.

Rules:

- Never return raw database or provider errors to clients.
- Do not convert every unexpected error into a validation error.
- Do not swallow failures that must roll back a transaction.
- Do not log passwords, raw session tokens, invitation tokens, or secrets.
- Keep error codes stable and aligned with the API Contract.

The API Contract owns the exact response contract.

---

## 14. Cross-cutting concerns

Implement cross-cutting behavior consistently, but do not build a framework before concrete use cases exist.

Relevant concerns include:

- Authentication middleware and request actor context
- Active Membership and authorization checks
- Request validation
- Error mapping
- Transaction handling
- Structured logging and request IDs
- Pagination and cursor handling
- Optimistic concurrency
- Activity creation for defined mutations
- Notification creation for defined events
- Outbox scheduling and delivery
- Timestamp and UUID handling

A cross-cutting utility belongs in common/shared code only when multiple modules genuinely need the same behavior and its ownership is clear.

---

## 15. Testing strategy

Test levels, required suites, and the high-risk scenarios that must be covered are defined in [Testing](../engineering/testing.md). The guiding rule: do not mock the behavior a test is supposed to verify. A mocked repository cannot prove PostgreSQL constraints, locking, or transaction behavior.

---

## 16. Deployment and operations

V1 runs as one API instance and one PostgreSQL database on a single VPS using Docker Compose, with the Outbox worker as a separate process from the same codebase. Details are in [Operations](../engineering/operations.md). Multi-instance deployment, Kubernetes, Redis, or high-availability infrastructure require a new ADR.

---

## 17. Technology baseline

Use the versions and dependencies already established by the repository. This table records the intended V1 baseline; the actual installed versions and package manifests remain the implementation authority.

| Concern | Baseline |
|---|---|
| Runtime | Node.js 24 |
| Language | TypeScript |
| Backend framework | Express 5 |
| Database | PostgreSQL 18 |
| ORM | Prisma 7 with PostgreSQL adapter |
| Validation | Zod |
| Testing | Vitest and Supertest |
| Logging | Pino and pino-http |
| Package manager | pnpm workspace |
| Containers | Docker and Docker Compose |
| CI | GitHub Actions |
| Frontend application | `apps/web`; framework/version must be verified from its package manifest |

Do not upgrade, replace, or add dependencies merely because a newer option exists. Verify compatibility and justify changes against a concrete requirement.

---

## 18. Architecture change rules

A change to architecture is required when a proposal materially changes:

- Repository or workspace boundaries
- Application deployment boundaries
- Module ownership or public contracts
- Dependency direction
- Transaction or consistency boundaries
- Persistence technology or data ownership
- Cross-module communication
- Background processing infrastructure
- Security or tenant-isolation boundaries
- Operational topology

For a consequential change:

1. State the problem and the constraint that current architecture cannot satisfy.
2. Identify affected modules, specifications, tests, and deployment behavior.
3. Compare realistic alternatives, including keeping the current design.
4. Record benefits, costs, risks, and migration implications.
5. Obtain explicit approval before treating the proposal as binding.
6. Update this document and the authoritative specifications affected by the decision.
7. Verify the implementation and tests.

Do not silently change architecture through a local refactor that alters module ownership or system guarantees.

---

## 19. Known limits

- One API instance: in-memory rate limiting and the connection budget in [Database §7.11](database.md#711-single-vps-connection-and-timeout-baseline) assume a single process.
- Additional shared workspace packages (for example a generated API client for `apps/web`) are not created until the web app consumes the API.

Open decisions are tracked in the [Roadmap](../plan/roadmap.md#open-decisions).

---

## 20. Sources of truth

The authority map for all documents is in the [documentation index](../README.md#authority-map). The repository's code, migrations, and tests are the source of truth for what is implemented; the specifications are the source of truth for what the system is intended to do.

---

## 21. Guidance for contributors and coding agents

Before implementing a feature:

1. Read the relevant product and detailed specifications.
2. Inspect the current repository and installed dependency versions.
3. Identify the owning domain module.
4. Identify the actor, tenant context, authorization rule, invariants, and resource relationships.
5. Define the use case and its transaction boundary.
6. Decide which layer owns each part of the behavior.
7. Implement the smallest design that preserves the required boundaries.
8. Add tests at the appropriate levels, including negative tenant/authorization cases where relevant.
9. Run relevant tests, type checks, lint, and CI tasks.
10. Update specifications or this architecture document if the approved design changes.
11. Report what changed, what was verified, and what remains unverified.

Do not:

- Invent requirements to fill specification gaps.
- Treat a proposed design as implemented.
- Add dependencies or infrastructure without justification.
- Import another module's private implementation.
- Leak Prisma or Express types into Domain.
- Bypass tenant-scoped authorization.
- Claim production readiness, performance validation, or recovery readiness without evidence.

The governing principle is simple: preserve domain correctness and explicit boundaries with the least complexity that satisfies V1.
