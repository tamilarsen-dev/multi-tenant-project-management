# Phase 0.4 — Implementation Plan

**Version:** 1.1  
**Status:** Approved planning baseline  
**Date:** 2026-11-09  
**Supersedes:** Phase 0.4 Implementation Plan V1.0 for implementation planning  
**Related authority:** PRD V1.2, Requirements Specification V1.2, Domain Map V1.2, Permissions Specification V1.1, Database Specification V1.3, Cross-Document Consistency Review V1.1, ADR-001, `architecture.md`

---

## 1. Purpose and status

This document turns the accepted product, domain, database, permission, and architecture decisions into an ordered implementation plan. It defines work packages, dependencies, acceptance criteria, migration sequencing, and verification expectations.

This is a planning artifact. A task marked planned or ready is not evidence that its implementation exists or has passed tests.

### 1.1 Authority and conflict resolution

Use the latest accepted versions listed above as the source of truth. Older planning documents and earlier database drafts are historical references only.

If an implementation detail conflicts with an accepted specification or ADR:
1. Stop the affected task.
2. Record the discrepancy.
3. Resolve it in the owning specification or an ADR.
4. Update this plan before proceeding.

Do not silently change product or domain policy inside implementation code.

### 1.2 V1.1 change log

V1.1 updates the V1.0 plan to align it with ADR-001 and the accepted V1 specifications:

- Replaces generic layered architecture language with the Presentation / Application / Domain / Infrastructure boundaries in ADR-001.
- Makes module ownership and transaction coordination explicit.
- Clarifies Prisma lifecycle, repository adapters, and transaction boundaries.
- Adds monorepo-aware foundation and CI expectations.
- Moves the minimum Activity capability to the earliest migration/use case that requires it.
- Adds Issue Label lifecycle and restore-collision work.
- Replaces obsolete 90-day Notification cleanup with state-dependent retention.
- Defines metadata-only Comment tombstones.
- Aligns Outbox retries and Invitation resend quota semantics with Database Specification V1.3.
- Marks performance workload and backup/recovery objectives as open decisions, not validated requirements.

---

## 2. Product and technical baseline

### 2.1 V1 product scope

V1 modules:
- Identity and authentication
- Organizations and memberships
- Invitations
- Projects
- Issues and Labels
- Comments and Activity
- Notifications
- Outbox-based invitation email delivery

Organization is the tenant boundary. A User may belong to multiple Organizations and have a different role in each.

Organization roles:
- `OWNER`
- `ADMIN`
- `MEMBER`

No `GUEST` role in V1.

### 2.2 Stack baseline

- Node.js 24
- TypeScript
- Express 5
- PostgreSQL 18
- Prisma 7
- Zod
- Vitest
- Supertest
- Pino
- pnpm workspace monorepo
- Docker Compose
- GitHub Actions
- Single VPS deployment target

The repository currently uses a workspace layout with `apps/api` and `apps/web`. Verify actual package scripts, dependency versions, and CI configuration before relying on them. Do not assume a tool is configured merely because it appears in this plan.

### 2.3 Architecture baseline

ADR-001 is Accepted. The API is a modular monolith using Pragmatic Clean Architecture.

Dependency direction:

- **Presentation:** HTTP routes, controllers/handlers, request parsing, response mapping.
- **Application:** use cases, orchestration, authorization coordination, transaction coordination, and application-level ports.
- **Domain:** business rules, entities/value objects, domain policies. Must not depend on Express or Prisma.
- **Infrastructure:** Prisma implementations, database access, external providers, Outbox worker, logging and other technical adapters.

Rules:
- Domain must not import Express, Prisma, or infrastructure modules.
- Presentation calls Application; it does not implement business policy.
- Infrastructure implements ports required by Application.
- The composition root wires concrete implementations.
- Application use cases own transaction boundaries when a workflow must be atomic.
- Prisma transaction types must not leak into Domain. Keep any Prisma-specific transaction adapter inside Infrastructure.
- A cross-module use case may coordinate multiple modules within one database transaction. This does not justify bypassing module ownership.
- PostgreSQL is the source of truth. Database constraints enforce critical integrity invariants.
- Migrations are forward-only. No automatic destructive rollback strategy is assumed.

