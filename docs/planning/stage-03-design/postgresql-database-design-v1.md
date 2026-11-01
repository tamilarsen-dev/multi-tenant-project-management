**Project:** Multi-Tenant Project Management API  
**Workflow Stage:** 03 — Design  
**Document:** Supporting Design Artifact (un-numbered)  
**Version:** 1.0  
**Status:** Approved

---

# PostgreSQL Database Design v1

We now continue with Database Design v1 using PostgreSQL. The focus is no longer on adding entities, but on ensuring that the data structure can enforce the domain rules we have already agreed upon.

There are three areas to address:

1. Define data types and constraints.
2. Preserve tenant isolation down to database relationships.
3. Define indexes, transactions, and archival policies based on actual needs.

We do not need to write application code yet. The database design must be sufficiently clear so that implementation does not become a sequence of patches.

## 1. PostgreSQL Design Principles

For this project, we use the following principles:

- Primary keys use UUID.
- Timestamps are stored as `timestamptz`.
- Statuses and roles are restricted to valid values.
- Foreign keys preserve referential integrity.
- Unique constraints preserve data uniqueness.
- Transactions group changes that must succeed together.
- The application layer handles business rules that require context and decisions.
- Tenant isolation must be ensured across every data-access path.

Why UUID? Internal IDs do not need to be sequential or reveal the number of resources. However, UUID is not an authorization mechanism. Guessing an ID is not a valid access method, but an unguessable ID still does not replace permission checks.

## 2. Define Data Types and Constraints

The following is the proposed design for the core tables.

| Table | Column | PostgreSQL type | Constraint |
|---|---|---|---|
| `users` | `id` | `uuid` | Primary key |
| | `email` | `text` | Not null; unique after normalization |
| | `name` | `text` | Not null |
| | `password_hash` | `text` | Not null |
| | `created_at` | `timestamptz` | Not null |
| `organizations` | `id` | `uuid` | Primary key |
| | `name` | `text` | Not null |
| | `slug` | `text` | Not null; unique |
| | `created_at` | `timestamptz` | Not null |
| `memberships` | `id` | `uuid` | Primary key |
| | `user_id` | `uuid` | FK to `users`, not null |
| | `organization_id` | `uuid` | FK to `organizations`, not null |
| | `role` | `text` | `OWNER`, `ADMIN`, `MEMBER` |
| | `status` | `text` | `ACTIVE`, `REMOVED` |
| | `joined_at` | `timestamptz` | Not null; latest activation time |
| | `removed_at` | `timestamptz` | Nullable; set on revocation, cleared on reactivation |
| `projects` | `id` | `uuid` | Primary key |
| | `organization_id` | `uuid` | FK, not null |
| | `key` | `text` | Unique within the Organization |
| | `archived_at` | `timestamptz` | Nullable; NULL = active, non-NULL = archived |
| | `next_issue_number` | `integer` | Not null, default 1; atomic per-Project counter |
| `issues` | `id` | `uuid` | Primary key |
| | `organization_id` | `uuid` | FK to organizations, not null |
| | `project_id` | `uuid` | Composite FK to projects, not null |
| | `number` | `integer` | Unique within the Project |
| | `status` | `text` | Restricted status values |
| | `priority` | `text` | Restricted priority values |
| | `version` | `integer` | Not null, minimum 1 |
| | `assignee_membership_id` | `uuid` | Nullable, composite FK to memberships |
| | `archived_at` | `timestamptz` | Nullable; NULL = active, non-NULL = archived |

Membership revocation does not perform a physical `DELETE`: status changes from `ACTIVE` to `REMOVED`, `removed_at` is set, and the record is retained; assigned Issues are unassigned in the same transaction. When a re-invitation is accepted, the same `REMOVED` record changes back to `ACTIVE`, its role is updated, `joined_at` is set to the new activation time, and `removed_at` is cleared.

Using `text` with a `CHECK` constraint is a reasonable choice for simple enums. PostgreSQL also supports native enums, but changing enum values has its own migration implications. We do not need to choose native enums merely because the name sounds more formal.

## 3. Composite Constraints for Tenant Isolation

This section deserves careful attention.

For example:

```text
Acme
└── Project PAY
    └── Issue PAY-431

Beta
└── Project WEB
    └── Issue WEB-17
```

We must not allow an Issue in Acme to reference a Project owned by Beta merely because both IDs are individually valid.

An ordinary foreign key such as:

```text
issues.project_id → projects.id
```

ensures that the Project exists, but by itself does not ensure that the Project belongs to the correct Organization when Issue also stores `organization_id`.

There are two approaches.

**Approach A: Derive Organization through Project**

```text
Issue → Project → Organization
```

