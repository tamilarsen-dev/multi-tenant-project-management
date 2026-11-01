**Project:** Multi-Tenant Project Management API  
**Workflow Stage:** 03 — Design  
**Document:** 05  
**Version:** 1.0  
**Status:** Approved

---

# Domain Model Validation v1

This document validates the domain model before it is translated into an ERD and database design. The source of business-rule decisions is **Problem Definition and Requirements v1**. This document does not reopen decisions already established there.

## 1. Validation Purpose

Validation ensures that every entity has sufficiently clear identity, attributes, relationships, cardinality, lifecycle, and invariants to explain the primary use cases. If a rule has not been decided, it is recorded as an open item rather than assumed.

Reasoning flow:

```text
Requirements & Business Rules
        ↓
Domain Model
        ↓
Constraints and Invariants
        ↓
ERD
        ↓
Database Design
        ↓
Application Logic and Tests
```

The database is not the starting point. Its structure must support the domain rules already agreed upon.

## 2. Lifecycle Validation

### 2.1 Organization

An Organization is created by a User. The creating User automatically becomes its Owner. Every Organization must always have at least one Owner.

**v1 boundary:** Permanent deletion and archiving of an Organization are not v1 features. Therefore, an Organization has no `archived/deleted` lifecycle in the v1 domain model. Lifecycle management beyond creation and information updates must not be assumed.

### 2.2 Membership

Membership represents the relationship between a User and an Organization, as well as the User's role within that Organization. A User–Organization pair has one Membership record throughout its lifecycle.

```text
User + Organization
        ↓
    Membership
        ↓
OWNER | ADMIN | MEMBER
        ↓
      Active
        ↓
     Removed
```

An Invitation is not a Membership. A Membership is created when a valid Invitation is accepted or when an Organization is created for its initial Owner.

Revoking a Membership changes its status to `REMOVED` and sets `removed_at`; it does not physically delete the record. The minimum-one-Owner invariant must remain satisfied. If the Membership is still assigned to Issues, all related Issues are unassigned in the same transaction before the Membership status changes. If the same User receives a new Invitation after the status becomes `REMOVED`, the same Membership record is reactivated (`ACTIVE`), its role follows the Invitation, `joined_at` is updated, and `removed_at` is cleared. An Invitation must not create a second Membership.

### 2.3 Invitation

The v1 Invitation lifecycle:

```text
PENDING ──→ ACCEPTED
   │
   ├──────→ REVOKED
   │
   └──────→ EXPIRED
```

Final statuses: `PENDING`, `ACCEPTED`, `REVOKED`, `EXPIRED`.

Important rules:

- An Owner may invite with the `ADMIN` or `MEMBER` role.
- An Admin may invite with the `MEMBER` role only.
- An Invitation cannot grant the `OWNER` role.
- An Invitation that has been accepted, revoked, or expired cannot be reused.
- `expires_at` is the source of truth for validity. The acceptance process rejects an Invitation when `expires_at <= now()`, even if the worker has not updated its status.
- A worker checks for expired Invitations every minute.
- At most one active (`PENDING`) Invitation may exist for a given Organization and normalized email combination.
- Resending an email does not extend the Invitation's validity period.
- Email failure does not cancel a still-valid Invitation record.

### 2.4 Project

A Project is created within exactly one Organization. In v1, a Project has an archive/restore lifecycle, not hard deletion.

- Owners and Admins can archive and restore a Project.
- An archived Project cannot accept new Issues and cannot be modified.
- Archiving a Project does not automatically archive the Issues within it.
- Issues in an archived Project cannot be modified until the Project is restored.
- Restoring a Project does not automatically restore Issues that were individually archived.
- A Project cannot be moved to another Organization in v1.

### 2.5 Issue

An Issue belongs to exactly one Project and carries an explicit `organizationId` as tenant context. Issues use archive/restore, not hard deletion.

The v1 Issue statuses are:

- `TODO`
- `IN_PROGRESS`
- `IN_REVIEW`
- `DONE`
- `CANCELLED`

Allowed transitions:

| Current status | Allowed next status |
|---|---|
| `TODO` | `IN_PROGRESS`, `CANCELLED` |
| `IN_PROGRESS` | `IN_REVIEW`, `CANCELLED` |
| `IN_REVIEW` | `IN_PROGRESS`, `DONE`, `CANCELLED` |
| `DONE` | `IN_PROGRESS` |
| `CANCELLED` | `TODO` |