### 2.4 Explicit V1 non-goals

Do not introduce these unless a later decision justifies them:
- Microservices
- Kubernetes
- Multi-region deployment or high availability
- Redis
- Billing and subscriptions
- SSO
- Real-time collaboration
- Custom workflows or custom permission systems
- Watchers
- Semantic/global search
- Mobile application

---

## 3. Delivery strategy

Implement vertical slices in dependency order. Each slice should include the domain/application behavior, persistence, HTTP interface where applicable, tests, and documentation needed to make the slice verifiable.

Do not build a large generic framework before the first real use case. Shared abstractions should emerge from repeated requirements, not speculation.

### 3.1 Release sequence

| Phase | Scope | Exit condition |
|---|---|---|
| 0 | Foundation | Architecture conventions, database/test setup, error handling, validation, logging and CI checks are usable |
| 1 | Identity and Organization | Register, login, session lifecycle, create/read/update Organization |
| 2 | Membership and Invitation | Membership rules, invitation lifecycle, email Outbox processing |
| 3 | Projects | Organization-scoped project lifecycle |
| 4 | Issues and Labels | Issue lifecycle, assignment, status/priority, labels, concurrency rules |
| 5 | Collaboration | Comments, Activity, Notifications and retention |
| 6 | Hardening and Release | Security, operational readiness, deployment, backup/restore verification |

**First end-to-end target:** Register → Login → Create Organization.

### 3.2 Definition of Done for each task

A task is complete only when:
- Behavior matches the accepted specifications.
- Authorization and tenant scoping are enforced server-side.
- Validation and error mapping are implemented.
- Relevant unit and integration tests pass.
- Database constraints support critical invariants.
- No secret, raw token, password, or sensitive payload is logged.
- API documentation is updated where the public contract changes.
- The change passes formatting, linting, type-checking, tests, and applicable CI checks.
- The code respects ADR-001 module and dependency boundaries.

---

## 4. Phase 0 — Foundation

### FND-01 — Establish module and layer conventions

**Work**
- Define the API module layout and naming conventions.
- Establish the four architecture boundaries: Presentation, Application, Domain, Infrastructure.
- Define module ownership and permitted cross-module interaction.
- Define where use cases, domain policies, ports, adapters, controllers, schemas, and DTOs live.
- Keep the composition root explicit.
- Add a short architecture note or example slice showing the conventions.

**Acceptance**
- A developer can identify the owner of a business rule and the layer where it belongs.
- Domain code imports no Express or Prisma packages.
- Presentation does not call Prisma directly.
- Cross-module dependencies are explicit and do not create circular imports.

### FND-02 — Application error model and HTTP error envelope

**Work**
- Define stable application error categories and codes.
- Map application errors to HTTP status codes in Presentation.
- Define one consistent error response envelope.
- Ensure unexpected errors do not expose stack traces or internal details in production.

**Acceptance**
- Validation, authentication, authorization, not-found, conflict, rate-limit, and unexpected errors have predictable mappings.
- Tests verify both status and response shape.
- Internal error details remain in server logs only where safe.

### FND-03 — Shared request validation

**Work**
- Establish Zod validation conventions for params, query, and body.
- Keep transport validation separate from domain invariants.
- Normalize validation failures into the common error envelope.

**Acceptance**
- Invalid requests fail before application use cases execute.
- Domain rules are still enforced in the Application/Domain layer and database where required.
- Validation schemas do not become a substitute for authorization.

### FND-04 — Prisma client lifecycle and persistence boundary

**Work**
- Create one managed Prisma client lifecycle for the API process.
- Keep Prisma access inside Infrastructure.
- Define repository/query adapters only where they represent meaningful persistence boundaries.
- Define how Application coordinates a transaction without exposing Prisma types to Domain.
- Define connection shutdown behavior for tests and application termination.

**Acceptance**
- No controller or Domain module imports Prisma.
- Application use cases can coordinate atomic operations through an infrastructure-provided transaction abstraction or adapter.
- Prisma-specific types remain in Infrastructure.
- Tests can create and dispose of database resources deterministically.

### FND-05 — Database migration and test database workflow

