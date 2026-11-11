# Stage 03 --- Design: Conceptual Overview

  -----------------------------------------------------------------------
  Field                               Value
  ----------------------------------- -----------------------------------
  Project                             Multi-Tenant Project Management API

  Workflow Stage                      03 --- Design

  Document Type                       Conceptual Learning Guide

  Version                             1.0

  Status                              Learning Reference

  Related Stages                      01 --- Understand, 02 --- Specify,
                                      04 --- Plan, 05 --- Implement, 06
                                      --- Verify, 07 --- Review
  -----------------------------------------------------------------------

## 1. Purpose

Stage 03 --- Design develops a technical solution that can satisfy the
requirements established in Stage 02.

Stage 01 establishes the problem and domain context. Stage 02 defines
what the system must do and the constraints it must satisfy. Stage 03
determines how the system should be structured and how its important
responsibilities, data, interfaces, and interactions fit together.

Design is not merely drawing diagrams or choosing folder names. It is
the reasoning process through which engineering decisions are made,
alternatives are evaluated, trade-offs are understood, and constraints
are translated into a coherent technical solution.

A design should be detailed enough to guide implementation and review,
but it should not pretend that every low-level implementation detail
must be decided in advance.

## 2. The Core Question: How Should the System Satisfy Its Requirements?

Consider a requirement from the project:

"An Issue assignee must belong to the same Organization as the Issue."

This requirement states what must be true. Design must determine how to
preserve that invariant.

Possible design decisions include: - How Organization, Project, Issue,
and Membership relate. - Whether Issue stores an organization identifier
as well as a project identifier. - How the database enforces
same-organization relationships. - How the application validates
assignment operations. - How transactions protect changes. - How tests
will verify the invariant.

Design translates requirements into technical structure and mechanisms.

## 3. Main Design Areas

### 3.1 Domain design

Domain design represents the important concepts, relationships,
responsibilities, and rules of the problem domain.

It answers: - What are the core domain concepts? - What information and
behavior belong to each concept? - How are concepts related? - Which
invariants must always hold? - Which state transitions are valid? -
Which responsibilities belong to which domain concepts?

For the project, domain concepts include Organization, Membership,
Project, Issue, Invitation, Comment, Activity, and Notification.

Domain design should preserve the meaning established during Stage 01
and the rules specified during Stage 02.

### 3.2 Data design

Data design determines how information is represented, related,
constrained, and persisted.

It considers: - Entities and attributes. - Relationships and
cardinality. - Primary and foreign keys. - Unique and check
constraints. - Indexes. - Nullability. - Data lifecycle and retention. -
Transaction boundaries. - Concurrency and consistency.

For the project, data design includes how Issue relates to Project and
Organization, how Membership represents access, and how Invitation and
Activity state is stored.

A data model is not simply a list of tables. It is a representation of
domain rules and integrity requirements.

### 3.3 API and interface design

API design defines how external clients interact with the system.

It considers: - Resources and endpoint boundaries. - HTTP methods and
status codes. - Request and response schemas. - Authentication and
authorization behavior. - Error contracts. - Pagination and filtering. -
Idempotency where needed. - Compatibility and versioning.

The API contract should expose domain behavior without leaking
unnecessary internal implementation details.

### 3.4 Software architecture

Software architecture concerns the significant structures of a software
system, the responsibilities assigned to its components, their
dependencies, and the principles governing their interaction.

It considers: - System boundaries. - Modules and components. -
Dependency direction. - Data ownership. - Communication mechanisms. -
Cross-cutting concerns. - Quality attributes and architectural
trade-offs.

Architecture is not synonymous with folder structure. Folders may
reflect architectural boundaries, but a directory tree alone does not
explain responsibility, dependency, or runtime behavior.

### 3.5 Security design

Security design determines how trust boundaries and security
requirements are enforced.

For the project, this includes: - Authentication and session
lifecycle. - Authorization policy. - Tenant isolation. - Input
validation. - Secret handling. - Data exposure and error behavior. -
Abuse and concurrency considerations.

Security should be considered across API, application, database, and
operational boundaries rather than treated as a single middleware
feature.

### 3.6 Operational and reliability design

Design should consider how the system will be run and maintained.

Examples: - Logging and request correlation. - Health checks. - Database
connection management. - Background jobs and retries. - Failure
handling. - Deployment compatibility. - Backup and recovery needs. -
Observability requirements.

These concerns influence architecture and implementation. They should
not be postponed until the application is already difficult to operate.

## 4. Design Principles and Quality Attributes

A design is evaluated against both functional requirements and quality
attributes.

Relevant quality attributes include: - Security. - Reliability. -
Maintainability. - Performance. - Scalability. - Testability. -
Modifiability. - Operability. - Availability.

