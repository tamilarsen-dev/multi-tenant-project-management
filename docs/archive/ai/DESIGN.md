# DESIGN.md

> Agent-facing design guide for the Multi-Tenant Project Management API.
>
> **Status:** Working reference. The detailed Phase 0 specifications
> remain authoritative. This file is an index and implementation
> guardrail, not a replacement for those specifications.

## 1. Purpose

Use this document to understand the system's important design
constraints before changing or implementing a feature.

Do not treat this file as permission to invent missing behavior. When
implementation reveals a gap or conflict, stop at the affected decision,
explain the impact, and request or record an explicit decision before
proceeding.

## 2. Design sources of truth

Read the relevant source documents before implementing a task:

  ---------------------------------------------------------------------------
  Source                                  Authority
  --------------------------------------- -----------------------------------
  `phase-0.1-domain-map.md`               Domain entities, relationships,
                                          business rules, lifecycle rules,
                                          and domain invariants

  `phase-0.2-api-specification.md`        HTTP endpoints, request/response
                                          contracts, validation, status
                                          codes, and API behavior

  `phase-0.3-database-specification.md`   Schema constraints, indexes,
                                          transactions, locking, concurrency,
                                          retention, and migration policy

  `phase-0.4-implementation-plan.md`      Slice order, dependencies,
                                          verification strategy, and
                                          Definition of Done

  `ARCHITECTURE.md`                       Intended system boundaries and
                                          architecture direction; some
                                          choices remain open

  `PRD.md`                                Product goals, V1 scope, actors,
                                          and out-of-scope capabilities
  ---------------------------------------------------------------------------

If sources disagree, do not silently choose one. Identify the
conflicting statements and their consequences. The detailed Phase 0
specifications govern their respective areas unless an explicit later
decision supersedes them.

## 3. System design at a glance

-   Product shape: multi-tenant project-management API.
-   V1 backend: Node.js, TypeScript, Express, PostgreSQL, Prisma, and
    Zod.
-   Deployment shape: intended as a modular monolith; confirm the
    architecture direction in `ARCHITECTURE.md` before treating the
    proposed internal layering as final.
-   Tenancy: an Organization is the tenant boundary. A user's access is
    mediated by an active Membership.
-   Primary workflow: authenticated user creates an Organization,
    creates Projects, and manages Issues within those Projects.
-   Collaboration: Comments, Activities, and in-app Notifications record
    and communicate relevant changes.
-   Invitation delivery: transactional Outbox with bounded retries.

The V1 is a portfolio implementation baseline, not a claim of production
operation or customer validation.

## 4. Core domain relationships

The main domain entities are:

-   Identity and access: `User`, `Session`, `Organization`,
    `Membership`, `Invitation`.
-   Work management: `Project`, `Issue`.
-   Collaboration: `Comment`, `Activity`, `Notification`.
-   Asynchronous delivery: `OutboxEvent`.

Important relationship constraints:

1.  A User may belong to multiple Organizations through Membership
    records.
2.  A Membership is scoped to one Organization and one User. A removed
    Membership is retained rather than deleted.
3.  An Issue belongs to a Project and an Organization. The database must
    enforce that the Issue's Project belongs to the same Organization.
4.  An Issue assignee is a Membership in the same Organization, not a
    globally scoped User reference.
5.  Activity is organization-scoped. It may reference an actor and an
    Issue; Project or Membership context belongs in metadata where
    appropriate.
6.  Notification is recipient-scoped and retains a snapshot of its
    display content.

Consult the Domain Map and Database Specification for exact fields,
cardinalities, and constraints.

## 5. High-risk invariants

These rules are easy to break through apparently harmless endpoint or
schema changes. Preserve them across application logic, persistence, and
tests.

### 5.1 Tenant isolation

-   Every tenant-owned read and mutation must be scoped to the requested
    Organization and the caller's active Membership.
-   Do not trust an `organizationId`, `projectId`, `issueId`, or
    `membershipId` merely because it was supplied by the client.
-   Enforce same-Organization relationships with composite foreign keys
    where specified, not only application checks.
-   Cross-tenant access and lack of active Membership resolve as `404`;
    an active member lacking permission receives `403`, per the API
    contract.

### 5.2 Membership and Owner safety

-   Roles are `OWNER`, `ADMIN`, and `MEMBER`.
-   A Member cannot invite. An Owner may invite Admin or Member; an
    Admin may invite Member only.