**Work**
- Configure a real PostgreSQL test database.
- Document local database startup and environment configuration.
- Verify migrations from an empty database.
- Verify the migration sequence against a database with the previous migration applied.
- Ensure tests isolate data and clean up reliably.
- Keep test setup independent from production data.

**Acceptance**
- A clean database can be migrated to the current schema using the documented command.
- Integration tests run against PostgreSQL, not SQLite or mocked persistence.
- Repeated test runs do not depend on leftover state.
- Migration failures are visible and fail CI.

### FND-06 — Test factories and request helpers

**Work**
- Add minimal factories/fixtures for Users, Organizations, Memberships, and later module entities as needed.
- Add authenticated request helpers for API integration tests.
- Keep fixtures explicit; avoid opaque global test state.

**Acceptance**
- Tests can express tenant and role scenarios clearly.
- Test data setup does not bypass the constraints being tested.
- Helpers do not hide the behavior under test.

### FND-07 — OpenAPI contract and CI validation

**Work**
- Establish the source of truth for the OpenAPI document.
- Keep API documentation aligned with actual route contracts.
- Add a CI validation step compatible with the pnpm workspace.
- Define how generated or maintained API documentation is updated.

**Acceptance**
- OpenAPI validation runs in CI from the repository root/workspace workflow.
- Invalid or inconsistent API documentation fails CI.
- The documented request, response, and error contracts match the implemented endpoints.

### FND-08 — Request ID, structured logging and safe context

**Work**
- Generate or accept a validated request ID.
- Include request ID in structured logs and error responses.
- Configure Pino with appropriate production serialization.
- Redact credentials, session tokens, invitation tokens, passwords, and sensitive payloads.

**Acceptance**
- A request can be traced through logs using its request ID.
- Secrets are not emitted in logs.
- Logging does not expose raw authentication or invitation material.

### Foundation exit gate

Before Phase 1:
- FND-01 through FND-08 are complete to the extent needed by the first vertical slice.
- The API starts locally.
- PostgreSQL is reachable.
- A clean migration run succeeds.
- A minimal integration test can execute against PostgreSQL.
- Type-check, lint, test, and build commands are documented and runnable.
- No Prisma schema or migration is considered complete until it is actually applied and tested.

---

## 5. Migration sequencing principles

Migrations follow dependency order and the earliest use case that needs the data. Do not postpone a table solely to preserve a broad thematic grouping if an earlier atomic use case depends on it.

Proposed sequence:

| Migration group | Expected contents | Dependency / timing |
|---|---|---|
| M001 | Users and Sessions | Required for registration, login and session lifecycle |
| M002 | Organizations and Memberships; minimum Activity capability if Organization creation writes Activity | Required for atomic Organization creation and Owner membership |
| M003 | Invitations and Outbox | Required for invitation lifecycle and durable email dispatch |
| M004 | Projects | Required for Project use cases |
| M005 | Issues and Labels | Required for Issue lifecycle and Label associations |
| M006 | Comments, remaining Activity extensions and Notifications | Required for collaboration and notification use cases |

The exact migration split may change to satisfy foreign-key dependencies and deployment safety. The invariant is that every use case must have its required schema before implementation is accepted. In particular, Organization creation writes its Activity record atomically, so the minimum Activity schema must exist by that point. Do not wait until the collaboration phase to introduce a table required by Phase 1.

Each migration must:
- Be forward-only.
- Preserve existing data.
- Add database constraints for critical invariants.
- Be tested from a clean database.
- Be reviewed for lock duration and destructive operations.
- Have a documented operational procedure where deployment ordering matters.

---

## 6. Phase 1 — Identity and Organization

### AUTH-01 — User registration

**Work**
- Validate registration input.
- Hash passwords using Argon2id.
- Create User and initial Session atomically.
- Return the intended authentication response without exposing password hash or raw stored token.

**Acceptance**
- Duplicate identity conflicts are handled consistently.
- Password is never stored in plaintext.
- User and Session are either both committed or neither is committed.

### AUTH-02 — Login

**Work**
- Verify credentials using the stored password hash.
- Create a new Session.
- Return the session credential according to the accepted authentication contract.

