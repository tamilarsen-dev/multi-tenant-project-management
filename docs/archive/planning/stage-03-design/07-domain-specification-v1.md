**Project:** Multi-Tenant Project Management API  
**Workflow Stage:** 03 — Design  
**Document:** 07  
**Version:** 1.0  
**Status:** Approved

---

# Domain Specification v1

**Source of truth for business rules:** Problem Definition and Requirements (Document 03)

## 1. Purpose and Scope

This document consolidates the v1 domain model: entities, domain-level attributes, relationships, cardinality, lifecycle, and invariants. It does not replace the Permission Matrix, ERD, PostgreSQL Database Design, or API Contract.

The system is a Multi-Tenant Project Management API. An Organization is the tenant boundary. A User may belong to multiple Organizations and may have different roles through each Membership.

## 2. Domain Entities

| Entity | Responsibility | Key domain attributes (non-exhaustive) |
|---|---|---|
| User | Global user identity | `id`, `email`, `name`, credential data, timestamps |
| Organization | Tenant and data-ownership context | `id`, `name`, `slug`, timestamps |
| Membership | User–Organization association and access rights | `id`, `userId`, `organizationId`, `role`, `status`, `joinedAt` |
| Invitation | Invites an email address to an Organization | `id`, `organizationId`, `invitedEmail`, `invitedBy`, `role`, token reference, `expiresAt`, `status`, `acceptedAt?` |
| Project | Container for Issues within an Organization | `id`, `organizationId`, `name`, `key`, `description`, `createdBy`, archive state, timestamps |
| Issue | Unit of work within a Project | `id`, `organizationId`, `projectId`, `number`, `title`, `description`, `status`, `priority`, `assigneeMembershipId?`, `createdBy`, `version`, archive state, timestamps |
| Comment | Discussion on an Issue | `id`, `issueId`, `authorId`, `body`, `createdAt`, `updatedAt`, deletion state |
| Label | Issue classification within an Organization | `id`, `organizationId`, `name` |
| IssueLabel | Issue–Label association | `issueId`, `labelId` |
| Activity | Organization-level append-only event log | `id`, `organizationId`, `actorId?`, `issueId?`, `action`, `metadata`, `createdAt` |
| Notification | In-app message to a User | `id`, `recipientUserId`, event reference/context, `readAt?`, timestamps |
| Session | User authentication session | `id`, `userId`, token hash, expiry/revocation data |

`archived_at` and `deleted_at` are persistence representations selected in Database Design, not Issue workflow statuses.

## 3. Relationships and Cardinality

Notation: `1` = exactly one; `0..1` = optional; `0..N` = zero or many; `1..N` = at least one.

| Relationship | Cardinality | Domain meaning |
|---|---|---|
| User → Membership | `1 : 0..N` | A User may not have joined any Organization yet or may have several Memberships |
| Organization → Membership | `1 : 1..N` | An Organization has at least one Membership; the minimum-one-Owner invariant applies |
| Organization → Project | `1 : 0..N` | Every Project belongs to exactly one Organization |
| Organization → Invitation | `1 : 0..N` | An Invitation is issued within one Organization |
| Organization → Issue | `1 : 0..N` | An Issue stores explicit tenant context matching its Project |
| Project → Issue | `1 : 0..N` | Every Issue belongs to exactly one Project |
| Membership → Issue (Assignee) | `0..1 : 0..N` | An Issue may have no Assignee; an Assignee must be an active Membership in the same Organization |
| Issue → Comment | `1 : 0..N` | A Comment belongs to exactly one Issue |
| User → Comment | `1 : 0..N` | Every Comment has one author |
| Organization → Label | `1 : 0..N` | A Label belongs to one Organization |
| Issue ↔ Label | `N : N` | Implemented through IssueLabel; both sides must belong to the same Organization |
| Organization → Activity | `1 : 0..N` | All Activities have Organization context |
| User → Activity (actor) | `0..1 : 0..N` | Actor is nullable for system activity |
| Issue → Activity | `0..1 : 0..N` | Issue is nullable for non-Issue events |
| User → Session | `1 : 0..N` | A User may have multiple Sessions |
| User → Notification | `1 : 0..N` | A Notification is addressed to one recipient User |

## 4. Organization and Membership Rules

- The User who creates an Organization automatically becomes its Owner through a Membership created atomically with the Organization.
- The `(userId, organizationId)` combination is unique.
- A role belongs to a Membership, not globally to a User. v1 roles: `OWNER`, `ADMIN`, `MEMBER`; `GUEST` is outside scope.
- Every Organization must always have at least one Owner. The last Owner cannot be revoked or demoted.
- An Admin may manage other Admin/Member Memberships, but not an Owner's Membership and not their own Membership for Owner promotion. An Owner may manage other Memberships as long as at least one Owner remains. A revoked Membership changes to `REMOVED`, sets `removedAt`, and is not hard-deleted. If the User is invited again, the same record is reactivated; the role follows the Invitation, `joinedAt` is updated, and `removedAt` is cleared.
- Permanent Organization deletion and Organization archiving are outside v1 scope.

## 5. Invitation Lifecycle

Invitation statuses: `PENDING`, `ACCEPTED`, `REVOKED`, `EXPIRED`.

