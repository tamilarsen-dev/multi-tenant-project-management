# Phase 0.1 --- Domain Map

**Project:** Multi-Tenant Project Management API\
**Status:** Conceptual domain mapping completed\
**Scope:** V1

## 1. Purpose and scope

This document records the core business entities, responsibilities,
relationships, lifecycle rules, authorization boundaries, and invariants
agreed for V1. It is a conceptual specification, not a physical database
schema or implementation guide. Exact SQL types, indexes, foreign keys,
locking, HTTP contracts, and implementation details belong to later
phases.

An Organization is the tenant boundary. A User may belong to multiple
Organizations. The role a User holds is defined by Membership within
each Organization.

## 2. Domain overview

  Domain               Entities
  -------------------- --------------------------------------
  Identity             User, Session
  Organization         Organization, Membership, Invitation
  Project Management   Project, Issue
  Collaboration        Comment, Activity, Notification
  Infrastructure       Outbox Event

``` text
User
 ├── Session
 └── Membership
       └── Organization
             ├── Invitation
             ├── Project
             │     └── Issue
             │           ├── Comment
             │           └── Activity
             ├── Activity
             ├── Notification
             └── Outbox Event
```

This is a conceptual overview, not a complete foreign-key diagram.

# 3. Identity Domain

## 3.1 User

User represents a global identity and is not tenant-bound.

  Attribute         Responsibility
  ----------------- -----------------------
  `id`              User identifier
  `email`           Normalized email
  `password_hash`   Password hash
  `display_name`    User-facing name
  `created_at`      Creation timestamp
  `updated_at`      Last update timestamp

**Decisions** - Email is trimmed and lowercased before storage and
comparison. - Normalized email is globally unique. - Email verification
is deferred in V1; registration produces an account that can sign in. -
Passwords use Argon2id; plaintext passwords are never stored. - User has
many Sessions and Memberships. - User does not contain `organization_id`
or an Organization role. Roles belong to Membership.

## 3.2 Session

Session represents an authenticated login session.

  Attribute      Responsibility
  -------------- --------------------------------------
  `id`           Session identifier
  `user_id`      Owning User
  `token_hash`   SHA-256 hash of opaque session token
  `created_at`   Creation timestamp
  `expires_at`   Expiration timestamp
  `revoked_at`   Revocation timestamp; nullable

**Decisions** - Authentication uses an opaque cryptographically random
32-byte Bearer token. - Only the SHA-256 token hash is stored. - Fixed
lifetime is seven days; no sliding expiration. - Refresh rotates the old
token and creates a new Session atomically. - Concurrent refresh using
the same token must not create two active sessions. - Reuse of an old
token is rejected and logged; it does not automatically revoke the newly
issued Session. - Logout revokes the current Session. - Validity is
derived from `revoked_at IS NULL` and `expires_at > now`. -
`last_used_at` is deferred in V1. - JWT and cookie-based sessions are
excluded from V1.

# 4. Organization Domain

## 4.1 Organization

Organization is the tenant boundary.

  Attribute      Responsibility
  -------------- -------------------------
  `id`           Organization identifier
  `name`         Organization name
  `created_at`   Creation timestamp
  `updated_at`   Last update timestamp

**Decisions** - A User may belong to multiple Organizations. - Role is
stored on Membership, not Organization. - Organization name is not
globally unique. - Organization cannot be archived or permanently
deleted in V1. - Every Organization must always have at least one active
Owner. - Creating an Organization and its initial Owner Membership is
atomic.

## 4.2 Membership

Membership represents a User's participation and role within an
Organization.

  Attribute           Responsibility
  ------------------- -------------------------------
  `id`                Membership identifier
  `user_id`           Member User
  `organization_id`   Organization
  `role`              `OWNER`, `ADMIN`, or `MEMBER`
  `status`            `ACTIVE` or `REMOVED`
  `joined_at`         Time Membership became active
  `removed_at`        Removal timestamp; nullable
  `created_at`        Creation timestamp
  `updated_at`        Last update timestamp