This is simpler because `issues` does not duplicate `organization_id`. Tenant scope is determined by joining to Project.

**Approach B: Also store Organization on Issue**

```text
Issue
├── organization_id
└── project_id
```

We then create a composite foreign key:

```text
issues(project_id, organization_id)
    → projects(id, organization_id)
```

The database can then reject an Issue that pairs a Project with a mismatched Organization.

For this project, I recommend Approach B. We store some tenant information twice, but gain a stronger relational constraint. The consequence is that every operation that changes either relationship must keep both columns consistent.

The same pattern can be used for assignment:

```text
issues(assignee_membership_id, organization_id)
    → memberships(id, organization_id)
```

For this foreign key to be valid, the referenced column pair must have a matching unique constraint.

Note: this foreign key ensures that the Membership belongs to the correct Organization, but it does not ensure that the Membership status is `ACTIVE`. Status still needs to be enforced through transaction rules and application logic.

## 4. Constraint Design for Core Tables

The following constraints should be recorded in `docs/database-design.md`.

| Table | Constraint |
|---|---|
| `users` | Unique normalized email |
| `organizations` | Unique slug |
| `memberships` | Unique `(user_id, organization_id)` |
| `memberships` | Unique `(id, organization_id)` for composite foreign keys |
| `projects` | Unique `(organization_id, key)` |
| `projects` | Unique `(id, organization_id)` for composite foreign keys |
| `issues` | Unique `(project_id, number)` |
| `issues` | Composite FK to Project and Organization |
| `issues` | Optional composite FK to Assignee Membership |
| `labels` | Unique `(organization_id, normalized_name)` |
| `issue_labels` | Primary key `(issue_id, label_id)` |
| `issue_labels` | Composite FKs ensuring Issue and Label belong to the same Organization |
| `invitations` | Unique token hash |
| `sessions` | Unique token hash |

For `issue_labels`, the stronger pattern is to store `organization_id` in the junction table and create both composite foreign keys:

```text
issue_labels(issue_id, organization_id)
    → issues(id, organization_id)

issue_labels(label_id, organization_id)
    → labels(id, organization_id)
```

This prevents a Label from Beta being attached to an Issue in Acme, even if application code makes a mistake.

For active Invitations, we can use a partial unique index based on Organization and normalized email. Its predicate must match the definition of an active Invitation: status `PENDING`. Do not include `expires_at > now()` in the index predicate because time continuously advances and `now()` is not suitable for an index predicate. The worker transitions `PENDING` to `EXPIRED` every minute; acceptance still checks `expires_at` directly.

## 5. Indexes Based on Queries, Not Guesswork

Indexes speed up searches at the cost of storage and additional write work. Do not create an index for every column merely because the column looks important.

For v1, candidates include:

| Query | Candidate index |
|---|---|
| Find User by email | Unique email index |
| List a User's Memberships | `(user_id, status)` |
| List Organization Members | `(organization_id, status, role)` |
| List Projects in an Organization | `(organization_id, archived_at, created_at)` |
| List Issues in a Project | `(project_id, status, created_at)` |
| Issues assigned to a Membership | `(assignee_membership_id, status)` |
| List Issue Comments | `(issue_id, created_at)` |
| Latest Activity in an Organization | `(organization_id, created_at)` |
| Unread Notifications | `(user_id, created_at)` with a partial index for unread records |
| Sessions belonging to a User | `(user_id, expires_at)` |

Unique constraints usually create the required index automatically. Do not create duplicate indexes over the same columns without a reason.

After the application runs with representative data, evaluate queries using `EXPLAIN ANALYZE`. Optimizing based on measurements makes more sense than guessing performance requirements from column names.

## 6. Transaction Boundaries

Now define which operations require transactions.

### Create Organization

One transaction:

```text
INSERT organization → INSERT owner membership
```

### Create Issue

One transaction:

```sql
UPDATE projects
SET next_issue_number = next_issue_number + 1
WHERE id = ?
  AND organization_id = ?
  AND archived_at IS NULL
RETURNING next_issue_number - 1;
```

Then:

```text
INSERT issue(number) → INSERT activity
```

Updating the Project row locks the counter atomically. `UNIQUE(project_id, number)` remains the final defensive constraint. If the transaction rolls back, the counter increment rolls back as well.

### Accept Invitation

One transaction:

```text
validate and consume Invitation
→ create Membership if absent, or reactivate an existing REMOVED Membership
```

### Revoke Membership

One transaction:

```text
lock Organization row
→ validate minimum-Owner invariant
→ unassign all Issues + Activity per Issue
→ set Membership.status = REMOVED and removed_at
→ record Membership-revoked Activity
```