-   The last active Owner cannot be removed or demoted.
-   Organization-level locking protects the last-Owner invariant.
-   Membership revocation is a soft state transition to `REMOVED`; it
    retains the row and unassigns that Membership's Issues atomically.
-   Re-invitation reactivates the existing Membership record under the
    specified rules.

### 5.3 Invitation lifecycle

-   Invitation states: `PENDING`, `ACCEPTED`, `REVOKED`, `EXPIRED`.
-   `expires_at` is authoritative. Acceptance must reject an expired
    invitation even if a worker has not yet updated its state.
-   Only one active pending Invitation for the same Organization and
    normalized email is allowed.
-   Use the specified partial unique index and transaction/advisory-lock
    strategy. Do not attempt a partial unique index based on `now()`.
-   Invitation token material is stored as a hash for lookup; the Outbox
    payload carries encrypted token material for delivery.
-   Resend reuses the token and does not extend expiry; enforce the
    cooldown.
-   Email delivery failure does not invalidate a still-valid Invitation.

### 5.4 Project and Issue integrity

-   All active Organization roles may create Projects and manage
    accessible Issues, subject to the specified rules.
-   Issue numbering is per Project and must be allocated atomically.
-   An Issue's Project and Organization must match.
-   An Issue assignee must be an eligible Membership in the same
    Organization.
-   Status changes must follow the explicit transition graph in the
    Domain Map. Do not replace it with arbitrary enum assignment.
-   An archived Project cannot accept new Issues or allow Issue
    modifications. Project archival does not automatically archive its
    Issues.

### 5.5 Comments, Activities, and Notifications

-   Comments cannot be created or updated when the Issue or Project is
    archived.
-   Comment deletion is soft deletion; preserve the required
    placeholder/history behavior.
-   Activity is append-only and records meaningful business changes, not
    reads.
-   A business mutation and its corresponding Activity record must
    commit atomically.
-   Notification creation associated with a mutation must follow the
    specified transaction boundary.
-   Do not put Comment body text or secrets in Activity metadata.
-   Historical personal Notifications remain readable after Membership
    removal, as specified.

### 5.6 Concurrency and consistency

-   Use optimistic concurrency control (OCC) through conditional version
    updates where required.

-   Use explicit row/advisory locks for invariants that cannot be
    protected by a simple version check.

-   Follow the global lock order from the Database Specification:

    `Organization → Invitation advisory lock (when relevant) → Membership → Project → Issue → Comment`

-   For multiple rows at the same lock level, acquire locks in
    primary-key order.

-   Do not acquire a lower-level lock and then attempt to acquire a
    higher-level lock.

-   Keep transactions bounded. Do not perform network calls, such as
    sending email, inside database transactions.

### 5.7 Outbox delivery

-   Invitation email delivery uses the transactional Outbox.
-   Delivery is at-least-once; handlers must tolerate retries and
    duplicate processing.
-   There are four total attempts: initial attempt plus up to three
    transient retries at 1, 5, and 15 minutes.
-   Use lease-based claiming and expired-lease recovery.
-   Permanent failures are not retried.
-   Do not mark an Invitation invalid merely because email delivery
    failed.

## 6. API design conventions

The API Specification is authoritative. Key conventions include:

-   Base path: `/api/v1`.
-   Authentication: opaque Bearer session token backed by the database.
-   Success responses use the specified `data` envelope.
-   Errors use `{ "error": { "code": "...", "message": "..." } }`.
-   Validation failures: `400`.
-   Cross-tenant or no active Membership: `404`.
-   Active Membership without permission: `403`.
-   Stale version: `409`.
-   Invalid domain transition: `422`.
-   Cursor pagination defaults to 20 and has a maximum page size of 100.

Do not add endpoints, response fields, or alternate error conventions
without updating the API Specification and recording the decision.

## 7. Persistence and migration conventions

-   PostgreSQL is the integrity boundary for relational constraints and
    concurrency-sensitive invariants.
-   Prisma Migrate is the migration authority.
-   Use Prisma schema for supported schema constructs and custom SQL
    migrations for constraints/indexes Prisma cannot represent
    adequately.
-   Use forward-only migrations. Production uses
    `prisma migrate deploy`; do not use `db push` as a production
    migration strategy.
-   Keep database roles separated by runtime, migrator, and
    administrative responsibilities as specified.
-   Use application-generated UUID v4 identifiers.
-   Store timestamps in UTC using the specified `TIMESTAMPTZ(3)`
    convention.