**Decisions** - One Membership record exists per
`(organization_id, user_id)`. - A User may hold different roles in
different Organizations. - Active Membership is required for
Organization resource access. - Membership is the source of
authorization within an Organization. - All roles may create Projects. -
All Members with access may manage Issues; they are not restricted to
Issues they created. - All roles may create and read Comments. - A
Member may manage their own Comments. Owner and Admin may manage other
users' Comments. - Removal retains the record, changes status to
`REMOVED`, and sets `removed_at`. - Removal atomically unassigns Issues
assigned to that Membership. - Re-invitation reactivates the same
Membership, applies the Invitation role, resets `joined_at`, and clears
`removed_at`.

**Role and Membership administration** - Owner may invite Admins and
Members. - Admin may invite Members only. - Member cannot invite. -
Invitation cannot assign the Owner role. - Admin may manage other Admin
and Member Memberships, but cannot alter an Owner or promote themselves
to Owner. - Owner may manage other Owners provided at least one active
Owner remains. - No operation may remove or demote the last active
Owner. - Concurrent last-Owner operations require a consistent
transaction and locking protocol.

## 4.3 Invitation

Invitation represents an invitation for an email address to join an
Organization. The invitee may not yet have a User account.

  Attribute              Responsibility
  ---------------------- -----------------------------------------
  `id`                   Invitation identifier
  `organization_id`      Target Organization
  `email`                Normalized invitee email
  `role`                 `ADMIN` or `MEMBER`
  `invited_by_user_id`   Inviting User
  `status`               Invitation lifecycle status
  `token_hash`           SHA-256 hash of opaque invitation token
  `expires_at`           Expiration timestamp
  `accepted_at`          Acceptance timestamp; nullable
  `revoked_at`           Revocation timestamp; nullable
  `created_at`           Creation timestamp
  `updated_at`           Last update timestamp

**Decisions** - Email is normalized before comparison. - Invitation has
no User foreign key because the invitee may not have an account. -
Status values: `PENDING`, `ACCEPTED`, `REVOKED`, `EXPIRED`. -
`expires_at` is authoritative; acceptance is rejected when
`expires_at <= now`. - A worker runs every minute to transition stale
PENDING Invitations to EXPIRED. - Invitation permissions follow the
Membership rules above. - Invitation uses an opaque random 32-byte
token; only its SHA-256 hash is stored. - Acceptance requires a valid
token, an authenticated User, and a normalized email match. - If the
User already exists, no new User is created. - An existing removed
Membership is reactivated rather than replaced. - An already-active
member cannot receive a duplicate Membership through acceptance. -
Acceptance is one transaction: lock and recheck Invitation status and
expiry, create/reactivate Membership, mark Invitation ACCEPTED, create
Activity, and create the inviter's Notification. - A partial unique
index will enforce one PENDING Invitation per
`(organization_id, email)`. - Before creating another Invitation for the
same Organization and normalized email, stale PENDING Invitations are
expired in the transaction. Unique-constraint conflicts must be handled
safely under concurrency. - Email delivery failure does not invalidate
the Invitation. - Resend is allowed while the Invitation remains valid
and does not extend its expiry.

# 5. Project Management Domain

## 5.1 Project

Project is a resource within one Organization and contains Issues.

  -----------------------------------------------------------------------
  Attribute                           Responsibility
  ----------------------------------- -----------------------------------
  `id`                                Project identifier

  `organization_id`                   Owning Organization

  `name`                              Project name

  `description`                       Optional description

  `next_issue_number`                 Counter for the next Issue number

  `archived_at`                       Archive timestamp; nullable

  `created_at`                        Creation timestamp

  `updated_at`                        Last update timestamp

  `version`                           Candidate optimistic-concurrency
                                      version; final use specified in
                                      database design
  -----------------------------------------------------------------------

