# Database Design

| Field | Value |
|---|---|
| Status | Active |
| Owner | T. Tamil Arsen |
| Last updated | 2026-11-11 |
| Database | PostgreSQL 18 |
| ORM / migrations | Prisma 7 / Prisma Migrate |

This document is the authority for the relational design. It describes the **target** schema; the schema that actually exists is whatever `apps/api/prisma/migrations` produces, and the [Roadmap](../plan/roadmap.md) tracks the gap between the two.

---

## 1. Purpose and authority

This document translates the [Requirements](../product/requirements.md), [Domain Model](domain-model.md), and [Permissions](permissions.md) into a PostgreSQL persistence model.

It is authoritative for:

- Physical tables, columns, PostgreSQL types, nullability, and defaults.
- Primary keys, foreign keys, unique constraints, check constraints, and indexes.
- Transaction boundaries and database-level concurrency controls.
- Persistence lifecycle, retention, and cleanup behavior.
- Prisma schema and custom SQL migration expectations.

It does not redefine product scope, domain meaning, role permissions, or HTTP contracts.

### 1.1 Relationship to other documents

Product scope belongs to the [PRD](../product/prd.md), domain meaning to the [Domain Model](domain-model.md), role rules to [Permissions](permissions.md), and HTTP behavior to the [API Contract](api/contract.md). If this document disagrees with one of them, record the mismatch and resolve it in the owning document. Do not change a product or domain rule to make a schema easier to implement.

### 1.2 V1 persistence boundary

V1 uses one PostgreSQL database for a single-VPS deployment. The design does not assume multi-region deployment, horizontal database sharding, or a distributed database.

The database must support:

- Global User identity and multiple organization memberships.
- Organization-scoped resources and tenant-safe relationships.
- Session and Invitation token verification without storing raw tokens.
- Project and Issue lifecycle, including archive and restore.
- Comments, append-only Activity, and recipient-scoped Notifications.
- Durable asynchronous Invitation delivery through an Outbox.
- Atomic enforcement of critical multi-row invariants.

---

## 2. Design principles

1. **Tenant integrity is structural.** Tenant-owned relationships use composite foreign keys where applicable. Application filters alone are insufficient.
2. **Authorization remains an application responsibility.** A valid foreign key does not prove that a Membership is active or that a User has permission.
3. **Preserve history.** Membership removal, archive, and comment deletion are state transitions, not broad cascading deletes.
4. **Use transactions for invariants.** Operations that change multiple related records commit or roll back as one unit.
5. **Use database constraints for deterministic local rules.** Required values, enum-like states, uniqueness, and timestamp consistency should be constrained in PostgreSQL.
6. **Use explicit locking for cross-row invariants.** A `CHECK` constraint cannot safely enforce “at least one active Owner” across rows.
7. **Avoid speculative indexes.** Indexes should serve known query patterns and be validated with query plans.
8. **Keep external I/O outside transactions.** Email delivery happens through the Outbox worker, never while holding a domain transaction open.

---

## 3. Relational model overview

### 3.1 Tables

| Domain | Tables |
|---|---|
| Identity | `users`, `sessions` |
| Organization | `organizations`, `memberships`, `invitations` |
| Project management | `projects`, `issues`, `labels`, `issue_labels` |
| Collaboration | `comments`, `activities`, `notifications` |
| Asynchronous processing | `outbox_events` |

`issue_labels` is a relational join table, not an independent domain aggregate.

### 3.2 Main relationships

- User 1:N Session.
- User 1:N Membership; Organization 1:N Membership.
- Organization 1:N Invitation, Project, Label, and Activity.
- Project 1:N Issue.
- Issue N:N Label through `issue_labels`.
- Issue 1:N Comment.
- Membership may be the assignee of many Issues and author of many Comments.
- Activity 1:N Notification.
- Invitation 1:N OutboxEvent.

### 3.3 Tenant ownership

Organization is the tenant boundary.

The following records are organization-scoped and must carry `organization_id` where needed to enforce tenant consistency directly:

- Membership
- Invitation
- Project
- Issue
- Label
- Comment
- Activity
- Notification

`User` and `Session` are global identity/authentication records.

### 3.4 Tenant-safe foreign keys

Use composite foreign keys for tenant-sensitive references:

- Issue `(organization_id, project_id)` → Project `(organization_id, id)`.
- Issue `(organization_id, assignee_membership_id)` → Membership `(organization_id, id)`.
- IssueLabel `(organization_id, issue_id)` → Issue `(organization_id, id)`.
- IssueLabel `(organization_id, label_id)` → Label `(organization_id, id)`.
- Comment `(organization_id, issue_id)` → Issue `(organization_id, id)`.
- Comment `(organization_id, author_membership_id)` → Membership `(organization_id, id)`.
- Activity `(organization_id, issue_id)` → Issue `(organization_id, id)`.
- Notification `(organization_id, activity_id)` → Activity `(organization_id, id)`.

Each referenced pair `(organization_id, id)` must have a matching unique constraint.

A composite FK prevents a row in Organization A from referencing a Project, Issue, Membership, or Label in Organization B. It does not prove that the referenced Membership is `ACTIVE`; active-state validation remains transactional application logic.

---

## 4. Global conventions

### 4.1 Naming

- Use `snake_case` for PostgreSQL tables, columns, constraints, and indexes.
- Use plural table names.
- Use UUID identifiers.
- Use explicit constraint and index names.
- Prisma model and field names may use idiomatic TypeScript casing with `@@map` and `@map` where needed.

### 4.2 Identifiers

- PostgreSQL type: `UUID`.
- Application-generated identifiers: UUID v4 using `crypto.randomUUID()`.
- UUID v7 is deferred for V1.
- Do not use sequential integer IDs for externally addressable domain resources.

### 4.3 Timestamps

Use `TIMESTAMPTZ(3)` for persisted timestamps.

- Store and operate in UTC.
- Convert to a user's local timezone in the presentation layer.
- Millisecond precision aligns with JavaScript `Date`.
- `created_at` defaults to `NOW()`.
- `updated_at` is application-managed; no general-purpose update trigger.
- A real mutation updates `updated_at`; a no-op does not.
- Event timestamps are assigned within the transaction that records the event.

### 4.4 Email normalization

- Trim and lowercase email addresses in one shared application function.
- Store normalized values in `VARCHAR(254)`.
- Do not use `CITEXT` in V1.
- Unique constraints operate on normalized values.
- Registration, login, Invitation creation, and Invitation acceptance must use the same normalization behavior.
- Database checks can reject empty values but do not replace application normalization.

