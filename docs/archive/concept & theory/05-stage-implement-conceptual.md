# Stage 05 --- Implement: Conceptual Overview

  -----------------------------------------------------------------------
  Field                               Value
  ----------------------------------- -----------------------------------
  Project                             Multi-Tenant Project Management API

  Workflow Stage                      05 --- Implement

  Document Type                       Conceptual Learning Guide

  Version                             1.0

  Status                              Learning Reference

  Related Stages                      01 --- Understand, 02 --- Specify,
                                      03 --- Design, 04 --- Plan, 06 ---
                                      Verify, 07 --- Review, 08 ---
                                      Integrate
  -----------------------------------------------------------------------

## 1. Purpose

Stage 05 --- Implement turns the approved requirements, technical
design, and implementation plan into working software.

Implementation is not simply writing code. It is the disciplined process
of translating decisions into executable behavior while preserving
correctness, security, maintainability, and the intended system
architecture.

The central question is:

**How do we build the designed system in a controlled way, while
continuously checking that the implementation still matches the
requirements and design?**

Implementation includes coding, configuring, integrating libraries,
creating database migrations, handling errors, writing tests, reviewing
changes, and adapting design decisions when real implementation reveals
new information.

## 2. Inputs and Outputs

### Inputs

Implementation draws on the outputs of earlier stages: - Stage 01:
problem understanding, domain concepts, workflows, constraints. - Stage
02: functional and non-functional requirements, business rules,
acceptance criteria. - Stage 03: architecture, data model, API
contracts, security decisions, ADRs. - Stage 04: scope, work breakdown,
dependencies, milestones, risks, Definition of Done.

These inputs guide implementation. They are not immutable scripture: if
implementation reveals a contradiction or missing requirement, the issue
should be raised and resolved through an explicit change.

### Outputs

Typical outputs include: - Source code. - Database schema and versioned
migrations. - API endpoints and contracts. - Automated tests. -
Configuration and build artifacts. - Updated technical documentation. -
Code review changes. - Integrated, potentially releasable increments. -
Recorded design decisions and known limitations.

The main output is working software whose behavior can be verified.

## 3. Implementation Is More Than Coding

A feature commonly passes through several connected activities:

1.  Understand the requirement and acceptance criteria.
2.  Review relevant design decisions and dependencies.
3.  Break the work into a small implementation task.
4.  Modify the appropriate code and data structures.
5.  Add or update automated tests.
6.  Run relevant local checks.
7.  Review correctness, security, and maintainability.
8.  Integrate the change with the rest of the system.
9.  Update documentation or decisions when needed.

The sequence may vary, and testing often happens during coding rather
than only after it. The important point is that implementation and
quality checks are interleaved.

## 4. Core Implementation Concerns

### 4.1 Translating requirements into behavior

A requirement describes a capability or constraint. Implementation gives
it concrete behavior.

Example requirement:

"An Issue assignee must be an active Membership in the same
Organization."

Implementation must translate this into multiple enforcement points: -
API input validation checks that the supplied identifier is
well-formed. - Application/domain logic checks whether the Membership is
eligible. - Database constraints prevent invalid cross-organization
relationships where feasible. - Tests verify both valid and invalid
assignment cases.

A single validation in an HTTP controller is not necessarily enough. The
correct enforcement layer depends on the invariant and the architecture.

### 4.2 Respecting architectural boundaries

Implementation should preserve the responsibilities and dependency
direction established during design.

For example: - HTTP layer handles transport concerns. - Application
layer coordinates use cases. - Domain logic enforces business rules. -
Persistence layer handles database interaction. - Infrastructure
provides external capabilities such as email delivery.

These are conceptual responsibilities, not a mandatory folder layout.
The architecture should make important dependencies explicit and prevent
unrelated concerns from becoming tangled.

### 4.3 Data and transaction correctness

Database code must preserve invariants under failure and concurrency.

Examples from this project: - Creating a business entity and its
Activity record must be atomic when the design requires it. - Issue
number allocation must remain unique under concurrent requests. -
Membership revocation and Issue unassignment must not leave inconsistent
state. - Invitation acceptance must respect status and expiry rules.

A transaction groups related database operations into one atomic unit.
It does not automatically solve every concurrency problem; isolation,
constraints, locking, and retry behavior still matter.

### 4.4 Error handling

Implementation must convert failures into predictable application and
API behavior.

Different failure categories should remain distinguishable: - Invalid
input. - Authentication failure. - Authorization denial. - Missing
resource. - Conflict or stale state. - Domain rule violation. -
Unexpected infrastructure or programming failure.

The global error handler is the final boundary for translating errors
into the established HTTP error contract. It should not hide failures
that need to be fixed, nor expose stack traces or secrets to clients.

