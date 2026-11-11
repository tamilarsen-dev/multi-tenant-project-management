# Phase 0.5 --- Domain Implementation

## Multi-Tenant Project Management API

> **Purpose:** Define how the approved V1 specifications will be
> translated into working software.
>
> **Status:** Draft --- implementation approach defined at a high level;
> detailed architecture decisions and implementation tasks remain to be
> finalized.
>
> **Scope:** This document establishes the implementation process and
> responsibilities. It is not a substitute for the Domain Map, API
> Specification, Database Specification, or Implementation Plan.

------------------------------------------------------------------------

## 1. Purpose and position in the workflow

The project has completed the initial planning work:

  -----------------------------------------------------------------------
  Artifact                            Responsibility
  ----------------------------------- -----------------------------------
  Phase 0.1 --- Domain Map            Defines domain entities,
                                      relationships, and business rules

  Phase 0.2 --- API Specification     Defines the HTTP contract

  Phase 0.3 --- Database              Defines persistence structure,
  Specification                       constraints, indexes, and
                                      concurrency requirements

  Phase 0.4 --- Implementation Plan   Defines implementation sequence,
                                      slices, dependencies, and
                                      Definition of Done

  **Phase 0.5 --- Domain              Turns the specifications into
  Implementation**                    executable, tested software
  -----------------------------------------------------------------------

Phase 0.5 is the transition from design and planning into
implementation.

Implementation does not mean translating every document mechanically
into code. Specifications are the current design baseline. During
implementation, assumptions may be challenged by framework behavior,
database semantics, test results, security review, or operational
constraints. Changes must be evaluated and the relevant specifications
and decision records updated.

## 2. Implementation principles

The following principles guide implementation:

1.  **Specification-driven, evidence-verified:** use approved
    specifications as the baseline, then verify behavior through tests
    and review.
2.  **Incremental delivery:** implement the system in vertical slices
    rather than building every layer in isolation.
3.  **Database-enforced integrity:** use application validation for
    clear API errors and database constraints for durable data
    invariants.
4.  **Explicit transaction boundaries:** group related mutations that
    must succeed or fail together.
5.  **Tenant isolation by design:** every organization-scoped operation
    must establish and enforce tenant context.
6.  **Security and negative cases are first-class:** test forbidden
    actions and cross-tenant access, not only successful flows.
7.  **Pragmatic abstraction:** introduce interfaces and architectural
    boundaries where they reduce coupling or improve testability; avoid
    abstraction without a concrete benefit.
8.  **AI-assisted, engineer-verified:** AI may help explain, draft,
    inspect, and debug code, but generated changes must be understood,
    reviewed, and tested before integration.
9.  **Documentation follows meaningful changes:** update specifications
    and decision records when implementation changes contracts, business
    rules, data structures, security behavior, or operations.

## 3. Scope of implementation work

Implementation work is organized into the following activity areas. They
are responsibilities within each vertical slice, not necessarily
sequential project-wide phases.

### 3.1 Database implementation

-   Implement Prisma schema models.
-   Create incremental Prisma migrations.
-   Add custom SQL for PostgreSQL features not adequately represented in
    Prisma schema.
-   Implement foreign keys, composite foreign keys, CHECK constraints,
    unique constraints, partial indexes, and required indexes.
-   Configure database roles and runtime privileges where specified.
-   Validate migrations against a clean database and an existing
    development database.

### 3.2 Domain logic implementation

-   Implement business rules and invariants.
-   Implement role and resource authorization policies.
-   Implement allowed state transitions.
-   Enforce archive, removal, and lifecycle rules.
-   Keep domain decisions independent of HTTP request details and
    ORM-specific behavior where practical.

### 3.3 Persistence implementation

-   Implement database queries and repository operations.
-   Implement transaction boundaries.
-   Implement explicit row/advisory locking where required.
-   Implement optimistic concurrency control where specified.
-   Use raw SQL only where necessary and keep it explicit and
    reviewable.

### 3.4 Application implementation

-   Implement use cases and orchestration.
-   Coordinate domain rules, persistence, and external side effects.
-   Map expected failures into application-level errors.
-   Keep transaction ownership clear: the component coordinating a
    multi-step use case should make the transaction boundary explicit.

### 3.5 API implementation

-   Implement Express routes and controllers.
-   Apply authentication and authorization middleware.
-   Validate request input using Zod.
-   Map application results and errors to the documented HTTP contract.
-   Keep controllers focused on HTTP concerns rather than embedding
    business rules.

### 3.6 Testing implementation

Implement tests at the appropriate levels:

-   Unit tests for isolated rules and pure logic.
-   Integration tests for database behavior and infrastructure
    interactions.
-   API/HTTP tests for routes, middleware, validation, status codes, and
    response contracts.
-   End-to-end tests for important complete user flows.
-   Security and concurrency tests for tenant isolation, permission
    boundaries, race conditions, and invariants.

### 3.7 Documentation

-   Keep API documentation aligned with the implemented contract.
-   Update Domain Map, API Specification, and Database Specification
    when their content changes.
-   Add or update Engineering Decision Records for consequential
    technical decisions.
-   Record operational procedures when they become actionable.

### 3.8 Integration and review

-   Run formatting, linting, type checking, and relevant test suites.
-   Review migrations and generated SQL.
-   Review security-sensitive code and tenant-scoped queries.
-   Integrate changes through the repository's Git workflow.
-   Require CI to pass before treating a slice as complete.

## 4. Delivery strategy: vertical slices

Implementation is delivered in vertical slices. A vertical slice
implements a coherent user-visible capability across the necessary
layers.

For example, User Registration may require: - HTTP route and request
validation. - Application use case. - Password hashing and session
creation. - User and Session persistence. - A database transaction. -
API and integration tests. - Updated API documentation where necessary.

This is preferable to implementing all database models first, then all
repositories, then all controllers, because a vertical slice exercises
the complete path and exposes integration problems earlier.

The initial sequence follows Phase 0.4:

1.  Implementation foundation.
2.  Authentication and Organization.
3.  Membership and Invitation.
4.  Project Management.
5.  Issue Management.
6.  Collaboration: Comments, Activities, Notifications.
7.  Hardening and Release.

The detailed task breakdown and dependencies remain governed by
`phase-0.4-implementation-plan.md`.

## 5. Example: User Registration vertical slice

The first authentication capability is Register.

Expected implementation workflow:

1.  **Review the contract**
    -   Confirm `POST /auth/register`.
    -   Confirm request validation and password policy.
    -   Confirm response shape and error behavior.
    -   Confirm duplicate-email behavior.
2.  **Review persistence requirements**
    -   Confirm User and Session schema.
    -   Confirm unique email constraint and session token hash storage.
    -   Confirm migration requirements.
3.  **Design the use case**
    -   Normalize and validate input according to the specification.
    -   Hash the password using the selected password-hashing
        configuration.
    -   Generate a cryptographically secure session token.
    -   Store only the token hash.
    -   Create User and Session atomically.
4.  **Implement persistence and transaction**
    -   Ensure both records commit or roll back together.
    -   Handle unique constraint conflicts predictably.
5.  **Implement the HTTP boundary**
    -   Add route, validation, controller, and response mapping.
    -   Keep business logic out of the controller.
6.  **Verify**
    -   Valid registration succeeds.
    -   Invalid input is rejected.
    -   Duplicate email is handled correctly.
    -   Raw password is not stored.
    -   Raw session token is not stored.
    -   User and Session creation is atomic.
    -   The response matches the API specification.
7.  **Review and integrate**
    -   Run typecheck, lint, tests, and CI.
    -   Review security-sensitive behavior.
    -   Update documentation if implementation differs from the approved
        specification.

This is an example workflow, not a claim that Register has already been
implemented.

## 6. Architecture direction

The current recommended direction is:

**Modular Monolith with Pragmatic Clean Architecture.**

This is a proposed architectural direction, not yet a finalized
implementation decision. It must be discussed and recorded in an
Engineering Decision Record before the architecture is treated as
approved.

### 6.1 Modular monolith

The application remains one deployable application, organized into
domain-oriented modules such as:

-   Auth
-   Organizations
-   Memberships
-   Invitations
-   Projects
-   Issues
-   Comments
-   Activities
-   Notifications

The goal is to preserve clear module boundaries without introducing
microservices and distributed-system complexity prematurely.

### 6.2 Pragmatic separation of responsibilities

The intended conceptual responsibilities are:

-   **Domain:** business concepts, invariants, and domain rules.
-   **Application:** use-case orchestration and transaction
    coordination.
-   **Infrastructure:** Prisma, PostgreSQL, email provider, logging, and
    other external mechanisms.
-   **Presentation:** Express routes, controllers, middleware, and HTTP
    request/response mapping.

The exact directory structure, dependency rules, and interface strategy
are not finalized by this document.

### 6.3 Architecture decision still required

Before implementing the first domain feature, decide and record:

-   Module boundaries and ownership.
-   Allowed dependency direction.
-   Where use cases live.
-   Where transaction boundaries are managed.
-   Whether repositories are interfaces, concrete Prisma adapters, or a
    selective combination.