**Decisions** - Project belongs to exactly one Organization and stores
`organization_id` directly. - Project cannot move between Organizations
in V1. - Project name is **not required to be unique** within an
Organization (PRJ-01). - Project identity is its UUID. - There is no
`owner_id`; permissions derive from Membership roles. - All roles
(`OWNER`, `ADMIN`, `MEMBER`) may create Projects. - Owner and Admin may
archive and restore Projects. - Project cannot be hard-deleted in V1. -
Archiving a Project does not automatically archive its Issues. - An
archived Project cannot accept new Issues. - Issues in an archived
Project cannot be modified. - Restoring a Project does not automatically
restore individually archived Issues. - Existing Comments and Activities
are preserved.

## 5.2 Issue

Issue represents a unit of work within a Project.

  Attribute                  Responsibility
  -------------------------- --------------------------------
  `id`                       Issue identifier
  `organization_id`          Tenant identifier
  `project_id`               Containing Project
  `number`                   Number unique within Project
  `title`                    Issue title
  `description`              Optional description
  `status`                   Issue lifecycle status
  `assignee_membership_id`   Assigned Membership; nullable
  `archived_at`              Archive timestamp; nullable
  `version`                  Optimistic-concurrency version
  `created_at`               Creation timestamp
  `updated_at`               Last update timestamp

**Tenant and relationship integrity** - Every Issue belongs to one
Project and one Organization. - Issue `organization_id` must match the
Organization of its Project. - The database will enforce this
relationship using a composite foreign-key strategy. - Assignee, if
present, must be a Membership in the same Organization and must be
active. - `assignee_membership_id` is nullable. - Revoking a Membership
atomically clears assignments to that Membership.

**Issue numbering** - Issue numbers are scoped to a Project. - Unique
key: `(project_id, number)`. - Project's `next_issue_number` counter is
incremented atomically. - Counter increment, Issue creation, and
corresponding Activity creation occur in one transaction. - Concurrent
requests must not receive the same Issue number within a Project. -
Project key prefixes such as `WEB-1` are illustrative only; a Project
key is not established as a V1 attribute.

**Status lifecycle**

  Current status   Allowed next statuses
  ---------------- ------------------------------------
  `TODO`           `IN_PROGRESS`, `CANCELLED`
  `IN_PROGRESS`    `IN_REVIEW`, `CANCELLED`
  `IN_REVIEW`      `IN_PROGRESS`, `DONE`, `CANCELLED`
  `DONE`           `IN_PROGRESS`
  `CANCELLED`      `TODO`

-   Status values: `TODO`, `IN_PROGRESS`, `IN_REVIEW`, `DONE`,
    `CANCELLED`.
-   All Members with access may change status.
-   Invalid transitions return HTTP `422`.
-   Custom workflows are excluded from V1.
-   Stale-version conflicts return HTTP `409`.

**Authorization**

  Operation                  Owner   Admin   Member
  ------------------------- ------- ------- --------
  Create Issue                Yes     Yes     Yes
  Read accessible Issue       Yes     Yes     Yes
  Update accessible Issue     Yes     Yes     Yes
  Change status               Yes     Yes     Yes
  Assign Issue                Yes     Yes     Yes
  Archive / restore Issue     Yes     Yes     Yes

All operations require active Organization Membership and access to the
relevant resource.

**Archive and restore** - Issue uses archive/restore, not hard
deletion. - Owner, Admin, and Member may archive and restore Issues,
subject to resource access. - Archived Issue cannot be modified. - An
Issue in an archived Project cannot be modified even if the Issue itself
is not archived. - Comments cannot be created or updated when the Issue
or its Project is archived. - Existing Comments and Activities are
preserved. - Project archive does not automatically archive Issues. -
Project restore does not automatically restore individually archived
Issues.

**Search and pagination** - V1 search is scoped to one Project. -
`title` and `description`: case-insensitive substring search. - Issue
number: exact numeric match. - No global search across Projects or
Organizations. - No fuzzy or semantic search. - Cursor-based
pagination. - Default page size: 20; maximum: 100. - Ordering must be
deterministic and include a unique tie-breaker. - `totalCount`
represents matching results at request time. - Result and count queries
must enforce the same tenant and authorization scope.

