# Domain Model

| Field | Value |
|---|---|
| Status | Active |
| Owner | T. Tamil Arsen |
| Last updated | 2026-11-11 |
| Inputs | [PRD](../product/prd.md), [Requirements](../product/requirements.md) |

> **Purpose:** Define the conceptual domain model: entities, responsibilities, relationships, lifecycle behavior, business rules, authorization boundaries, and invariants.
>
> **Boundary:** This is not a physical database schema, HTTP contract, or implementation plan. SQL types, indexes, foreign keys, locking, endpoint shapes, request/response schemas, and deployment mechanisms belong to their respective specifications.
>
> **Accuracy:** This document describes the intended V1 domain. It does not claim that all mapped capabilities have been implemented or verified.

---

## 1. Purpose and Scope

The product is a multi-tenant project-management platform for small software teams. An **Organization** is the tenant boundary. A **User** is a global identity that may participate in multiple Organizations. The User's role and access within a particular Organization are represented by a **Membership**.

Within an Organization, active members collaborate through Projects and Issues. Comments provide discussion context; Activities preserve meaningful business history; Notifications surface selected events to individual users.

This document translates the approved product direction and detailed requirements into a coherent domain model.

### 1.1 V1 domain scope

| Domain | Entities |
|---|---|
| Identity and authentication | User, Session |
| Organization and access | Organization, Membership, Invitation |
| Work management | Project, Issue, Label |
| Collaboration and history | Comment, Activity |
| User communication | Notification |
| Asynchronous processing | Outbox Event |

