**Project:** Multi-Tenant Project Management API  
**Workflow Stage:** 04 — Plan  
**Document:** 12  
**Version:** 1.0  
**Status:** Approved

---

# Implementation Roadmap v1

## 1. Purpose

This document defines the implementation sequence for the Multi-Tenant Project Management API after the Understand, Specify, and Design stages have been completed.

Implementation follows a **feature-driven development approach through vertical slices**. Each slice delivers a product capability that can be tested from the HTTP request through the persistence layer, rather than merely completing one technical layer.

The Technical Foundation is prepared before Slice 1. This foundation is engineering preparation, not an application feature or a separate vertical slice.

## 2. Implementation Principles

### 2.1 Feature-driven vertical slices

Work is grouped by product capabilities.

A vertical slice should ideally include:

- HTTP endpoints and routing.
- Request validation.
- Authentication and authorization, where required.
- Application/business logic.
- Database interaction and transactions.
- Error handling.
- Automated tests.
- API documentation.

Implementation proceeds incrementally. There is no need to build every controller, service, or repository for all features before one feature can work end to end.

### 2.2 Design and requirements remain authoritative

Implementation must follow the decisions in the Stage 02 and Stage 03 documents.

If a conflict is found between the implementation and a design decision, the conflict must be analyzed and resolved explicitly. Business rules must not be changed silently merely because a different implementation is easier.

### 2.3 Incremental complexity

Technology and complexity are introduced based on identified needs.

Redis, microservices, Kubernetes, distributed queues, and additional infrastructure are not v1 prerequisites unless a justified requirement exists.

### 2.4 Verification is part of implementation

A feature is not considered complete merely because an endpoint returns a response.

Verification must cover relevant business rules, authorization, data integrity, error handling, and automated tests.

## 3. Overall Implementation Sequence

Implementation order:

```text
Stage 01 — Understand
        ↓
Stage 02 — Specify
        ↓
Stage 03 — Design
        ↓
Stage 04 — Plan
        ↓
Technical Foundation
        ↓
Slice 1 — Identity & Organization
        ↓
Slice 2 — Projects
        ↓
Slice 3 — Issues
        ↓
Slice 4 — Membership & Invitations
```

The Technical Foundation prepares the environment and engineering workflow so that vertical slices can be developed consistently.

## 4. Technical Foundation

**Objective:** Prepare the repository, runtime, database, application foundation, testing, and CI so feature implementation can begin reproducibly.

Scope:

1. Repository and workspace setup.
2. Node.js and TypeScript configuration.
3. Express application foundation.
4. Environment configuration.
5. PostgreSQL and Docker Compose.
6. Prisma setup and migration workflow.
7. Structured logging.
8. Testing foundation.
9. API foundation.
10. CI and Git workflow.
11. Developer documentation.

The Technical Foundation does not implement registration, login, Organization, Project, or Issue features.

Definition of Done:

- A developer can install dependencies from the lockfile.
- The API can run locally.
- PostgreSQL can run through Docker Compose.
- Prisma Client can be generated.
- The migration workflow is prepared.
- Lint, typecheck, build, and tests run successfully.
- CI runs quality checks through GitHub Actions.
- Documentation allows another developer to reproduce the setup.

## 5. Slice 1 — Identity & Organization

**Objective:** Deliver working identity and Organization creation flows end to end.

Scope:

### Registration

- A User can register an account.
- Input is validated.
- Email uniqueness is enforced.
- Credentials are stored using a secure password-hashing mechanism.
- Error responses follow the API contract.

### Login

- A User can authenticate.
- The system verifies credentials.
- The system issues an opaque database-backed Bearer session token.
- Only the SHA-256 token hash is stored.
- A session expires after 7 days.

### Authentication and Sessions

- Protected endpoints verify the session.
- Expired and revoked sessions are rejected.
- Refresh rotates the token atomically.
- Logout revokes the current session.

### Create Organization

