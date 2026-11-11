# Phase 0.3 --- Database Specification

**Project:** Multi-Tenant Project Management API\
**Status:** Finalized design, not yet implemented\
**Database:** PostgreSQL 18\
**ORM/migrations:** Prisma ORM + Prisma Migrate

## 1. Scope and domain model

V1 contains eleven entities: `User`, `Session`, `Organization`,
`Membership`, `Invitation`, `Project`, `Issue`, `Comment`, `Activity`,
`Notification`, and `OutboxEvent`.

Core relationships: - User 1:N Session, Membership, Notification, and
Invitation (as inviter). - Organization 1:N Membership, Invitation,
Project, and Activity. - Project 1:N Issue; Issue 1:N Comment. -
Membership 1:N assigned Issue and authored Comment. - Activity 1:N
Notification; Invitation 1:N OutboxEvent.

### Tenant integrity

Tenant-sensitive relations use composite foreign keys: - Issue
`(organization_id, project_id)` → Project `(organization_id, id)`. -
Issue `(organization_id, assignee_membership_id)` → Membership
`(organization_id, id)`. - Comment `(organization_id, issue_id)` → Issue
`(organization_id, id)`. - Comment
`(organization_id, author_membership_id)` → Membership
`(organization_id, id)`. - Activity `(organization_id, issue_id)` →
Issue `(organization_id, id)`. - Notification
`(organization_id, activity_id)` → Activity `(organization_id, id)`.

Referenced tables need a matching unique key on `(organization_id, id)`,
even where `id` is already globally unique. A foreign key guarantees
tenant consistency, not that a referenced Membership is `ACTIVE`; the
latter is checked transactionally by the application.

## 2. Global conventions

### Identifiers

-   PostgreSQL `UUID` primary keys.
-   Application generates UUID v4 using `crypto.randomUUID()`.
-   UUID v7 is deferred; changing generator later does not require
    changing PostgreSQL column types.

### Timestamps

-   Use `TIMESTAMPTZ(3)` for all timestamp columns.
-   Application convention and database connections use UTC.
-   Convert to user-local timezone in the presentation layer.
-   Millisecond precision matches JavaScript `Date`.
-   `updated_at` is application-managed, without a general timestamp
    trigger.
-   Actual mutations update `updated_at`; no-op operations do not.

### Email

-   Trim and lowercase in the application before storage and comparison.
-   Use ordinary `VARCHAR`, not `CITEXT`.
-   Unique constraints operate on normalized stored values.
-   Registration, login, invitation creation, and invitation acceptance
    must share the same normalization function.

### Deletion

-   Domain foreign keys explicitly use `ON DELETE RESTRICT`.
-   No cascading deletion of domain records.
-   Physical deletion of Users and Organizations is unsupported in V1.
-   Use status changes, soft deletion, and explicit retention jobs where
    defined.

### Optimistic concurrency

Organization, Membership, Project, Issue, and Comment have
`version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1)`. Use
conditional updates:

``` sql
UPDATE some_table
SET ..., version = version + 1, updated_at = NOW()
WHERE id = $1 AND version = $2
RETURNING *;
```

A real mutation increments the version; a no-op does not. A stale
version returns `409`. Multi-row invariants still require explicit
locks.

### Connections and timeouts

-   API and worker use bounded connection pools, configured per
    environment.
-   Final pool sizes depend on VPS capacity and process count.
-   Prisma transaction `maxWait` and `timeout` are bounded and
    configurable.
-   Never perform HTTP requests, email delivery, or other external I/O
    inside a database transaction.
-   PostgreSQL `statement_timeout` limits individual statements;
    `lock_timeout` limits lock waiting.
-   API, worker, and maintenance workloads may use different timeout
    settings. Numeric values are finalized through testing.

## 3. Relational schema

The following SQL defines the intended PostgreSQL structure. Standard
models and relations are represented in Prisma; PostgreSQL-specific
indexes and constraints may require custom SQL migrations.

### 3.1 Users

