# Requirements Specification

| Field | Value |
|---|---|
| Status | Active |
| Owner | T. Tamil Arsen |
| Last updated | 2026-11-11 |
| Parent | [PRD](prd.md) |

---

## 1. Purpose & Scope

### 1.1 Purpose

This document defines the functional requirements, business rules, and non-functional requirements for the Multi-Tenant Project Management SaaS.

It translates the product direction established in the PRD into requirements that can be understood, implemented, tested, and traced.

Each requirement has:

- A unique identifier.
- A priority.
- A description of the expected system behavior.
- Acceptance criteria.

Implementation status is tracked per requirement in the [Roadmap](../plan/roadmap.md), not here, so this document only changes when the required behavior changes.

### 1.2 Scope

This document covers the V1 capabilities:

1. Identity and Authentication
2. Organization Management
3. Membership and Invitations
4. Project Management
5. Issue Management
6. Collaboration
7. Notifications

It also defines business rules, security expectations, consistency requirements, reliability requirements, performance targets, and operational requirements.

### 1.3 Requirement Conventions

**Priority**

| Priority | Meaning |
|---|---|
| P0 | Essential for V1. The product cannot satisfy its core purpose without it. |
| P1 | Required for the planned V1 scope, but secondary to core functionality and security. P1 requirements remain in V1 and MUST NOT be deferred without an explicit scope decision. |

### 1.4 Requirement Language

- **MUST** indicates a mandatory requirement.
- **SHOULD** indicates a recommended requirement that may be deferred with justification.
- **MAY** indicates an optional capability.

---

## 2. Actors & Definitions

### 2.1 Actors

| Actor | Description |
|---|---|
| Unauthenticated Visitor | A person who has not authenticated and may register or log in. |
| Authenticated User | A user with a valid authenticated session. |
| Organization Owner | A user holding the OWNER role in an organization. |
| Organization Admin | A user holding the ADMIN role in an organization. |
| Organization Member | A user holding the MEMBER role in an organization. |

### 2.2 Core Definitions

| Term | Definition |
|---|---|
| User | A global identity representing a person using the platform. |
| Organization | The primary tenant boundary. |
| Membership | The relationship between a User and an Organization, including the user's organization-level role and membership lifecycle. |
| Session | An authenticated session associated with a User. |
| Invitation | An invitation for a user to join an Organization. |
| Project | A workspace for organizing related issues within an Organization. |
| Issue | A work item belonging to exactly one Project. |
| Comment | A discussion entry associated with an Issue. |
| Activity | A historical record of a relevant action or change. |
| Notification | An in-app message informing a user about a relevant event. |
| Tenant Isolation | The enforcement of data access boundaries between Organizations. |

### 2.3 Role Model

The V1 system supports:

- OWNER
- ADMIN
- MEMBER

A role MUST belong to a Membership, not directly to a global User.

A single User MAY hold different roles in different Organizations.

Detailed action-level authorization is defined in [Permissions](../design/permissions.md).

---

## 3. Functional Requirements

### 3.1 Identity & Authentication

#### FR-AUTH-001 — User Registration

| Attribute | Value |
|---|---|
| Priority | P0 |

The system MUST allow an unauthenticated visitor to register an account using the required identity and credential information.

Acceptance Criteria:

- A valid registration request creates a User.
- The email address is normalized before persistence.
- Duplicate normalized email addresses are rejected.
- The password is securely hashed before storage.
- The plaintext password is never stored.
- Invalid registration input is rejected.
- Registration MUST NOT create an Organization automatically.

#### FR-AUTH-002 — User Login

| Attribute | Value |
|---|---|
| Priority | P0 |

The system MUST allow a registered User to authenticate using valid credentials.

Acceptance Criteria:

- Valid credentials establish an authenticated Session.
- Invalid credentials are rejected.
- The response MUST NOT expose the stored password hash.
- The generated session token is returned to the client.
- Only a hash of the session token is stored in the database.

#### FR-AUTH-003 — Retrieve Current User

| Attribute | Value |
|---|---|
| Priority | P0 |

The system MUST allow an authenticated User to retrieve their current identity.

Acceptance Criteria:

- A valid Session allows access to the current-user endpoint.
- The response identifies the authenticated User.
- An invalid, expired, revoked, or missing Session is rejected.
- The response MUST NOT expose password hashes or session token hashes.

#### FR-AUTH-004 — User Logout

| Attribute | Value |
|---|---|
| Priority | P0 |

The system MUST allow an authenticated User to revoke their current Session.

Acceptance Criteria:

- A valid logout request revokes the current Session.
- A revoked Session cannot be used for subsequent authenticated requests.
- Logout MUST NOT revoke unrelated Sessions belonging to the same User.

#### FR-AUTH-005 — Session Validation

| Attribute | Value |
|---|---|
| Priority | P0 |

The system MUST validate authentication sessions before granting access to protected resources.

Acceptance Criteria:

- A valid, unexpired, non-revoked Session is accepted.
- An expired Session is rejected.
- A revoked Session is rejected.
- A token that does not correspond to a stored Session is rejected.
- Session expiration is enforced server-side.

#### FR-AUTH-006 — Session Refresh

| Attribute | Value |
|---|---|
| Priority | P0 |

The system MUST allow an eligible authenticated Session to be refreshed without requiring the User to enter credentials again.

Acceptance Criteria:

- A valid refresh operation issues a new session token.
- The previous token is invalidated as part of the refresh operation.
- Token rotation MUST be atomic.
- An expired or revoked Session cannot be refreshed.
- The new token is stored as a hash.
- The new Session expires seven days after its creation or at the absolute expiry inherited from the original login (30 days after login), whichever comes first. Refresh never extends the absolute expiry.
- The refresh operation succeeds only once for a given old token, including under concurrent requests.
- Reuse of an old token is rejected and logged; it does not automatically revoke the newly issued Session.
- No grace window is provided for a previously rotated token.
- If the old Session has expired, the User must log in again.