-   Avoid adding indexes speculatively. Tie new indexes to query
    patterns and evidence.
-   Do not use destructive schema changes without the specified
    expand-and-contract approach.

Before writing Prisma code, inspect the actual installed Prisma CLI,
Client, adapter, and PostgreSQL driver versions and the repository's
existing configuration. Do not assume examples for another Prisma major
version apply unchanged.

## 8. Implementation guidance for agents

For each task:

1.  Read the relevant Domain Map rules.
2.  Read the relevant API contract, if the task touches HTTP behavior.
3.  Read the relevant Database Specification decisions, especially
    constraints, transactions, and lock order.
4.  Check the implementation plan for dependencies and Definition of
    Done.
5.  Inspect the existing repository and follow established conventions.
6.  Identify the transaction boundary and the invariants that must
    remain true.
7.  Implement the smallest coherent vertical slice.
8.  Add tests at the appropriate levels, including negative and
    concurrency cases where risk warrants them.
9.  Update API documentation and design documents when behavior or
    decisions change.
10. Run typecheck, lint, tests, and the relevant CI checks before
    integration.

Do not create abstractions merely because a pattern appears in a
diagram. Introduce interfaces, repositories, module contracts, or
generic frameworks when an actual use case justifies them.

## 9. Known gaps and items requiring explicit review

These items are not permission to make assumptions. Resolve them when
the relevant implementation work reaches them.

  -----------------------------------------------------------------------
  Item                    Current state           Required handling
  ----------------------- ----------------------- -----------------------
  Activity schema timing  The initial migration   Reconcile migration
                          sequence places         dependencies before
                          Activities in `M006`,   implementing Create
                          but Create Organization Organization. A minimal
                          is specified to create  earlier Activity schema
                          an Activity atomically. or a revised
                                                  slice/migration
                                                  sequence may be needed.
                                                  Record the decision.

  Mention behavior        Mention exists in       Do not invent mention
                          notification rules, but parsing or silently add
                          parsing syntax and      an endpoint. Clarify
                          API-level behavior are  the contract before
                          not fully specified.    implementing mention
                                                  notifications.

  Architecture option     Modular Monolith +      Treat it as a proposal
                          Pragmatic Clean         until confirmed. Avoid
                          Architecture is         irreversible
                          recommended in          folder/interface
                          `ARCHITECTURE.md`, but  decisions based only on
                          not yet explicitly      the recommendation.
                          confirmed.              

  Concrete module layout  The repository's actual Adapt the illustrative
                          structure and module    structure to the real
                          boundaries still need   repository; do not
                          inspection.             assume it already
                                                  exists.

  Prisma adapter behavior The project uses a      Verify transaction, raw
                          version-specific Prisma SQL, and
                          adapter setup.          connection-pool
                                                  behavior against the
                                                  installed versions and
                                                  actual code.

  Cross-module contracts  Public module           Define them only when a
                          interfaces have not     real cross-module use
                          been fully formalized.  case requires them;
                                                  document the boundary
                                                  and decision.
  -----------------------------------------------------------------------

If another contradiction appears, add it here or to the relevant
decision log rather than hiding it in implementation code.

## 10. Change control

When a design decision changes:

1.  State the existing decision and the proposed change.
2.  Explain the reason and affected invariants, API behavior, schema,
    migrations, tests, and documentation.
3.  Identify all source documents that need updates.
4.  Update the authoritative specification first.
5.  Update this guide only as a concise summary or pointer.
6.  Do not leave conflicting versions of the same rule in multiple
    documents.

## 11. Agent completion checklist

Before considering a design-sensitive task complete:

-   [ ] Tenant boundaries are enforced in queries and relational
    constraints.
-   [ ] Authorization follows the Domain Map and API Specification.
-   [ ] Transaction boundaries preserve the required atomicity.
-   [ ] Lock acquisition follows the global lock order.
-   [ ] OCC and uniqueness constraints cover the relevant race
    conditions.
-   [ ] Error and response behavior matches the API contract.
-   [ ] Tests cover success, failure, authorization, and relevant
    concurrency paths.
-   [ ] Migrations are forward-only and match the actual
    Prisma/PostgreSQL versions.
-   [ ] Documentation and unresolved decisions are updated.
-   [ ] No unapproved product or architecture behavior was introduced.

------------------------------------------------------------------------

**Rule:** When in doubt, preserve the explicit specification, expose the
ambiguity, and do not let an implementation detail quietly become a
product decision.
