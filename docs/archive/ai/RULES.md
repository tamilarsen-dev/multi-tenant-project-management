# RULES.md

> Agent-facing engineering rules for the Multi-Tenant Project Management
> API.
>
> **Status:** Working rules for implementation. Product behavior and
> technical design remain governed by the Phase 0 specifications and
> explicit architecture decisions.

## 1. Priority of instructions and sources

When instructions conflict, use this order:

1.  Explicit user decisions made for this project.
2.  The authoritative Phase 0 specification for the subject:
    -   `phase-0.1-domain-map.md` for domain behavior.
    -   `phase-0.2-api-specification.md` for HTTP contracts.
    -   `phase-0.3-database-specification.md` for persistence and
        concurrency.
    -   `phase-0.4-implementation-plan.md` for slice order and
        completion criteria.
3.  Accepted architecture decisions.
4.  `PRD.md`, `ARCHITECTURE.md`, and `DESIGN.md` as summaries and
    implementation guidance.
5.  Existing repository conventions, provided they do not conflict with
    the sources above.

Do not resolve a conflict by guessing. Report the conflict, affected
files, and implementation impact.

## 2. General implementation principles

-   Prefer correctness, explicit behavior, and maintainability over
    cleverness.
-   Implement the smallest coherent vertical slice that satisfies its
    specification.
-   Do not add product scope, endpoints, fields, roles, states, or
    behavior without approval.
-   Do not silently change an established contract to make
    implementation easier.
-   Avoid speculative abstractions and premature generalization.
-   Keep business rules explicit and testable.
-   Keep changes focused. Do not reformat or rewrite unrelated files.
-   Preserve existing working conventions unless there is a concrete
    reason to change them.
-   Do not claim a feature is complete merely because its happy path
    works.

## 3. Working with the repository

Before editing:

1.  Inspect the actual repository structure and relevant files.
2.  Read the applicable specifications and existing implementation.
3.  Check package versions and scripts rather than assuming them.
4.  Identify the smallest set of files and modules that should change.
5.  State any unresolved dependency or specification conflict.

While editing:

-   Follow the repository's existing TypeScript, module, naming, and
    formatting conventions.
-   Use the package manager and workspace commands already established
    by the repository.
-   Do not add a dependency when the existing stack can reasonably solve
    the problem.
-   If a dependency is necessary, explain why and assess its maintenance
    and security implications.
-   Do not edit generated output or lockfiles manually.
-   Do not place secrets, credentials, real user data, or private tokens
    in source control.

After editing:

-   Inspect the diff.
-   Remove accidental changes, debug code, and unused imports.
-   Run relevant checks and report their actual results.
-   Do not claim tests passed unless they were run and passed.

## 4. TypeScript and Node.js

-   Preserve strict TypeScript settings.
-   Avoid `any`. If unavoidable at an external boundary, isolate it and
    explain why.
-   Prefer `unknown` for untrusted values, then validate or narrow the
    type.
-   Validate external input at runtime; TypeScript types do not validate
    HTTP payloads.
-   Do not use type assertions to bypass a real type or validation
    problem.
-   Handle asynchronous failures explicitly.
-   Do not leave floating Promises or unhandled rejections.
-   Keep environment access centralized and validate required
    environment variables at startup.
-   Do not read environment variables throughout business logic.
-   Follow the repository's configured ESM/NodeNext import conventions.
    Do not change module format casually.

## 5. HTTP and validation

-   Keep HTTP concerns at the transport boundary: parsing,
    authentication context, validation, status codes, headers, and
    response serialization.
-   Validate request parameters, query strings, and bodies with the
    established Zod conventions.
-   Treat all client input as untrusted.
-   Do not use request-body fields as proof of identity, tenant
    membership, or authorization.
-   Keep API responses and errors consistent with
    `phase-0.2-api-specification.md`.
-   Do not expose stack traces, database errors, token material,
    password hashes, or internal implementation details.
-   Do not turn unexpected internal failures into misleading client
    validation errors.
-   Preserve the specified distinction between `400`, `403`, `404`,
    `409`, and `422`.

## 6. Authentication, authorization, and tenant isolation

-   Authenticate the caller before protected operations.
-   Resolve authorization from trusted server-side identity and current
    Membership state.
-   Scope tenant-owned reads and writes to the Organization in the route
    and the caller's active Membership.
-   Verify that related resources belong to the same Organization and
    parent resource.
-   Never rely on an unscoped lookup followed by an incomplete
    authorization check.
-   Apply the exact role rules in the Domain Map; do not infer
    permissions from role names.
-   Do not log raw session tokens, invitation tokens, passwords, or
    secrets.