---

### 3.2 Organization Management

#### FR-ORG-001 — Create Organization

| Attribute | Value |
|---|---|
| Priority | P0 |

The system MUST allow an authenticated User to create an Organization.

Acceptance Criteria:

- Only an authenticated User can create an Organization.
- The Organization is created with valid required information.
- The creator automatically becomes its initial OWNER.
- Organization creation and initial Owner Membership creation occur atomically.
- If either operation fails, both operations are rolled back.

#### FR-ORG-002 — List User Organizations

| Attribute | Value |
|---|---|
| Priority | P0 |

The system MUST allow an authenticated User to retrieve Organizations in which they have active Membership.

Acceptance Criteria:

- Only Organizations with active Membership for the requesting User are returned.
- Organizations belonging exclusively to other Users are not returned.
- Removed Memberships do not grant access.
- The result supports pagination where required by the API contract.

#### FR-ORG-003 — Retrieve Organization

| Attribute | Value |
|---|---|
| Priority | P0 |

The system MUST allow an authorized Organization member to retrieve Organization information.

Acceptance Criteria:

- An active member can retrieve the Organization they belong to.
- A non-member cannot retrieve protected Organization information.
- A User cannot retrieve another tenant's Organization by guessing its identifier.
- The response contains only information the requesting User is permitted to access.

#### FR-ORG-004 — Update Organization

| Attribute | Value |
|---|---|
| Priority | P1 |

The system MUST allow authorized Organization administrators to update permitted Organization information.

Acceptance Criteria:

- Only roles authorized by [Permissions](../design/permissions.md) can update Organization information.
- Invalid Organization data is rejected.
- Updating one Organization does not affect another Organization.
- Organization identity and tenant ownership cannot be changed through ordinary update operations.

#### V1 Scope Constraint — Organization Deletion and Archiving

Organization deletion and archiving are excluded from V1. This is a scope constraint, not a user-facing functional capability. The constraint is captured by `BR-ORG-004`.

---

### 3.3 Membership & Invitations

#### FR-MEM-001 — Organization Membership Creation

| Attribute | Value |
|---|---|
| Priority | P0 |

The system MUST establish a Membership when a User joins an Organization.

Acceptance Criteria:

- A Membership connects exactly one User to exactly one Organization.
- A User cannot have duplicate Membership records for the same Organization.
- A newly created Membership has an explicit role.
- A newly created Membership has ACTIVE status.
- Initial Owner Membership is created atomically with Organization creation.

#### FR-MEM-002 — List Organization Members

| Attribute | Value |
|---|---|
| Priority | P0 |

The system MUST allow authorized Organization members to retrieve the Organization's active members.

Acceptance Criteria:

- Only authorized Users can retrieve member information.
- The result is restricted to the requested Organization.
- Removed Memberships are not presented as active members.
- Member roles are included where the requester has permission to view them.

#### FR-MEM-003 — Manage Membership Roles

| Attribute | Value |
|---|---|
| Priority | P0 |

The system MUST allow authorized Users to change Membership roles.

Acceptance Criteria:

- Role changes follow the authorization rules in [Permissions](../design/permissions.md).
- A User cannot assign a role they are not authorized to assign.
- Role changes apply only to the specified Organization Membership.
- The system preserves the invariant that every Organization has at least one active OWNER.
- The last active OWNER cannot be demoted.
- A role change that removes OWNER status is allowed only after another active OWNER has been established.
- Concurrent role changes cannot leave the Organization without an active OWNER.

#### FR-MEM-004 — Remove Organization Member

| Attribute | Value |
|---|---|
| Priority | P0 |

The system MUST allow authorized Users to remove a member from an Organization.

Acceptance Criteria:

- Removal follows the authorization rules.
- A removed Membership changes to REMOVED status.
- The removed User loses access to the Organization's protected resources.
- The User's historical comments and activity attribution remain preserved.
- Assigned Issues belonging to the removed User are automatically unassigned.
- Membership removal and issue unassignment occur in one transaction.
- The operation MUST NOT leave the Organization without an active OWNER.
- The last active OWNER cannot be removed.
- A replacement OWNER must be established before the current last OWNER can leave or be removed.
- Concurrent membership removals cannot leave the Organization without an active OWNER.

#### FR-MEM-005 — Reactivate Existing Membership

| Attribute | Value |
|---|---|
| Priority | P1 |

The system MUST support reactivation of an existing removed Membership when the same User rejoins the Organization.

Acceptance Criteria:

- Reactivation uses the existing Organization-User Membership relationship.
- A duplicate Membership for the same Organization and User is not created.
- The Membership returns to ACTIVE status.
- The role assigned after reactivation follows the invitation and authorization rules.

#### FR-INV-001 — Create Invitation

| Attribute | Value |
|---|---|
| Priority | P0 |

The system MUST allow authorized Organization members to invite eligible Users.

Acceptance Criteria:

- Only authorized roles can create invitations.
- The invitation identifies its Organization and intended recipient.
- The invitation has PENDING status when created.
- The invitation token is generated securely.
- Only a hash of the invitation token is stored.
- The invitation expires after seven days.

#### FR-INV-002 — Deliver Invitation

| Attribute | Value |
|---|---|
| Priority | P0 |

The system MUST support asynchronous delivery of Organization invitations.

Acceptance Criteria:

- Creating an invitation initiates the invitation delivery process.
- Delivery failure does not silently convert the invitation into an accepted invitation.
- Retry transient network/timeouts, HTTP 408, HTTP 429, and provider HTTP 5xx responses.
- Allow at most eight total delivery attempts, including the initial attempt.
- Use exponential backoff beginning at one minute, doubling to a 60-minute cap, with ±20% jitter.
- Treat other provider HTTP 4xx responses as non-retryable; transition directly to terminal FAILED.
- After eight failed attempts, transition to terminal FAILED and stop automatic retries.
- Terminal failure is recovered through a new Invitation resend after the resend limits permit it; do not reset the terminal Outbox event.

#### FR-INV-003 — Accept Invitation

| Attribute | Value |
|---|---|
| Priority | P0 |

The system MUST allow an eligible authenticated User to accept an invitation.

Acceptance Criteria:

- The invitation must be valid and in PENDING status.
- The authenticated User's email must match the invitation recipient.
- Expired, revoked, or previously accepted invitations cannot be accepted.
- Successful acceptance establishes or reactivates Membership.
- Invitation acceptance and Membership changes preserve domain consistency.

#### FR-INV-004 — Revoke Invitation

| Attribute | Value |
|---|---|
| Priority | P0 |

The system MUST allow authorized Users to revoke pending invitations.

Acceptance Criteria:

- Only authorized roles can revoke an invitation.
- A revoked invitation cannot subsequently be accepted.
- Revocation changes the invitation status to REVOKED.
- Revocation does not alter unrelated invitations.

#### FR-INV-005 — Resend Invitation

| Attribute | Value |
|---|---|
| Priority | P1 |

The system MUST support resending a pending invitation.

Acceptance Criteria:

- Only a pending invitation can be resent.
- Resending generates a new invitation token.
- The previous token is invalidated.
- The stored token is a hash.
- Resend is subject to a 60-second cooldown and a maximum of five successful resend operations per Invitation in a rolling 24-hour window.
- A resend operation counts toward the quota only when token rotation and creation of its Outbox event commit successfully. Email-provider delivery success is not required for the operation to count.
- Requests rejected by cooldown or rate limiting do not consume the resend quota, rotate the token, or enqueue an Outbox event.
- Resend rotates the token and does not extend the original seven-day expiration.
- Expired Invitations cannot be resent; a new Invitation is required.

---

### 3.4 Project Management

#### FR-PROJ-001 — Create Project

| Attribute | Value |
|---|---|
| Priority | P0 |

The system MUST allow active Organization members to create Projects within their Organization.

Acceptance Criteria:

- The requesting User has active Membership in the target Organization.
- Project creation follows the permissions defined in [Permissions](../design/permissions.md).
- The Project belongs to exactly one Organization.
- A Project cannot be created under an Organization the User cannot access.

#### FR-PROJ-002 — List Projects

| Attribute | Value |
|---|---|
| Priority | P0 |

The system MUST allow authorized Users to list Projects belonging to an Organization.

Acceptance Criteria:

- Only Projects belonging to the requested Organization are returned.
- A User cannot list Projects from another tenant.
- Archived Projects follow the visibility rules defined by the domain and API specifications.
- Collection responses follow the API pagination conventions.

#### FR-PROJ-003 — Retrieve Project

| Attribute | Value |
|---|---|
| Priority | P0 |

The system MUST allow authorized Users to retrieve a Project.

Acceptance Criteria:

- The User has active Membership in the Project's Organization.
- The Project identifier is resolved within the correct tenant boundary.
- Unauthorized cross-tenant access is rejected.
- The response does not expose unrelated Organization data.

#### FR-PROJ-004 — Update Project

| Attribute | Value |
|---|---|
| Priority | P0 |

The system MUST allow OWNER and ADMIN roles to update Project information.

Acceptance Criteria:

- OWNER and ADMIN can update permitted Project fields.
- MEMBER cannot update Project information.
- Invalid Project data is rejected.
- Updating a Project cannot move it to another Organization through ordinary update operations.

#### FR-PROJ-005 — Archive and Restore Project

| Attribute | Value |
|---|---|
| Priority | P0 |

The system MUST allow OWNER and ADMIN roles to archive and restore Projects.

Acceptance Criteria:

- OWNER and ADMIN can archive an active Project.
- OWNER and ADMIN can restore an archived Project.
- MEMBER cannot archive or restore a Project.
- Archiving does not permanently delete the Project or its Issues.
- Archive and restore operations follow the defined resource lifecycle.

---

### 3.5 Issue Management

#### FR-ISSUE-001 — Create Issue

| Attribute | Value |
|---|---|
| Priority | P0 |

The system MUST allow active Organization members to create Issues within accessible Projects.

Acceptance Criteria:

- The requesting User has active Membership in the Project's Organization.
- The Issue belongs to exactly one Project.
- Required Issue fields are validated.
- The Project and Issue must belong to the same tenant context.
- Issue creation and its corresponding Activity record occur atomically.

#### FR-ISSUE-002 — List and Retrieve Issues

| Attribute | Value |
|---|---|
| Priority | P0 |

The system MUST allow authorized Users to list and retrieve Issues.

Acceptance Criteria:

- A User can retrieve Issues only from Projects they are authorized to access.
- An Issue identifier cannot be used to bypass tenant isolation.
- Collection responses follow the API pagination conventions.
- Archived Issue visibility follows the defined resource lifecycle.

#### FR-ISSUE-003 — Update Issue

| Attribute | Value |
|---|---|
| Priority | P0 |

The system MUST allow authorized Organization members to update permitted Issue information.

Acceptance Criteria:

- Update authorization follows [Permissions](../design/permissions.md).
- Invalid fields and values are rejected.
- Changes cannot move an Issue into a Project belonging to another Organization.
- Relevant changes are recorded in Activity history.
- Concurrent updates follow the defined concurrency policy.

#### FR-ISSUE-004 — Assign and Reassign Issue

| Attribute | Value |
|---|---|
| Priority | P0 |

The system MUST allow authorized Users to assign or reassign an Issue to an eligible Organization member.

Acceptance Criteria:

- The assignee must have ACTIVE Membership in the Organization owning the Project.
- A User from another Organization cannot be assigned.
- Removing a member automatically clears their Issue assignments.
- Assignment changes preserve data consistency.
- Relevant assignment changes are recorded in Activity history.

#### FR-ISSUE-005 — Manage Issue Priority

| Attribute | Value |
|---|---|
| Priority | P0 |

The system MUST allow authorized Users to set and update Issue priority.

Acceptance Criteria:

- Priority values are `LOW`, `MEDIUM`, `HIGH`, or `URGENT`.
- A new Issue defaults to `MEDIUM` when no priority is supplied.
- Invalid priority values are rejected.
- Priority changes are associated with the correct Issue.
- Relevant changes are recorded in Activity history.

#### FR-ISSUE-006 — Manage Issue Status

| Attribute | Value |
|---|---|
| Priority | P0 |

The system MUST allow authorized Users to change Issue status according to the defined status transition rules.

Acceptance Criteria:

- Status values belong to the supported status set.
- Invalid status values are rejected.
- Disallowed transitions are rejected.
- Valid status changes are recorded in Activity history.
- Concurrent status changes follow the defined concurrency policy.