**Acceptance**
- Invalid credentials do not reveal whether the account exists.
- Session data is persisted securely.
- Sensitive values are not logged.

### AUTH-03 — Session validation / authentication middleware

**Work**
- Resolve the presented session credential to a valid Session.
- Reject expired, revoked, or otherwise invalid sessions.
- Attach authenticated identity to the request context.

**Acceptance**
- Authentication is performed before protected use cases execute.
- Expired and revoked sessions are rejected.
- Request identity cannot be supplied or overridden by untrusted request fields.

### AUTH-04 — Session refresh

**Work**
- Rotate session credentials atomically.
- Store only the token hash.
- Prevent replay of a previously rotated credential according to the accepted session policy.

**Acceptance**
- Concurrent refresh attempts cannot both successfully rotate the same session state.
- The raw token is not stored or logged.
- Session state remains consistent after failure.

### AUTH-05 — Logout current session

**Work**
- Revoke the authenticated current Session.

**Acceptance**
- The current credential becomes unusable.
- Logout is scoped to the authenticated session.
- Repeated logout behavior is deterministic.

### AUTH-06 — Session expiration and lifecycle

**Work**
- Apply the accepted seven-day session lifetime.
- Ensure expired sessions are rejected regardless of cleanup timing.
- Add cleanup only if required by the database/operational design.

**Acceptance**
- Authorization never relies solely on a periodic cleanup job to reject expired sessions.

### AUTH-07 — Authentication security tests

**Work**
- Test invalid credentials, expired sessions, revoked sessions, token rotation, replay, and concurrent refresh.
- Verify tenant identity is not inferred from client-controlled fields.

**Acceptance**
- Security-sensitive negative paths are covered by automated tests.

### AUTH-08 — Authentication API documentation

Document registration, login, authenticated session behavior, refresh, logout, error responses, and credential handling.

### ORG-01 — Create Organization

**Work**
- Require authenticated User.
- Validate Organization input.
- Create Organization, OWNER Membership, and initial Activity in one transaction.
- Ensure all three records commit or none do.

**Acceptance**
- Creator becomes OWNER.
- No partially created Organization or orphaned membership/activity is possible.
- Activity schema is available before this use case is implemented.

### ORG-02 — List Organizations for current User

**Work**
- Return only Organizations where the authenticated User has a Membership.
- Include role information only as permitted by the API contract.

**Acceptance**
- Organizations belonging only to other Users are never returned.
- Results are scoped by authenticated identity.

### ORG-03 — Read Organization

**Work**
- Read Organization through active Membership authorization.
- Hide inaccessible tenant resources using the accepted not-found behavior.

**Acceptance**
- Non-members cannot distinguish an inaccessible Organization from a nonexistent one where the specification requires 404.

### ORG-04 — Update Organization

**Work**
- Apply the accepted role policy.
- Validate mutable fields.
- Record Activity where required by the domain specification.

**Acceptance**
- Unauthorized roles cannot update the Organization.
- Updates are tenant-scoped and validated.

### ORG-05 — Organization security and transaction tests

Test membership isolation, role enforcement, atomic creation, and cross-tenant access attempts.

### DOC-01 — Identity and Organization API documentation

Document the endpoints, authentication requirements, role behavior, error responses, and tenant-hiding semantics.

**Phase 1 exit gate:** Register → Login → Create Organization → List/Read Organization works end-to-end with real PostgreSQL integration tests.

---

## 7. Phase 2 — Membership and Invitation

### MEM-01 — Read Organization members

Return members only to authorized Organization members and follow the accepted visibility rules.

### MEM-02 — Change member role

Enforce the role hierarchy and protect the last OWNER. A transition that would leave an Organization without an OWNER must fail atomically.

### MEM-03 — Remove member

Enforce role policy and last-OWNER protection. Ensure removal takes effect for subsequent authorization checks.

### MEM-04 — Leave Organization

Apply the accepted leave policy. Prevent the last OWNER from leaving while the Organization remains active unless an explicitly supported ownership-transfer flow is used.

### MEM-05 — Membership authorization and concurrency tests

Test role boundaries, tenant isolation, last-OWNER races, and concurrent membership changes.