-   Follow the specified opaque session-token and hashed-storage design.
    Do not substitute JWTs or cookies without an explicit decision.

## 7. Database and transaction rules

-   Treat database constraints as part of the domain's integrity design,
    not optional duplication.
-   Use transactions for operations that the specifications require to
    be atomic.
-   Keep transactions short and bounded.
-   Never perform email delivery or other network I/O inside a database
    transaction.
-   Use conditional updates for OCC where specified; a read-then-write
    check alone is not sufficient.
-   Use explicit row/advisory locks for the invariants that require
    them.
-   Follow the global lock order in
    `phase-0.3-database-specification.md`.
-   Acquire multiple locks at the same level in primary-key order.
-   Handle expected unique-constraint and concurrency conflicts
    deliberately.
-   Do not catch and suppress database errors without preserving correct
    behavior and observability.
-   Use parameterized SQL for raw queries. Never interpolate untrusted
    input into SQL strings.
-   Use Prisma for supported operations and custom SQL migrations where
    the specification requires database features Prisma cannot
    represent.
-   Do not use `prisma db push` as a production migration mechanism.

## 8. Domain behavior and side effects

-   Keep domain rules independent of Express request/response objects.
-   Do not duplicate the same business rule inconsistently across
    controllers and services.
-   Make state transitions explicit and reject invalid transitions.
-   Preserve soft-delete/archive semantics; do not replace them with
    physical deletion.
-   Write required Activity records in the same transaction as their
    business mutation.
-   Create Notifications according to the specified event and recipient
    rules.
-   Use the Outbox for invitation email delivery.
-   Design Outbox processing for at-least-once delivery and duplicate
    processing.
-   Do not invent behavior for unresolved features such as mention
    parsing.

## 9. Error handling and logging

-   Use the project's centralized error-handling conventions.
-   Return stable, documented error codes and safe messages.
-   Log unexpected failures with useful structured context, but exclude
    secrets and sensitive payloads.
-   Prefer structured Pino logging over ad hoc `console.log` in
    application code.
-   Include correlation/request context where the existing
    implementation supports it.
-   Do not log full request bodies by default.
-   A handled business error should not be logged as an unexpected
    server failure unless there is a specific operational reason.

## 10. Testing rules

Tests should verify behavior and invariants, not merely mirror
implementation details.

-   Unit tests: isolated domain logic and deterministic rules.
-   Integration tests: persistence, constraints, transactions, and
    database behavior.
-   HTTP/API tests: routing, validation, authentication, authorization,
    status codes, and response contracts.
-   End-to-end tests: critical user workflows across relevant
    boundaries.
-   Add negative tests for unauthorized access, cross-tenant access,
    invalid transitions, and invalid states.
-   Add concurrency tests for race-sensitive invariants where
    appropriate.
-   Use a real PostgreSQL test database for behavior that depends on
    PostgreSQL constraints, locks, isolation, or SQL semantics.
-   Keep tests deterministic and independent. Clean up test data safely.
-   Do not weaken or delete a failing test merely to make CI green.
    Diagnose the cause.
-   Do not mock the behavior that the test is intended to verify.

## 11. Security and data handling

-   Never commit secrets or include them in generated documentation.
-   Store only the credential/token representations specified by the
    design.
-   Use the specified password hashing and invitation-token encryption
    mechanisms.
-   Avoid leaking whether another tenant owns a resource.
-   Validate and normalize identifiers and user input according to the
    API contract.
-   Apply least privilege to database roles and application permissions.
-   Avoid collecting or retaining data beyond the specified product
    behavior.
-   Treat logs, fixtures, seeds, and test snapshots as potential
    data-leak paths.

## 12. Documentation and decision management

-   Update the authoritative specification when an approved behavior or
    design decision changes.
-   Update OpenAPI documentation when the API contract changes.
-   Update migrations and database documentation together when schema
    behavior changes.
-   Record important trade-offs and rejected alternatives when they
    affect future implementation.
-   Keep agent-facing documents concise; link to the source of truth
    instead of copying entire specifications.
-   Mark unresolved items explicitly. Do not present recommendations as
    accepted decisions.

## 13. Required task report

For a completed implementation task, report:

1.  **What changed:** files/modules and behavior implemented.
2.  **Design decisions:** important choices made and their rationale.
3.  **Tests:** commands run and actual pass/fail results.
4.  **Risks or gaps:** known limitations, unresolved specifications, and
    deferred work.
5.  **Documentation:** specifications or API docs updated.

If implementation was not completed, state what remains and why. Never
imply completion through vague wording.

------------------------------------------------------------------------

**Rule:** An agent may accelerate implementation, but it does not own
product decisions. Make changes traceable, testable, and consistent with
the approved specifications.