`DONE` and `CANCELLED` are not terminal states. All other transitions are rejected. Any Member with access to the Issue may change its status.

Assignee is optional. If provided, the Assignee must reference an active Membership in the same Organization as the Issue.

### 2.6 Comment

A Comment is associated with exactly one Issue and has one User as its author. All roles with access to the Issue can create and read Comments.

- The author can edit and delete their own Comments.
- Owners and Admins can edit and delete other Members' Comments.
- Deletion uses soft delete.
- Full Comment version history is not retained in v1; the latest content, `updated_at`, and Activity of changes are retained.
- A Comment cannot be created or modified while its Issue or Project is archived.

### 2.7 Activity

Activity is an Organization-level append-only event log, not a Comment.

- Every Activity must have an `organizationId`.
- `actorId` is nullable, for example, for system events.
- `issueId` is nullable because not every event is associated with an Issue.
- There is no direct `projectId` in the v1 Activity model; Project or Membership context may be stored in event metadata.
- Read operations do not generate Activity.
- A business mutation and the Activity recording that mutation must be atomic.

### 2.8 Notification

A Notification is a message to a User about a relevant event. It is different from Activity, which records Organization history.

In-app Notifications are persisted and can be read. Email in v1 is used only for Invitations. Failure to create a Notification does not roll back the business operation that triggered it.

### 2.9 Session

A Session represents a User's authentication session. Token details, expiry, rotation, and revocation mechanisms belong to the authentication/security design and are not further specified by this domain validation document.

## 3. Relationship and Cardinality Validation

### 3.1 User, Organization, and Membership

```text
User         0..N ── Membership ── 1..1 Organization
Organization 1..N ── Membership
```

Interpretation:

- A User may have zero or many Memberships.
- An Organization has one or many Memberships.
- Every Membership is associated with exactly one User and exactly one Organization.
- A User must not have more than one Membership in the same Organization.
- Every Organization must have at least one Owner.

Conceptually, User and Organization have a many-to-many relationship implemented through Membership.

### 3.2 Organization and Project

```text
Organization 1 ─── 0..N Project
Project      ─── exactly 1 Organization
```

Every Project must have one Organization. A Project key is unique within an Organization, not globally.

Conceptual constraint:

```text
UNIQUE (organization_id, project_key)
```

### 3.3 Project and Issue

```text
Project 1 ─── 0..N Issue
Issue   ─── exactly 1 Project
```

Every Issue also carries `organizationId`. The `organizationId` and `projectId` pair must point to the same Organization and Project. This supports tenant isolation and will be enforced in the logical/database design.

### 3.4 Issue and Assignee Membership

```text
Issue 0..1 ─── Membership
Membership 0..N ─── Issue
```

An Issue may have no Assignee. If assigned, the Assignee must be an active Membership in the Organization that owns the Issue. At the domain level, the Assignee is a relationship to Membership, not directly to User.

### 3.5 Issue and Comment

```text
Issue 1 ─── 0..N Comment
Comment ─── exactly 1 Issue
Comment ─── exactly 1 Author (User)
```

The author must have the appropriate access to the Organization when performing a Comment operation. Access after Membership revocation follows the authorization rules applied at request time; Comments and Activity are retained.

### 3.6 Issue and Label

```text
Issue 0..N ─── 0..N Label
```

An Issue may have multiple Labels, and a Label may be used by multiple Issues. Labels are managed within an Organization context. Physical uniqueness and constraints must follow the Requirements and database-design decisions; global uniqueness must not be assumed.

### 3.7 Organization and Invitation

```text
Organization 1 ─── 0..N Invitation
Invitation   ─── exactly 1 Organization
```

An Invitation has a normalized destination email, status, expiry, and the role to be granted upon acceptance. The invitee's role limits which roles they may assign through an Invitation.

### 3.8 User and Notification / Session

```text
User 1 ─── 0..N Notification
User 1 ─── 0..N Session
```

Every Notification and Session is associated with one User. Technical Session lifecycle details are defined in the authentication design.

### 3.9 Organization, Issue, and Activity

```text
Organization 1 ─── 0..N Activity
Issue        0..1 ─── 0..N Activity
Actor User   0..1 ─── 0..N Activity
```

Every Activity has one Organization. An Activity may have no Issue or actor User.

## 4. Core Invariants