### INV-01 — Create invitation

**Work**
- OWNER may invite ADMIN or MEMBER.
- ADMIN may invite MEMBER only.
- MEMBER cannot invite.
- Validate target identity and invitation eligibility.
- Persist invitation state and Outbox event atomically.

**Acceptance**
- Unauthorized invitations are rejected.
- Invitation and Outbox event cannot diverge due to partial commit.

### INV-02 — Generate and store invitation token

Store only a secure token hash. Return or deliver the raw token only through the intended invitation channel.

### INV-03 — Invitation email Outbox event

Persist an encrypted delivery payload or otherwise protect sensitive delivery material according to the accepted Database Specification. Do not perform provider I/O inside the database transaction.

### INV-04 — Outbox worker claim

Implement safe claiming/locking so multiple worker executions do not process the same event concurrently.

### INV-05 — Outbox delivery and retry policy

**Accepted policy**
- Eight total delivery attempts.
- Retry transient network errors and timeouts, plus HTTP 408, 429, and 5xx responses.
- Non-retryable 4xx responses fail immediately.
- Exponential backoff starts at one minute, doubles per retry, and is capped at 60 minutes.
- Apply ±20% jitter.
- Terminal records are retained for 30 days.

**Acceptance**
- Retry scheduling is deterministic under test when clock/randomness are controlled.
- Terminal failure is observable.
- Provider calls occur outside database transactions.
- Worker crashes do not silently lose committed Outbox events.

### INV-06 — Invitation resend cooldown

Apply a 60-second cooldown. A rejected cooldown request must not rotate the token, create an Outbox event, or consume resend quota.

### INV-07 — Invitation resend rolling quota

**Accepted policy**
- Maximum five successful resend operations in a rolling 24-hour window.
- A successful resend operation means the transaction that rotates the invitation token and creates its Outbox event commits.
- Provider delivery outcome does not affect whether the resend operation counts.
- Rejected requests do not consume quota.
- Initial invitation creation is not counted as a resend.

The database query/index strategy must follow Database Specification V1.3, including the partial index on invitation resend records.

### INV-08 — Accept invitation

**Work**
- Validate token hash and invitation state.
- Enforce expiry and single-use semantics.
- Create or connect the intended User and Membership according to the accepted identity flow.
- Mark invitation accepted atomically.

**Acceptance**
- Concurrent acceptance attempts cannot create duplicate memberships or accept the same invitation twice.
- Invalid, expired, revoked, or already-used invitations fail consistently.

### INV-09 — Revoke invitation

Enforce role policy and prevent subsequent acceptance.

### INV-10 — Invitation lifecycle and concurrency tests

Test create, resend cooldown, rolling quota, token rotation, acceptance races, revocation, and Outbox atomicity.

### INV-11 — Invitation API and operational documentation

Document invitation states, permissions, token behavior, resend semantics, and Outbox operations.

### DOC-02 — Membership and Invitation documentation

Update API and operational documentation.

**Phase 2 exit gate:** Membership and invitation workflows are tenant-safe, role-correct, transactionally consistent, and resilient to duplicate/concurrent requests.

---

## 8. Phase 3 — Project Management

### PRJ-01 — Create Project

Create a Project inside an Organization only for an authorized role. Record Activity if required.

### PRJ-02 — List Projects

Return only Projects belonging to the authorized Organization.

### PRJ-03 — Read Project

Enforce Organization membership and Project-to-Organization scoping.

### PRJ-04 — Update Project

Apply the accepted role and field mutation policy. Record Activity where specified.

### PRJ-05 — Archive Project

Apply the accepted archive semantics. Archived Projects must not appear in active listings.

### PRJ-06 — Restore Project

Apply the accepted restore policy and preserve tenant integrity.

### PRJ-07 — Project authorization and tenant tests

Test cross-Organization reads and mutations, role boundaries, and archived-resource behavior.

### PRJ-08 — Project API documentation

Document endpoints, authorization, lifecycle, and error behavior.

### DOC-03 — Project module documentation

Update module/domain documentation and relevant API examples.

**Phase 3 exit gate:** Project lifecycle is complete and isolated by Organization.

---