### 4.5 Security during implementation

Security is not a final layer added after features work. It is part of
the implementation of each relevant use case.

Examples: - Verify authorization on every protected operation. - Scope
resource access to the active Organization. - Validate and bound
user-controlled input. - Avoid logging credentials or sensitive
tokens. - Use parameterized database operations. - Handle session
lifecycle and revocation correctly. - Apply rate limiting to appropriate
endpoints. - Avoid leaking cross-tenant resource existence where the API
contract requires concealment.

Security controls must be implemented at appropriate layers and verified
with negative tests, not merely documented.

### 4.6 Maintainability and readability

Code should make behavior and constraints understandable to future
maintainers, including the developer who returns to it months later.

Important concerns: - Clear names and cohesive responsibilities. -
Explicit dependencies. - Consistent error and response conventions. -
Small, understandable units of behavior. - Limited duplication without
premature abstraction. - Useful tests and documentation. - Avoiding
unnecessary complexity.

Maintainability does not mean maximizing abstraction or creating a layer
for every noun. It means making change reasonably safe and
understandable.

## 5. Implementation Workflow and Feedback Loops

Implementation is iterative.

A typical loop:

``` text
Select a small work item
        |
        v
Understand requirement and design
        |
        v
Implement a thin increment
        |
        v
Run tests and local checks
        |
        v
Review code and behavior
        |
        v
Integrate the change
        |
        v
Update decisions or plan if evidence requires it
        |
        +------> Select next work item
```

Verification and review are separate workflow stages, but their
activities occur throughout implementation. Stage 06 and Stage 07
provide deeper and more systematic treatment; they are not reasons to
postpone all testing and review until coding is finished.

## 6. Vertical Slices and Incremental Delivery

A vertical slice delivers a small end-to-end capability through the
relevant system layers.

Example: Create Organization: - Define the route and request/response
behavior. - Authenticate the actor. - Validate the input. - Execute the
use case. - Persist the Organization and initial Owner Membership. -
Commit the required transaction. - Return the agreed success response. -
Verify expected and failure behavior with tests.

A slice should produce observable behavior, not merely a collection of
unfinished layers.

Incremental delivery provides feedback earlier: - Does the API contract
work? - Does the data model support the use case? - Are authorization
rules enforceable? - Do the components integrate? - Are the tests
revealing missing requirements?

This feedback can expose incorrect assumptions before they spread across
the system.

## 7. Database Changes and Migrations

Schema changes are part of implementation and must be treated as
versioned changes.

A migration records how the database schema changes from one known state
to another.

Important principles: - Keep migrations in source control. - Review
generated migrations rather than blindly trusting them. - Test
migrations against realistic database states. - Consider existing data
and compatibility. - Avoid casually editing migrations that have already
been applied in shared environments. - Coordinate schema and application
changes when compatibility matters.

For production systems, expand-and-contract is a common strategy for
changes that must remain compatible while old and new application
versions coexist.

The exact deployment migration procedure belongs to later delivery
planning, but implementation must produce safe, reviewable migrations.

## 8. Configuration and Dependencies

Implementation also involves integrating libraries, runtime
configuration, and external services.

Principles: - Pin and manage dependencies through the package manager
and lockfile. - Understand the role and risk of each dependency. - Keep
secrets out of source control. - Validate required configuration at
startup. - Separate application configuration from environment-specific
values. - Avoid hidden dependencies on a developer's machine. - Make
builds reproducible.

A system that only works on one laptop is not yet a reliable software
deliverable.

## 9. Tests During Implementation

Tests should be written close to the behavior they protect.

Examples: - Unit tests for isolated domain behavior. - Integration tests
for database constraints and transactions. - API tests for HTTP
contracts, authentication, and authorization. - Concurrency tests for
operations with race conditions. - End-to-end tests for a small number
of critical user journeys.

Testing during implementation serves two purposes: 1. It checks whether
the code behaves as intended. 2. It gives fast feedback about design and
implementation mistakes.

Passing tests is evidence, not proof of the absence of defects. Test
quality depends on whether the cases meaningfully challenge the
behavior.

## 10. Code Review and Technical Decisions

Implementation changes should be reviewable.

A useful change: - Has a clear purpose. - Is small enough to
understand. - Includes relevant tests. - Does not introduce unrelated
modifications. - Explains non-obvious decisions. - Updates relevant
documentation.

When implementation reveals a meaningful design choice, record it where
appropriate, for example in an Architecture Decision Record (ADR).

Do not silently change an important business rule or architecture
decision inside an ordinary code change. Revisit the relevant
requirement or design decision explicitly.

## 11. Project-Specific Examples

### Example A: Registration and Login