``` sql
CREATE TABLE users (
  id UUID PRIMARY KEY,
  email VARCHAR(254) NOT NULL,
  password_hash TEXT NOT NULL,
  display_name VARCHAR(100) NOT NULL,
  created_at TIMESTAMPTZ(3) NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ(3) NOT NULL DEFAULT NOW(),
  CONSTRAINT users_email_unique UNIQUE (email),
  CONSTRAINT users_email_nonempty CHECK (length(trim(email)) > 0),
  CONSTRAINT users_display_name_nonempty CHECK (length(trim(display_name)) > 0)
);
```

Email is application-normalized. Passwords use Argon2id; plaintext is
never stored.

### 3.2 Sessions

``` sql
CREATE TABLE sessions (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  token_hash CHAR(64) NOT NULL UNIQUE,
  created_at TIMESTAMPTZ(3) NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ(3) NOT NULL,
  revoked_at TIMESTAMPTZ(3)
);

CREATE INDEX sessions_user_id_idx ON sessions(user_id);
CREATE INDEX sessions_expires_at_idx
  ON sessions(expires_at) WHERE revoked_at IS NULL;
CREATE INDEX sessions_revoked_at_idx
  ON sessions(revoked_at) WHERE revoked_at IS NOT NULL;
```

The raw opaque session token is cryptographically random 32 bytes. Store
only its SHA-256 lowercase-hex hash. Session lifetime is seven days.
Refresh rotates the old session atomically; only one concurrent refresh
may succeed. Logout revokes the current session only. Delete expired or
revoked sessions after 30 days using bounded batches.

### 3.3 Organizations

``` sql
CREATE TABLE organizations (
  id UUID PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
  created_at TIMESTAMPTZ(3) NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ(3) NOT NULL DEFAULT NOW(),
  CONSTRAINT organizations_name_nonempty CHECK (length(trim(name)) > 0)
);
```

Organization names are not unique. V1 has no Organization archive or
physical deletion. Organization row locking protects the Last Owner
invariant.

### 3.4 Memberships

``` sql
CREATE TABLE memberships (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  role VARCHAR(10) NOT NULL CHECK (role IN ('OWNER', 'ADMIN', 'MEMBER')),
  status VARCHAR(10) NOT NULL DEFAULT 'ACTIVE'
    CHECK (status IN ('ACTIVE', 'REMOVED')),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
  joined_at TIMESTAMPTZ(3) NOT NULL DEFAULT NOW(),
  removed_at TIMESTAMPTZ(3),
  created_at TIMESTAMPTZ(3) NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ(3) NOT NULL DEFAULT NOW(),
  CONSTRAINT memberships_one_per_user_org UNIQUE (organization_id, user_id),
  CONSTRAINT memberships_org_id_unique UNIQUE (organization_id, id),
  CONSTRAINT memberships_status_timestamp_consistent CHECK (
    (status = 'ACTIVE' AND removed_at IS NULL)
    OR (status = 'REMOVED' AND removed_at IS NOT NULL)
  )
);

CREATE INDEX memberships_active_user_idx
  ON memberships(user_id, organization_id) WHERE status = 'ACTIVE';
CREATE INDEX memberships_org_status_joined_idx
  ON memberships(organization_id, status, joined_at DESC, id DESC);
```

Exactly one Membership record exists per User/Organization. Removal
changes status to `REMOVED` and retains the row. Rejoining reactivates
the same row, applies the Invitation role, resets `joined_at`, and
clears `removed_at`. Revocation unassigns the Membership's Issues in the
same transaction. The application must validate active Membership before
assignment or Comment creation.

### 3.5 Invitations