## 9. Phase 4 — Issue Management

### ISS-01 — Create Issue

Create an Issue within an authorized Project/Organization. Allocate the Issue number safely under concurrent creation.

### ISS-02 — List and filter Issues

Support only the filters and ordering included in V1 requirements. Ensure every query is scoped to the authorized Organization and Project.

### ISS-03 — Read Issue

Enforce tenant and Project scoping. Return the accepted not-found behavior for inaccessible resources.

### ISS-04 — Update Issue fields

Validate mutable fields and record Activity for the changes required by the domain specification.

### ISS-05 — Issue priority

Support exactly:
- `LOW`
- `MEDIUM`
- `HIGH`
- `URGENT`

Default priority is `MEDIUM`.

### ISS-06 — Assign and unassign Issue

Validate that the assignee is an eligible member of the same Organization. Enforce the accepted authorization policy.

### ISS-07 — Issue status transitions

Implement only the V1 status model and permitted transitions. Do not introduce configurable workflows.

### ISS-08 — Optimistic concurrency control

Use the accepted concurrency/version mechanism to reject stale updates rather than silently overwriting newer state.

### ISS-09 — Archive Issue

Apply accepted archive semantics and ensure archived Issues are excluded from active results.

### ISS-10 — Restore Issue

Apply accepted restore semantics and preserve relationships and tenant integrity.

### ISS-11 — Issue concurrency, authorization and lifecycle tests

Test concurrent number allocation, stale updates, assignment boundaries, status transitions, archive/restore, and cross-tenant access.

### LAB-01 — Create and rename Label

Implement Organization-scoped Label creation and rename. Normalize names according to the accepted specification and enforce active-name uniqueness within an Organization.

### LAB-02 — Attach and detach Label

Maintain Issue-Label associations only within the same Organization. Enforce uniqueness and tenant integrity at the database boundary where specified.

### LAB-03 — Archive Label

Archive a Label without silently deleting its existing Issue-Label associations.

### LAB-04 — Restore Label and handle collision

If another active Label in the same Organization has the same normalized name, reject the restore. The Label remains archived and its existing Issue-Label associations remain unchanged.

### LAB-05 — Label lifecycle and tenant tests

Test normalization, active uniqueness, cross-Organization attachment, archive behavior, restore collision, and concurrent rename/restore behavior.

### DOC-04 — Issue and Label documentation

Document Issue lifecycle, priority values/default, assignment, status transitions, concurrency behavior, Label normalization, archive/restore, and collision behavior.

**Phase 4 exit gate:** Issue and Label workflows preserve tenant boundaries, uniqueness, lifecycle, and concurrency invariants.

---

## 10. Phase 5 — Collaboration

### COL-01 — Create Comment

Create a Comment on an authorized Issue. Persist any required Activity in the same transaction.

### COL-02 — List Comments

Return Comments only for an accessible Issue and according to the accepted ordering/pagination contract.

### COL-03 — Delete Comment

**Accepted V1 behavior**
- Erase the Comment body.
- Retain a metadata-only tombstone indefinitely.
- Do not hard-delete the Comment record in normal application behavior.
- Preserve the required relationship and audit metadata.

**Acceptance**
- Deleted body content is no longer retrievable.
- Tombstone metadata remains available according to the specification.
- Deletion and required Activity changes are atomic.

### COL-04 — Comment authorization and deletion tests

Test author/role policy, cross-tenant access, body erasure, tombstone retention, and repeated deletion behavior.

### COL-05 — Activity feed read

Return Activity records scoped to the Organization and authorized resources. Activity is append-only in V1.

### COL-06 — Activity creation integration

Ensure the required use cases create Activity records in the same transaction as the state change. Do not emit Activity after commit if that would permit a committed state change without its required Activity record.

### COL-07 — Notification creation

Create Notifications for the events defined by the accepted requirements. Notification creation must be transactionally consistent with the originating event where specified.

### COL-08 — List Notifications

Return only the authenticated User's Notifications, with pagination and read-state filtering as specified.

### COL-09 — Mark Notification read

Set `read_at` when transitioning from unread to read. Repeating the operation for an already-read Notification is idempotent and must not reset `read_at`.