# 6. Collaboration Domain

## 6.1 Comment

Comment represents user-authored discussion attached to an Issue.

  Attribute                Responsibility
  ------------------------ -----------------------------------
  `id`                     Comment identifier
  `organization_id`        Tenant identifier
  `issue_id`               Related Issue
  `author_membership_id`   Author Membership
  `body`                   Comment content
  `created_at`             Creation timestamp
  `updated_at`             Last update timestamp
  `deleted_at`             Soft-deletion timestamp; nullable

**Authorization**

  Operation                        Owner   Admin   Member
  ------------------------------- ------- ------- --------
  Read Comment                      Yes     Yes     Yes
  Create Comment                    Yes     Yes     Yes
  Update own Comment                Yes     Yes     Yes
  Delete own Comment                Yes     Yes     Yes
  Update another user's Comment     Yes     Yes      No
  Delete another user's Comment     Yes     Yes      No

All operations require access to the relevant Issue and Organization.

**Lifecycle and deletion visibility** - Comment uses soft deletion, not
hard deletion. - Soft deletion sets `deleted_at`. - The record and
latest body remain stored. - Full Comment version history is excluded
from V1. - Activity records meaningful Comment changes. - Deleted
Comment is displayed as a placeholder indicating it was deleted; its
original body is not displayed (COL-01: A, Placeholder). - Comment
cannot be created or updated if its Issue or Project is archived. -
Existing Comments are preserved when an Issue or Project is archived.

## 6.2 Activity

Activity is an Organization-level record of a meaningful business event.
It is distinct from Comment and Notification.

  Attribute           Responsibility
  ------------------- ---------------------------------------------
  `id`                Activity identifier
  `organization_id`   Organization where event occurred; required
  `actor_id`          Acting User; nullable for system events
  `issue_id`          Related Issue; nullable
  `event_type`        Event category
  `metadata`          Versioned JSONB event details
  `created_at`        Event timestamp

**Decisions** - Activity is an Organization-level event log. -
`organization_id` is required. - `actor_id` is nullable. - `issue_id` is
nullable because some events concern Organization, Membership,
Invitation, or Project rather than an Issue. - No dedicated `project_id`
column; Project context may be included in metadata. - Activity is
append-only through normal application operations. - Read events are not
recorded. - Business mutation and corresponding Activity insertion occur
in the same database transaction. - Activity metadata must not contain
secrets or Comment body content.

**Versioned metadata envelope**

``` json
{
  "schemaVersion": 1,
  "entityType": "ISSUE",
  "entityId": "issue-uuid",
  "changes": {
    "status": {
      "from": "TODO",
      "to": "IN_PROGRESS"
    }
  }
}
```

-   `schemaVersion` supports metadata format evolution.
-   Metadata must be validated according to event type and schema
    version.
-   Event payloads contain only information necessary to describe the
    business change.

**Initial event catalog examples** (exact names and payload contracts
will be finalized later):

  -----------------------------------------------------------------------
  Domain                              Example events
  ----------------------------------- -----------------------------------
  Organization                        `ORGANIZATION_CREATED`

  Membership                          `MEMBERSHIP_CREATED`,
                                      `MEMBERSHIP_REMOVED`,
                                      `MEMBERSHIP_REACTIVATED`

  Invitation                          `INVITATION_CREATED`,
                                      `INVITATION_ACCEPTED`,
                                      `INVITATION_REVOKED`,
                                      `INVITATION_EXPIRED`

  Project                             `PROJECT_CREATED`,
                                      `PROJECT_ARCHIVED`,
                                      `PROJECT_RESTORED`

  Issue                               `ISSUE_CREATED`, `ISSUE_UPDATED`,
                                      `ISSUE_STATUS_CHANGED`,
                                      `ISSUE_ASSIGNED`, `ISSUE_ARCHIVED`,
                                      `ISSUE_RESTORED`

  Comment                             `COMMENT_CREATED`,
                                      `COMMENT_UPDATED`,
                                      `COMMENT_DELETED`
  -----------------------------------------------------------------------

