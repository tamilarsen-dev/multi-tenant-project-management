# Architecture Context

## Multi-Tenant Project Management API

  Field          Value
  -------------- -----------------------------------------------------------
  Document       `ARCHITECTURE.md`
  Purpose        Persistent architecture context for coding agents
  Status         Draft; architecture choice requires explicit confirmation
  Scope          V1 backend
  Last updated   2026-11-02

> This file is an agent-facing architecture guide, not a replacement for
> the detailed Design documents or Architecture Decision Records (ADRs).
> It summarizes known constraints and identifies decisions that must not
> be invented by an agent.

## 1. System shape

The product is a backend API for a multi-tenant project-management
application.

V1 is planned as a **modular monolith**: one deployable backend
application, organized into domain-oriented modules. Microservices are
out of scope.

The current operational plan uses: - One API application. - PostgreSQL
as the primary relational database. - Docker Compose for local and
initial deployment environments. - A single VPS for V1. - Background
processing for asynchronous work such as invitation email and scheduled
cleanup.

Do not introduce distributed services, Redis, Kubernetes, or additional
infrastructure without a concrete requirement and an explicit design
decision.

## 2. Technology baseline

Use the versions and packages already established by the repository. Do
not upgrade, replace, or add dependencies merely because a newer or more
fashionable option exists.

  Concern           Baseline
  ----------------- ----------------------------------
  Runtime           Node.js 24
  Language          TypeScript
  HTTP framework    Express 5
  Database          PostgreSQL 18
  ORM               Prisma 7 with PostgreSQL adapter
  Validation        Zod
  Tests             Vitest and Supertest
  Logging           Pino and pino-http
  Package manager   pnpm workspace
  Containers        Docker and Docker Compose
  CI                GitHub Actions

Prisma 7 adapter configuration and APIs must follow the installed
versions and current repository setup. Do not copy examples written for
older Prisma versions without checking compatibility.

## 3. Architecture direction

### 3.1 Intended direction

The recommended direction is a **modular monolith with pragmatic Clean
Architecture boundaries**.

This direction is a recommendation, not a confirmed final decision until
the project owner explicitly accepts it.

The intended properties are:

-   Organize code around business capabilities, not only technical file
    types.
-   Keep business rules independent of Express and Prisma.
-   Keep HTTP concerns at the application boundary.
-   Keep database and external-service details behind infrastructure
    adapters.
-   Use abstractions only where they protect a meaningful boundary or
    make behavior testable.
-   Avoid creating interfaces, factories, base classes, or generic
    frameworks without a concrete need.

### 3.2 Architecture decision still requiring confirmation

Before treating the following as binding, confirm the architecture
choice with the project owner:

**Option C --- Modular Monolith + Pragmatic Clean Architecture**

-   One deployable application.
-   Domain-oriented modules.
-   Clear separation of HTTP, application use cases, domain rules, and
    infrastructure where useful.
-   No mandatory interface for every class or repository.
-   No microservices.

Do not silently mark this decision as accepted merely because it is
recommended here.

## 4. Domain modules

The current domain map identifies these major areas:

  -----------------------------------------------------------------------
  Module                              Main responsibilities
  ----------------------------------- -----------------------------------
  Auth / Identity                     User registration, login, sessions,
                                      refresh, logout

  Organizations                       Organization creation and
                                      organization-level data

  Memberships                         Organization membership, roles,
                                      activation and removal

  Invitations                         Invitation lifecycle and acceptance

  Projects                            Project lifecycle and organization
                                      ownership

  Issues                              Issue lifecycle, status,
                                      assignment, numbering, search

  Comments                            Issue discussion and comment
                                      lifecycle

  Activities                          Append-only record of meaningful
                                      domain events

  Notifications                       Personal notification inbox and
                                      read state

  Outbox                              Durable asynchronous work,
                                      including invitation email
  -----------------------------------------------------------------------

These are domain boundaries, not a mandate to create one microservice or
one deployable package per module.

A module may contain multiple files or internal components. Keep its
public surface small and avoid reaching into another module's internal
implementation.

## 5. Dependency rules

The intended dependency direction is:

``` text
HTTP / Presentation
        |
        v
Application / Use Cases
        |
        v
Domain Rules

Infrastructure implements technical dependencies
used by Application through explicit boundaries.
```

Apply these principles:

1.  Domain rules must not import Express, Prisma, database clients, or
    provider SDKs.
2.  HTTP controllers translate transport input into application calls
    and translate results into HTTP responses.
3.  Application use cases coordinate business operations and transaction
    boundaries.
4.  Infrastructure owns persistence, external email delivery, logging
    integrations, and other technical adapters.
5.  Validation of transport shape belongs at the API boundary. Domain
    invariants must still be enforced by the application/domain
    operation and, where appropriate, database constraints.
6.  Avoid circular module dependencies.
7.  Cross-module operations should use explicit exported operations or
    application-level coordination, not import another module's private
    files.

If a use case spans multiple domain areas, keep orchestration explicit.
Do not hide multi-module business transactions inside an HTTP
controller.

## 6. Responsibility boundaries

### HTTP / Presentation

Responsible for: - Express routes and middleware composition. - Parsing
path, query, headers, and request body. - Calling request validation. -
Authentication context extraction. - Mapping application outcomes to
HTTP status and response envelopes.

Not responsible for: - Implementing business rules. - Constructing
complex database queries. - Managing multi-step domain transactions
directly.

### Application

Responsible for: - Use-case orchestration. - Authorization decisions
that require current actor and resource context. - Transaction
coordination. - Calling domain behavior and persistence
ports/adapters. - Ensuring related operations succeed or fail together.

### Domain

Responsible for: - Business concepts and invariants. - Valid state
transitions. - Rules that must remain true regardless of transport or
persistence technology.

Not every entity requires a rich class model. Use simple typed
structures and focused functions when they express the domain more
clearly.

### Infrastructure

Responsible for: - Prisma and PostgreSQL integration. - Repository/query
implementations. - Transaction adapter details. - Email provider
integration. - Outbox worker and scheduled jobs. - Technical logging and
other external integrations.

## 7. Persistence and transaction principles

PostgreSQL is the source of truth for persisted application state.

Prisma is the primary data-access tool, but it is not assumed to express
every PostgreSQL feature required by the design. Custom SQL migrations
or carefully scoped raw SQL may be used for features such as partial
indexes, CHECK constraints, advisory locks, and row-locking queries.

Important principles:

-   Enforce tenant relationships with database constraints where
    specified.
-   Use transactions for multi-record operations that must remain
    atomic.
-   Use explicit locking for invariants that can be violated by
    concurrent requests.
-   Use optimistic concurrency control where the API contract requires
    version checks.
-   Do not assume that a sequence of separate Prisma calls is atomic
    unless it is inside the appropriate transaction.
-   Do not move business-critical integrity checks exclusively to the
    frontend.
-   Do not use `prisma db push` as the production migration strategy.
    Prisma Migrate is the migration authority.

The detailed locking order, constraints, indexes, migration rules, and
transaction boundaries are defined in
`phase-0.3-database-specification.md`.

## 8. Multi-tenancy and authorization

Organization is the tenant boundary.

Every organization-scoped use case must establish: 1. The authenticated
User. 2. The relevant active Membership. 3. The Membership's role and
permission for the requested action. 4. That the target resource belongs
to the Organization in the request context.

Never trust a client-supplied `userId`, `organizationId`,
`membershipId`, or resource relationship without validating it against
authenticated and persisted context.

A resource identifier alone does not grant access. Avoid queries that
fetch a resource globally and only later check tenant ownership if a
tenant-scoped query can enforce the boundary directly.

Cross-tenant or inaccessible resources follow the API contract's
not-found behavior. Do not leak resource existence through error
messages or logs returned to clients.

The detailed authorization matrix and lifecycle invariants are in the
Domain Map and API Specification.

## 9. Cross-cutting concerns

The following concerns should be implemented consistently rather than
independently reinvented in each feature:

-   Authentication middleware and request actor context.
-   Authorization and active-membership checks.
-   Request validation.
-   Error mapping and the standard error envelope.
-   Transaction handling.
-   Structured logging and request IDs.
-   Pagination and cursor handling.
-   Optimistic concurrency handling.
-   Activity creation for meaningful mutations.
-   Notification creation for defined events.
-   Outbox scheduling and delivery.
-   Consistent timestamp and UUID handling.