-   How domain and application errors are represented.
-   How shared infrastructure is exposed without creating global
    coupling.
-   How cross-module use cases communicate.

Avoid creating an interface for every class by default. Add abstractions
where they protect a boundary, support meaningful testing, or isolate a
likely change.

## 7. Verification strategy

A feature is not complete merely because its endpoint returns a
successful response.

Verification must cover:

-   Expected successful behavior.
-   Input validation.
-   Authentication and authorization.
-   Tenant isolation.
-   Resource lifecycle and state rules.
-   Database constraints and transaction behavior.
-   Concurrent requests where relevant.
-   Error mapping and response contract.
-   Logging and operational behavior where applicable.

Examples of high-risk cases: - A user from Organization A attempts to
access Organization B's Issue. - A Member attempts an Owner/Admin-only
action. - Two requests attempt to remove the final Owners
concurrently. - Two refresh requests attempt to rotate the same
session. - An Issue is assigned to a Membership from another
Organization. - A database operation fails halfway through a multi-step
use case.

The relevant tests should use real PostgreSQL integration where
correctness depends on PostgreSQL behavior, such as foreign keys,
locking, partial indexes, and transaction isolation.

## 8. Definition of Done for an implementation slice

A vertical slice is complete only when applicable criteria are
satisfied:

### Specification

-   Behavior matches the approved domain and API specifications.
-   Any deviations are reviewed and documented.

### Implementation

-   Responsibilities are placed in the appropriate modules and layers.
-   Business rules are not accidentally delegated to controllers or
    database adapters.
-   Transaction boundaries and error handling are explicit.

### Data integrity and security

-   Tenant ownership is enforced.
-   Authorization is checked for the relevant operation.
-   Database constraints protect required invariants.
-   Sensitive values are not logged or stored inappropriately.

### Testing

-   Relevant unit and integration tests pass.
-   API behavior is verified.
-   Negative authorization and tenant-isolation cases are covered.
-   Concurrency tests exist where the use case requires them.

### Quality and integration

-   Formatting, linting, and type checking pass.
-   CI passes.
-   Migrations are reviewed and reproducible.
-   Changes are reviewed and integrated.

### Documentation

-   Relevant documentation is updated.
-   Important new technical decisions are recorded.

If a criterion is not applicable, record why. Do not silently skip it.

## 9. Working with AI during implementation

AI may assist with: - Explaining unfamiliar APIs and framework
behavior. - Exploring implementation alternatives. - Drafting code or
tests. - Reviewing code for likely defects. - Investigating errors and
test failures. - Identifying missing edge cases.

AI output is not evidence of correctness.

Before accepting generated code: 1. Understand what it changes. 2. Check
that it matches the specification. 3. Inspect security and
tenant-scoping behavior. 4. Run the relevant tests. 5. Review database
effects and generated SQL when applicable. 6. Be able to explain the
design and trade-offs.

The engineer remains responsible for the code integrated into the
repository.

## 10. Change management during implementation

The specifications are a baseline, not immutable artifacts.

When implementation reveals a necessary change:

1.  Describe the observed problem or new evidence.
2.  Identify which domain rule, API contract, database behavior, or
    operational assumption is affected.
3.  Evaluate alternatives and trade-offs.
4.  Record consequential decisions in Engineering Decision Records.
5.  Update the relevant active specification.
6.  Implement and test the revised behavior.
7.  Preserve superseded decisions as historical records rather than
    silently deleting them.

Do not create a new document for every small code change. Revise the
authoritative document when appropriate and use the changelog or pull
request history for ordinary implementation progress.

## 11. Out of scope

This document does not: - Replace the detailed Domain Map. - Redefine
API endpoints or response schemas. - Replace the Database
Specification. - Reorder the implementation sequence in Phase 0.4. -
Finalize the exact source-code directory structure. - Claim that any
domain feature has already been implemented. - Authorize microservices
or additional infrastructure without a separate decision.

## 12. Immediate next steps

Before the first domain feature is implemented:

1.  Review the four Phase 0 artifacts.
2.  Discuss and finalize the Modular Monolith + Pragmatic Clean
    Architecture approach.
3.  Record the architecture decision and dependency rules.
4.  Confirm the implementation foundation tasks from Phase 0.4.
5.  Begin the first vertical slice: Register.

**Success criterion for Phase 0.5:** the V1 domain is implemented
incrementally as a working, tested, reviewable system whose behavior can
be traced back to its requirements and technical decisions.