| ID | Invariant | Validation consequence |
|---|---|---|
| INV-ORG-01 | Every Organization has at least one Owner. | Removing or demoting the last Owner is rejected. |
| INV-MEM-01 | A User has at most one Membership per Organization. | Duplicate Membership is rejected. |
| INV-PROJ-01 | Every Project belongs to exactly one Organization. | A Project without a tenant is rejected. |
| INV-PROJ-02 | Project key is unique within an Organization. | Duplicate keys within the same tenant are rejected. |
| INV-ISSUE-01 | Every Issue belongs to exactly one Project and one Organization. | `organizationId` must match the Project's Organization. |
| INV-ISSUE-02 | Assignee must be an active Membership in the same Organization. | Cross-tenant or inactive Assignees are rejected. |
| INV-ISSUE-03 | Status changes only through allowed transitions. | Invalid transitions are rejected without mutation. |
| INV-ARCH-01 | An Issue in an archived Project cannot be mutated. | Mutations are rejected until the Project is restored. |
| INV-COM-01 | Comments can only be created/changed on active Issues and Projects. | Comment mutations on archived resources are rejected. |
| INV-ACT-01 | Activity always belongs to one Organization and is append-only. | Activity cannot be edited/deleted through the application. |
| INV-INV-01 | At most one PENDING Invitation exists per Organization and normalized email. | Duplicate active Invitations are rejected. |
| INV-INV-02 | An Invitation is invalid after `expires_at`. | Acceptance is rejected even if the worker has not updated the status. |
| INV-MEM-REACTIVATE | At most one Membership exists per User–Organization pair. | Re-invitation reactivates the `REMOVED` record; it does not create a second record. |

## 5. Entity, Attribute, and Relationship Distinctions

Example for Issue:

```text
Issue
├── title                  attribute
├── description            attribute
├── priority               attribute
├── status                 attribute with transition behavior
├── organizationId         tenant relationship/reference
├── projectId              relationship/reference
└── assigneeMembershipId?  optional relationship/reference
```

`assigneeMembershipId` is a reference representation in the data model. At the domain level, assignment is a relationship between an Issue and a Membership.

## 6. Comment vs Activity

| Comment | Activity |
|---|---|
| User-generated content | Event log generated by the system from business events |
| Has an author | Actor may be nullable |
| Can be edited according to permissions | Append-only |
| Can be soft-deleted | Cannot be deleted through the application |
| Always associated with an Issue | Must be associated with an Organization; Issue is optional |

They must not be merged into one entity merely because both store text or notes.

## 7. Use Cases the Model Must Explain

The domain model must be able to explain at least the following use cases without violating invariants:

1. Register a User.
2. Create an Organization and its initial Owner.
3. Invite a User with an allowed role.
4. Accept a still-valid Invitation.
5. Create a Project within an Organization.
6. Create an Issue in an active Project.
7. Assign an Issue to an active Membership in the same Organization.
8. Change an Issue status through a valid transition.
9. Add, edit, and soft-delete a Comment according to permissions.
10. Revoke a Membership (status `REMOVED`) and atomically unassign Issues assigned to it.
11. Archive and restore Projects/Issues according to the rules.
12. Reject access to resources belonging to another Organization.
13. Handle concurrent Issue updates without silently losing changes.

## 8. Final Decisions vs Open Items

### 8.1 Domain decisions already established

The lifecycle, role, permission, status-transition, archive, Comment, Activity, and Invitation decisions above originate from Requirements v1. They are no longer open questions in this document.

### 8.2 Remaining open items

The following technical decisions have been established in PostgreSQL Database Design and the API Contract: per-Project Issue number counter, email retries, Activity metadata envelope, v1 Issue search, and API error envelope/status semantics.

The only remaining open item that does not block closing domain design is the numeric response-time target, to be set after a workload baseline is available. v1 Session/token behavior has been established as an opaque database-backed Bearer token with hash-only storage, 7-day expiry, refresh rotation, and logout revocation.

## 9. Validation Outcome

The Domain Model may proceed to ERD and database design when:

- Every primary entity and relationship has clear cardinality.
- Lifecycle and invariants are consistent with Requirements v1.
- Tenant context is explicit and consistent.
- Primary use cases can be explained by the model.
- Technical open items are recorded without changing business rules that have already been locked.

The next document, **Constraint Matrix & Use Case Validation**, tests these invariants through concrete scenarios. It does not redefine the business rules.