``` sql
CREATE TABLE invitations (
  id UUID PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  email VARCHAR(254) NOT NULL,
  role VARCHAR(10) NOT NULL CHECK (role IN ('ADMIN', 'MEMBER')),
  invited_by_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  status VARCHAR(10) NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING', 'ACCEPTED', 'REVOKED', 'EXPIRED')),
  token_hash CHAR(64) NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ(3) NOT NULL,
  accepted_at TIMESTAMPTZ(3),
  revoked_at TIMESTAMPTZ(3),
  last_resent_at TIMESTAMPTZ(3),
  created_at TIMESTAMPTZ(3) NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ(3) NOT NULL DEFAULT NOW(),
  CONSTRAINT invitations_email_nonempty CHECK (length(trim(email)) > 0),
  CONSTRAINT invitations_accepted_timestamp_consistent CHECK (
    (status = 'ACCEPTED' AND accepted_at IS NOT NULL)
    OR (status <> 'ACCEPTED' AND accepted_at IS NULL)
  ),
  CONSTRAINT invitations_revoked_timestamp_consistent CHECK (
    (status = 'REVOKED' AND revoked_at IS NOT NULL)
    OR (status <> 'REVOKED' AND revoked_at IS NULL)
  )
);

CREATE UNIQUE INDEX invitations_one_pending_per_email
  ON invitations(organization_id, email) WHERE status = 'PENDING';
CREATE INDEX invitations_pending_expiration_idx
  ON invitations(expires_at) WHERE status = 'PENDING';
```

Inviter references User, preserving identity after Membership removal.
Invitation email uses the shared email normalization function. Roles are
`ADMIN` or `MEMBER`; Owner cannot be invited.

Before creating an Invitation for the same Organization/email, expire
stale `PENDING` records (`expires_at <= NOW()`) inside the transaction.
Use a transaction-level advisory lock keyed deterministically by
`(organization_id, normalized_email)`; the partial unique index is the
final integrity defense. Do not use `NOW()` in the partial-index
predicate.

Invitation lifetime is seven days. Lazy expiration rejects expired
tokens even if the worker has not updated status. A scheduled worker
changes stale `PENDING` rows to `EXPIRED`, using the expiration index
and `FOR UPDATE SKIP LOCKED` where appropriate.

`last_resent_at` supports a 60-second manual resend cooldown. Update it
atomically when resend successfully enters the queue. Worker retries do
not use the cooldown. Resend reuses the same token and does not extend
expiry. Invitation records are retained while the Organization exists;
no automatic cleanup in V1.

### 3.6 Projects

``` sql
CREATE TABLE projects (
  id UUID PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  next_issue_number INTEGER NOT NULL DEFAULT 1 CHECK (next_issue_number >= 1),
  archived_at TIMESTAMPTZ(3),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
  created_at TIMESTAMPTZ(3) NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ(3) NOT NULL DEFAULT NOW(),
  CONSTRAINT projects_org_id_unique UNIQUE (organization_id, id),
  CONSTRAINT projects_name_nonempty CHECK (length(trim(name)) > 0)
);

CREATE INDEX projects_active_listing_idx
  ON projects(organization_id, created_at DESC, id DESC)
  WHERE archived_at IS NULL;
CREATE INDEX projects_archived_listing_idx
  ON projects(organization_id, created_at DESC, id DESC)
  WHERE archived_at IS NOT NULL;
```

Project names are not unique. All active Organization roles may create
Projects. Archive/restore uses `archived_at`. Archiving a Project does
not archive its Issues. Archived Projects cannot accept new Issues or be
modified. Projects cannot move between Organizations in V1.

### 3.7 Issues

``` sql
CREATE TABLE issues (
  id UUID PRIMARY KEY,
  organization_id UUID NOT NULL,
  project_id UUID NOT NULL,
  number INTEGER NOT NULL CHECK (number >= 1),
  title VARCHAR(200) NOT NULL,
  description TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'TODO'
    CHECK (status IN ('TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE', 'CANCELLED')),
  assignee_membership_id UUID,
  archived_at TIMESTAMPTZ(3),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
  created_at TIMESTAMPTZ(3) NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ(3) NOT NULL DEFAULT NOW(),
  CONSTRAINT issues_project_tenant_fk
    FOREIGN KEY (organization_id, project_id)
    REFERENCES projects(organization_id, id) ON DELETE RESTRICT,
  CONSTRAINT issues_assignee_tenant_fk
    FOREIGN KEY (organization_id, assignee_membership_id)
    REFERENCES memberships(organization_id, id) ON DELETE RESTRICT,
  CONSTRAINT issues_project_number_unique UNIQUE (project_id, number),
  CONSTRAINT issues_org_id_unique UNIQUE (organization_id, id),
  CONSTRAINT issues_title_nonempty CHECK (length(trim(title)) > 0)
);

CREATE INDEX issues_project_active_listing_idx
  ON issues(project_id, number DESC, id DESC) WHERE archived_at IS NULL;
CREATE INDEX issues_project_archived_listing_idx
  ON issues(project_id, number DESC, id DESC) WHERE archived_at IS NOT NULL;
```

