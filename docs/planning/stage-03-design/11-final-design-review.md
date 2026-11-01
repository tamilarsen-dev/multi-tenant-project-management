**Project:** Multi-Tenant Project Management API  
**Workflow Stage:** 03 — Design  
**Document:** 11  
**Version:** 1.0  
**Status:** Approved

---

# Final Design Review

We are entering the Final Design Review before implementation. The goal is to check consistency across the design artifacts, not to add new technologies. A longer technology stack does not automatically make software more mature, despite what the internet sometimes suggests.

Four areas must align: the domain model, business rules, database design, and API Contract.

## 1. Check Design Consistency

The following issues must be resolved before writing migrations.

| Finding | Risk | Design decision |
|---|---|---|
| Organization is created together with its Owner Membership | Organization may exist without an Owner if one insert fails | One transaction |
| Assignee directly references User | Assignee may belong to another tenant | Use `assignee_membership_id` |
| Issue stores `organization_id` and `project_id` | The two IDs may refer to different tenants | Composite foreign key |
| Label can be attached to an Issue | A Label from another Organization may be used | Composite foreign key on `issue_labels` |
| Invitation may be accepted repeatedly | Duplicate Membership or token reuse | Transaction, constraints, and retry handling |
| Issue status is changed through PATCH | Status transitions may be bypassed | Domain validation |
| Two Users update an Issue concurrently | Lost update | Optimistic concurrency using `version` |
| Activity must record changes | History may be lost if its insert fails | Mutation and Activity in one transaction |

One additional rule: the API must not allow clients to send `organizationId` or `role` on endpoints where those values are determined by server context. Fields that clients must not control should be rejected or ignored according to an explicit contract.

## 2. Important Additional Findings

Several technical concerns needed to be closed.

### A. Issue Number Allocation Must Be Safe Under Concurrent Requests

We want to generate identifiers such as `PAY-431`.

Do not use the naive algorithm:

```sql
SELECT MAX(number) + 1
```

Two concurrent requests may read the same maximum number and attempt to use the same next number.

Final decision: add `projects.next_issue_number INTEGER NOT NULL DEFAULT 1`. Create Issue performs an atomic increment and obtains the number through `UPDATE ... RETURNING` in the same transaction as the Issue and Activity inserts. `UNIQUE(project_id, number)` remains mandatory. This counter and mechanism are included in the logical ERD and PostgreSQL Database Design.

### B. Invitation Status Must Have a Consistent Definition

We use the statuses `PENDING`, `ACCEPTED`, `REVOKED`, and `EXPIRED`.

A worker checks every minute and transitions `PENDING` Invitations whose `expires_at` has passed to `EXPIRED`. However, `expires_at` remains authoritative: the acceptance endpoint must reject when `expires_at <= now()`, even if the worker has not yet updated the status.

The partial unique expression index uses only `(organization_id, lower(invited_email)) WHERE status = 'PENDING'`; do not include `now()` in the index predicate. When creating a new Invitation, stale `PENDING` Invitations that have expired are transitioned to `EXPIRED` inside the transaction before insertion.

### C. Activity Must Record Meaningful Changes

Activity is not created only when an Issue is created. Changes to status, assignment, priority, Membership, and archival must also be recorded according to the audit policy.

For every operation that must generate history:

```text
Business mutation
       +
Activity insert
       ↓
Same transaction
```

If either operation fails, both are rolled back. For external Notifications, use a separate mechanism such as a transactional outbox when the worker is designed.

## 3. Cross-Document Consistency Checks

Before the design is considered ready for planning, ensure the following decisions are consistent across all artifacts:

- v1 roles are only OWNER, ADMIN, and MEMBER. All roles can create Projects.
- Invitations: Owner may invite ADMIN/MEMBER; Admin may invite MEMBER only; an Invitation cannot grant OWNER.
- Membership revocation changes status to `REMOVED`, sets `removed_at`, and retains the record; assigned Issues are unassigned atomically. Re-invitation reactivates the same record with the new Invitation role; an Invitation is rejected if Membership is still ACTIVE; the last Owner cannot be revoked.
- An Organization cannot be archived or permanently deleted in v1.
- Project and Issue use nullable `archived_at`; Comment uses nullable `deleted_at`.
- Issue stores `organization_id` and `project_id`; Assignee references a Membership in the same Organization.
- Activity has Organization context and is append-only; actor and Issue are nullable.
- Issue transitions include `CANCELLED → TODO`.

## 4. Define the First Implementation Scope