## 6.3 Notification

Notification is a persisted in-app message addressed to a specific User.

  Attribute             Responsibility
  --------------------- --------------------------
  `id`                  Notification identifier
  `organization_id`     Related Organization
  `recipient_user_id`   Intended recipient
  `activity_id`         Source Activity
  `type`                Notification category
  `read_at`             Read timestamp; nullable
  `created_at`          Creation timestamp

**Recipient rules**

  Event                  Recipient
  ---------------------- ----------------
  Invitation accepted    Inviter
  Issue assigned         New assignee
  User mentioned         Mentioned User
  Comment added          Issue assignee
  Issue status changed   Issue assignee

Additional rules: - Actor does not receive a Notification for their own
action. - Users who are no longer active Members of the Organization
must not receive new Notifications. - No watchers or subscribers in
V1. - No push notifications or real-time delivery in V1. - In-app
Notifications are persisted in the database. - Email is used for
Invitation only in V1.

**Read lifecycle** - `read_at = NULL` means unread; non-null means
read. - Read state uses a timestamp, not a duplicate boolean. -
Operations include listing, marking one as read, marking all as read,
filtering unread, and pagination. - Mark-as-read should be idempotent. -
Users may only read their own Notifications, including across multiple
Organizations.

**Duplicate handling** A unique constraint on
`(activity_id, recipient_user_id)` is a candidate if the product rule is
one Notification per recipient per Activity. This constraint and exact
semantics remain to be confirmed in the Database Specification, together
with retry and idempotency behavior.

# 7. Infrastructure Domain

## 7.1 Outbox Event

Outbox Event represents durable work that must be processed outside the
database transaction. Its V1 use is Invitation Email delivery.

**Purpose**

The database and an external email provider cannot participate in one
ordinary PostgreSQL transaction. Sending email directly after a database
commit can fail, leaving a valid Invitation without a delivered email.
Sending email before commit can produce an email for an Invitation that
later rolls back.

V1 uses the Transactional Outbox Pattern.

**Conceptual attributes**

  Attribute        Responsibility
  ---------------- ---------------------------------
  `id`             Outbox event identifier
  `event_type`     Type of work
  `payload`        Data required for processing
  `status`         Processing status
  `attempts`       Number of attempts
  `available_at`   Earliest processing time
  `processed_at`   Successful processing timestamp
  `last_error`     Last failure information
  `created_at`     Creation timestamp
  `updated_at`     Last update timestamp

These are conceptual attributes. Exact column types and operational
fields such as lease ownership are specified later.

**Transactional behavior**

Invitation creation, Activity insertion, and Outbox Event insertion
occur in one transaction:

``` text
BEGIN

1. Create Invitation
2. Create Activity
3. Create Outbox Event

COMMIT
```

A background worker processes the durable Outbox Event after commit.

**Lifecycle**

``` text
PENDING
   |
   v
PROCESSING
   |--------------------|
   v                    v
SENT                 FAILURE
                        |
                -----------------
                |               |
                v               v
             PENDING          FAILED
           (retryable)     (permanent or
                           retries exhausted)
```

-   Worker crash recovery for PROCESSING events requires a lease/timeout
    or equivalent mechanism.
-   Concurrent workers must not process the same event simultaneously.
-   PostgreSQL `SELECT ... FOR UPDATE SKIP LOCKED` is a candidate for
    atomic work claiming; the final approach belongs in
    database/implementation specification.

**Invitation email retry policy** - Initial attempt plus up to three
retries. - Retry delays: 1 minute, 5 minutes, and 15 minutes after
retryable failures. - Maximum total attempts: four, including the
initial attempt. - Transient failures are retryable. - Permanent
failures are not retried. - Exhausted retries result in FAILED status
and require manual handling if delivery is still needed. - Email
delivery failure does not invalidate or revoke the Invitation. -
Invitation remains PENDING while otherwise valid. - Resend is allowed
while the Invitation is valid and does not extend `expires_at`.