Composite FKs enforce that Project and assignee belong to the same
Organization. Application transaction must additionally verify assignee
Membership is `ACTIVE`.

Allocate Issue numbers atomically, in the same transaction as Issue
insert and Activity insert:

``` sql
UPDATE projects
SET next_issue_number = next_issue_number + 1
WHERE id = $1 AND organization_id = $2 AND archived_at IS NULL
RETURNING next_issue_number - 1 AS allocated_number;
```

Status transitions are application-enforced:

  Current       Allowed next statuses
  ------------- ------------------------------
  TODO          IN_PROGRESS, CANCELLED
  IN_PROGRESS   IN_REVIEW, CANCELLED
  IN_REVIEW     IN_PROGRESS, DONE, CANCELLED
  DONE          IN_PROGRESS
  CANCELLED     TODO

All active roles with access can manage Issues. Archive/restore uses
`archived_at`. Issues in archived Projects cannot be modified. Restoring
a Project does not automatically restore archived Issues. No custom
workflow in V1.

### 3.8 Comments

``` sql
CREATE TABLE comments (
  id UUID PRIMARY KEY,
  organization_id UUID NOT NULL,
  issue_id UUID NOT NULL,
  author_membership_id UUID NOT NULL,
  body TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
  created_at TIMESTAMPTZ(3) NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ(3) NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ(3),
  CONSTRAINT comments_issue_tenant_fk
    FOREIGN KEY (organization_id, issue_id)
    REFERENCES issues(organization_id, id) ON DELETE RESTRICT,
  CONSTRAINT comments_author_tenant_fk
    FOREIGN KEY (organization_id, author_membership_id)
    REFERENCES memberships(organization_id, id) ON DELETE RESTRICT,
  CONSTRAINT comments_body_length CHECK (
    char_length(body) BETWEEN 1 AND 10000 AND length(trim(body)) > 0
  )
);

CREATE INDEX comments_issue_listing_idx
  ON comments(issue_id, created_at ASC, id ASC);
```

Application validation defines intended whitespace normalization;
PostgreSQL `trim()` alone is not a complete Unicode whitespace policy.
Author Membership must be active when Comment is created. All active
roles can read/create. Members can update/delete their own Comments;
Owner/Admin can manage others'. Delete is soft via `deleted_at`; API
returns a deleted placeholder. Activity does not store Comment body.
Comments cannot be created/updated if Issue or Project is archived.
Clients must render body safely, not as executable HTML.

### 3.9 Activities

``` sql
CREATE TABLE activities (
  id UUID PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  actor_id UUID REFERENCES users(id) ON DELETE RESTRICT,
  issue_id UUID,
  event_type VARCHAR(100) NOT NULL,
  metadata JSONB NOT NULL CHECK (jsonb_typeof(metadata) = 'object'),
  created_at TIMESTAMPTZ(3) NOT NULL DEFAULT NOW(),
  CONSTRAINT activities_issue_tenant_fk
    FOREIGN KEY (organization_id, issue_id)
    REFERENCES issues(organization_id, id) ON DELETE RESTRICT
);

CREATE INDEX activities_org_listing_idx
  ON activities(organization_id, created_at DESC, id DESC);
```

`actor_id` is nullable for system events; `issue_id` is nullable for
non-Issue events. There is no `project_id` column; Project context
belongs in metadata. Metadata envelope contains `schemaVersion`,
`entityType`, `entityId`, and `changes`. Never include password, token,
secret, or Comment body.