### Update Issue

One transaction:

```text
conditional update based on version → record Activity
```

One important correction: an ordinary transaction does not automatically solve every race condition. For example, two concurrent requests can still violate the last-Owner rule if each only reads the Owner count before updating.

For v1, every operation that can change the number of active Owners (revoking an Owner Membership or changing an Owner role) must lock the Organization row using `SELECT ... FOR UPDATE` at the beginning of the transaction, then count active Owners and perform the change. Locking the Organization serializes Owner changes within the same tenant. Handle deadlocks/serialization failures with bounded retries and verify the behavior using concurrent integration tests. The database must be part of the invariant-enforcement mechanism, not merely a place to store application decisions.

Email delivery and external Notifications must not be treated as if they were part of a PostgreSQL transaction. If the database transaction rolls back after an email is sent, the outside world does not roll back with it.

For reliable delivery, we can later use a transactional outbox: record an event or job in the same transaction, then let a worker process it after commit.

## 7. Archival Policy

For v1:

- Project and Issue use nullable `archived_at` as a consistent archive marker. `NULL` means active; a timestamp means archived. Organization archiving is outside v1 scope.
- Archiving does not delete Issues, Comments, or Activity.
- Archived resources remain subject to authorization.
- Mutations follow the lifecycle policy.
- Permanent deletion is outside v1 scope.

We do not need to apply soft deletion to every table. Archiving is an explicit domain concept. Soft deletion is a storage strategy for cases that actually require logical deletion.

## 8. Database Design Outcome

We now have an initial design for:

- Data types and constraints.
- Tenant isolation across relationships.
- Query-driven indexes.
- Transaction boundaries.
- Concurrency control.
- Archival and history retention.

However, this does not mean we should immediately write all SQL. One more design step is needed: the API Contract.

We need to define endpoints, requests, responses, the error model, and authorization rules for use cases such as creating an Organization, accepting an Invitation, creating a Project, creating an Issue, changing status, and revoking Membership.

Once the API Contract is clear, implementation can begin incrementally with schemas, migrations, tests, and the first endpoints. This way, every part of the code has a clear design reason rather than appearing because the next tutorial tells us to type something.

---

## 9. Reconciliation with Domain Requirements v1

This section provides final corrections to columns and constraints that were still missing from earlier drafts.

### 9.1 The `issues` Table Must Carry Organization Context

Minimum logical columns for `issues`:

- `id UUID PRIMARY KEY`
- `organization_id UUID NOT NULL`
- `project_id UUID NOT NULL`
- `number INTEGER NOT NULL`
- `title`, `description`, `status`, `priority`
- `assignee_membership_id UUID NULL`
- `created_by`, `version`, `created_at`, `updated_at`
- `archived_at TIMESTAMPTZ NULL` as the archive marker

Required constraints to design:

```sql
ALTER TABLE projects
ADD CONSTRAINT uq_projects_id_organization
UNIQUE (id, organization_id);

ALTER TABLE issues
ADD CONSTRAINT fk_issues_project_organization
FOREIGN KEY (project_id, organization_id)
REFERENCES projects (id, organization_id);

ALTER TABLE memberships
ADD CONSTRAINT uq_memberships_id_organization
UNIQUE (id, organization_id);

ALTER TABLE issues
ADD CONSTRAINT fk_issues_assignee_membership_organization
FOREIGN KEY (assignee_membership_id, organization_id)
REFERENCES memberships (id, organization_id);
```

Composite FKs guarantee tenant matching, not that the Membership is `ACTIVE`. Active-state validation still requires application logic/transactions. When a Membership is revoked, Issues assigned to it must be unassigned atomically before or as part of Membership revocation.

### 9.2 Invitation Lifecycle and Unique Index

- Stored statuses: `PENDING`, `ACCEPTED`, `REVOKED`, `EXPIRED`.
- A worker checks every minute and transitions expired `PENDING` Invitations to `EXPIRED`.
- `expires_at` remains authoritative: acceptance rejects when `expires_at <= now()`, even if status is still `PENDING`.
- The partial unique expression index uses key `(organization_id, lower(invited_email))` and predicate `status = 'PENDING'`. Do not use `now()` in the index predicate.
- When creating a new Invitation for the same Organization/email, the transaction must mark any old expired `PENDING` Invitation as `EXPIRED` before inserting. Handle unique violations caused by race conditions.
- Email failure does not cancel the Invitation. Use a transactional outbox; after a transient failure, perform up to 3 automatic retries after the initial attempt with delays of 1, 5, and 15 minutes. Stop retries if the Invitation is no longer `PENDING` or has passed `expires_at`. Manual resend is available only for a still-valid `PENDING` Invitation and does not extend `expires_at`.