These qualities can conflict.

For example: - Stronger isolation may add query and transaction
complexity. - More abstraction may improve testability but make simple
behavior harder to follow. - Caching may reduce read latency but
introduce invalidation and consistency problems. - More services may
allow independent scaling but increase network and operational
complexity.

Design requires explicit trade-offs. There is rarely one structure that
optimizes every quality attribute simultaneously.

## 5. Design Decisions and Trade-offs

A design decision should be based on: 1. The requirement or problem it
addresses. 2. Relevant constraints. 3. Alternatives considered. 4.
Benefits and costs of each alternative. 5. Risks and failure modes. 6.
The reason the selected approach is appropriate.

Example: authentication session design.

Possible approaches include: - Server-side opaque sessions. -
Self-contained signed tokens such as JWTs. - Cookie-based sessions with
server-side state.

The decision affects revocation, storage, client behavior, operational
complexity, and security.

For this project, the approved design uses opaque random session tokens
with only a hash stored in the database, a defined expiry, rotation, and
revocation behavior.

The point is not that one approach is universally best. The point is
that design decisions should be made against project requirements and
trade-offs.

## 6. Constraints, Invariants, and Mechanisms

A useful design distinguishes:

-   **Requirement:** what the system must satisfy.
-   **Invariant:** a condition that must remain true across valid system
    states.
-   **Mechanism:** the technical means used to preserve the invariant.

Example:

  -----------------------------------------------------------------------
  Type                                Example
  ----------------------------------- -----------------------------------
  Requirement                         Issue assignee must belong to the
                                      same Organization.

  Invariant                           An Issue cannot reference a
                                      Membership from another
                                      Organization.

  Database mechanism                  Composite foreign key involving
                                      organization and membership
                                      identifiers.

  Application mechanism               Validate assignment permission and
                                      resource context.

  Verification mechanism              Attempt cross-organization
                                      assignment and assert rejection.
  -----------------------------------------------------------------------

Important invariants should not depend on one fragile check if they can
be reinforced at multiple appropriate boundaries.

The database can enforce structural integrity; application logic can
enforce business authorization and workflow rules. These mechanisms
complement one another.

## 7. Modeling Techniques and Design Artifacts

Different models reveal different aspects of a system.

### 7.1 Domain model

Describes important domain concepts, relationships, and behavior.

### 7.2 Entity Relationship Diagram (ERD)

Describes data entities, relationships, keys, and cardinality.

Conceptual ERD focuses on domain-level entities and relationships.
Logical ERD adds more precise attributes, keys, and constraints without
necessarily committing to every database-specific implementation detail.

### 7.3 API contract

Describes externally visible API behavior, including operations,
schemas, status codes, and error responses.

### 7.4 Permission matrix

Maps actors or roles to actions and resources. It makes authorization
rules explicit and helps reveal missing or contradictory permissions.

### 7.5 State-transition model

Describes valid states and transitions for entities such as Issues,
Invitations, and Memberships.

### 7.6 Sequence or interaction diagram

Shows how components or actors interact over time for a specific
workflow.

### 7.7 Architecture diagrams

Show system context, containers, components, dependencies, or deployment
structures depending on the level of detail.

A diagram is useful when it answers a specific question. Producing
diagrams without a decision or communication purpose adds documentation
without necessarily adding understanding.

## 8. Architecture Is More Than Folder Structure

A common misconception is that software architecture means deciding
whether to use folders named `controllers`, `services`, `repositories`,
or `modules`.

Those are organizational choices. Architecture is concerned with deeper
questions:

-   Which components own which responsibilities?
-   Which components are allowed to depend on which others?
-   Where does business logic live?
-   Who controls data access?
-   How do components communicate?
-   What happens when a dependency fails?
-   Which parts can change independently?
-   What quality attributes does the structure support or compromise?

A folder structure can express an architecture, but it cannot establish
one by itself.

## 9. Typical Design Activities

Stage 03 commonly involves:

1.  Translating requirements into design constraints.
2.  Refining the domain model.
3.  Defining entity relationships and data integrity.
4.  Designing API contracts.
5.  Defining authorization and security boundaries.
6.  Establishing module and component responsibilities.
7.  Defining transaction and consistency behavior.
8.  Considering concurrency and failure modes.
9.  Evaluating quality attributes and trade-offs.
10. Reviewing the design for consistency and completeness.
11. Recording important decisions and unresolved risks.

Design is iterative. A discovered conflict may require clarification in
Stage 02 or a change to the scope.

## 10. Typical Artifacts