### COL-10 — Mark Notification unread

Set `read_at = NULL`. A subsequent unread-to-read transition sets a new `read_at` and therefore a new read-retention deadline.

### COL-11 — Notification retention cleanup

**Accepted V1 retention**
- Read Notification: retain for 180 days after its current `read_at`.
- Unread Notification: retain for 365 days after `created_at`.
- Marking unread clears `read_at`.
- Marking read again establishes a new `read_at`.
- Cleanup evaluates the Notification's current state and applicable deadline.
- Cleanup uses an atomic predicate so a concurrent read-state transition cannot cause a newly retained Notification to be deleted incorrectly.
- Cleanup runs in bounded batches and uses supporting indexes.

Do not implement a generic 90-day retention policy.

### COL-12 — Collaboration authorization, transaction and retention tests

Test Comment tombstones, append-only Activity, Notification ownership, read/unread transitions, idempotency, retention deadlines, batching, and concurrent cleanup/state transitions.

### DOC-05 — Collaboration documentation

Document Comment deletion, Activity semantics, Notification read state, retention rules, and cleanup operation.

**Phase 5 exit gate:** Collaboration data is correctly scoped, transactional, auditable, and retained according to current state.

---

## 11. Phase 6 — Hardening and Release

### REL-01 — Security review

Review authentication, session handling, password hashing, token storage, authorization, tenant isolation, validation, rate limiting, logging redaction, CORS, security headers, and secret management.

### REL-02 — Tenant isolation test pass

Run systematic negative tests across every module:
- User from Organization A cannot read Organization B resources.
- Client-supplied Organization identifiers do not override membership checks.
- Nested resources are checked against their owning Organization.
- Role restrictions are enforced at the use-case boundary.

### REL-03 — Concurrency and integrity test pass

Run concurrency tests for:
- Session refresh
- Last-OWNER protection
- Invitation acceptance and resend
- Issue number allocation
- Optimistic concurrency
- Label uniqueness and restore
- Notification state transitions and cleanup

### REL-04 — Performance workload and benchmark

**Blocked by open decision OD-15.**

Define a representative workload, dataset size, concurrency, latency objectives, and measurement environment before claiming performance validation. Do not invent benchmark targets in implementation code.

### REL-05 — Backup and restore procedure

**Blocked by open decision OD-16 for formal objectives.**

Implement and test backup and restore procedures after backup retention, RPO, and RTO are decided. A successful backup command is not proof that recovery works. Perform a restore drill and record the result.

### REL-06 — Deployment configuration

Prepare Docker Compose and single-VPS deployment configuration. Separate secrets from source control, define health checks, configure persistent database storage, and document deployment ordering.

### REL-07 — Database operations

Document migration execution, backup, restore, log inspection, disk monitoring, and basic database maintenance. Keep operational procedures appropriate to a single-VPS deployment.

### REL-08 — CI/CD release workflow

Run formatting, lint, type-check, tests, build, OpenAPI validation, and migration checks as applicable. Deployment must not proceed when required checks fail.

### REL-09 — Release smoke tests

Verify registration, login, Organization creation, invitation flow, Project/Issue creation, and core collaboration behavior in the deployed environment.

### REL-10 — Release documentation

Publish setup, environment variables, architecture links, API docs, migration/deployment procedures, backup/restore procedures, and known limitations.

**Phase 6 exit gate:** The application is deployable on the selected single-VPS target, security and tenant tests pass, and operational claims are supported by recorded verification.

---

## 12. Testing strategy

### Unit tests
Use for pure domain policies, validation-independent business rules, state transitions, and deterministic application logic.

### Integration tests
Use real PostgreSQL for repository behavior, constraints, transactions, migrations, and concurrency-sensitive invariants. Do not substitute SQLite for PostgreSQL behavior.

### HTTP/API tests
Use Supertest to verify routing, authentication middleware, validation, status codes, response envelopes, and OpenAPI contract alignment.

### End-to-end tests
Verify complete user journeys across module boundaries, beginning with Register → Login → Create Organization.

### Security tests
Prioritize negative authorization and tenant isolation tests. A successful happy path says very little about whether the system leaks another tenant's data.