### 4.5 Deletion behavior

- Domain foreign keys use `ON DELETE RESTRICT` unless a narrowly scoped exception is explicitly documented.
- Do not cascade-delete business history.
- Physical deletion of Users and Organizations is not supported in V1.
- Membership removal changes status to `REMOVED`.
- Project and Issue use archive/restore.
- Comment deletion uses a tombstone (`deleted_at`).
- Activity is append-only.
- Retention cleanup is explicit, bounded, and limited to records with a defined retention policy.

### 4.6 Optimistic concurrency

The following mutable resources use `version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1)`:

- Organization
- Membership
- Project
- Issue
- Comment

A mutation uses a conditional update:

```sql
UPDATE some_table
SET ..., version = version + 1, updated_at = NOW()
WHERE id = $1
  AND version = $2
RETURNING *;
```

For organization-scoped resources, include `organization_id` in the predicate.

- A successful real mutation increments the version.
- A no-op does not increment the version.
- A stale version produces the API's version-conflict response (`409`).
- Optimistic concurrency does not replace explicit locks for multi-row invariants.

### 4.7 Enumerated values

Closed value sets are PostgreSQL native enum types, declared in Prisma with `enum` and `@@map` ([ADR-0005](../adr/0005-postgresql-native-enums.md)). The application never invents a value outside these types, and the database rejects any that slip through.

```sql
CREATE TYPE organization_role   AS ENUM ('OWNER', 'ADMIN', 'MEMBER');
CREATE TYPE membership_status   AS ENUM ('ACTIVE', 'REMOVED');
CREATE TYPE invitation_status   AS ENUM ('PENDING', 'ACCEPTED', 'REVOKED', 'EXPIRED');
CREATE TYPE issue_status        AS ENUM ('TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE', 'CANCELLED');
CREATE TYPE issue_priority      AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');
CREATE TYPE activity_event_type AS ENUM (/* the catalog in Domain Model §6.2 */);
CREATE TYPE notification_type   AS ENUM ('INVITATION_RECEIVED', 'ISSUE_ASSIGNED', 'COMMENT_ADDED', 'MEMBERSHIP_REMOVED');
CREATE TYPE outbox_event_type   AS ENUM ('INVITATION_EMAIL');
CREATE TYPE outbox_status       AS ENUM ('PENDING', 'PROCESSING', 'SENT', 'FAILED', 'SUPERSEDED');
```

Rules:

- `activity_event_type` contains exactly the catalog in [Domain Model §6.2](domain-model.md#62-activity). Values are added by the migration of the slice that first emits them, never in advance.
- Adding a value (`ALTER TYPE ... ADD VALUE`) is a normal forward migration. Removing or renaming a value requires a data migration and an ADR; V1 does not plan any.
- Declaration order is meaningful only for `issue_priority` (`LOW < MEDIUM < HIGH < URGENT`), which allows `ORDER BY priority`.
- API JSON uses the same uppercase string values.

### 4.8 Text length limits

Length limits are defined once, in [API Conventions §7.1](api/conventions.md#71-field-limits). Columns use `VARCHAR(n)` or `TEXT` with a `CHECK (char_length(col) <= n)` so the database enforces the same ceiling as the API. JavaScript string length counts UTF-16 code units while `char_length` counts code points, so the application check is never looser than the database check.

---

## 5. Table specifications

The SQL below is the intended relational shape. It is illustrative implementation SQL; Prisma models and custom migrations must be kept consistent with it.

### 5.1 `users`

Global account identity.

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY,
  email VARCHAR(254) NOT NULL,
  password_hash TEXT NOT NULL,
  display_name VARCHAR(100) NOT NULL,
  created_at TIMESTAMPTZ(3) NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ(3) NOT NULL DEFAULT NOW(),
  CONSTRAINT users_email_unique UNIQUE (email),
  CONSTRAINT users_email_nonempty CHECK (length(trim(email)) > 0),
  CONSTRAINT users_display_name_nonempty
    CHECK (length(trim(display_name)) > 0)
);
```

Rules:

- `email` contains the normalized address.
- `password_hash` contains an Argon2id password hash, never plaintext.
- Email is globally unique.
- A User is not owned by an Organization and has no global organization role.

### 5.2 `sessions`

Authenticated login sessions.

```sql
CREATE TABLE sessions (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL
    REFERENCES users(id) ON DELETE RESTRICT,
  token_hash VARCHAR(64) NOT NULL,
  created_at TIMESTAMPTZ(3) NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ(3) NOT NULL,
  absolute_expires_at TIMESTAMPTZ(3) NOT NULL,
  revoked_at TIMESTAMPTZ(3),
  CONSTRAINT sessions_token_hash_unique UNIQUE (token_hash),
  CONSTRAINT sessions_token_hash_length CHECK (char_length(token_hash) = 64),
  CONSTRAINT sessions_expiry_after_creation
    CHECK (expires_at > created_at),
  CONSTRAINT sessions_expiry_within_absolute
    CHECK (expires_at <= absolute_expires_at)
);

CREATE INDEX sessions_user_id_idx
  ON sessions(user_id);

CREATE INDEX sessions_expires_at_idx
  ON sessions(expires_at);
```

Partial indexes for session cleanup (`WHERE revoked_at IS NULL` / `IS NOT NULL`) are deferred to the cleanup job: they are added with that job, in hand-written SQL, once a query needs them. `memberships_user_status_idx` is a plain composite index rather than a partial one because the schema file cannot declare partial indexes and an undeclared index would show up as drift; with only two statuses the difference is negligible at V1 scale.

Rules:

- Raw opaque session token: cryptographically random 32 bytes.
- Store only its SHA-256 lowercase-hex hash.
- Fixed lifetime: seven days from creation, capped by `absolute_expires_at`.
- No sliding expiration on use.
- Login sets `absolute_expires_at = created_at + 30 days`.
- Refresh is atomic rotation: revoke the old Session and create a new Session with a new token hash, `absolute_expires_at` copied from the old Session, and `expires_at = LEAST(NOW() + 7 days, absolute_expires_at)`.
- Only one concurrent refresh using the same old token may succeed.
- Reuse of a rotated token is rejected and logged; it does not automatically revoke the replacement Session.
- No grace window.
- Logout revokes only the current Session.
- Expired or revoked Sessions are eligible for deletion 30 days after expiry/revocation through bounded cleanup batches.

The application must validate `revoked_at IS NULL` and `expires_at > NOW()` for authentication.

Refresh concurrency protocol:

```sql
UPDATE sessions
SET revoked_at = NOW()
WHERE id = $1
  AND user_id = $2
  AND revoked_at IS NULL
  AND expires_at > NOW()
RETURNING user_id, absolute_expires_at;
```

The `UPDATE` above also returns `absolute_expires_at` (`RETURNING user_id, absolute_expires_at`). The conditional revocation and insertion of the replacement Session occur in one transaction. Exactly one concurrent refresh can update the old row and receive a returned row; competing attempts receive no row and fail with `INVALID_SESSION`. Do not revoke the old Session in a separate transaction from creating the replacement.

### 5.3 `organizations`

Tenant root.

```sql
CREATE TABLE organizations (
  id UUID PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
  created_at TIMESTAMPTZ(3) NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ(3) NOT NULL DEFAULT NOW(),
  CONSTRAINT organizations_name_nonempty
    CHECK (length(trim(name)) > 0)
);
```

Rules:

- Organization names are not globally unique.
- `id` is the stable identity.
- No Organization archive or physical deletion in V1.
- The Organization row is the serialization point for operations that may change the active Owner count.
- Creating an Organization and its initial Owner Membership must occur in one transaction.

### 5.4 `memberships`

Association entity connecting a User to an Organization and carrying organization-scoped role and membership state.

```sql
CREATE TABLE memberships (
  id UUID NOT NULL UNIQUE,
  organization_id UUID NOT NULL
    REFERENCES organizations(id) ON DELETE RESTRICT,
  user_id UUID NOT NULL
    REFERENCES users(id) ON DELETE RESTRICT,
  role organization_role NOT NULL,
  status membership_status NOT NULL DEFAULT 'ACTIVE',
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
  joined_at TIMESTAMPTZ(3) NOT NULL DEFAULT NOW(),
  removed_at TIMESTAMPTZ(3),
  created_at TIMESTAMPTZ(3) NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ(3) NOT NULL DEFAULT NOW(),
  CONSTRAINT memberships_pk PRIMARY KEY (organization_id, user_id),
  CONSTRAINT memberships_org_id_unique UNIQUE (organization_id, id),
  CONSTRAINT memberships_status_timestamp_consistent CHECK (
    (status = 'ACTIVE' AND removed_at IS NULL)
    OR
    (status = 'REMOVED' AND removed_at IS NOT NULL)
  )
);

CREATE INDEX memberships_user_status_idx
  ON memberships(user_id, status);

CREATE INDEX memberships_org_roster_idx
  ON memberships(organization_id, status, joined_at DESC, id DESC);
```

Key decision:

- The logical and primary key is `(organization_id, user_id)`, enforcing at most one Membership per User/Organization pair.
- A separate UUID `id` is retained as a unique alternate identifier because the API exposes `membershipId` as a resource identifier and other records need a stable membership reference.
- Tenant-sensitive references to a Membership use `(organization_id, id)`, not `id` alone.

Lifecycle:

- `ACTIVE` grants organization membership subject to role permissions.
- `REMOVED` preserves the relationship and history but grants no access.
- Rejoining reactivates the same Membership row; it does not create a second row.
- Reactivation updates role and membership lifecycle timestamps according to the Invitation acceptance operation.
- Removal and automatic unassignment of the member's Issues occur in one transaction.
- Historical Comment and Activity attribution remains intact.

Important invariant:

- Every Organization must have at least one active `OWNER`.
- A database `CHECK` constraint cannot enforce this cross-row invariant.
- All operations that may demote or remove an Owner must lock the Organization row before checking and changing Membership rows.

### 5.5 `invitations`

Invitation lifecycle and token verification.

```sql
CREATE TABLE invitations (
  id UUID PRIMARY KEY,
  organization_id UUID NOT NULL
    REFERENCES organizations(id) ON DELETE RESTRICT,
  email VARCHAR(254) NOT NULL,
  role organization_role NOT NULL
    CHECK (role <> 'OWNER'),
  invited_by_user_id UUID NOT NULL
    REFERENCES users(id) ON DELETE RESTRICT,
  status invitation_status NOT NULL DEFAULT 'PENDING',
  token_hash VARCHAR(64) NOT NULL,
  token_version INTEGER NOT NULL DEFAULT 1 CHECK (token_version >= 1),
  expires_at TIMESTAMPTZ(3) NOT NULL,
  accepted_at TIMESTAMPTZ(3),
  revoked_at TIMESTAMPTZ(3),
  created_at TIMESTAMPTZ(3) NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ(3) NOT NULL DEFAULT NOW(),
  CONSTRAINT invitations_token_hash_unique UNIQUE (token_hash),
  CONSTRAINT invitations_email_nonempty CHECK (length(trim(email)) > 0),
  CONSTRAINT invitations_expiry_after_creation
    CHECK (expires_at > created_at),
  CONSTRAINT invitations_accepted_timestamp_consistent CHECK (
    (status = 'ACCEPTED' AND accepted_at IS NOT NULL)
    OR
    (status <> 'ACCEPTED' AND accepted_at IS NULL)
  ),
  CONSTRAINT invitations_revoked_timestamp_consistent CHECK (
    (status = 'REVOKED' AND revoked_at IS NOT NULL)
    OR
    (status <> 'REVOKED' AND revoked_at IS NULL)
  )
);

CREATE UNIQUE INDEX invitations_one_pending_per_org_email
  ON invitations(organization_id, email)
  WHERE status = 'PENDING';

CREATE INDEX invitations_pending_expiration_idx
  ON invitations(expires_at)
  WHERE status = 'PENDING';
```

Rules:

- Invitation email is normalized using the same function as User email.
- Invitation roles are `ADMIN` or `MEMBER`; an Owner cannot be invited directly.
- Invitation lifetime is seven days.
- Acceptance requires an authenticated User whose normalized email matches the Invitation email.
- Only `PENDING` invitations may be accepted, revoked, or resent.
- Expiry is authoritative: reject when `expires_at <= NOW()`, even if a scheduled worker has not yet changed status.
- Resending rotates the token, updates `token_hash`, invalidates the old token, and does not silently extend the original expiry unless the product requirement is changed.
- The old raw token must no longer verify after the resend transaction commits.
- A partial unique index ensures at most one `PENDING` Invitation per Organization and normalized email.

Concurrency:

- Use a transaction-level advisory lock keyed deterministically from `(organization_id, normalized_email)` for create/resend/expire operations that could race.
- Expire stale pending records before inserting a replacement.
- Treat the partial unique index as the final integrity defense.
- Do not use `NOW()` in a partial-index predicate.
- Acceptance and revocation must lock the Invitation row and conditionally transition only a still-pending, unexpired Invitation.
- Invitation acceptance, Membership creation/reactivation, and corresponding Activity must be atomic.

Resend policy (V1 decision): enforce a minimum 60-second cooldown between successful resend operations for the same Invitation and allow at most five successful resend operations per Invitation in any rolling 24-hour window. A resend operation counts when the transaction that rotates the Invitation token and creates its Outbox event commits successfully; whether the email provider later delivers or rejects the message does not change the count. A request rejected by cooldown or rate limiting does not consume quota, rotate the token, or create an Outbox event. Apply checks atomically while holding the Invitation row lock. Count resend operations from Outbox records for that Invitation with `invitation_token_version > 1` and `created_at` within the rolling 24-hour window; the initial invitation event (`token_version = 1`) is excluded. Terminal Outbox records are retained for 30 days, which exceeds the 24-hour counting window. The `outbox_invitation_resend_window_idx` index supports the rolling-window count. Resend rotates the token, invalidates the previous token, and does not extend the original seven-day expiry. An expired Invitation must be replaced with a new Invitation rather than resent.

### 5.6 `projects`

Organization-owned work container.

```sql
CREATE TABLE projects (
  id UUID PRIMARY KEY,
  organization_id UUID NOT NULL
    REFERENCES organizations(id) ON DELETE RESTRICT,
  name VARCHAR(100) NOT NULL,
  description TEXT CHECK (char_length(description) <= 5000),
  next_issue_number INTEGER NOT NULL DEFAULT 1
    CHECK (next_issue_number >= 1),
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

Rules:

- Project names are not assumed globally unique.
- All active Organization roles may create and read Projects.
- Only `OWNER` and `ADMIN` may update, archive, or restore Projects.
- Archiving a Project does not automatically archive its Issues.
- Archived Projects cannot accept new Issues or be modified.
- Restoring a Project does not automatically restore archived Issues.
- Projects cannot move between Organizations in V1.

### 5.7 `issues`

Work item belonging to exactly one Project and Organization.

```sql
CREATE TABLE issues (
  id UUID PRIMARY KEY,
  organization_id UUID NOT NULL,
  project_id UUID NOT NULL,
  number INTEGER NOT NULL CHECK (number >= 1),
  title VARCHAR(200) NOT NULL,
  description TEXT CHECK (char_length(description) <= 10000),
  status issue_status NOT NULL DEFAULT 'TODO',
  priority issue_priority NOT NULL DEFAULT 'MEDIUM',
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
  ON issues(project_id, number DESC)
  WHERE archived_at IS NULL;

CREATE INDEX issues_project_archived_listing_idx
  ON issues(project_id, number DESC)
  WHERE archived_at IS NOT NULL;
```

Rules:

- Composite FKs enforce that Project and assignee Membership belong to the same Organization.
- The application must additionally verify that the assignee Membership is `ACTIVE`.
- Priority is one of `LOW`, `MEDIUM`, `HIGH`, or `URGENT`; new Issues default to `MEDIUM`. The `issue_priority` enum is the final integrity defense. Values are ordered LOW < MEDIUM < HIGH < URGENT; they are not workflow states.
- All active roles may perform Issue operations allowed by the Permissions, including archive/restore.
- Issue status transitions are enforced by the domain layer (the enum only restricts the value set). The matrix is owned by [Domain Model §5.2](domain-model.md#52-issue) and repeated here for convenience:

| Current | Allowed next statuses |
|---|---|
| TODO | IN_PROGRESS, CANCELLED |
| IN_PROGRESS | IN_REVIEW, CANCELLED |
| IN_REVIEW | IN_PROGRESS, DONE, CANCELLED |
| DONE | IN_PROGRESS |
| CANCELLED | TODO |

- Issues in archived Projects cannot be modified.
- An archived Issue cannot be modified until restored.
- Restoring an Issue requires its parent Project to be active.
- Removing a Membership unassigns its Issues in the same transaction.
- No custom workflow is included in V1.

Issue number allocation:

```sql
UPDATE projects
SET next_issue_number = next_issue_number + 1
WHERE id = $1
  AND organization_id = $2
  AND archived_at IS NULL
RETURNING next_issue_number - 1 AS allocated_number;
```

Run the counter update, Issue insert, and corresponding Activity insert in one transaction. The counter is internal allocation state; incrementing it does not represent a user-facing Project edit and therefore does not increment the Project's optimistic-concurrency `version` or `updated_at`. The unique constraint on `(project_id, number)` is the final integrity defense.

### 5.8 `labels`

Organization-scoped labels available to Issues.

```sql
CREATE TABLE labels (
  id UUID PRIMARY KEY,
  organization_id UUID NOT NULL
    REFERENCES organizations(id) ON DELETE RESTRICT,
  name VARCHAR(50) NOT NULL,
  normalized_name TEXT NOT NULL,
  archived_at TIMESTAMPTZ(3),
  created_at TIMESTAMPTZ(3) NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ(3) NOT NULL DEFAULT NOW(),
  CONSTRAINT labels_org_id_unique UNIQUE (organization_id, id),
  CONSTRAINT labels_name_nonempty CHECK (length(trim(name)) > 0),
  CONSTRAINT labels_normalized_name_nonempty CHECK (length(normalized_name) > 0)
);

CREATE UNIQUE INDEX labels_active_name_unique
  ON labels(organization_id, normalized_name)
  WHERE archived_at IS NULL;

CREATE INDEX labels_org_name_lookup_idx
  ON labels(organization_id, normalized_name);
```

Label policy (V1 decision):

- Any active Organization Member may create, rename, archive, and restore Labels, consistent with the existing Issue-label permission rule.
- A Label name is trimmed, Unicode-normalized with NFKC, internal whitespace is collapsed to one ASCII space, and the comparison key is Unicode case-folded. Store the display form in `name` and the canonical comparison key in `normalized_name`. Generate both in the application using one shared normalization function; do not rely on PostgreSQL `LOWER()` to implement Unicode case-folding.
- Active Label names must be unique within an Organization after normalization. The partial unique index enforces this. Archived Labels do not reserve a name.
- Rename follows the same normalization and uniqueness rules. A rename that collides with another active Label is rejected.
- Deletion means archive (`archived_at`), never physical deletion in V1. Archived Labels cannot be newly attached to Issues. Existing `issue_labels` associations are retained so historical Issue views remain stable; archived Labels are visibly marked as archived. Restoring a Label is allowed only if its normalized name is not currently used by another active Label.
- Do not add color, description, or custom metadata in V1. Hard deletion and automatic cleanup are excluded.

### 5.9 `issue_labels`

Join table for the many-to-many Issue/Label relationship.

```sql
CREATE TABLE issue_labels (
  organization_id UUID NOT NULL,
  issue_id UUID NOT NULL,
  label_id UUID NOT NULL,
  created_at TIMESTAMPTZ(3) NOT NULL DEFAULT NOW(),
  CONSTRAINT issue_labels_pk
    PRIMARY KEY (issue_id, label_id),
  CONSTRAINT issue_labels_issue_tenant_fk
    FOREIGN KEY (organization_id, issue_id)
    REFERENCES issues(organization_id, id) ON DELETE RESTRICT,
  CONSTRAINT issue_labels_label_tenant_fk
    FOREIGN KEY (organization_id, label_id)
    REFERENCES labels(organization_id, id) ON DELETE RESTRICT
);

CREATE INDEX issue_labels_label_lookup_idx
  ON issue_labels(organization_id, label_id, issue_id);
```

Rules:

- The composite foreign keys prevent attaching a Label from another Organization.
- Add/remove operations must verify the Issue and Project are in a mutable state.
- The application must not treat the join row as authorization evidence.

### 5.10 `comments`

Issue discussion with tombstone deletion.

```sql
CREATE TABLE comments (
  id UUID PRIMARY KEY,
  organization_id UUID NOT NULL,
  issue_id UUID NOT NULL,
  author_membership_id UUID NOT NULL,
  body TEXT CHECK (char_length(body) <= 10000),
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
  CONSTRAINT comments_body_tombstone_consistent CHECK (
    (deleted_at IS NULL AND body IS NOT NULL AND length(trim(body)) > 0)
    OR (deleted_at IS NOT NULL AND body IS NULL)
  )
);

CREATE INDEX comments_issue_chronological_idx
  ON comments(issue_id, created_at ASC, id ASC);
```

Rules:

- Author Membership must be active when a Comment is created.
- All active roles may read/create Comments subject to resource access.
- The author may edit/delete their own Comment.
- `OWNER` and `ADMIN` may manage other members' Comments.
- Delete is a tombstone operation: in the same transaction set `deleted_at` and set `body = NULL`. The Comment row, ID, author reference, creation timestamp, and deletion timestamp remain as historical context; the user-authored body is erased immediately.
- API presentation uses a deleted placeholder and never exposes the deleted body.
- Activity metadata must not copy Comment body text.
- No automatic physical purge of Comment tombstones occurs in V1. Any future legal-erasure workflow must be separately specified; this retention decision is not a promise that all personal data is erased.
- Comments cannot be created or updated when the Issue or Project is archived.
- Historical author attribution remains available after Membership removal.
- Maximum body length is 10,000 characters (§4.8). PostgreSQL `trim()` is not a complete Unicode whitespace policy, so application validation remains authoritative for whitespace normalization.

V1 retention decision: erase the Comment body at logical deletion and retain the metadata-only tombstone indefinitely. Do not run an automatic tombstone purge in V1.

### 5.11 `activities`

Append-only organization activity stream.

```sql
CREATE TABLE activities (
  id UUID PRIMARY KEY,
  organization_id UUID NOT NULL
    REFERENCES organizations(id) ON DELETE RESTRICT,
  actor_user_id UUID
    REFERENCES users(id) ON DELETE RESTRICT,
  issue_id UUID,
  event_type activity_event_type NOT NULL,
  metadata JSONB NOT NULL
    CHECK (jsonb_typeof(metadata) = 'object'),
  created_at TIMESTAMPTZ(3) NOT NULL DEFAULT NOW(),
  CONSTRAINT activities_org_id_unique UNIQUE (organization_id, id),
  CONSTRAINT activities_issue_tenant_fk
    FOREIGN KEY (organization_id, issue_id)
    REFERENCES issues(organization_id, id) ON DELETE RESTRICT
);

CREATE INDEX activities_org_listing_idx
  ON activities(organization_id, created_at DESC, id DESC);

CREATE INDEX activities_org_issue_listing_idx
  ON activities(organization_id, issue_id, created_at DESC, id DESC)
  WHERE issue_id IS NOT NULL;
```

Rules:

- `actor_user_id` is nullable for system-generated events.
- `issue_id` is nullable for organization-level events.
- There is one Organization-level Activity stream. Issue-level Activity is a filtered view of the same records, not a second event store.
- Metadata follows the envelope `{ schemaVersion, entityType, entityId, changes }` defined in [Domain Model §6.2](domain-model.md#62-activity).
- Migration order: `activities` is created together with `organizations` because Organization creation writes Activity. `issues` does not exist yet at that point, so `issue_id` is created as a plain nullable column, and `activities_issue_tenant_fk` is added by the migration that creates `issues`.
- Do not store passwords, raw tokens, secrets, or Comment body text in Activity metadata.
- Activity is append-only.
- In production, the runtime database role receives `SELECT` and `INSERT`, not `UPDATE` or `DELETE` (§10). Until role separation exists, append-only is enforced by the application having no update/delete code path for Activity.
- Activity is retained indefinitely in V1.

### 5.12 `notifications`

Recipient-scoped in-app notifications.

```sql
CREATE TABLE notifications (
  id UUID PRIMARY KEY,
  organization_id UUID NOT NULL
    REFERENCES organizations(id) ON DELETE RESTRICT,
  recipient_user_id UUID NOT NULL
    REFERENCES users(id) ON DELETE RESTRICT,
  activity_id UUID NOT NULL,
  type notification_type NOT NULL,
  content JSONB NOT NULL
    CHECK (jsonb_typeof(content) = 'object'),
  read_at TIMESTAMPTZ(3),
  created_at TIMESTAMPTZ(3) NOT NULL DEFAULT NOW(),
  CONSTRAINT notifications_activity_tenant_fk
    FOREIGN KEY (organization_id, activity_id)
    REFERENCES activities(organization_id, id) ON DELETE RESTRICT,
  CONSTRAINT notifications_one_per_activity_recipient
    UNIQUE (activity_id, recipient_user_id)
);

CREATE INDEX notifications_recipient_listing_idx
  ON notifications(recipient_user_id, created_at DESC, id DESC);

CREATE INDEX notifications_recipient_unread_idx
  ON notifications(recipient_user_id, created_at DESC, id DESC)
  WHERE read_at IS NULL;

CREATE INDEX notifications_read_retention_idx
  ON notifications(read_at)
  WHERE read_at IS NOT NULL;

CREATE INDEX notifications_unread_retention_idx
  ON notifications(created_at)
  WHERE read_at IS NULL;
```

Rules:

- Notification has no Membership FK. This is deliberate: a removed member may still read the final account-level Membership-removal notification without regaining Organization access.
- `content` is a display snapshot with an explicit schema version and minimal resource context.
- Mark-one-read is idempotent while the Notification is already read: it does not reset `read_at`. Transitioning from unread to read sets `read_at` to the current timestamp. Marking unread sets `read_at = NULL`. A later unread-to-read transition sets a new timestamp and therefore a new 180-day retention deadline. Mark-all-read updates only the recipient's unread Notifications; already-read timestamps are not reset.
- Create Notifications in the event-generation transaction using the recipient rules in [Domain Model §6.3](domain-model.md#63-notification). No actor self-notifications, no broadcasts, at most one Notification per event and recipient.
- The unique `(activity_id, recipient_user_id)` constraint prevents duplicate notification rows for the same event and recipient.
- Retention decision (V1): delete a read Notification 180 days after its current `read_at`; delete an unread Notification 365 days after `created_at`. Marking unread sets `read_at = NULL`; a later read transition sets `read_at` to that transition timestamp and establishes a new 180-day deadline. Repeated read requests while already read are idempotent and do not reset the timestamp. Cleanup evaluates the row's current state and corresponding deadline at deletion time, uses bounded batches, and must not delete before that deadline. The deletion predicate must be evaluated atomically against the current row state so a concurrent read/unread transition cannot cause premature deletion. A removed User's final membership-removal Notification follows the same recipient-level retention rule.

### 5.13 `outbox_events`

Durable asynchronous delivery work. V1 uses this table for Invitation email delivery.

```sql
CREATE TABLE outbox_events (
  id UUID PRIMARY KEY,
  invitation_id UUID NOT NULL
    REFERENCES invitations(id) ON DELETE RESTRICT,
  invitation_token_version INTEGER NOT NULL
    CHECK (invitation_token_version >= 1),
  event_type outbox_event_type NOT NULL,
  payload JSONB NOT NULL
    CHECK (jsonb_typeof(payload) = 'object'),
  status outbox_status NOT NULL DEFAULT 'PENDING',
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  available_at TIMESTAMPTZ(3) NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ(3),
  last_error TEXT,
  locked_at TIMESTAMPTZ(3),
  lease_expires_at TIMESTAMPTZ(3),
  worker_id VARCHAR(100),
  created_at TIMESTAMPTZ(3) NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ(3) NOT NULL DEFAULT NOW(),
  CONSTRAINT outbox_invitation_generation_unique
    UNIQUE (invitation_id, invitation_token_version, event_type),
  CONSTRAINT outbox_state_lease_consistent CHECK (
    (
      status = 'PROCESSING'
      AND locked_at IS NOT NULL
      AND lease_expires_at IS NOT NULL
      AND worker_id IS NOT NULL
      AND processed_at IS NULL
    )
    OR
    (
      status IN ('PENDING', 'SENT', 'FAILED', 'SUPERSEDED')
      AND locked_at IS NULL
      AND lease_expires_at IS NULL
      AND worker_id IS NULL
    )
  ),
  CONSTRAINT outbox_terminal_timestamp_consistent CHECK (
    (status IN ('SENT', 'FAILED', 'SUPERSEDED') AND processed_at IS NOT NULL)
    OR
    (status IN ('PENDING', 'PROCESSING') AND processed_at IS NULL)
  )
);

CREATE INDEX outbox_pending_available_idx
  ON outbox_events(available_at ASC, created_at ASC)
  WHERE status = 'PENDING';

CREATE INDEX outbox_expired_lease_idx
  ON outbox_events(lease_expires_at ASC)
  WHERE status = 'PROCESSING';

CREATE INDEX outbox_invitation_idx
  ON outbox_events(invitation_id);

CREATE INDEX outbox_invitation_resend_window_idx
  ON outbox_events(invitation_id, created_at DESC)
  WHERE invitation_token_version > 1;
```

Rules:

- Invitation row and OutboxEvent are inserted in the same transaction.
- Invitation table stores only the token hash.
- The delivery payload contains encrypted token material, never plaintext at rest.
- Use AES-256-GCM with a 256-bit key held outside the database, a unique 96-bit nonce per encryption, a 128-bit authentication tag, and a key-version field.
- Never log raw tokens, encryption keys, decrypted payloads, or sensitive delivery data.
- Worker claims records using a short transaction and `FOR UPDATE SKIP LOCKED`.
- Worker state transitions:
  - `PENDING` → `PROCESSING`: set worker and lease fields.
  - `PROCESSING` → `SENT`: set `processed_at`, clear lease fields.
  - `PROCESSING` → `FAILED`: set `processed_at`, clear lease fields.
  - `PROCESSING` → `PENDING`: transient failure; set future `available_at`, clear lease fields.
  - Obsolete Invitation token version: set `SUPERSEDED`, set `processed_at`, and clear lease fields without sending.
  - Expired `PROCESSING` lease: eligible for reclaim.
- Updates must be conditional on current lease ownership so a stale worker cannot overwrite a newer worker's result.
- Delivery is at-least-once, not exactly-once. Use provider idempotency support if available.
- Retry policy (V1 decision): `attempts` counts worker delivery attempts and is incremented when a worker claims an event. Allow at most eight total attempts, including the initial attempt. Retry transient network/timeouts, HTTP 408, HTTP 429, and provider HTTP 5xx responses. Treat other provider 4xx responses as non-retryable and transition directly to `FAILED`.
- After a retryable failure on attempt n (n < 8), schedule the next attempt using exponential backoff: `min(1 minute × 2^(n-1), 60 minutes)`, then multiply the delay by a uniformly distributed random factor from 0.8 to 1.2 (±20% jitter). If attempt eight fails, transition to terminal `FAILED`, record a sanitized error code/message, and do not retry automatically.
- Terminal `FAILED` invitation delivery does not revoke or extend the Invitation. The Invitation remains usable until its original expiry if the recipient already has the token. Recovery is a user-initiated resend after the cooldown/rate limit; resend rotates the token and creates a new Outbox event for the new token version. Do not manually reset a terminal event's attempt counter.
- Retain terminal `SENT`/`FAILED`/`SUPERSEDED` records for 30 days, then redact sensitive payload and delete. Never clean up `PENDING` or `PROCESSING` records.

---

## 6. Index strategy

Indexes serve concrete query and maintenance patterns. PostgreSQL automatically creates indexes for primary-key and unique constraints, but does not automatically index every referencing FK column.

V1 baseline:

| Table | Index purpose |
|---|---|
| `sessions` | User lookup; active expiry cleanup; revoked cleanup |
| `memberships` | Active memberships by User; organization roster |
| `invitations` | One pending invite per org/email; expiry scan |
| `projects` | Active and archived organization listing |
| `issues` | Active and archived project listing; unique issue number |
| `labels` | Organization/name uniqueness |
| `issue_labels` | Issue label lookup; reverse label lookup |
| `comments` | Chronological Issue comments |
| `activities` | Chronological Organization activity |
| `notifications` | Recipient inbox and unread inbox |
| `outbox_events` | Pending scheduling, expired lease recovery, Invitation lookup and generation deduplication |

Do not add Issue status or assignee indexes merely because those columns exist. Add them only when query plans and measured workload justify them.

Use keyset/cursor pagination with stable ordering, generally `(created_at, id)` or the domain-specific ordering key. Index column order must match the actual filter and sort predicates.

Validate with `EXPLAIN (ANALYZE, BUFFERS)` in a controlled environment. Do not treat a single local query plan as a production performance guarantee.

---

## 7. Transaction and concurrency protocol

### 7.1 Isolation level

Use PostgreSQL `READ COMMITTED` by default. Do not globally switch V1 to `SERIALIZABLE`.

Correctness comes from explicit transaction boundaries, constraints, row locks, advisory locks where needed, and conditional updates.

### 7.2 Global lock ordering

Use one consistent lock order to reduce deadlocks:

1. Organization row.
2. Invitation advisory lock, when relevant.
3. Invitation row, when relevant.
4. Membership row(s).
5. Project row(s).
6. Issue row(s).
7. Label row(s), when relevant.
8. Comment row(s).

When locking multiple rows at the same level, acquire them in deterministic primary-key order. Never acquire a lower-level lock and then request a higher-level lock.

This order must be reviewed against actual operation paths before implementation. Do not copy a lock sequence into code without checking every transaction that touches the same records.

### 7.3 Last active Owner

For any operation that can change the active Owner count:

1. Begin a transaction.
2. Lock the Organization row using `SELECT ... FOR UPDATE`.
3. Lock the relevant Membership row(s) in deterministic order.
4. Read/validate the current active Owner set.
5. Apply the role or status transition.
6. Ensure at least one active `OWNER` remains.
7. Write Activity in the same transaction.
8. Commit.

This serializes competing demotion/removal operations for one Organization. A pre-check outside the transaction is not sufficient.

### 7.4 Membership removal and Issue assignment

Assignment and revocation must serialize around the target Membership.

- Assignment: lock Organization as required, lock target Membership, verify same Organization and `ACTIVE`, then update Issue.
- Removal: lock Organization, lock Membership, mark it `REMOVED`, unassign all Issues assigned to that Membership, and record Activity in one transaction.
- If assignment and removal race, the final committed state must not leave an Issue assigned to a removed Membership.
- The composite FK enforces tenant consistency; transaction logic enforces active status.

### 7.5 Invitation create, resend, accept, and revoke

- Use an advisory lock derived from `(organization_id, normalized_email)` for pending-invitation uniqueness workflows.
- Expire stale pending rows before creating a replacement.
- The partial unique index is the final guard against concurrent duplicates.
- Resend rotates the token hash and creates/updates the corresponding delivery work atomically.
- Acceptance locks the Invitation row and validates pending state, expiry, and authenticated email match before creating/reactivating Membership.
- Revoke and accept must be mutually exclusive state transitions. Only one may win.
- Never perform email provider I/O inside the transaction.

### 7.6 Issue number allocation

Atomically increment `projects.next_issue_number`, insert the Issue, and write Activity in one transaction. The unique `(project_id, number)` constraint protects against duplicate allocation.

### 7.7 Optimistic concurrency

Use conditional updates with `version`. A zero-row update means the version is stale or the resource is no longer visible/eligible; the application maps this according to the API's tenant-hiding and conflict contract.

### 7.8 Atomic domain events and notifications

The following must commit together:

- Domain mutation.
- Activity record.
- In-app Notification rows derived from that event.

If any insert fails, the domain mutation must roll back. External email delivery is not part of this transaction; it is performed through the Outbox.

### 7.9 Outbox worker safety

- Claim work in a short transaction with `FOR UPDATE SKIP LOCKED`.
- Commit the lease before calling the provider.
- Make the provider call outside the database transaction.
- Complete the row only if the worker still owns the current lease.
- Recover expired leases.
- Expect at-least-once delivery and design the delivery adapter accordingly.

### 7.10 Deadlocks and retries

PostgreSQL deadlock SQLSTATE `40P01` may be retried a bounded number of times only when the entire transaction is safe to repeat. Consistent lock ordering is the primary defense; retry is recovery, not the design.

### 7.11 Single-VPS connection and timeout baseline

Initial V1 baseline for one application instance:

| Setting | Initial value | Purpose |
|---|---:|---|
| Prisma connection pool limit | 10 connections | Bound application connections to PostgreSQL |
| Prisma pool acquisition timeout | 5 seconds | Fail predictably when the pool is saturated |
| PostgreSQL `statement_timeout` | 15 seconds | Bound individual SQL statement execution |
| PostgreSQL `lock_timeout` | 3 seconds | Avoid requests waiting indefinitely on locks |
| PostgreSQL `idle_in_transaction_session_timeout` | 10 seconds | Terminate abandoned open transactions |
| Prisma interactive transaction `maxWait` | 5 seconds | Bound transaction connection acquisition |
| Prisma interactive transaction `timeout` | 10 seconds | Bound application transaction duration |
| HTTP request timeout | 30 seconds | Bound end-to-end request duration |

These are initial deployment defaults, not universal capacity claims. Keep the application to one instance in V1 and ensure the aggregate connection budget includes migrations, monitoring, and administrative access. Revisit the pool limit and timeouts after measuring VPS memory, PostgreSQL memory use, query latency, pool wait time, and peak concurrent requests. Do not increase the pool merely to hide slow queries or long transactions. Any change must preserve a documented database connection budget.

---

## 8. Retention and cleanup

| Data | V1 policy |
|---|---|
| Session | Delete 30 days after expiry or revocation |
| Invitation | Retain; no automatic deletion in V1 |
| Outbox `SENT` / `FAILED` / `SUPERSEDED` | Retain 30 days, then redact sensitive payload and delete |
| Outbox `PENDING` / `PROCESSING` | Never eligible for terminal cleanup |
| Activity | No automatic cleanup in V1; preserve historical event records |
| Notification | Current read state: read deadline is 180 days after current `read_at`; unread deadline is 365 days after `created_at` |
| User, Organization, Membership, Project, Issue, Comment tombstone | No general physical-delete job |
| Deleted Comment body | Set to NULL immediately on logical deletion; retain metadata-only tombstone indefinitely in V1 |

Cleanup jobs must be:

- Periodic, indexed, bounded, and batched.
- Safe to run concurrently or after interruption.
- Observable through structured logs and metrics.
- Idempotent where practical.

Invitation expiration and Invitation deletion are separate concerns. Expired Invitations are rejected immediately using `expires_at`; a scheduled worker may transition stale `PENDING` rows to `EXPIRED`.

---

## 9. Prisma and migration strategy

### 9.1 Migration authority

Prisma Migrate is the schema migration authority.

- `schema.prisma` represents standard models, fields, relations, and supported indexes/constraints.
- Custom SQL migrations implement PostgreSQL-specific features or constraints not adequately represented by Prisma.
- Prisma schema and SQL migration history must remain consistent.
- Applied migrations are immutable. Corrections use a new migration.

### 9.2 Workflow

- Development: `prisma migrate dev`.
- Production: `prisma migrate deploy`.
- Do not use `prisma db push` as the production migration mechanism.
- Review generated SQL and custom migration SQL before applying.
- CI validates schema/migration consistency and tests against a database created from migrations.

### 9.3 PostgreSQL features requiring custom migration review

At minimum, explicitly verify:

- Partial unique indexes for pending Invitations.
- Partial indexes for active/unread/worker state.
- Composite primary and foreign keys.
- Check constraints not fully represented by Prisma (Prisma does not model `CHECK`; add them by editing the generated migration with `prisma migrate dev --create-only`).
- Activity table runtime privileges.
- Outbox state/lease consistency constraints.
- Any database role and grant configuration.

### 9.4 Deployment strategy

- Use forward-only migrations.
- Do not rely on automatic down migrations.
- Use expand-and-contract for risky or destructive schema changes.
- Roll back application code only when the current schema remains backward-compatible.
- After destructive schema/data changes, recovery depends on tested backup/restore, not an assumed reversible migration.

### 9.5 Seeding

- Development: useful sample Users, Organizations, Memberships, Projects, Issues, and Labels.
- Tests: isolated, minimal, deterministic fixtures controlled by tests.
- Production: no dummy seed data.
- Production bootstrap, if needed, is a deliberate separate procedure.
- Seeds should be idempotent where practical and contain no real credentials or secrets.

---

## 10. Database roles and privileges

Production uses separate database roles. Development and CI may use a single role; the role split is a release-hardening task in the [Roadmap](../plan/roadmap.md).

| Role | Responsibility |
|---|---|
| `app_runtime` | API and worker runtime |
| `app_migrator` | Prisma Migrate and schema changes |
| `db_admin` | Administration and maintenance |

Rules:

- API and worker processes use `app_runtime`.
- CI/CD migration process uses `app_migrator`.
- Application processes never use admin credentials.
- Runtime roles do not receive `SUPERUSER`, `CREATEDB`, or `CREATEROLE`.
- `app_runtime` receives only required DML privileges.
- On `activities`, `app_runtime` receives `SELECT` and `INSERT`, not `UPDATE` or `DELETE`.
- Role grants must be tested using the actual runtime database account, not inferred from migration success.

---

## 11. Security requirements

- Passwords use Argon2id.
- Session and Invitation tokens are cryptographically random.
- Authoritative tables store token hashes only.
- Raw Invitation token material is encrypted only in the Outbox payload using AES-256-GCM.
- Encryption keys are held outside PostgreSQL and are versioned for rotation.
- Logs exclude passwords, raw tokens, keys, decrypted payloads, and sensitive Comment bodies.
- Database credentials follow least privilege.
- Composite FKs enforce tenant referential integrity.
- Application authorization remains mandatory; referential integrity is not an authorization system.
- No SQL query may rely on a client-supplied tenant ID without validating the caller's active Membership and permission.
- Parameterized queries/ORM parameters must be used; do not concatenate untrusted input into SQL.

---

## 12. Design notes

### 12.1 Membership key

The composite primary key represents the domain's natural uniqueness rule: one User can have only one Membership in one Organization.

The separate `id` is an alternate unique key retained for API resource addressing and references from Issue/Comment records. This avoids weakening the logical uniqueness rule merely because the API uses a membership identifier.

If the API contract is later changed to address Memberships only by `(organizationId, userId)`, the alternate `id` can be reconsidered in a separately reviewed migration. Do not remove it opportunistically.

---

## 13. Deferred and excluded from V1

- UUID v7.
- `CITEXT`.
- PostgreSQL Row-Level Security.
- Global `SERIALIZABLE` isolation.
- Global/fuzzy/semantic Issue search.
- Dedicated Issue status/assignee indexes without query evidence.
- Automatic down migrations.
- Physical Organization deletion.
- Automatic Activity retention cleanup.
- Automatic physical purge of Comment tombstones in V1.
- Custom Issue workflows.
- Kubernetes or multi-instance deployment architecture.
- Multi-region database architecture.
- Point-in-time recovery (PITR) unless operational scope is separately expanded.
- Multi-instance connection-pool coordination; V1 uses one application instance and the bounded baseline in Section 7.11.

---

## 14. Verification

Every constraint and protocol in this document needs a test that fails when it is violated. The required tests are listed in [Testing](../engineering/testing.md); progress is tracked in the [Roadmap](../plan/roadmap.md).