- An authenticated User can create an Organization.
- Slug and uniqueness behavior follow the design.
- The Organization and Owner Membership are created in a single database transaction.
- The User who creates the Organization receives the `OWNER` role.

### Slice 1 Definition of Done

- Registration, login, authentication, session refresh, and logout work.
- Create Organization atomically creates the Organization and Owner Membership.
- Unique constraints and transaction behavior are verified.
- Authentication and authorization failures are tested.
- Error responses are consistent with the API Contract.
- Automated tests cover relevant success, failure, and edge cases.
- API documentation is updated.

## 6. Slice 2 — Projects

**Objective:** Deliver Project management capabilities within an Organization context.

Scope:

- Create Project.
- List Projects.
- Get Project Detail.
- Update Project.
- Archive Project.
- Restore Project.
- Organization-level authorization.

Important rules:

- All active roles (`OWNER`, `ADMIN`, `MEMBER`) can create a Project.
- All access must be restricted to the relevant Organization.
- Archive and restore follow the Permission Matrix.
- Permanent Project deletion is not available in v1.
- An archived Project cannot accept new Issues.
- Archiving a Project does not automatically archive all of its Issues.

Definition of Done:

- In-scope CRUD behavior works.
- Archive/restore behavior follows the design.
- Tenant isolation and permissions are tested.
- Database constraints and error semantics are verified.
- Automated tests and API documentation are updated.

## 7. Slice 3 — Issues

**Objective:** Deliver the core capabilities for managing work within a Project.

Scope:

### Issue Management

- Create Issue.
- List Issues.
- Get Issue Detail.
- Update Issue.
- Archive Issue.
- Restore Issue.

### Assignment and Classification

- Assign an Issue to a Membership in the same Organization.
- Change assignee.
- Manage priority.
- Add and remove Labels.

### Workflow

Issue statuses:

- `TODO`
- `IN_PROGRESS`
- `IN_REVIEW`
- `DONE`
- `CANCELLED`

Allowed transitions:

```text
TODO        → IN_PROGRESS, CANCELLED
IN_PROGRESS → IN_REVIEW, CANCELLED
IN_REVIEW   → IN_PROGRESS, DONE, CANCELLED
DONE        → IN_PROGRESS
CANCELLED   → TODO
```

### Comments and Activity

- Create and read Comments.
- Edit and soft-delete Comments according to permissions.
- Record meaningful business Activities.
- Business mutations and Activity records must be atomic.

### Search, Filtering, and Pagination

- Search is scoped to a Project.
- Title and description use case-insensitive substring matching.
- Issue number uses an exact numeric match.
- Cursor pagination.
- Fuzzy, semantic, and global search are excluded.

### Concurrency and Integrity

- Issue numbers are allocated through an atomic counter per Project.
- Unique constraint `(project_id, number)`.
- An Issue stores both `organization_id` and `project_id`.
- A composite relationship preserves tenant consistency between an Issue and its Project.
- Optimistic concurrency is applied as designed for updates that require it.

Definition of Done:

- The Issue lifecycle follows the domain specification.
- All status transitions are tested.
- Tenant integrity and assignee constraints are verified.
- Archive behavior and Comment restrictions are tested.
- Activity is recorded atomically with the business mutation.
- Concurrency-sensitive operations are verified.
- Search and pagination follow the API contract.
- Automated tests and API documentation are updated.

## 8. Slice 4 — Membership & Invitations

**Objective:** Deliver Organization member management and invitation flows.

Scope:

### Invitation

- Invite Member.
- Accept Invitation.
- Revoke pending Invitation.
- Invitation expiration.
- Invitation email delivery.

Invitation roles:

| Inviter | Allowed invitation roles |
| ------- | ------------------------ |
| OWNER   | ADMIN, MEMBER            |
| ADMIN   | MEMBER                   |
| MEMBER  | Not allowed              |

An Invitation cannot grant the `OWNER` role.

### Membership Management

- Change Member Role.
- Revoke Membership.
- Reactivate Membership through a new Invitation.
- Enforce the minimum-one-Owner invariant.