Activity is append-only. Runtime role receives `SELECT` and `INSERT`,
not `UPDATE` or `DELETE`. Activity is retained indefinitely.

### 3.10 Notifications

``` sql
CREATE TABLE notifications (
  id UUID PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  recipient_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  activity_id UUID NOT NULL,
  type VARCHAR(50) NOT NULL,
  content JSONB NOT NULL CHECK (jsonb_typeof(content) = 'object'),
  read_at TIMESTAMPTZ(3),
  created_at TIMESTAMPTZ(3) NOT NULL DEFAULT NOW(),
  CONSTRAINT notifications_activity_tenant_fk
    FOREIGN KEY (organization_id, activity_id)
    REFERENCES activities(organization_id, id) ON DELETE RESTRICT,
  CONSTRAINT notifications_one_per_recipient_activity
    UNIQUE (activity_id, recipient_user_id)
);

CREATE INDEX notifications_recipient_listing_idx
  ON notifications(recipient_user_id, created_at DESC, id DESC);
CREATE INDEX notifications_unread_listing_idx
  ON notifications(recipient_user_id, created_at DESC, id DESC)
  WHERE read_at IS NULL;
CREATE INDEX notifications_retention_idx ON notifications(created_at);
```

Content is a snapshot with `schemaVersion: 1`, title, message, and
resource reference. Notification deliberately has no Membership FK, so
historical personal notifications remain readable after Membership
removal. Mark-one-read is idempotent; mark-all-read is supported. Retain
for 90 days, including unread records; cleanup in batches up to 1,000.
Notification cleanup does not delete Activity.

### 3.11 Outbox events

``` sql
CREATE TABLE outbox_events (
  id UUID PRIMARY KEY,
  invitation_id UUID NOT NULL REFERENCES invitations(id) ON DELETE RESTRICT,
  event_type VARCHAR(100) NOT NULL,
  payload JSONB NOT NULL CHECK (jsonb_typeof(payload) = 'object'),
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING', 'PROCESSING', 'SENT', 'FAILED')),
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  available_at TIMESTAMPTZ(3) NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ(3),
  last_error TEXT,
  locked_at TIMESTAMPTZ(3),
  lease_expires_at TIMESTAMPTZ(3),
  worker_id VARCHAR(100),
  created_at TIMESTAMPTZ(3) NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ(3) NOT NULL DEFAULT NOW(),
  CONSTRAINT outbox_state_lease_consistent CHECK (
    (
      status = 'PROCESSING' AND locked_at IS NOT NULL
      AND lease_expires_at IS NOT NULL AND worker_id IS NOT NULL
      AND processed_at IS NULL
    )
    OR
    (
      status IN ('PENDING', 'SENT', 'FAILED')
      AND locked_at IS NULL AND lease_expires_at IS NULL
      AND worker_id IS NULL
    )
  ),
  CONSTRAINT outbox_terminal_timestamp_consistent CHECK (
    (status IN ('SENT', 'FAILED') AND processed_at IS NOT NULL)
    OR (status IN ('PENDING', 'PROCESSING') AND processed_at IS NULL)
  )
);

CREATE INDEX outbox_pending_available_idx
  ON outbox_events(available_at ASC, created_at ASC) WHERE status = 'PENDING';
CREATE INDEX outbox_expired_lease_idx
  ON outbox_events(lease_expires_at ASC) WHERE status = 'PROCESSING';
CREATE INDEX outbox_invitation_id_idx ON outbox_events(invitation_id);
```

Outbox V1 handles Invitation email. Raw Invitation token is encrypted in
payload; Invitation table stores only token hash. Use AES-256-GCM with
256-bit key held outside DB, unique 96-bit nonce per encryption, 128-bit
authentication tag, and `keyVersion` for rotation. Never log raw token,
key, or decrypted payload.