Possible design artifacts include: - Domain model. - Conceptual and
logical ERDs. - Database design specification. - API contract. -
Permission matrix. - State-transition definitions. - Architecture
diagrams. - Component and dependency descriptions. - Security design. -
Transaction and concurrency rules. - Architecture Decision Records
(ADRs). - Design review findings.

For this project, Stage 03 includes the domain specification, permission
matrix, ERD, API contract, PostgreSQL database design, and final design
review.

The purpose of these artifacts is to make the solution understandable,
reviewable, and implementable.

## 11. Architecture Decision Records

An Architecture Decision Record (ADR) captures a significant technical
decision and its reasoning.

A lightweight ADR commonly includes: - Title. - Status. - Context. -
Decision. - Alternatives considered. - Consequences.

Examples of decisions that may deserve an ADR: - Session-based
authentication versus JWT. - Modular monolith versus distributed
services. - Database-enforced tenant relationships. - Transactional
outbox for reliable event delivery.

Not every small coding choice needs an ADR. Record decisions whose
consequences are significant, difficult to reverse, or likely to be
questioned later.

## 12. What Stage 03 Does Not Do

Stage 03 does not need to: - Write the complete application. - Decide
every variable name or function signature. - Create every folder before
implementation. - Optimize every query without workload evidence. -
Predict exact production capacity without measurements. - Resolve every
future architectural question.

Design should provide enough structure to implement safely while leaving
low-risk details to implementation.

Over-design is also a failure mode. A design should be proportionate to
the current scope, risks, and expected evolution.

## 13. Relationship with the Next Stages

### Stage 03 → Stage 04: Design to Plan

Design identifies components, dependencies, constraints, and risks.
Planning uses these to sequence work, identify milestones, and prepare
implementation.

### Stage 03 → Stage 05: Design to Implement

Implementation realizes the design in code. The design is a guide and
reference, not a substitute for engineering judgment.

### Stage 03 → Stage 06: Design to Verify

Invariants, state transitions, data constraints, and API contracts
become sources for verification cases.

### Stage 03 → Stage 07: Design to Review

Review evaluates whether the implementation respects the intended design
and whether the design remains appropriate.

Design feedback may reveal that the original solution needs to change.

## 14. Common Failure Modes

-   **Premature architecture:** choosing complex structures before
    requirements justify them.
-   **Diagram-driven design:** producing diagrams without resolving real
    questions.
-   **Database-first modeling:** designing tables without understanding
    domain meaning.
-   **Happy-path-only design:** ignoring concurrency, invalid
    transitions, and failure behavior.
-   **Application-only integrity:** relying on application checks where
    database constraints can protect important invariants.
-   **Over-abstraction:** introducing layers and patterns without a
    clear benefit.
-   **Under-specified boundaries:** leaving module ownership and
    dependency direction unclear.
-   **Unrecorded decisions:** important trade-offs exist only in
    someone's memory.
-   **Silent design drift:** implementation changes the design without
    updating its authoritative documentation.
-   **False precision:** deciding performance or capacity targets
    without workload evidence.

## 15. Readiness Questions

Before moving from design to planning, the team should be able to
answer:

-   [ ] Does the design address the specified requirements?
-   [ ] Are the domain model and important invariants clear?
-   [ ] Are data relationships and integrity constraints defined?
-   [ ] Are API contracts and error semantics sufficiently specified?
-   [ ] Are authorization and tenant-isolation mechanisms clear?
-   [ ] Are component responsibilities and dependency boundaries
    understood?
-   [ ] Are transaction, concurrency, and failure behaviors considered?
-   [ ] Are important quality-attribute trade-offs understood?
-   [ ] Are significant decisions and unresolved risks recorded?
-   [ ] Can the design be implemented and verified without guessing
    about critical behavior?

Not every low-level detail must be settled. The goal is to remove
ambiguity around high-impact decisions before work is sequenced.

## 16. Key Principles

1.  Design translates requirements into a coherent technical solution.
2.  Architecture concerns responsibilities, boundaries, dependencies,
    and trade-offs, not just folder structure.
3.  Domain, data, API, security, and operational design are related but
    distinct views.
4.  Important invariants should be enforced at appropriate boundaries.
5.  Design decisions should explain context, alternatives, and
    consequences.
6.  Quality attributes can conflict; trade-offs must be understood.
7.  Models and diagrams should answer concrete questions.
8.  Avoid both under-design and speculative over-design.
9.  Design is iterative and may require revisiting requirements.
10. A good design guides implementation without pretending to prescribe
    every line of code.

------------------------------------------------------------------------

**Learning objective:** Be able to explain how requirements are
translated into domain, data, API, security, and architectural
structures, and how engineering trade-offs are evaluated and recorded.