**Delivery semantics and idempotency**

Transactional Outbox guarantees durable recording of work alongside the
business transaction; it does not guarantee exactly-once external
delivery.

A worker may successfully send an email and crash before marking the
Outbox Event as SENT. A later attempt may send the email again. The
practical model is at-least-once processing, with idempotent effects
where the external provider supports them.

Raw invitation tokens and other secrets must not be indiscriminately
stored in payloads or logs. Token delivery must use a secure mechanism
consistent with the token-hash storage decision.

# 8. Cross-Domain Invariants

1.  Organization is the tenant boundary.
2.  A User may belong to multiple Organizations.
3.  Membership, not User, carries the Organization role.
4.  Active Membership is required for Organization resource access.
5.  Tenant relationships must be enforced at application and database
    levels where applicable.
6.  An Organization must always retain at least one active Owner.
7.  Invitation acceptance, Membership activation, Activity creation, and
    related Notification creation are atomic.
8.  Issue and Project must belong to the same Organization.
9.  Issue assignment must reference an active Membership in the same
    Organization.
10. Membership removal and Issue unassignment are atomic.
11. Issue number allocation is atomic and unique within its Project.
12. Business mutations and their Activity records are atomic.
13. Activity is append-only through normal application operations.
14. Comment deletion is soft deletion and uses placeholder visibility.
15. Archived Projects and Issues restrict mutations according to their
    lifecycle rules.
16. Notifications are recipient-scoped and cannot be read by other
    Users.
17. Outbox work is durably recorded in the same transaction as the
    business operation that requires it.

# 9. Explicit V1 Exclusions

-   Email verification.
-   JWT authentication and cookie-based sessions.
-   Session sliding expiration and `last_used_at`.
-   Organization archive or permanent deletion.
-   Project hard deletion or movement between Organizations.
-   Issue hard deletion.
-   Custom Issue workflows.
-   Global, fuzzy, or semantic Issue search.
-   Project key as an established V1 attribute.
-   Full Comment version history.
-   Watchers and subscribers.
-   Push and real-time notifications.
-   Email notifications other than Invitation.
-   Exactly-once external delivery guarantees.
-   Numeric performance targets before workload baselines exist.

# 10. Deferred Technical Decisions

  -----------------------------------------------------------------------
  Topic                               Specification phase
  ----------------------------------- -----------------------------------
  HTTP endpoints, request/response    Phase 0.2 --- API Specification
  schemas, error contract             

  SQL types, indexes, foreign keys,   Phase 0.3 --- Database
  composite constraints               Specification

  Last-Owner locking protocol         Phase 0.3 / implementation design

  Invitation partial unique index and Phase 0.3
  concurrency handling                

  Outbox claiming, lease, crash       Phase 0.3 / implementation design
  recovery, and cleanup               

  Notification uniqueness and         Phase 0.3
  idempotency constraints             

  Cursor encoding and query details   Phase 0.2 and 0.3

  Exact Activity event payload        Phase 0.2 / implementation design
  schemas                             

  Project `version` usage and other   Phase 0.3
  OCC details                         

  Worker scheduling and operational   Phase 0.4 --- Implementation Plan /
  monitoring                          operational design
  -----------------------------------------------------------------------

# 11. Phase 0.1 Completion

Phase 0.1 --- Domain Map is conceptually complete. The core entities,
responsibilities, relationships, lifecycles, authorization rules, and
cross-domain invariants have been mapped for V1.

**Next phase:** Phase 0.2 --- API Specification. This phase translates
domain decisions into concrete HTTP contracts: endpoints, methods,
request schemas, response schemas, authorization requirements, error
behavior, and pagination.

**Document status:** Conceptual domain specification.\
**Implementation status:** This document does not imply that the mapped
domain entities or features have been implemented.