Worker claims with transaction and `FOR UPDATE SKIP LOCKED`, sets
`PROCESSING` and lease fields, then: - Success: `SENT`, set
`processed_at`, clear lease fields. - Permanent failure or retry
exhaustion: `FAILED`, set `processed_at`, clear lease fields. -
Transient failure: return to `PENDING`, set future `available_at`. -
Expired lease: eligible for reclaim.

Updates must be conditional on current lease ownership so stale workers
cannot overwrite newer results. Delivery is at-least-once, not
exactly-once; use provider idempotency support if available. Retry at
most four attempts: initial plus three transient retries at 1, 5, and 15
minutes. Permanent errors are not retried. Retain `SENT`/`FAILED`
records for 30 days, then redact sensitive payload and delete. Never
clean up `PENDING` or `PROCESSING`.

## 4. Index strategy

Indexes are query-driven. PostgreSQL creates indexes for PK and UNIQUE
constraints, but not automatically for referencing FK columns. Add an FK
index only if it is not covered by an existing index and the
query/maintenance pattern needs it.

V1 baseline: - Sessions: `user_id`, active expiration cleanup, revoked
cleanup. - Memberships: active lookup by User; Organization roster. -
Invitations: pending uniqueness and expiration scan. - Projects: active
and archived Organization listing. - Issues: active and archived Project
listing; exact number via unique `(project_id, number)`. - Comments:
chronological Issue listing. - Activities: chronological Organization
listing. - Notifications: recipient inbox, unread inbox, retention
cleanup. - Outbox: pending scheduling, expired lease recovery,
Invitation lookup.

No Issue status or assignee indexes until query evidence supports them.
Do not duplicate the Issue number unique index. Reassess with query
plans and observed workload; use `EXPLAIN (ANALYZE, BUFFERS)` in
controlled environments.

## 5. Concurrency and transaction protocol

### Isolation

Use PostgreSQL `READ COMMITTED` by default. Do not globally use
`SERIALIZABLE` in V1.

### Global lock ordering

Acquire locks in this order: 1. Organization row. 2. Invitation advisory
lock, when relevant. 3. Membership row(s). 4. Project row(s). 5. Issue
row(s). 6. Comment row(s).

Acquire multiple rows at the same level in deterministic primary-key
order. Never acquire a lower-level lock and then request a higher-level
lock.

Invitation advisory lock is deterministically keyed from
`(organization_id, normalized_email)`. Hash collisions may serialize
unrelated invitations but must not compromise correctness. For
Invitation creation: 1. Lock Organization row if required by the
operation. 2. Acquire Invitation advisory lock. 3. Lock and validate
inviter Membership. 4. Expire stale pending Invitation. 5. Insert
Invitation and OutboxEvent in the same transaction.

### Last Owner

Any operation that changes active Owner count locks the Organization row
with `SELECT ... FOR UPDATE` before checking and mutating. No operation
may remove or demote the last active Owner.

### Assignment vs revocation

Assignment and revocation follow the global lock order. Assignment locks
Organization as needed, then target Membership, validates active status
and tenant, then updates Issue. Revocation locks Organization, then
Membership, marks it removed, unassigns its Issues, and records Activity
in one transaction.

### Invitation concurrency

Use transaction-level advisory lock per Organization/normalized email
for expire-check-create. Expire stale pending records before insert.
Partial unique index is the final defense. Treat unique violations as
concurrency outcomes.

### Issue number allocation

Atomic Project counter update, Issue insert, and Activity insert occur
in one transaction.

### OCC

Use conditional version updates for Organization, Membership, Project,
Issue, and Comment. A stale version returns `409`, while resource
visibility follows API tenant-hiding policy.

### Atomic events

Domain mutation, Activity, and in-app Notification commit in one
transaction. External email is delivered through the transactional
Outbox, not inside the domain transaction.

### Deadlocks

PostgreSQL `40P01` may be retried a bounded number of times when the
entire transaction is safe to repeat. Correct lock ordering is primary
prevention; retry is recovery.