Implementation concerns: - Input validation and password policy. -
Password hashing. - Account persistence. - Session token generation and
hash storage. - Expiry and revocation behavior. - Auth endpoint rate
limiting. - Generic, safe error responses. - Tests for invalid
credentials and session lifecycle.

### Example B: Create Issue

Implementation concerns: - Organization-scoped authorization. - Project
eligibility and archive state. - Issue number allocation under
concurrency. - Atomic persistence of Issue and Activity. - Assignee
Membership validation. - Pagination and response contract. - Tests for
cross-tenant access and concurrent creation.

### Example C: Accept Invitation

Implementation concerns: - Token verification. - Invitation status and
expiry. - Membership creation or reactivation. - Role assignment from
the invitation. - Atomic state changes. - Activity and notification
behavior. - Concurrent acceptance handling. - Tests for expired,
revoked, and already accepted invitations.

These examples show why implementation requires coordinated reasoning
across API, domain, database, security, and testing concerns.

## 12. Common Failure Modes

-   **Coding before understanding:** implementation solves the wrong
    problem.
-   **Controller-centric business logic:** domain rules become scattered
    and inconsistent.
-   **Trusting only application validation:** database invariants can
    still be violated by concurrency or alternate write paths.
-   **Testing only happy paths:** authorization, invalid transitions,
    and failure behavior remain untested.
-   **Deferring security:** insecure behavior becomes embedded in the
    architecture.
-   **Oversized changes:** review and debugging become difficult.
-   **Silent design drift:** implementation no longer matches approved
    decisions.
-   **Premature abstraction:** complexity is introduced before a real
    need exists.
-   **No migration discipline:** schema changes become difficult to
    reproduce or recover.
-   **Ignoring integration:** components work independently but fail
    together.
-   **Treating green CI as correctness proof:** checks pass, but
    important behavior may not be covered.
-   **Endless refactoring:** implementation progress is delayed by
    polishing without a concrete quality benefit.

## 13. What Stage 05 Does Not Mean

Stage 05 does not mean: - Writing all code before testing. -
Implementing every feature in one large batch. - Treating the design as
impossible to change. - Moving all security work to a final hardening
phase. - Assuming a successful local run means the feature is
complete. - Replacing review and verification with personal
confidence. - Optimizing every component before measuring it. -
Declaring the project production-ready merely because the API runs.

## 14. Relationship with Other Stages

### Stage 04 → Stage 05: Plan to Implement

The plan supplies scope, work breakdown, sequence, dependencies, risks,
and completion criteria.

### Stage 05 ↔ Stage 06: Implement and Verify

Implementation creates behavior; verification gathers evidence that the
behavior satisfies requirements. Testing is performed throughout
implementation, while Stage 06 defines the broader verification approach
and evidence.

### Stage 05 ↔ Stage 07: Implement and Review

Implementation creates changes; review evaluates their correctness,
design quality, security, and maintainability.

### Stage 05 → Stage 08: Implement to Integrate

Small changes are integrated into the shared codebase. Integration
validates compatibility across modules, database changes, contracts, and
build configuration.

### Stage 05 → Stage 09: Implement to Deploy

Implementation produces versioned source, migrations, configuration
expectations, and build artifacts that later become deployable releases.

## 15. Readiness for Starting Implementation

Before implementing a particular work item, confirm:

-   [ ] The requirement and acceptance criteria are understood.
-   [ ] Relevant design decisions are known.
-   [ ] Dependencies and prerequisites are available.
-   [ ] API and data contracts are sufficiently clear.
-   [ ] Security and authorization implications are understood.
-   [ ] Transaction and concurrency requirements are identified where
    relevant.
-   [ ] The work item is small enough to implement and review.
-   [ ] Verification cases are known.
-   [ ] Configuration and external dependencies are available.
-   [ ] Completion conditions are clear.

This is a work-item readiness check, not a demand that every future
feature be fully specified before the first line of code.

## 16. Key Principles

1.  Implementation translates requirements and design into working
    behavior.
2.  Coding is only one part of implementation.
3.  Build small, coherent, verifiable increments.
4.  Preserve domain invariants across application and database layers.
5.  Treat security as part of each relevant feature.
6.  Design transactions and concurrency behavior deliberately.
7.  Write tests during implementation, not only at the end.
8.  Keep changes reviewable and decisions explicit.
9.  Version database migrations and manage dependencies reproducibly.
10. Use feedback to correct requirements, design, and plans when
    necessary.
11. Green tests and CI are evidence, not proof of correctness.
12. Implementation should produce software that can be verified,
    reviewed, integrated, and eventually deployed.

------------------------------------------------------------------------

**Learning objective:** Understand implementation as a disciplined,
iterative engineering process that turns approved requirements, design,
and plans into working, testable, maintainable software.