### Concurrency tests
Use coordinated concurrent operations and assert database state, not merely response codes.

### Migration tests
Run the complete migration chain from an empty PostgreSQL database in CI or a controlled verification environment.

---

## 13. Dependency overview

```text
Foundation
   |
   v
Identity + Organization
   |
   v
Membership + Invitation + Outbox
   |
   v
Projects
   |
   v
Issues + Labels
   |
   v
Comments + Activity + Notifications
   |
   v
Hardening + Release
```

Cross-cutting dependencies:
- Activity is required as early as the first use case that writes it, including Organization creation.
- Outbox infrastructure is introduced with Invitations, not as a generic event bus.
- Notification retention behavior is implemented with Notifications, not deferred as an unowned operations task.
- Authorization and tenant scoping apply to every module from its first endpoint.

---

## 14. Risks and controls

| Risk | Control |
|---|---|
| Tenant data leakage | Organization-scoped queries, authorization at use-case boundary, negative integration tests |
| Business logic leaking into controllers | ADR-001 layer boundaries and review checklist |
| Prisma coupling | Infrastructure-only Prisma access and transaction adapter |
| Partial writes across modules | Application-owned transaction coordination |
| Duplicate/out-of-order invitation delivery | Transactional Outbox, safe worker claiming, idempotent processing |
| Invitation resend quota races | Transactional token rotation and indexed rolling-window count |
| Issue number race | Database-backed allocation/locking strategy verified under concurrency |
| Stale Issue updates | Optimistic concurrency control |
| Label restore collision | Active normalized-name uniqueness and explicit restore rejection |
| Notification cleanup race | Atomic state/deadline predicate and bounded batches |
| Activity missing after committed mutation | Same-transaction Activity creation |
| Unverified operational claims | Recorded benchmark and restore-drill evidence |

---

## 15. Open decisions

These decisions remain open and are not silently resolved by this plan.

| ID | Decision | Required before |
|---|---|---|
| OD-15 | Representative performance workload and benchmark profile | Performance validation and performance objective claims |
| OD-16 | Backup retention, Recovery Point Objective (RPO), and Recovery Time Objective (RTO) | Formal backup/recovery objective claims and final operational sign-off |

OD-15 and OD-16 do not block beginning Foundation or the Register → Login → Create Organization vertical slice. They do block claiming that performance and disaster recovery objectives have been validated.

---

## 16. Implementation readiness checklist

Before starting a task:
- [ ] Confirm the task's owning specification and accepted version.
- [ ] Confirm the module and layer ownership under ADR-001.
- [ ] Confirm required migrations and foreign-key dependencies.
- [ ] Identify authorization and tenant-scoping rules.
- [ ] Identify transaction boundaries and external I/O.
- [ ] Define positive, negative, and concurrency tests where relevant.
- [ ] Update API documentation if the contract changes.

Before declaring a phase complete:
- [ ] All phase tasks meet their acceptance criteria.
- [ ] Relevant PostgreSQL integration tests pass.
- [ ] Tenant isolation and role tests pass.
- [ ] Migrations succeed from a clean database.
- [ ] Type-check, lint, tests, build, and applicable CI checks pass.
- [ ] Documentation reflects the implementation.
- [ ] No unresolved specification conflict remains.

---

## 17. First implementation sequence

Start with the smallest verified path. Do not implement every foundation abstraction speculatively.

1. Inspect the current `apps/api` workspace structure, package scripts, dependencies, and environment configuration.
2. Compare the repository against FND-01 through FND-08 and record what exists, what is partial, and what is missing.
3. Make only the foundation changes needed to support the first vertical slice.
4. Verify PostgreSQL connectivity and clean migration execution.
5. Implement AUTH-01 registration with a real database integration test.
6. Implement AUTH-02 login and AUTH-03 authentication.
7. Implement ORG-01 atomic Organization creation, including OWNER Membership and Activity.
8. Implement ORG-02/ORG-03 list and read with tenant isolation tests.
9. Run the complete first-slice test and CI checks before moving to Phase 2.

**Do not create the Prisma schema as part of this planning revision.** Schema and migrations belong to implementation tasks and must follow the accepted Database Specification V1.3.