## 6. Retention and cleanup

  -----------------------------------------------------------------------
  Data                                V1 policy
  ----------------------------------- -----------------------------------
  Session                             Delete 30 days after expiry or
                                      revocation

  Invitation                          Retain while Organization exists;
                                      no automatic cleanup

  Outbox `SENT`/`FAILED`              30 days, then redact sensitive
                                      payload and delete

  Outbox `PENDING`/`PROCESSING`       Never eligible for terminal cleanup

  Activity                            Indefinite

  Notification                        90 days, including unread

  User, Organization, Membership,     No general physical-delete job
  Project, Issue, Comment             
  -----------------------------------------------------------------------

Cleanup is periodic, indexed, bounded, and batched. Invitation
expiration is separate from deletion: - Lazy validation rejects when
`expires_at <= NOW()`. - Scheduled worker changes stale `PENDING` to
`EXPIRED`. - Worker may use `FOR UPDATE SKIP LOCKED`.

## 7. Migration and seeding

### Migration authority

-   Prisma Migrate is the migration authority.
-   `schema.prisma` represents standard models, fields, relations,
    constraints, and indexes.
-   Custom SQL migrations implement PostgreSQL-specific features or
    constraints not adequately represented by Prisma.
-   Prisma schema and SQL migration history must remain consistent.
-   Applied migrations are immutable; corrections use new migrations.

### Workflow

-   Development: `prisma migrate dev`.
-   Production: `prisma migrate deploy`.
-   Do not use `prisma db push` as production migration mechanism.
-   Review generated and custom SQL before applying.
-   CI validates migration/schema consistency and tests against a
    migrated database.

### Deployment strategy

Use forward-only migrations. Do not rely on automatic down migrations.
Use expand-and-contract for risky/destructive changes. Roll back the
application only when schema remains backward-compatible. After
destructive schema/data changes, recovery uses backup/restore, not an
assumed reversible migration.

### Seeding

-   Development: useful sample Users, Organizations, Memberships,
    Projects, and Issues.
-   Test: isolated, minimal, deterministic fixtures controlled by tests.
-   Production: no dummy seed data.
-   Production bootstrap, if needed, is a separate deliberate procedure.
-   Seeds should be idempotent where practical and contain no real
    credentials/secrets.

## 8. Database roles and privileges

Use three roles:

  Role             Responsibility
  ---------------- -----------------------------------
  `app_runtime`    API and worker runtime
  `app_migrator`   Prisma Migrate and schema changes
  `db_admin`       Administration and maintenance

API and worker use `app_runtime`; CI/CD migration uses `app_migrator`;
application processes never use admin credentials. Runtime roles do not
receive `SUPERUSER`, `CREATEDB`, or `CREATEROLE`. `app_runtime` receives
only required DML privileges. On `activities`, it receives `SELECT` and
`INSERT`, but not `UPDATE` or `DELETE`.

## 9. Security

-   Passwords use Argon2id.
-   Session and Invitation tokens are cryptographically random.
-   Authoritative tables store token hashes only.
-   Raw Invitation token is encrypted only in Outbox payload using
    AES-256-GCM.
-   Encryption keys are external to the database; payload includes key
    version.
-   Logs exclude passwords, raw tokens, keys, decrypted payloads, and
    sensitive Comment bodies.
-   Database access follows least privilege.
-   Composite FKs enforce tenant referential integrity.
-   Application authorization remains mandatory; referential integrity
    is not an authorization system.

## 10. Deferred and excluded from V1

-   UUID v7; `CITEXT`; global/fuzzy/semantic Issue search.
-   Dedicated Issue status/assignee indexes without profiling evidence.
-   PostgreSQL Row-Level Security.
-   Global `SERIALIZABLE` isolation.
-   Automatic down migrations.
-   Activity retention cleanup; Organization physical deletion.
-   Custom Issue workflows.
-   Kubernetes/multi-instance database architecture.
-   PITR; distributed tracing.
-   Numeric performance SLOs before workload baseline.

## 11. Implementation readiness checklist

-   [ ] Prisma models match the approved relational schema.
-   [ ] Custom SQL migrations contain partial indexes and unsupported
    CHECK/privilege definitions.