Label is an Organization-scoped concept (not Project-scoped). Its persistence constraints are specified in [Database](database.md#58-labels).

### 1.2 Explicit V1 exclusions

The domain does not include:
- GUEST role or custom permission definitions.
- Organization archive or permanent deletion.
- Project or Issue hard deletion.
- Project movement between Organizations.
- Custom Issue workflows.
- Watchers or subscribers.
- Full Comment version history.
- Global, fuzzy, or semantic search.
- Real-time collaborative editing, chat, or push notification infrastructure.
- Billing, subscriptions, SSO/SAML, or account email verification.
- Exactly-once external message delivery guarantees.

These exclusions do not prevent future versions from introducing the concepts through explicit scope and design changes.

---

## 2. Domain Model Overview

### 2.1 Conceptual relationships

```text
User
 ├── Session
 └── Membership ─────────────── Organization
                                  ├── Invitation
                                  ├── Project
                                  │    └── Issue
                                  │         ├── Comment
                                  │         └── Issue–Label ── Label
                                  ├── Label
                                  ├── Activity (optional Issue context)
                                  ├── Notification ───── User (recipient)
                                  └── Outbox Event

Issue ── Project ── Organization
  └────── Assignee Membership ── Organization

Comment ── Author Membership ── Organization
Activity ── Actor User (optional)
```

This is a conceptual relationship map, not a complete foreign-key diagram. In particular, Activity may refer to an actor who is no longer an active member, and Notification is addressed to a User rather than being an authorization grant.

### 2.2 Core modeling principles

1. **Tenant ownership is explicit.** Organization-scoped resources belong to exactly one Organization, directly or through a parent resource.
2. **Identity is global; authorization is contextual.** User is global. Membership carries the Organization-specific role and status.
3. **Membership is not disposable.** Removal changes access state but preserves the relationship for historical attribution and possible reactivation.
4. **Business history is distinct from current state.** Activity records meaningful changes; it is not a mutable copy of the current resource.
5. **Notifications are not Activities.** An Activity describes what happened. A Notification is a recipient-specific message about an event.
6. **Archival is not deletion.** Project and Issue archival preserves records and historical relationships.
7. **Domain invariants apply regardless of entry point.** A rule must remain true whether a mutation originates from an API endpoint, background worker, or another internal workflow.

---

## 3. Identity and Authentication Domain

### 3.1 User

**Responsibility:** Represents a person with a platform account. User is global and is not owned by an Organization.

**Conceptual attributes:**
- `id`: stable User identifier.
- `email`: normalized email address.
- `passwordHash`: secure password hash.
- `displayName`: user-facing name.
- `createdAt`, `updatedAt`: timestamps.

**Rules:**
- A normalized email address is globally unique.
- Email normalization is applied consistently before storage and comparison.
- Email verification is outside V1; a registered account may authenticate without completing an email-verification workflow.
- Passwords are never stored in plaintext.
- A User may own multiple Sessions and participate in multiple Organizations through Membership.
- User does not contain an Organization role or a tenant-specific `organizationId`.

### 3.2 Session

**Responsibility:** Represents one authenticated login session for a User.

**Conceptual attributes:**
- `id`, `userId`, `tokenHash`.
- `createdAt`, `expiresAt`, `absoluteExpiresAt`.
- `revokedAt` (nullable).

**Rules and lifecycle:**
- Authentication uses an opaque, cryptographically random Bearer token.
- Only a hash of the raw session token is persisted.
- A Session has a fixed lifetime of seven days from its creation. Using a Session never extends it.
- Login sets `absoluteExpiresAt` to 30 days after login. Every Session created by refresh inherits that value unchanged.
- `expiresAt` of any Session is the earlier of `createdAt + 7 days` and `absoluteExpiresAt`.
- A valid Session is not revoked and has not expired.
- Refresh is allowed only while the existing Session is valid.
- Refresh atomically revokes the old Session and creates a new Session (new token, new `expiresAt`, inherited `absoluteExpiresAt`). After `absoluteExpiresAt` the User must log in again; refresh cannot extend a login indefinitely.
- Concurrent refresh attempts using the same token must result in at most one successful rotation.
- Reuse of a rotated token is rejected and logged. It does not automatically revoke the newly issued Session.
- There is no refresh grace window. Once expired, the User must authenticate again.
- Logout revokes the current Session.
- JWT-based and cookie-based sessions are outside V1.

---

## 4. Organization and Membership Domain

### 4.1 Organization

**Responsibility:** Represents a tenant workspace and the ownership boundary for organization-scoped resources.

**Conceptual attributes:**
- `id`: Organization identifier.
- `name`: display name.
- `createdAt`, `updatedAt`: timestamps.

**Rules:**
- Every Organization is a distinct tenant boundary.
- A User may belong to multiple Organizations.
- Organization roles are not stored on Organization; they belong to Membership.
- Creating an Organization and creating its initial OWNER Membership are one atomic business operation.
- Every Organization must always have at least one active OWNER.
- Organization cannot be archived or permanently deleted in V1.
- Organization names are display attributes, not identity keys. They are not globally unique. Two Organizations may use the same name. This decision avoids treating a mutable human-readable label as a tenant identifier; the Organization ID remains its identity.
- V1 does not define a separate Organization slug or URL-key uniqueness rule.

### 4.2 Membership

**Responsibility:** Represents the relationship between one User and one Organization, including the User's Organization-specific role and access status.

**Conceptual attributes:**
- `organizationId`, `userId`: identify the Organization-User relationship (natural key).
- `id`: stable Membership identifier exposed by the API as `membershipId` and used by other records (assignee, comment author).
- `role`: `OWNER`, `ADMIN`, or `MEMBER`.
- `status`: `ACTIVE` or `REMOVED`.
- `version`: optimistic-concurrency counter.
- `joinedAt`, `removedAt` (nullable).
- `createdAt`, `updatedAt`.

**Rules:**
- At most one Membership exists for a given `(organizationId, userId)` pair.
- A User may have different roles in different Organizations.
- Only an ACTIVE Membership grants access to Organization resources.
- A REMOVED Membership is retained; it is not physically deleted as part of ordinary member removal.
- Rejoining a removed User reactivates the existing Membership rather than creating a duplicate relationship.
- Reactivation updates the role according to the accepted invitation, resets `joinedAt`, and clears `removedAt`.
- Removing a member revokes their Organization access and automatically unassigns their Issues.
- Membership removal and all related Issue unassignments are one atomic business operation.
- Historical Comments and Activities remain attributable after Membership removal.
- The last active OWNER cannot be removed or demoted.
- A replacement OWNER must be established before the current last OWNER leaves or is removed.
- Concurrent role changes and removals must preserve the at-least-one-active-OWNER invariant.

**Role administration rules:**
- OWNER may invite ADMIN and MEMBER.
- ADMIN may invite MEMBER only.
- MEMBER cannot invite.
- Invitations cannot grant OWNER.
- ADMIN cannot alter an OWNER or promote themselves to OWNER.
- OWNER may manage other Owners only when at least one active OWNER remains afterward.
- ADMIN may manage eligible ADMIN and MEMBER memberships within the agreed permission policy.
- The detailed action-by-action authorization matrix is maintained in [Permissions](permissions.md).

### 4.3 Invitation

**Responsibility:** Represents an invitation for an email address to join an Organization. The invitee may not yet have a User account.

**Conceptual attributes:**
- `id`, `organizationId`.
- `email`: normalized recipient email.
- `role`: `ADMIN` or `MEMBER`.
- `invitedByUserId`.
- `status`: `PENDING`, `ACCEPTED`, `REVOKED`, or `EXPIRED`.
- `tokenHash`.
- `expiresAt`, `acceptedAt` (nullable), `revokedAt` (nullable).
- `createdAt`, `updatedAt`.

**Rules and lifecycle:**
- Invitation belongs to exactly one Organization.
- Invitation has no required User relationship because the recipient may not have an account.
- Only ADMIN and MEMBER roles may be assigned by Invitation.
- Invitation token is opaque and cryptographically random; only its hash is stored as the verification credential.
- Invitation lifetime is seven days. `expiresAt` is authoritative; acceptance is rejected when the expiration time has been reached.
- A PENDING invitation may become ACCEPTED, REVOKED, or EXPIRED. Terminal states cannot be accepted again.
- Acceptance requires a valid token, an authenticated User, and a normalized email match.
- If the recipient already has an account, that User is used; acceptance does not create a duplicate User.
- If the recipient has an existing REMOVED Membership, acceptance reactivates that Membership.
- An already ACTIVE member cannot gain a duplicate Membership by accepting an invitation.
- Resending is allowed only for a still-pending invitation. It rotates the token, invalidates the previous token, and does not extend the original expiration.
- Resend has a 60-second cooldown and a maximum of five successful resend operations per Invitation in a rolling 24-hour window. An operation counts when token rotation and Outbox creation commit; provider delivery outcome is irrelevant. Rejected cooldown/rate-limit requests do not consume quota.
- Invitation acceptance, Membership creation/reactivation, status transition, and required domain history are one atomic business operation.
- Invitation delivery is asynchronous. Delivery failure does not make the Invitation accepted or otherwise change its domain validity.
- Delivery retry policy is eight total attempts with exponential backoff capped at 60 minutes and ±20% jitter; non-retryable provider errors fail immediately. Detailed worker mechanics belong to Database/Architecture specifications.

---

## 5. Project Management Domain

### 5.1 Project

**Responsibility:** Represents a body of work within exactly one Organization and contains Issues.

**Conceptual attributes:**
- `id`, `organizationId`.
- `name`, optional `description`.
- `nextIssueNumber`: next number to allocate within this Project.
- `archivedAt` (nullable).
- `createdAt`, `updatedAt`.
- `version`: concurrency-related concept; exact persistence behavior belongs to [Database](database.md#46-optimistic-concurrency).

**Rules:**
- Project belongs to exactly one Organization and cannot move between Organizations in V1.
- Project name is not required to be unique within an Organization.
- Project identity is its identifier, not its name.
- Project has no independent owner field; authorization derives from the actor's active Membership and role.
- All active roles may create and read Projects.
- Only OWNER and ADMIN may update, archive, or restore Projects.
- Project is archived/restored, not hard-deleted.
- Archiving a Project does not automatically archive its Issues.
- An archived Project cannot accept new Issues.
- Issues in an archived Project cannot be modified, even if the Issue itself is not archived.
- Restoring a Project does not automatically restore Issues that were individually archived.
- Existing Comments and Activities are preserved when a Project is archived.

### 5.2 Issue

**Responsibility:** Represents a unit of work within a Project.

**Conceptual attributes:**
- `id`, `organizationId`, `projectId`.
- `number`: unique within its Project.
- `title`, optional `description`.
- `status`, `priority`.
- `assigneeMembershipId` (nullable).
- `archivedAt` (nullable).
- `version`, `createdAt`, `updatedAt`.

**Ownership and relationship rules:**
- Every Issue belongs to exactly one Project and one Organization.
- The Issue's Organization must be the same Organization that owns its Project.
- Assignee, when present, must be an ACTIVE Membership in the same Organization.
- Assignee is a Membership relationship, not a global User relationship.
- Removing the assignee's Membership clears the assignment atomically.
- Issue cannot be moved to a Project in another Organization through ordinary updates.

**Issue numbering:**
- Issue numbers are unique within a Project, not globally.
- Allocation must be atomic so concurrent creation cannot assign the same number.
- Counter allocation, Issue creation, and corresponding Activity creation are one atomic business operation.
- Project-key prefixes such as `WEB-123` are illustrative only; a Project key is not a V1 domain attribute.

**Status lifecycle:**

| Current status | Allowed next statuses |
|---|---|
| `TODO` | `IN_PROGRESS`, `CANCELLED` |
| `IN_PROGRESS` | `IN_REVIEW`, `CANCELLED` |
| `IN_REVIEW` | `IN_PROGRESS`, `DONE`, `CANCELLED` |
| `DONE` | `IN_PROGRESS` |
| `CANCELLED` | `TODO` |

- Supported statuses are `TODO`, `IN_PROGRESS`, `IN_REVIEW`, `DONE`, and `CANCELLED`.
- All active Organization roles with access may change Issue status.
- A transition not listed above is invalid.
- Custom workflows are excluded from V1.
- The transition matrix is a fixed V1 domain rule, not a user-configurable workflow.

**Priority and labels:**
- Issue priority is `LOW`, `MEDIUM`, `HIGH`, or `URGENT`; new Issues default to `MEDIUM`.
- Labels classify Issues within the Organization.
- Label references must not cross Organization boundaries.
- All active roles may create, rename, archive, restore, and associate Labels, subject to active Membership in the Organization.
- Label rules are defined in §5.3.

**Archive and restore:**
- Issue is archived/restored, not hard-deleted.
- All active roles may archive and restore Issues, subject to access to the resource.
- An archived Issue cannot be modified.
- An Issue in an archived Project cannot be modified.
- Existing Comments and Activities remain preserved.
- Project archive does not automatically archive its Issues.
- Restoring a Project does not restore individually archived Issues.

**Search and listing domain constraints:**
- V1 Issue search is scoped to one Project.
- Supported matching: case-insensitive substring on title and description; exact numeric match on Issue number.
- Global, fuzzy, and semantic search are excluded.
- Listing uses deterministic ordering and cursor pagination. Exact cursor and HTTP behavior belongs to the [API Contract](api/contract.md).

### 5.3 Label

**Responsibility:** Represents an Organization-scoped classification that may be associated with Issues.

**Domain rules:**
- A Label belongs to exactly one Organization.
- An Issue may have multiple Labels; a Label may be associated with multiple Issues in the same Organization.
- An Issue cannot be associated with a Label from another Organization.
- All active Organization roles may create, rename, archive, restore, and associate Labels with Issues.
- Restoring an archived Label is rejected if another active Label in the same Organization has the same normalized name. The Label remains archived and existing Issue-Label associations remain unchanged.
- Label names are normalized using Unicode NFKC, trimming, whitespace collapse, and Unicode case-folding.
- Active normalized Label names are unique within an Organization.
- Deletion means archive, not physical deletion. Archived Labels cannot be newly attached to Issues; existing associations remain for historical context.
- Hard deletion is excluded from V1.

---

## 6. Collaboration and History Domain

### 6.1 Comment

**Responsibility:** Represents user-authored discussion attached to one Issue.

**Conceptual attributes:**
- `id`, `organizationId`, `issueId`.
- `authorMembershipId`.
- `body`.
- `createdAt`, `updatedAt`.
- `deletedAt` (nullable).

**Rules:**
- Comment belongs to exactly one Issue and is scoped to the same Organization.
- The author is represented by Membership to preserve Organization context and attribution.
- All active roles may read and create Comments on accessible Issues.
- A Member may edit or delete their own Comment.
- OWNER and ADMIN may edit or delete another member's Comment.
- Comment creation or update is blocked when its Issue or parent Project is archived.
- Deletion is a tombstone operation, not physical deletion of the Comment record.
- On deletion, the Comment body is erased immediately and `deletedAt` is set in the same transaction.
- A deleted Comment is displayed as a deletion placeholder; its original body is no longer stored or exposed.
- Full Comment version history is excluded from V1.
- Relevant Comment changes produce Activity records.
- Historical author attribution remains available after Membership removal.

**Retention decision:**
- Comment body content is erased in the logical-delete transaction.
- The metadata-only tombstone (ID, author attribution, creation time, deletion time) is retained indefinitely in V1.
- No automatic physical purge of tombstone records runs in V1. This does not constitute a general account-level legal-erasure workflow.

### 6.2 Activity

**Responsibility:** Represents an append-only record of a meaningful business event that occurred within an Organization.

**Conceptual attributes:**
- `id`, `organizationId`.
- `actorId` (nullable for system-generated events).
- `issueId` (nullable).
- `eventType`.
- `metadata`: versioned event details.
- `createdAt`.

**Rules:**
- Activity is Organization-level, not a separate Issue-owned event store.
- `organizationId` is required.
- `actorId` may be null for system events.
- `issueId` is nullable because events may concern Organization, Membership, Invitation, or Project rather than an Issue.
- Project context may be carried in event metadata; a dedicated Project relationship is not required by the conceptual model.
- Activity is append-only through ordinary application operations.
- Read operations are not recorded as Activity.
- A business mutation and its corresponding Activity insertion occur in the same transaction.
- Activity metadata must not contain secrets, raw invitation/session tokens, or Comment body content.
- Activity preserves historical actor attribution even if the actor's Membership is later removed.
- A removed member's historical actions remain visible to currently authorized Organization members.

**Activity views decision:**
- V1 has one Organization-level Activity stream as the underlying domain concept.
- An Issue-level Activity view is a filtered presentation of that same stream using the Issue context; it is not a second independent Activity entity or event log.
- API response shape, filtering, and UI presentation belong to API/product design.
- This keeps one canonical event history and avoids duplicate event records.

**Metadata envelope:**

```json
{
  "schemaVersion": 1,
  "entityType": "ISSUE",
  "entityId": "issue-identifier",
  "changes": {
    "status": {
      "from": "TODO",
      "to": "IN_PROGRESS"
    }
  }
}
```

- `schemaVersion` identifies the metadata contract version.
- Metadata must be validated according to event type and schema version.
- Event payloads contain only information needed to describe the business change.
- Exact event names and payload schemas are maintained in the API/implementation design as appropriate.

**Event catalog (canonical).** This table is the single source of truth for Activity `eventType` values. The API Contract states which endpoint emits which event; it must not introduce names that are not listed here.

| Domain | Event types |
|---|---|
| Organization | `ORGANIZATION_CREATED`, `ORGANIZATION_UPDATED` |
| Membership | `MEMBERSHIP_ROLE_CHANGED`, `MEMBERSHIP_REMOVED` |
| Invitation | `INVITATION_CREATED`, `INVITATION_RESENT`, `INVITATION_REVOKED`, `INVITATION_ACCEPTED` |
| Project | `PROJECT_CREATED`, `PROJECT_UPDATED`, `PROJECT_ARCHIVED`, `PROJECT_RESTORED` |
| Issue | `ISSUE_CREATED`, `ISSUE_UPDATED`, `ISSUE_ASSIGNEE_CHANGED`, `ISSUE_STATUS_CHANGED`, `ISSUE_ARCHIVED`, `ISSUE_RESTORED` |
| Label | `LABEL_CREATED`, `LABEL_RENAMED`, `LABEL_ARCHIVED`, `LABEL_RESTORED`, `ISSUE_LABEL_ATTACHED`, `ISSUE_LABEL_DETACHED` |
| Comment | `COMMENT_CREATED`, `COMMENT_UPDATED`, `COMMENT_DELETED` |

Event semantics that are easy to get wrong:

- `INVITATION_ACCEPTED` covers both a new Membership and the reactivation of a removed one; metadata records `membershipId` and `reactivated: true|false`. There is no separate `MEMBERSHIP_CREATED` event.
- Creating an Organization emits only `ORGANIZATION_CREATED`; the initial OWNER Membership is part of that event's metadata.
- Removing a member emits `MEMBERSHIP_REMOVED` and, for every Issue that was assigned to that Membership, one `ISSUE_ASSIGNEE_CHANGED` with metadata `reason: "MEMBERSHIP_REMOVED"`, so each Issue's history shows why it became unassigned.
- Priority, title, and description changes emit `ISSUE_UPDATED` with per-field `from`/`to` changes.
- Invitation expiry is a time-based fact, not an action; it emits no Activity.
- No-op requests emit no Activity.

### 6.3 Notification

**Responsibility:** Represents a persisted in-app message addressed to one User about a relevant event.

**Conceptual attributes:**
- `id`, `organizationId`.
- `recipientUserId`.
- `activityId` (source event).
- `type`: one of the Notification types below.
- Display-content snapshot or versioned content representation.
- `readAt` (nullable), `createdAt`.

**Rules:**
- Notification has exactly one recipient User.
- A User may read or update the read state only of their own Notifications.
- Notification does not grant access to the Organization or resource referenced by the message.
- Notification is distinct from Activity: one Activity may result in zero or more Notifications.
- Notification content should preserve enough context for display even if the underlying resource later changes.
- Notification generation must remain consistent with the originating business event.

**Notification types and recipients (canonical).** These four types are the complete V1 set; they implement BR-NOTIF-001 to BR-NOTIF-005 in [Requirements](../product/requirements.md#49-notification-rules).

| `type` | Source Activity | Recipient |
|---|---|---|
| `INVITATION_RECEIVED` | `INVITATION_CREATED` | The invited email's User, only if that normalized email already belongs to a User. Invitation email delivery is a separate asynchronous process. |
| `ISSUE_ASSIGNED` | `ISSUE_CREATED` with an assignee, or `ISSUE_ASSIGNEE_CHANGED` to a non-null assignee | The new assignee only; the previous assignee is not notified. |
| `COMMENT_ADDED` | `COMMENT_CREATED` | The Issue's current assignee, unless they wrote the Comment. |
| `MEMBERSHIP_REMOVED` | `MEMBERSHIP_REMOVED` | The removed User, unless they removed themselves (left). Reading it does not restore Organization access. |

Status changes, mentions, invitation acceptance, and Label operations do not create Notifications in V1.

Additional rules:
- Do not notify an actor about their own action.
- Do not broadcast these events indiscriminately to all Organization members.
- A single source event produces at most one Notification per recipient.
- A removed User may access the final membership-removal Notification addressed to them without regaining access to Organization resources.
- Notification content must not expose data beyond what is necessary for the event.
- A read Notification is retained for 180 days after its current `readAt`; an unread Notification is retained for 365 days after `createdAt`.
- Marking a Notification unread sets `readAt` to NULL. A later read transition sets `readAt` to the new transition timestamp and establishes a new 180-day deadline. Repeated read requests while already read are idempotent and do not reset the timestamp.
- Retention cleanup evaluates the current read state and its corresponding deadline.
- Exact event-to-notification mapping and deduplication constraints must be reflected in the Database/API design.

---

## 7. Asynchronous Processing Domain

### 7.1 Outbox Event

**Responsibility:** Represents durable work to be delivered or processed asynchronously after a business operation commits.

**Domain role:**
- An Outbox Event is an infrastructure-supporting record, not a user-facing business resource.
- It is created in the same transaction as the business operation that requires asynchronous processing.
- Invitation email delivery is the primary V1 use case.
- Delivery failure must not roll back an already committed Invitation or falsely change its domain status.
- Processing may be retried; external delivery is not guaranteed exactly once.
- A delivery worker must tolerate retries and duplicate attempts safely.
- The exact event payload, encryption, lease, retry, backoff, and cleanup policy belongs to [Database](database.md#513-outbox_events) and [ADR-0008](../adr/0008-transactional-outbox-for-email.md).

---

## 8. Cross-Domain Invariants

These invariants must remain true across all application workflows and background processing.

| ID | Invariant |
|---|---|
| INV-001 | Every organization-scoped resource belongs to exactly one Organization, directly or through a valid parent relationship. |
| INV-002 | A User can access Organization resources only with an ACTIVE Membership and the required permission. |
| INV-003 | A resource identifier alone never grants access. |
| INV-004 | Relationships between organization-scoped resources cannot cross tenant boundaries. |
| INV-005 | Every Organization always has at least one ACTIVE OWNER. |
| INV-006 | A User has at most one Membership per Organization. |
| INV-007 | A removed Membership grants no Organization access but preserves historical attribution. |
| INV-008 | An Issue assignee is an ACTIVE Membership in the Issue's Organization. |
| INV-009 | Removing a Membership and clearing its Issue assignments are atomic. |
| INV-010 | Every Issue belongs to a Project in the same Organization. |
| INV-011 | Issue number is unique within its Project. |
| INV-012 | Issue status changes follow the fixed V1 transition matrix. |
| INV-013 | Archived Projects cannot accept new Issues or permit Issue mutations. |
| INV-014 | Archived Issues cannot be modified. |
| INV-015 | Comment creation/update is blocked for archived Issues or Projects. |
| INV-016 | Comment deletion preserves a tombstone and historical attribution. |
| INV-017 | Business mutations and required Activity records are atomic. |
| INV-018 | Activity is append-only through ordinary application operations. |
| INV-019 | Notifications are recipient-scoped and cannot be read by other Users. |
| INV-020 | Notification does not grant access to the resource it references. |
| INV-021 | Invitation acceptance requires a valid, unexpired, pending Invitation and authenticated email match. |
| INV-022 | Invitation acceptance cannot create duplicate Memberships. |
| INV-023 | Outbox work required by a business operation is durably recorded with that operation. |
| INV-024 | Session refresh rotation cannot produce multiple successful rotations from one old token. |
| INV-025 | A refresh chain never outlives the `absoluteExpiresAt` of the login that started it. |

---

## 9. Authorization Boundary Summary

This section summarizes domain-level authorization boundaries. The complete operation matrix and edge cases are authoritative in [Permissions](permissions.md).

| Resource / Operation | OWNER | ADMIN | MEMBER |
|---|---:|---:|---:|
| Read Organization resources | Yes | Yes | Yes |
| Manage Organization details | Yes | As defined by permission spec | No |
| Invite ADMIN | Yes | No | No |
| Invite MEMBER | Yes | Yes | No |
| Manage eligible Memberships | Yes | Limited | No |
| Create/read Project | Yes | Yes | Yes |
| Update/archive/restore Project | Yes | Yes | No |
| Create/read/update Issue | Yes | Yes | Yes |
| Assign Issue / change status / priority / labels | Yes | Yes | Yes |
| Archive/restore Issue | Yes | Yes | Yes |
| Read/create Comment | Yes | Yes | Yes |
| Manage own Comment | Yes | Yes | Yes |
| Manage another member's Comment | Yes | Yes | No |

Authorization always requires valid authentication, active Membership, tenant-scoped resource resolution, and the relevant permission. This summary does not replace the permission specification.

---

## 10. Lifecycle Summary

| Entity | Lifecycle |
|---|---|
| User | Registered; account email verification is not part of V1. |
| Session | Active → Revoked or Expired. Refresh rotates to a new Session within the same 30-day absolute window. |
| Organization | Created with initial OWNER; no archive/delete lifecycle in V1. |
| Membership | ACTIVE → REMOVED → ACTIVE (reactivation). |
| Invitation | PENDING → ACCEPTED / REVOKED / EXPIRED. |
| Project | Active ↔ Archived. No hard delete. |
| Issue | Active ↔ Archived; status follows the fixed transition matrix. No hard delete. |
| Comment | Active → metadata-only tombstone; body erased at deletion. Tombstone retained indefinitely in V1. |
| Activity | Append-only event record. |
| Notification | Unread ↔ Read; recipient-scoped. |
| Outbox Event | Pending/processing/delivered or failed according to delivery policy; technical states are specified separately. |

---

## 11. Decisions Resolved in This Domain Model

| Decision | Outcome | Rationale / Boundary |
|---|---|---|
| OD-13: Comment retention and permanent deletion | Erase Comment body at deletion; retain metadata-only tombstone indefinitely in V1. | Removes deleted user-authored content while preserving attribution and historical context without a destructive purge job. |
| OD-17: Organization name uniqueness | Organization names are not globally unique. | Name is a mutable display attribute; Organization ID is the stable identity. No uniqueness requirement is established by the product baseline. |
| OD-18: Issue status transitions | Adopt the fixed V1 transition matrix in §5.2. | A controlled fixed workflow satisfies V1 without introducing custom workflow configuration. |
| OD-19: Activity views | One Organization-level Activity stream; Issue-level view is a filtered presentation of the same records. | Avoids duplicate event sources while supporting contextual history. |

| Session absolute lifetime | Refresh chains end 30 days after login. | Without it, refresh makes a Session effectively sliding and unbounded, contradicting the fixed-lifetime rule. See [ADR-0003](../adr/0003-opaque-bearer-session-tokens.md). |
| Notification set | Exactly four types (§6.3). | Aligns the API Contract with BR-NOTIF; removes mention and status-change notifications that had no requirement behind them. |

---

## 12. Change Management


Update this document when:
- A domain entity, relationship, lifecycle, or invariant changes.
- A business rule changes in a way that affects domain behavior.
- Implementation evidence reveals that an invariant is infeasible or incomplete.
- A product-scope change adds or removes a domain capability.

Physical persistence changes belong in [Database](database.md), HTTP behavior in the [API Contract](api/contract.md), and role/action rules in [Permissions](permissions.md). Reconcile cross-document changes explicitly.