Membership revocation:

- The record is retained.
- Status becomes `REMOVED`.
- `removed_at` is populated.
- Related Issue assignments are cleared atomically.
- Re-invitation reactivates the same Membership.

### Invitation Lifecycle

Statuses:

- `PENDING`
- `ACCEPTED`
- `REVOKED`
- `EXPIRED`

`expires_at` is the source of truth for Invitation validity.

A scheduled worker checks for expired Invitations every minute. An Invitation must not be accepted after `expires_at`, even if its status is still `PENDING`.

### Email Delivery

- Transactional outbox.
- One initial attempt.
- Up to three retries for transient failures at minutes 1, 5, and 15.
- Permanent failures are not retried.
- Email failure does not invalidate an Invitation that has already been created.
- Resending does not extend the expiry time.

### Concurrency and Constraints

- At most one pending Invitation exists for an Organization and normalized email combination.
- A partial unique index is based on `status = 'PENDING'`.
- Expire stale Invitations before creating a new Invitation within the transaction.
- Handle unique-constraint conflicts caused by concurrent requests.
- Operations affecting Owners lock the Organization row before validating the minimum-one-Owner invariant.

Definition of Done:

- The Invitation lifecycle follows the design.
- Role restrictions and Membership permissions are tested.
- Membership revocation and reactivation preserve invariants.
- The last-Owner invariant is safe against concurrent operations.
- Invitation expiration and email retries are verified.
- Automated tests and API documentation are updated.

## 9. Cross-cutting Requirements

All slices must preserve the following requirements.

### Security

- Authentication and authorization are enforced on the server.
- Tenant isolation is enforced on every resource access.
- Passwords and session tokens are never stored in plaintext.
- Sensitive data is not included in logs or Activity metadata.
- Cross-tenant access or access without an active Membership is concealed as 404, as specified in the design.

### Data Integrity

- Database constraints are used for invariants that can be enforced at the database level.
- Transactions are used for multi-entity operations that must be atomic.
- Concurrency-sensitive business rules have an explicit strategy.

### API Contract

Error semantics:

| Condition | HTTP status |
|---|---:|
| Cross-tenant / no active Membership | 404 |
| Active Membership but insufficient permission | 403 |
| Stale version | 409 |
| Invalid domain transition | 422 |

The error envelope follows Document 10 — API Contract v1.

### Testing

Each slice must cover, at minimum:

- Success path.
- Validation failure.
- Authentication/authorization failure, where relevant.
- Not-found behavior.
- Data integrity.
- Transaction/concurrency cases, where relevant.
- Domain-specific edge cases.

### Documentation

The API contract and design decisions are updated when implementation reveals a need for an approved change.

## 10. Implementation Workflow

Every task follows the 11-stage engineering workflow:

1. Understand
2. Specify
3. Design
4. Plan
5. Implement
6. Verify
7. Review
8. Integrate
9. Deploy
10. Observe
11. Improve

The workflow is proportional to the risk of the change. Small tasks do not require excessive formal process; changes to authentication, tenant isolation, and data integrity require stricter analysis and verification.

## 11. Roadmap Completion Criteria

The roadmap is considered successfully executed when:

- The Technical Foundation is reproducible and verified.
- Slices 1 through 4 meet their respective Definitions of Done.
- Business rules from Stage 02 and Stage 03 remain preserved.
- Automated verification is run for every relevant change.
- The API contract and developer documentation remain synchronized with the implementation.

## 12. Out of Scope for v1

The following are not prerequisites for v1 implementation unless the scope is explicitly changed:

- Redis.
- Microservices.
- Kubernetes.
- Custom Issue workflows.
- Fuzzy/semantic/global search.
- Push notifications and real-time updates.
- Watchers/subscribers.
- Permanent deletion of Projects and Issues.
- Organization archiving/permanent deletion.
- JWT-based authentication.
- Cookie-based session authentication.