-   [ ] Tenant-sensitive relations have the intended composite FKs.
-   [ ] Domain FKs use `ON DELETE RESTRICT`.
-   [ ] FK indexes are reviewed for coverage and query patterns.
-   [ ] Invitation advisory lock and partial unique index tested under
    concurrency.
-   [ ] Last Owner protection tested under concurrent demotion/removal.
-   [ ] Assignment vs Membership revocation tested under concurrency.
-   [ ] Issue number allocation tested under concurrent creation.
-   [ ] OCC conflict behavior tested.
-   [ ] Domain mutation, Activity, and Notification atomicity tested.
-   [ ] Outbox lease recovery and stale-worker protection tested.
-   [ ] Retention jobs are bounded, indexed, and safe under concurrency.
-   [ ] Runtime, migrator, and admin roles are separated and verified.
-   [ ] Activity append-only privilege verified using runtime role.
-   [ ] Migrations apply cleanly from an empty database.
-   [ ] Production uses `prisma migrate deploy`.
-   [ ] Development seeds and test fixtures are separate.
-   [ ] Backup restoration is tested operationally.

## 12. Decision register

  ID      Decision
  ------- ------------------------------------------------------------
  DB-01   Composite FKs for tenant referential integrity
  DB-02   Application-generated UUID v4
  DB-03   Invitation resend cooldown in `last_resent_at`
  DB-04   Atomic Project counter for Issue numbering
  DB-05   Unique `(activity_id, recipient_user_id)`
  DB-06   Notification content JSON has `schemaVersion: 1`
  DB-07   Encrypted raw Invitation token in Outbox; key external
  DB-08   Outbox lease-based crash recovery
  DB-09   Active Membership and roster indexes
  DB-10   Active and archived Project listing indexes
  DB-11   Minimal Issue indexes; defer unproven indexes
  DB-12   Organization Activity listing index
  DB-13   Notification inbox, unread, and retention indexes
  DB-14   Outbox pending and expired-lease indexes
  DB-15   Organization row lock protects Last Owner
  DB-16   Invitation advisory lock plus partial unique index
  DB-17   Membership lock protects assignment/revocation race
  DB-18   OCC via conditional version updates
  DB-19   Domain mutation, Activity, Notification in one transaction
  DB-20   `READ COMMITTED` plus explicit locks
  DB-21   Prisma Migrate is migration authority
  DB-22   Environment-specific seeds; no production dummy data
  DB-23   UUID v4 retained for V1
  DB-24   Query-driven FK/index strategy
  DB-25   `ON DELETE RESTRICT` for domain FKs
  DB-26   Activity append-only via database privileges
  DB-27   Outbox state/lease consistency via CHECK constraints
  DB-28   Global lock ordering protocol
  DB-29   Deterministic local constraints enforced by DB
  DB-30   AES-256-GCM for encrypted Invitation token payload
  DB-31   Chronological Comment listing index
  DB-32   Application-managed `updated_at`; no general trigger
  DB-33   UTC and `TIMESTAMPTZ(3)`
  DB-34   `VARCHAR` email with application normalization
  DB-35   Session cleanup after 30 days
  DB-36   Invitation retained; terminal Outbox records 30 days
  DB-37   Activity indefinite; Notification 90 days
  DB-38   Notification retention index and batched cleanup
  DB-39   Lazy and scheduled Invitation expiration
  DB-40   Bounded configurable connection pools
  DB-41   Bounded transaction `maxWait` and `timeout`
  DB-42   Configurable `statement_timeout` and `lock_timeout`
  DB-43   Hybrid Prisma schema and custom SQL
  DB-44   Runtime, migrator, and admin roles separated
  DB-45   Forward-only migrations with expand-and-contract
  DB-46   Final consistency review and explicit advisory-lock order

## 13. Final status

Phase 0.3 is finalized as a design artifact and is ready to guide Prisma
schema modeling, custom SQL migration authoring, and database
implementation. This does not mean the schema has already been
implemented, migrated, load-tested, or security-tested.