Do not create a generic framework for a cross-cutting concern until at
least one concrete use case demonstrates the required abstraction.

## 10. Error handling boundary

The API uses the error envelope defined by the API Specification:

``` json
{
  "error": {
    "code": "SOME_ERROR_CODE",
    "message": "Human-readable explanation."
  }
}
```

Application/domain failures should be represented in a way that the HTTP
boundary can map consistently to the specified status and error code.

Do not: - Return raw database or provider errors to clients. - Log
passwords, raw session tokens, invitation tokens, or secrets. - Treat
every unexpected error as a validation error. - Swallow errors that
should cause a transaction to roll back.

## 11. Testing implications

Test at the boundary where behavior can be verified most directly:

-   Domain tests for deterministic business rules and state transitions.
-   Application tests for use-case orchestration and authorization
    behavior.
-   Persistence/integration tests for database constraints,
    transactions, and locking.
-   HTTP/API tests with Supertest for routing, middleware, validation,
    status codes, and response contracts.
-   End-to-end tests for critical workflows spanning multiple modules.

Concurrency-sensitive invariants require tests that exercise competing
operations, not only sequential happy paths.

Avoid mocking the behavior that a test is supposed to verify. For
example, a mocked repository cannot prove that a PostgreSQL constraint
or transaction behaves correctly.

## 12. Repository structure

The final folder structure must follow the actual repository and be
agreed during implementation. Do not reorganize the repository solely to
match an illustrative diagram.

A possible direction, subject to confirmation, is:

``` text
apps/
  api/
    src/
      modules/
        auth/
        organizations/
        memberships/
        invitations/
        projects/
        issues/
        comments/
        activities/
        notifications/
      shared/
        errors/
        middleware/
        validation/
        logging/
      infrastructure/
        database/
        email/
        outbox/
      app.ts
      server.ts
```

This is a conceptual example, not an instruction to create every folder
immediately. Introduce files when a real implementation task needs them.

## 13. Agent operating rules

When changing architecture or implementing a feature:

1.  Read the relevant PRD and detailed specifications first.
2.  Inspect the current repository before proposing structural changes.
3.  Identify the module that owns the behavior.
4.  State the use case, invariants, authorization context, and
    transaction boundary before coding.
5.  Prefer the smallest design that preserves the required boundaries.
6.  Do not add dependencies or infrastructure without justification.
7.  Do not invent requirements to fill gaps. Report ambiguity and
    request a decision when it affects correctness or security.
8.  Update architecture documentation or an ADR when a consequential
    architecture decision changes.
9.  Run the relevant tests and quality checks.
10. Report what changed, what was verified, and what remains unverified.

## 14. Sources of truth

Use these project artifacts in this order for their respective subjects:

  ---------------------------------------------------------------------------
  Subject                             Source
  ----------------------------------- ---------------------------------------
  Product intent and V1 scope         `PRD.md`

  Detailed domain behavior and        `phase-0.1-domain-map.md`
  invariants                          

  HTTP contract                       `phase-0.2-api-specification.md`

  Database schema and persistence     `phase-0.3-database-specification.md`
  constraints                         

  Implementation sequence and         `phase-0.4-implementation-plan.md`
  Definition of Done                  

  Architecture decisions              Accepted ADRs and explicitly confirmed
                                      architecture decisions

  Actual implementation state         Current repository code, migrations,
                                      and tests
  ---------------------------------------------------------------------------

If documents conflict, report the conflict. Do not silently invent a
resolution or modify authoritative specifications without approval.

## 15. Open decisions

-   Confirm Option C: modular monolith with pragmatic Clean Architecture
    boundaries.
-   Inspect the current repository and settle the concrete module/folder
    layout.
-   Define the exact application-to-infrastructure dependency mechanism
    based on the first vertical slice.
-   Decide whether any module boundary needs a formal public interface
    after concrete cross-module use cases exist.

Until confirmed, these items remain open. Do not present them as settled
architecture decisions.