- An Owner may invite with the `ADMIN` or `MEMBER` role; an Admin may invite `MEMBER` only; a Member cannot invite. An Invitation cannot grant the `OWNER` role.
- A User who already has an `ACTIVE` Membership cannot be invited again; a `REMOVED` Membership may be invited again and reactivated upon acceptance.
- `expiresAt` is the source of truth for expiration. Acceptance is rejected if `expiresAt <= now()`, even if the status has not yet been updated by the worker.
- A worker checks every minute and changes expired `PENDING` Invitations to `EXPIRED`.
- At most one `PENDING` Invitation may exist per Organization and normalized email. When creating a new Invitation, stale `PENDING` Invitations that have expired are transitioned to `EXPIRED` within the transaction before insertion; unique violations caused by races must be handled.
- Acceptance changes the Invitation to `ACCEPTED` and atomically creates a new Membership or reactivates a `REMOVED` Membership. Duplicate acceptance must not create duplicate Memberships; an `ACTIVE` Membership cannot receive a new Invitation.
- Email failure does not cancel the Invitation. Use a transactional outbox; for transient failures, perform up to 3 automatic retries after the initial attempt at minutes 1, 5, and 15. Do not retry permanent failures. Stop retries if the Invitation is no longer `PENDING` or has passed `expiresAt`. Manual resend is available only for a still-valid `PENDING` Invitation and does not extend expiry.

## 6. Project and Issue Lifecycle

### Project

- Every Project belongs to exactly one Organization and cannot be moved between Organizations in v1. `key` is unique within an Organization.
- Owners, Admins, and Members may create and update active Projects they can access. Only Owners/Admins may archive and restore.
- An archived Project cannot accept new Issues or be modified until restored.
- Archiving a Project does not automatically archive its Issues. Issues, Comments, and Activity are retained. Restoring a Project does not automatically restore individually archived Issues.
- Projects are not hard-deleted in v1.

### Issue

Workflow statuses: `TODO`, `IN_PROGRESS`, `IN_REVIEW`, `DONE`, `CANCELLED`.

| Current status | Allowed next status |
|---|---|
| `TODO` | `IN_PROGRESS`, `CANCELLED` |
| `IN_PROGRESS` | `IN_REVIEW`, `CANCELLED` |
| `IN_REVIEW` | `IN_PROGRESS`, `DONE`, `CANCELLED` |
| `DONE` | `IN_PROGRESS` |
| `CANCELLED` | `TODO` |

- Any Member with access may change the status; unlisted transitions are rejected. Custom workflows per Project are outside v1.
- An Issue stores `organizationId` and `projectId`; both must refer to the same Organization context.
- `assigneeMembershipId` is nullable; when populated, it must reference an active Membership in the Issue's Organization.
- An Issue in an archived Project cannot be created or modified until the Project is restored. Archived Issues are excluded from the active list by default.
- Only Owners/Admins may archive/restore an Issue. Restoring an Issue requires its parent Project to be active. Issues are not hard-deleted in v1.
- Issue updates use optimistic concurrency through `version`; stale updates are rejected to prevent lost updates.

## 7. Comment, Label, Activity, and Notification

### Comment

- Every Comment belongs to exactly one Issue and one author. All roles with access may create/read Comments.
- The author may edit/delete their own Comment; Owners/Admins may edit/delete other people's Comments.
- A Comment cannot be created or changed when its Issue or Project is archived.
- Deletion uses soft delete; full version history is not retained in v1. The latest content, `updatedAt`, and Activity of changes are retained. Edits/deletions generate Activity.

### Label

- A Label belongs to one Organization; its name is unique within that Organization after normalization.
- All roles with access may add/remove Labels on an Issue. The Issue and Label must belong to the same Organization.

### Activity

- Activity is an Organization-level event log, append-only, and is not created for read operations.
- `organizationId` is required; `actorId` is nullable for system activity; `issueId` is nullable for events unrelated to an Issue. There is no direct `projectId`; Project/Membership context may be stored in metadata.
- A business mutation and the Activity recording it must be atomic.

### Notification

- An in-app Notification is addressed to a specific User; only the recipient may read it or mark it as read.
- Notification failure does not roll back the business operation.
- v1 email is only for Invitations. Accepting an Invitation sends an in-app Notification to the inviter; assigning an Issue notifies the Assignee; a mention notifies the mentioned User; adding a Comment and changing status notify the Assignee. There are no self-notifications and no Notifications to Users who are no longer Organization Members.
- Watchers/subscribers, push, and real-time delivery are outside v1.

## 8. Cross-Feature Invariants

1. All resource access requires Authentication, active Membership in the target Organization, the appropriate permission, and validation of resource ownership.
2. Tenant consistency must be maintained across Issue–Project, Issue–Assignee Membership, and Issue–Label.
3. Multi-record business operations that must remain consistent use a transaction.
4. Issue concurrency must detect stale versions.
5. Activity is append-only and written atomically with the business mutation.
6. Invitation expiry is checked against the actual current time during acceptance, not solely through the worker.
7. Archive state is separate from Issue workflow status.

## 9. Technical Decisions and Remaining Open Items

The v1 technical decisions are detailed in PostgreSQL Database Design and the API Contract: Issue numbers are allocated through an atomic per-Project counter; Invitation email uses bounded retries; Activity uses a versioned metadata envelope; v1 Issue search is limited to title, description, and number; and the API uses a stable error envelope with defined status semantics.

v1 Sessions use opaque database-backed tokens, not JWTs; the token is sent as a Bearer token, only its hash is stored, the validity period is 7 days, refresh rotates the token, and logout revokes the current Session. Numeric response-time targets remain pending a workload baseline and do not block Stage 03.