The status transition matrix is defined in [Domain Model §5.2](../design/domain-model.md#52-issue).

#### FR-ISSUE-007 — Manage Issue Labels

| Attribute | Value |
|---|---|
| Priority | P1 |

The system MUST support Organization-scoped Label management and adding/removing Labels from Issues.

Acceptance Criteria:

- All active Organization roles may create, rename, archive, and restore Labels, subject to active Membership.
- Label operations are scoped to the correct Organization and Issue.
- Active Label names are unique per Organization after normalization.
- Name normalization uses Unicode NFKC, trimming, whitespace collapse, and Unicode case-folding.
- Archived Labels cannot be newly attached to Issues; existing Issue associations remain for historical context.
- Restoring an archived Label MUST be rejected if another active Label in the same Organization has the same normalized name.
- If restoration is rejected due to a name collision, the Label remains archived and its existing Issue-Label associations remain unchanged.
- Physical Label deletion is not available in V1.
- Invalid or cross-tenant Label references are rejected.

#### FR-ISSUE-008 — Archive and Restore Issue

| Attribute | Value |
|---|---|
| Priority | P0 |

The system MUST allow all active Organization roles to archive and restore Issues.

Acceptance Criteria:

- OWNER, ADMIN, and MEMBER can archive an eligible Issue.
- OWNER, ADMIN, and MEMBER can restore an archived Issue.
- Archive and restore operations do not permanently delete the Issue.
- Operations are restricted to Issues the User is authorized to access.
- Relevant changes are recorded in Activity history.

---

### 3.6 Collaboration

#### FR-COL-001 — Create Comment

| Attribute | Value |
|---|---|
| Priority | P0 |

The system MUST allow authorized Organization members to create comments on Issues.

Acceptance Criteria:

- The User has active Membership in the Issue's Organization.
- The comment is associated with the correct Issue.
- The comment author is recorded.
- Invalid comment content is rejected.
- Comment creation produces the relevant Activity record where required by the domain design.

#### FR-COL-002 — Retrieve Comments

| Attribute | Value |
|---|---|
| Priority | P0 |

The system MUST allow authorized Users to retrieve comments associated with an Issue.

Acceptance Criteria:

- Comments are returned only for an accessible Issue.
- Cross-tenant comment access is rejected.
- Deleted comments follow the defined tombstone visibility policy.
- Comment authorship and historical attribution are preserved.

#### FR-COL-003 — Edit Comment

| Attribute | Value |
|---|---|
| Priority | P1 |

The system MUST allow comment authors to edit their own comments.

OWNER and ADMIN may edit comments created by other members.

Acceptance Criteria:

- A comment author can edit their own comment.
- OWNER and ADMIN can edit comments created by other members.
- MEMBER cannot edit another member's comment.
- Unauthorized modifications are rejected.
- Relevant changes preserve historical attribution.

#### FR-COL-004 — Delete Comment

| Attribute | Value |
|---|---|
| Priority | P1 |

The system MUST allow comment authors to delete their own comments.

OWNER and ADMIN may delete comments created by other members.

Acceptance Criteria:

- A comment author can delete their own comment.
- OWNER and ADMIN can delete comments created by other members.
- MEMBER cannot delete another member's comment.
- Deletion sets `deletedAt` and erases the Comment body in the same transaction.
- The metadata-only tombstone preserves Comment ID, author attribution, creation time, and deletion time.
- Tombstones are retained indefinitely in V1; no automatic physical purge runs.

#### FR-COL-005 — View Activity History

| Attribute | Value |
|---|---|
| Priority | P1 |

The system MUST preserve and expose relevant Activity history for authorized Users.

Acceptance Criteria:

- Relevant business actions produce Activity records.
- Activity records identify the actor where applicable.
- Activity records remain associated with the relevant domain resource.
- Historical attribution remains available after Membership removal.
- Users cannot access Activity records belonging to another tenant.
- Activity records are not silently modified or removed through ordinary resource updates.

---

### 3.7 Notifications

#### FR-NOTIF-001 — Generate In-App Notifications

| Attribute | Value |
|---|---|
| Priority | P1 |

The system MUST generate in-app notifications for supported work events.

Supported event categories and recipients are:

- Organization invitation: the intended recipient. An in-app notification is created only when the normalized invitation email belongs to an existing User account; invitation email delivery remains a separate asynchronous process.
- Issue assignment: the new assignee.
- Issue reassignment: the new assignee only; the previous assignee is not notified by this event.
- Relevant comment on an assigned Issue: the current assignee, unless the assignee authored the comment.
- Membership removal: the removed User, as a final account-level notification. This notification does not restore Organization access.

Acceptance Criteria:

- Notifications are generated only for the supported event categories and recipients above.
- The actor is not notified about their own action.
- A single event creates at most one notification for the same recipient.
- Separate events may each create a notification for the same recipient.
- Notifications are not indiscriminately broadcast to all Organization members.
- A removed User can retrieve their own membership-removal notification without regaining access to Organization resources.
- A membership-removal notification exposes only the minimum context needed to explain the removal and does not expose protected Organization data.
- Notification generation does not compromise the consistency of the originating business operation.
- Invitation email delivery remains asynchronous and retryable; it is not replaced by an in-app notification.

#### FR-NOTIF-002 — Retrieve Notifications

| Attribute | Value |
|---|---|
| Priority | P1 |

The system MUST allow authenticated Users to retrieve their own notifications.

Acceptance Criteria:

- A User can retrieve notifications addressed to them.
- A User cannot retrieve another User's notifications.
- Notification collection responses follow pagination conventions.
- Notification records preserve their relevant event context.
- A read Notification is purged 180 days after its current `readAt` timestamp; an unread Notification is purged 365 days after `createdAt`.
- Marking a Notification unread sets `readAt` to NULL and makes it subject to the unread retention deadline.
- Marking an unread Notification read sets `readAt` to the timestamp of that read transition; repeated read requests while already read are idempotent and do not reset the timestamp.
- If a Notification is marked unread and later read again, the new read transition establishes a new 180-day deadline.
- Cleanup evaluates the Notification's current state and must not delete it before the corresponding current deadline.

#### FR-NOTIF-003 — Notification Read State

| Attribute | Value |
|---|---|
| Priority | P1 |

The system MUST support tracking whether a notification has been read.

Acceptance Criteria:

- A notification has a defined read or unread state represented by `readAt`.
- Marking a Notification read sets `readAt` to the current transition timestamp; repeating the same read operation is idempotent and does not change an existing timestamp.
- Marking a Notification unread sets `readAt` to NULL.
- A later transition from unread to read sets a new `readAt` timestamp and therefore establishes a new 180-day read-retention deadline.
- An authorized User can update the read state of their own notification.
- A User cannot update another User's notification.
- Read-state updates do not modify the underlying business event.

---

## 4. Business Rules

Business Rules define domain invariants: conditions that must remain true regardless of which API endpoint or application workflow performs an operation.

They are not tied to a specific controller, route, or database implementation.

### 4.1 Tenant Rules

| ID | Business Rule |
|---|---|
| BR-TENANT-001 | An Organization is the primary tenant boundary. |
| BR-TENANT-002 | Every organization-scoped resource belongs to exactly one Organization, directly or through its parent resource. |
| BR-TENANT-003 | A User can access organization-scoped resources only through valid active Membership and authorization. |
| BR-TENANT-004 | A resource relationship must not cross Organization boundaries. |
| BR-TENANT-005 | Knowing or guessing a resource identifier does not grant access to that resource. |

### 4.2 Identity and Session Rules

| ID | Business Rule |
|---|---|
| BR-AUTH-001 | A User's normalized email address is globally unique. |
| BR-AUTH-002 | Passwords are stored as secure password hashes, never plaintext. |
| BR-AUTH-003 | Session tokens are opaque Bearer tokens. |
| BR-AUTH-004 | Only session token hashes are stored in the database. |
| BR-AUTH-005 | A Session has a fixed lifetime of seven days from its creation (no sliding expiration on use). Every Session also carries the absolute expiry of the login that started its refresh chain: 30 days after that login. |
| BR-AUTH-006 | A revoked or expired Session cannot authenticate a request or be refreshed. |
| BR-AUTH-007 | Refreshing a Session atomically revokes the old Session and creates a new Session that expires at the earlier of seven days after its creation and the inherited absolute expiry. After the absolute expiry the User must log in again. |
| BR-AUTH-008 | Only one concurrent refresh using the same Session token may succeed. Reuse of the old token is rejected and logged, and does not automatically revoke the newly issued Session. V1 has no refresh grace window. |

### 4.3 Organization Rules

| ID | Business Rule |
|---|---|
| BR-ORG-001 | The User creating an Organization becomes its initial OWNER. |
| BR-ORG-002 | Organization creation and initial Owner Membership creation are atomic. |
| BR-ORG-003 | Every Organization must always have at least one active OWNER. |
| BR-ORG-004 | Organizations cannot be deleted or archived in V1. |

### 4.4 Membership Rules

| ID | Business Rule |
|---|---|
| BR-MEM-001 | A User can have at most one Membership for a given Organization. |
| BR-MEM-002 | A Membership contains the User's role within that Organization. |
| BR-MEM-003 | Supported roles are OWNER, ADMIN, and MEMBER. |
| BR-MEM-004 | Membership lifecycle states are ACTIVE and REMOVED. |
| BR-MEM-005 | A removed Membership does not grant access to Organization resources. |
| BR-MEM-006 | Removing a member must not leave the Organization without an active OWNER. |
| BR-MEM-007 | Removing a member automatically unassigns their assigned Issues. |
| BR-MEM-008 | Membership removal and related Issue unassignment occur atomically. |
| BR-MEM-009 | Historical comments and Activity attribution remain preserved after Membership removal. |
| BR-MEM-010 | Rejoining a previously removed User reactivates the existing Membership rather than creating a duplicate relationship. |
| BR-MEM-011 | The last active OWNER cannot be removed or demoted. A replacement active OWNER must be established first. Ownership and Membership changes must preserve this invariant under concurrent operations. |

BR-MEM-001 is enforced by the `(organization_id, user_id)` primary key of `memberships` (see [Database](../design/database.md#54-memberships)).

### 4.5 Invitation Rules

| ID | Business Rule |
|---|---|
| BR-INV-001 | An Invitation belongs to exactly one Organization. |
| BR-INV-002 | Invitation states are PENDING, ACCEPTED, REVOKED, and EXPIRED. |
| BR-INV-003 | An Invitation expires after seven days. |
| BR-INV-004 | Invitation tokens are securely generated and stored only as hashes. |
| BR-INV-005 | Invitation acceptance requires an authenticated User whose email matches the recipient email. |
| BR-INV-006 | Resending a pending Invitation rotates its token and invalidates the previous token. |
| BR-INV-007 | Revoked, expired, and accepted Invitations cannot be accepted again. |
| BR-INV-008 | Resend is subject to a 60-second cooldown between successful resend requests. |
| BR-INV-009 | No more than five successful resend operations are allowed per Invitation in a rolling 24-hour window. A resend counts when token rotation and Outbox creation commit; delivery outcome is irrelevant. Rejected requests do not consume quota. |

### 4.6 Project Rules

| ID | Business Rule |
|---|---|
| BR-PROJ-001 | A Project belongs to exactly one Organization. |
| BR-PROJ-002 | A User must have valid access to the Organization to access its Projects. |
| BR-PROJ-003 | All active Organization roles may create and read Projects. |
| BR-PROJ-004 | Only OWNER and ADMIN may update, archive, or restore Projects. |
| BR-PROJ-005 | Projects are archived or restored rather than hard-deleted in V1. |

### 4.7 Issue Rules

| ID | Business Rule |
|---|---|
| BR-ISSUE-001 | An Issue belongs to exactly one Project. |
| BR-ISSUE-002 | An Issue is indirectly scoped to the Organization that owns its Project. |
| BR-ISSUE-003 | An Issue assignee must have active Membership in the Project's Organization. |
| BR-ISSUE-004 | All active Organization roles may archive and restore Issues. |
| BR-ISSUE-005 | Removing a member automatically clears their Issue assignments. |
| BR-ISSUE-006 | Issue creation and its corresponding Activity record must be atomic. |
| BR-ISSUE-007 | Issue status changes must follow an explicitly defined transition policy. |
| BR-ISSUE-008 | Issues are archived or restored rather than hard-deleted in V1. |
| BR-ISSUE-009 | Issue priority is LOW, MEDIUM, HIGH, or URGENT; new Issues default to MEDIUM. |
| BR-ISSUE-010 | Restoring an archived Label is rejected if another active Label in the same Organization has the same normalized name; the Label remains archived and existing associations are unchanged. |

### 4.8 Comment and Activity Rules

| ID | Business Rule |
|---|---|
| BR-COL-001 | A Comment belongs to exactly one Issue. |
| BR-COL-002 | Comment authors may edit or delete their own comments. |
| BR-COL-003 | OWNER and ADMIN may manage comments created by other members. |
| BR-COL-004 | Comment deletion erases the body and preserves a metadata-only tombstone indefinitely in V1. |
| BR-COL-005 | Historical Activity attribution remains preserved after Membership removal. |
| BR-COL-006 | Relevant business actions should produce corresponding Activity records. |

### 4.9 Notification Rules

| ID | Business Rule |
|---|---|
| BR-NOTIF-001 | An Organization invitation notification is addressed only to its intended recipient. An in-app notification is created only if that normalized email belongs to an existing User account. |
| BR-NOTIF-002 | Issue assignment and reassignment notifications are addressed to the new assignee. A reassignment does not notify the previous assignee. |
| BR-NOTIF-003 | A comment on an assigned Issue notifies the current assignee unless the assignee authored the comment. |
| BR-NOTIF-004 | Membership removal may generate a final notification addressed to the removed User. Retrieving that notification does not restore Membership or Organization access. |
| BR-NOTIF-005 | The actor is not notified about their own action. Notifications are not broadcast to all Organization members, and one event creates at most one notification per recipient. |
| BR-NOTIF-006 | Read Notifications are retained for 180 days after the current `readAt`; unread Notifications are retained for 365 days after creation. Marking unread clears `readAt`; a later read transition sets a new timestamp. Repeated read requests are idempotent. Purge uses the current state and deadline. |

---

## 5. Non-Functional Requirements

### 5.1 Security

#### NFR-SEC-001 — Authentication Enforcement

| Priority | P0 |
|---|---|

Protected resources MUST require a valid authenticated Session.

Verification:

- Requests without credentials are rejected.
- Invalid, expired, and revoked Sessions are rejected.
- Public endpoints are explicitly defined.

#### NFR-SEC-002 — Authorization Enforcement

| Priority | P0 |
|---|---|

Authorization MUST be enforced server-side for every protected operation.

Verification:

- Tests cover allowed and denied actions for OWNER, ADMIN, and MEMBER.
- Authorization is not based solely on client-provided role information.
- Unauthorized operations cannot modify protected resources.

#### NFR-SEC-003 — Tenant Isolation

| Priority | P0 |
|---|---|

The system MUST prevent unauthorized access to resources belonging to another Organization.

Verification:

- Cross-tenant read attempts are rejected.
- Cross-tenant update attempts are rejected.
- Cross-tenant delete, archive, and assignment attempts are rejected.
- Tests include attempts using valid resource identifiers from another tenant.
- No successful unauthorized cross-tenant access is permitted.

#### NFR-SEC-004 — Credential and Token Protection

| Priority | P0 |
|---|---|

Passwords, Session tokens, and Invitation tokens MUST be protected.

Verification:

- Passwords are never stored in plaintext.
- Session tokens are stored as hashes.
- Invitation tokens are stored as hashes.
- Sensitive credentials are excluded from application logs and error responses.

#### NFR-SEC-005 — Input Validation

| Priority | P0 |
|---|---|

External input MUST be validated before it is used in business operations.

Verification:

- Invalid types, missing required fields, and invalid values are rejected.
- Validation behavior is consistent across endpoints.
- Invalid input does not create partial or inconsistent data.

### 5.2 Consistency and Data Integrity

#### NFR-CON-001 — Atomic Critical Operations

| Priority | P0 |
|---|---|

Critical multi-step operations MUST be atomic.

Examples:

- Organization creation and initial Owner Membership creation.
- Issue creation and Activity creation.
- Membership removal and Issue unassignment.
- Session token rotation.

Verification:

- If one required operation fails, the transaction is rolled back.
- No partial state remains after transaction failure.

#### NFR-CON-002 — Domain Invariant Preservation

| Priority | P0 |
|---|---|

The system MUST preserve all defined Business Rules during normal and concurrent operations.

Verification:

- No Organization can be left without an active OWNER.
- No Issue can be assigned to an ineligible User.
- No resource relationship can cross tenant boundaries.
- Membership uniqueness is preserved.

#### NFR-CON-003 — Concurrency Control

| Priority | P0 |
|---|---|

Concurrent modifications MUST have predictable outcomes.

Verification:

- Critical ownership and Membership operations are safe under concurrent requests.
- Concurrent attempts to remove or demote the last active OWNER cannot both succeed in a way that violates the ownership invariant.
- Concurrent updates do not silently violate domain invariants.
- Version-based concurrency behavior follows the API and database specifications where applicable.

### 5.3 Reliability

#### NFR-REL-001 — Idempotent Operations

| Priority | P1 |
|---|---|

Operations that are defined as idempotent MUST NOT create duplicate effects when the same request is repeated.

Verification:

- Repeated execution produces the defined idempotent result.
- Non-idempotent operations have explicit duplicate-request behavior.
- Retry behavior does not create inconsistent domain state.

#### NFR-REL-002 — Asynchronous Delivery Reliability

| Priority | P1 |
|---|---|

Asynchronous invitation and notification delivery MUST support failure handling and retry.

Verification:

- Delivery failures are detectable.
- Retry behavior is controlled.
- Repeated delivery attempts do not create unintended duplicate business effects.
- A failed external delivery does not corrupt the underlying Invitation or business operation.

### 5.4 Performance

#### NFR-PERF-001 — Read API Latency

| Priority | P1 |
|---|---|
| Target | p95 ≤ 500 ms |

Read API latency SHOULD remain within the target under a documented V1 test workload.

Verification:

- The test workload is documented.
- Measurement includes the relevant API and database operations.
- Results report p50, p95, and p99 where practical.
- The environment and dataset size are recorded.

#### NFR-PERF-002 — Write API Latency

| Priority | P1 |
|---|---|
| Target | p95 ≤ 700 ms |

Write API latency SHOULD remain within the target under a documented V1 test workload.

Verification:

- The test workload is documented.
- Measurements include transaction-heavy operations.
- Results distinguish successful requests from rejected requests.
- The environment and dataset size are recorded.

#### NFR-PERF-003 — Valid Request Error Rate

| Priority | P1 |
|---|---|
| Target | < 1% |

The valid-request error rate SHOULD remain below 1% under the defined performance test workload.

Verification:

- Only valid requests are included in the denominator.
- Expected authorization and validation failures are not counted as unexpected server errors.
- Unexpected failures are reported separately.

#### NFR-PERF-004 — Collection Pagination

| Priority | P0 |
|---|---|

Collection endpoints MUST support pagination according to the API specification.

Verification:

- Large collections can be retrieved in bounded pages.
- Cursor behavior follows the API contract.
- Pagination does not expose records outside the requesting tenant's scope.

### 5.5 Maintainability

#### NFR-MAINT-001 — Separation of Responsibilities

| Priority | P1 |
|---|---|

The application SHOULD maintain clear separation between transport, application behavior, domain rules, and persistence responsibilities.

Verification:

- Business rules are not implemented solely as route-level conditionals.
- Authorization decisions are consistently enforced.
- Domain behavior can be tested independently where practical.

#### NFR-MAINT-002 — Automated Testing

| Priority | P0 |
|---|---|

Critical business behavior MUST have automated tests.

Verification:

- Authentication workflows are tested.
- Authorization behavior is tested.
- Tenant isolation is tested.
- Critical transaction rollback behavior is tested.
- Membership and Issue invariants are tested.
- Failure cases are covered, not only successful requests.

#### NFR-MAINT-003 — API Consistency

| Priority | P1 |
|---|---|

The API SHOULD follow consistent conventions for validation, pagination, errors, and resource behavior.

Verification:

- Endpoints follow [API Conventions](../design/api/conventions.md).
- Error responses follow the common error contract.
- Pagination follows a consistent contract.
- API behavior is documented.

### 5.6 Operational Reliability

#### NFR-OPS-001 — Secure Deployment

| Priority | P0 |
|---|---|

The V1 deployment MUST use HTTPS and secure configuration management.

Verification:

- Production traffic uses HTTPS.
- Secrets are not committed to source control.
- Production configuration is separated from development configuration.

#### NFR-OPS-002 — Health Checks and Monitoring

| Priority | P1 |
|---|---|

The deployed application MUST expose health information and provide operational visibility.

Verification:

- Application health can be checked.
- Application errors are logged.
- Critical failures can be identified.
- Sensitive information is not exposed through logs.

#### NFR-OPS-003 — Database Backup and Recovery

| Priority | P0 |
|---|---|

The deployed system MUST support database backup and tested recovery procedures.

Verification:

- Backup procedures are documented.
- Backups can be restored in a test environment.
- Recovery results are recorded.
- Backup retention and recovery objectives follow the operational policy.

#### NFR-OPS-004 — Migration and Rollback

| Priority | P0 |
|---|---|

Database schema changes and application deployments MUST have documented migration and rollback procedures.

Verification:

- Database migrations are versioned.
- Deployment procedures identify migration order.
- Rollback limitations are documented.
- Failed deployment recovery is tested where practical.

The initial deployment target is a single VPS. High availability and horizontal scaling are not guaranteed by V1.

---

## 6. Acceptance Criteria

A requirement is considered accepted only when its acceptance criteria are verified.

### 6.1 Functional Acceptance

| Area | Acceptance Outcome |
|---|---|
| Authentication | Registration, login, current-user retrieval, logout, and session refresh work according to the defined rules. |
| Organization | Users can create and access Organizations according to Membership and authorization rules. |
| Membership | Membership lifecycle, role management, and removal preserve all Organization invariants. |
| Invitations | Invitation creation, delivery, acceptance, revocation, expiration, and resend follow the defined lifecycle. |
| Projects | Projects can be created and managed according to role permissions. |
| Issues | Issues can be created, assigned, updated, archived, and restored without violating tenant boundaries. |
| Collaboration | Comments and Activity history preserve authorship and historical context. |
| Notifications | Supported events produce appropriate in-app notifications without indiscriminate broadcasts. |

### 6.2 Security Acceptance

- Protected endpoints reject unauthenticated requests.
- Role-based authorization is enforced server-side.
- Cross-tenant access tests produce zero successful unauthorized access cases.
- Passwords and tokens are not stored in plaintext.
- Sensitive information is not exposed through logs or error responses.

### 6.3 Consistency Acceptance

- Critical operations are atomic.
- Organization ownership invariants remain valid.
- Membership removal and Issue unassignment remain consistent.
- Issue and Activity creation remain atomic.
- Concurrent operations do not silently violate domain invariants.

### 6.4 Performance Acceptance

- Read API p95 latency is at most 500 ms under the documented test workload.
- Write API p95 latency is at most 700 ms under the documented test workload.
- Valid-request error rate is below 1% under the same defined workload.
- Test conditions, dataset size, and environment are documented.

### 6.5 Operational Acceptance

- The application can be deployed to the target VPS.
- HTTPS is configured.
- Health checks and logging are available.
- Database backups can be created and restored.
- Migration and rollback procedures are documented.
- Recovery procedures have been tested.

Passing acceptance criteria requires recorded test evidence. A requirement's presence in documentation is not evidence of implementation or successful verification.

---

## 7. Traceability

This section connects requirements to the product direction and implementation evidence.

### 7.1 PRD Traceability

| PRD Section | Related Requirements |
|---|---|
| 3. Target Users and Actors | Actors, FR-AUTH, FR-ORG, FR-MEM |
| 4. Product Goals | All functional requirements |
| 5.1 Identity and Authentication | FR-AUTH |
| 5.2 Organization Management | FR-ORG |
| 5.3 Membership and Invitations | FR-MEM, FR-INV |
| 5.4 Project Management | FR-PROJ |
| 5.5 Issue Management | FR-ISSUE |
| 5.6 Collaboration | FR-COL |
| 5.7 Notifications | FR-NOTIF |
| 6. Product Rules and Constraints | Business Rules |
| 7. Success Criteria | Section 6 Acceptance Criteria |
| 8. Non-Functional Requirements | NFR-SEC, NFR-CON, NFR-REL, NFR-PERF, NFR-MAINT, NFR-OPS |
| 9. Non-Goals | Scope exclusions |

### 7.2 Domain Traceability

| Domain Concept | Related Requirements |
|---|---|
| User | FR-AUTH, BR-AUTH |
| Session | FR-AUTH, BR-AUTH |
| Organization | FR-ORG, BR-ORG |
| Membership | FR-MEM, BR-MEM |
| Invitation | FR-INV, BR-INV |
| Project | FR-PROJ, BR-PROJ |
| Issue | FR-ISSUE, BR-ISSUE |
| Comment | FR-COL, BR-COL |
| Activity | FR-COL, BR-COL |
| Notification | FR-NOTIF |

### 7.3 Implementation Traceability

The mapping from requirement IDs to implementation tasks and their status lives in the [Roadmap](../plan/roadmap.md).

---

## 8. Open Decisions

Open decisions are tracked in one register: [Roadmap — Open decisions](../plan/roadmap.md#open-decisions). Once made, a decision is recorded in the document that owns it (or in an ADR) and removed from the register.

---

## 9. Document Maintenance

Update this document when:

- A functional requirement is added, changed, or removed.
- A business rule changes.
- A non-functional target changes.
- An Open Decision is resolved.
- Acceptance criteria change.

Every requirement ID MUST remain stable once referenced by implementation tasks, tests, or other documentation.

Do not reuse retired requirement IDs for unrelated requirements.

Implementation progress is reflected in the Roadmap and MUST NOT silently change the intended product scope.