### 9.3 Archiving and Comment Soft Deletion

Projects and Issues are not hard-deleted in v1. Both have an archive state separate from the Issue workflow status. The v1 database representation uses nullable `archived_at` on both `projects` and `issues`. `NULL` means active; non-NULL means archived. Archive state is separate from the Issue workflow `status`.

Comment uses soft deletion. A column such as `deleted_at` is a candidate implementation. Deleted Comment content is not shown to ordinary Users. Full Comment version history is outside v1 scope.

### 9.4 Comment, Invitation, and Activity Logical Columns

| Table | Required logical attributes |
|---|---|
| `comments` | `id`, `issue_id`, `author_id`, `body`, `created_at`, `updated_at`, nullable `deleted_at` (soft delete) |
| `invitations` | `id`, `organization_id`, `invited_email`, `invited_by`, `role`, `token_hash`, `expires_at`, `status`, `accepted_at?`, `created_at` |
| `activities` | `id`, `organization_id`, nullable `actor_id`, nullable `issue_id`, `action`, `metadata`, `created_at` |
| `outbox_events` | `id`, `event_type`, `payload`, `available_at`, `attempt_count`, `processed_at?`, `last_error?`, `created_at` | Durable delivery job; retry state persisted; payload must not contain unnecessary secrets |

`deleted_at` on Comment and `archived_at` on Project and Issue are v1 persistence representations. All application queries and constraints must respect these markers.

### 9.5 Activity Schema

`activities.organization_id` is NOT NULL; `actor_id` is NULL for system Activity; `issue_id` is NULL for Organization/Membership/Project events not associated with an Issue. A direct `project_id` is not required. Metadata may store `projectId`/`membershipId` and before/after context. Activity is append-only.

### 9.6 Issue Status Constraint vs Archive State

Issue workflow statuses are only: `TODO`, `IN_PROGRESS`, `IN_REVIEW`, `DONE`, `CANCELLED`. Allowed domain transitions include `CANCELLED → TODO`. Archiving is not an additional value in the workflow status enum.

### 9.6.1 Concurrency for the Owner Invariant

Operations that can change the number of active Owners lock the Organization row (`SELECT ... FOR UPDATE`) before reading the Owner count. After obtaining the lock, validate the minimum-one-Owner rule and perform the Membership/role change in the same transaction. This prevents two parallel requests from each assuming another Owner remains and then both revoking the last Owners.

### 9.7 Locked v1 Technical Decisions

**Issue number:** `projects.next_issue_number INTEGER NOT NULL DEFAULT 1`. In the Create Issue transaction, perform an atomic update `SET next_issue_number = next_issue_number + 1 ... RETURNING next_issue_number - 1`, then insert the Issue using the returned number and insert Activity. `UNIQUE(project_id, number)` is mandatory.

**Invitation email retries:** store the delivery job in `outbox_events` in the same transaction that creates the Invitation (transactional outbox). A worker claims jobs whose `available_at` has arrived and which have not been processed, using a short transaction with `FOR UPDATE SKIP LOCKED`; delivery occurs outside the claim transaction, after which the job is marked complete or rescheduled. Use idempotent delivery handling so worker retries do not create duplicate effects. After a transient failure, perform up to 3 automatic retries after the initial attempt, with delays of 1, 5, and 15 minutes. Do not retry permanent failures. Stop retries if the Invitation is no longer `PENDING` or `expires_at <= now()`. Manual resend is available only for a still-valid `PENDING` Invitation and does not change `expires_at`.

**Activity metadata:** store JSONB with a versioned envelope `schemaVersion: 1`, `entityType`, `entityId`, and `changes` (array of `{field, from, to}`); event-specific context may be added. For Comments, store `commentId` and the action type, not the Comment body. Do not store passwords, tokens, or secrets.

**Session authentication:** use an opaque random 32-byte token, send it as a Bearer token, and store only its SHA-256 hash in `sessions.token_hash`. Validate `revoked_at` and `expires_at` on every request. The lifetime is 7 days. Refresh atomically revokes the old Session and creates a new 7-day Session; logout revokes the current Session. JWT and cookie sessions are outside v1.

**v1 Issue search:** search is limited to one Project and covers `title`, `description`, and `number`. Title/description use case-insensitive substring matching; number is matched exactly as a number when the query is numeric. Results respect status/priority/archive filters and the defined cursor pagination. v1 has no fuzzy search, semantic search, or global cross-Organization search.

**Remaining non-blocking item:** numeric performance targets will be established after a workload baseline and environment benchmark are available. Search/index optimization will be based on `EXPLAIN ANALYZE`, not assumptions.