We will not implement all eleven entities at once. We start with a vertical slice: one complete feature flow from HTTP request through database persistence and automated tests.

The recommended sequence follows.

### Slice 1: Identity & Organization

**First priority**

Registration, login, authentication, Organization creation, and Owner Membership.

Test duplicate email, invalid credentials, and the Organization-creation transaction.

### Slice 2: Projects

Create, list, retrieve details, archive, and tenant authorization.

Test duplicate keys within an Organization and cross-tenant access.

### Slice 3: Issues

Create, assign, filter, status transitions, version conflicts, and Activity.

Test tenant-scoped assignment, concurrent Issue numbering, and lost updates.

### Slice 4: Membership & Invitations

Invite, accept, revoke, role changes, and the Owner invariant.

Test expired and duplicate Invitations, as well as concurrent operations.

Every slice includes the required schema or migration, application logic, validation, error handling, and automated tests. This gives us a system that grows incrementally while remaining runnable and verifiable.

## 5. Establish the Definition of Done

### Definition of Done

- [ ] **Domain rules:** All relevant business rules are defined and enforced.
- [ ] **Authorization:** Access is tested for both authorized and unauthorized Users.
- [ ] **Data integrity:** Foreign keys, unique constraints, and transactions match requirements.
- [ ] **Error handling:** Failures produce consistent HTTP statuses and error codes.
- [ ] **Automated tests:** Tests cover success, failure, and relevant edge cases.
- [ ] **Documentation:** The API Contract and design decisions are updated.
- [ ] **Reproducibility:** Another developer can run the application and tests using the repository instructions.

This checklist can later be used in GitHub Issues or Pull Requests. It is not a replacement for engineering judgment, but it prevents work from being declared complete merely because an endpoint returns `200 OK`.

## 6. Final Decisions Before Coding

For v1, retain the planned stack:

- Runtime and language: Node.js + TypeScript
- HTTP framework: Express
- Database: PostgreSQL
- ORM: Prisma
- Validation: Zod
- Testing: Vitest
- API documentation: OpenAPI
- Environment: Docker for local dependencies

Redis is not required for Slice 1. Add it when there is a real need, not merely to make the technology list in the README look expensive.

The technical decisions that block v1 implementation have been established and aligned in the relevant documents: per-Project Issue number counter, API error contract and tenant-hiding semantics, Invitation email retries, Activity metadata envelope, and v1 Issue search. Numeric performance targets remain non-blocking and will be established after a workload baseline. Authentication v1 uses an opaque database-backed session token, Bearer transport, SHA-256 hash storage, 7-day expiry, refresh rotation, and revocation on logout. These decisions are reflected in the API Contract and Database Design.

After the Final Design Review is approved and blocking open items for the relevant slice are resolved or explicitly accepted, the next step is Stage 04 Plan, followed by Project Setup & Engineering Workflow as the technical foundation. We will define the repository structure, TypeScript and Express configuration, environment variables, Docker Compose for PostgreSQL, migration workflow, testing setup, and Git conventions. Once this foundation can be run and verified, we implement Slice 1 from beginning to passing tests.

## 7. Locked Technical Decisions

- **Membership revocation:** status changes to `REMOVED`, `removed_at` is set, and the record is retained; assigned Issues are unassigned in the same transaction. Re-invitation reactivates the same Membership record rather than creating a duplicate; an Invitation is rejected if Membership is still ACTIVE. Role changes/revocation affecting an Owner lock the Organization row using `SELECT ... FOR UPDATE` before validating the last-Owner invariant.
- **Session:** opaque database-backed Bearer token, hash-only storage, 7-day expiry, refresh rotation, logout revocation.
- **Issue number:** atomic `projects.next_issue_number` counter, unique `(project_id, number)`.
- **API errors:** custom envelope `{ error: { code, message, details?, requestId } }`; cross-tenant/no active Membership = 404; active Membership without permission = 403; stale version = 409; invalid domain transition = 422.
- **Invitation email:** transactional outbox through `outbox_events`; initial attempt plus up to 3 retries at minutes 1, 5, and 15 for transient failures; stop when the Invitation is no longer pending/valid.
- **Activity metadata:** versioned JSONB envelope (`schemaVersion`, `entityType`, `entityId`, `changes`); does not store Comment bodies or secrets.
- **Issue search:** per-Project search over case-insensitive title/description substrings and exact Issue number when the query is numeric; cursor pagination; no fuzzy/semantic/global search.
- **Numeric performance SLO:** deferred until a workload baseline is available; does not block Stage 03.
