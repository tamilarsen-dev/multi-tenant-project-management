**Project:** Multi-Tenant Project Management API  
**Workflow Stage:** 03 — Design  
**Document:** 06  
**Version:** 1.0  
**Status:** Approved

---

# Constraint Matrix & Use Case Validation

This document continues the **Constraint Matrix & Use Case Validation** work within **Workflow Stage 03: Design**. Its purpose is to ensure that the domain model and business rules are correct before they are translated into an ERD and database design.

## 1. Constraint Matrix

Let's examine each entity.

| Entity | Identity | Primary relationship | Important invariant | Ownership |
|---|---|---|---|---|
| User | `userId` | Membership, Session, Comment, Activity | Email is unique | User |
| Organization | `organizationId` | Membership, Project, Invitation | ≥1 Owner | Organization |
| Membership | `membershipId` | User ↔ Organization | `(user, org)` is unique | Organization |
| Invitation | `invitationId` | Organization → invitee | Token valid; not expired/accepted | Organization |
| Project | `projectId` | Organization → Project | Key unique within Organization | Organization |
| Issue | `issueId` | Organization + Project → Issue; Membership → Assignee | Assignee must be an active Membership in the same Organization | Organization (with Project as operational parent) |
| Comment | `commentId` | Issue → Comment, User → author | Author has access | Issue |
| Label | `labelId` | Organization ↔ Issue | Label must belong to one Organization | Organization |
| Activity | `activityId` | Issue/User/Organization | Append-only | Organization |
| Notification | `notificationId` | User → Notification | Only the relevant User may read it | User |
| Session | `sessionId` | User → Session | Token valid/expired/revoked | User |

Notice something important:

**Ownership ≠ foreign key.**

For example:

```text
Issue
  ↓
Project
  ↓
Organization
```

At the database level, we may have:

```text
issue.project_id
```

But at the domain level:

> The Project owns/scopes the Issue.

This means the Issue's lifecycle and authorization partly depend on the Project.

---

## 2. Use Case Validation

Let's start with the basics.

### UC-01: User Creates an Organization

Charlie does not have an Organization yet.

Request:

```http
POST /organizations
```

Body:

```json
{
  "name": "Acme"
}
```

Domain operation:

```text
User Charlie
      ↓
Create Organization
      ↓
Organization Acme
      +
Membership(Charlie, Acme, OWNER)
```

Notice that there are actually **two domain changes**:

```text
Organization created
Membership created
```

Both must succeed together.

This must not happen:

```text
Organization created ✓
Membership failed    ✗
```

leaving:

```text
Acme
└── nobody
```

Our invariant is:

```text
Organization must have at least one Owner.
```

Therefore, this is a strong candidate for a **database transaction**.

---

### UC-02: Owner Invites a User

Alice is the Owner of Acme.

She invites:

```text
diana@example.com
role = MEMBER
```

Flow:

```text
Alice
 ↓
POST /organizations/acme/invitations
 ↓
Authorization
 ↓
Alice = OWNER or ADMIN?
 ↓
Is the requested role allowed by Invitation rules?
Owner: ADMIN or MEMBER; Admin: MEMBER
 ↓
Create Invitation
 ↓
send invitation
```

What has not happened yet:

```text
Diana is not a Member yet.
```

State:

```text
Organization
 ├── Alice (OWNER)
 └── Invitation → diana@example.com
```

Only when the Invitation is accepted:

```text
Diana accepts
      ↓
validate token
      ↓
validate expiration
      ↓
lookup Membership by (user, organization)
      ↓
create new OR reactivate REMOVED row
      ↓
Invitation = accepted
```

Result:

```text
Organization
 ├── Alice (OWNER)
 └── Diana (MEMBER)
```

This establishes the invariant:

```text
Invitation acceptance must not create
duplicate Membership. A REMOVED Membership is reactivated.
```

For example, Diana might click Accept twice because humans have an impressive ability to click the same button twice.

First request:

```text
Membership created/reactivated
Invitation accepted
```

Second request:

```text
already accepted
```

This must be safe.

**Reactivation case:** if Diana was previously a Member but her Membership has status `REMOVED`, acceptance reactivates the same record, sets the role according to the Invitation, updates `joined_at`, clears `removed_at`, and records Activity. If the Membership is still `ACTIVE`, acceptance is rejected as "already a member".

This brings us to the concept of **idempotency**.

---

### UC-03: Create Project

Diana is an active MEMBER in Acme.

She creates:

```text
Project:
name = Payment System
key = PAY
```

The result is **ALLOW**, because all roles (`OWNER`, `ADMIN`, and `MEMBER`) may create Projects in an Organization where they have an active Membership.

```text
Diana = active MEMBER in Acme
        ↓
Create Project in Acme
        ↓
ALLOW
```

Permissions are still evaluated based on Membership in the target Organization and the resource context. A role is not, by itself, an authorization decision; it is one input to the policy.

Role is only an input.

Authorization is actually:

```text
User
 ↓
Membership
 ↓
Role
 ↓
Permission
 ↓
Policy
 ↓
Allow / Deny
```

This is much healthier than:

```typescript
if (user.role === "ADMIN") ...
```

because `user.role` is not even correct in the domain model. The role belongs to **Membership**, since one User can have different roles in different Organizations.

---

### UC-04: Create Issue

Now Bob is an Admin.

Project:

```text
Acme
└── Payment System [PAY]
```

Bob creates:

```text
Issue:
title = "Prevent duplicate webhook"
priority = HIGH
status = TODO
assigneeMembership = Diana's Acme Membership
```

Flow:

```text
Request
 ↓
Authentication
 ↓
Membership check
 ↓
Authorization
 ↓
Validation
 ↓
Project exists?
 ↓
Project belongs to same Organization?
 ↓
Assignee is a member of Organization?
 ↓
Create Issue
 ↓
Create Activity
```

Notice how many invariants are involved in a single `POST`:

```text
INV-01 user must be authenticated
INV-02 user must be organization member
INV-03 user must have permission
INV-04 project must exist
INV-05 project belongs to organization
INV-06 assignee belongs to organization
INV-07 initial status must be valid
INV-08 issue number must be unique within project
INV-09 activity must correspond to successful creation
```

This is why the project is valuable for a portfolio.

Not because:

> "I can build Issue CRUD."

But because:

> "I can preserve invariants when a resource crosses multiple boundaries."

That is much closer to real backend engineering work.

---

### UC-05: Change Status

Diana is now working on an Issue:

```text
PAY-431
TODO
```

She performs:

```text
TODO → IN_PROGRESS
```

Valid.

But this request:

```text
TODO → DONE
```

is rejected if our state machine does not allow it.

Conceptually:

```text
allowedTransitions = {
    TODO:        [IN_PROGRESS, CANCELLED],
    IN_PROGRESS: [IN_REVIEW, CANCELLED],
    IN_REVIEW:   [DONE, IN_PROGRESS],
    DONE:        [IN_PROGRESS],
    CANCELLED:   [TODO]
}
```

Therefore:

```text
transition(TODO, DONE)
```

produces:

```text
INVALID_TRANSITION
```

This is an important example:

**Validation is not limited to validating input shape.**

The shape:

```json
{
  "status": "DONE"
}
```

may be valid according to the schema.

But it may be invalid according to a **business rule**.

There are therefore two layers:

```text
Structural validation
        ↓
"Is the status a valid enum value?"

Domain validation
        ↓
"Is this status transition allowed?"
```

---

### UC-06: Concurrent Update

Now we get to the part that starts to feel like actual backend engineering.

Issue:

```text
version = 7
status = IN_PROGRESS
```

Diana opens the Issue.

Bob also opens the Issue.

Both see:

```text
version 7
```

Diana changes:

```text
IN_PROGRESS → IN_REVIEW
```

Server:

```text
version 7 → 8
```

Bob then attempts:

```text
IN_PROGRESS → CANCELLED
```

based on version 7.

The server sees:

```text
clientVersion = 7
currentVersion = 8
```

Therefore:

```text
409 Conflict
```

If we blindly accepted Bob's update:

```text
Diana's update
       ↓
lost
```

We would have a **lost update**.

Therefore:

```text
Issue.version
```

is not a cosmetic attribute.

It supports the invariant:

> An update may only modify the version the client actually observed.

---

### UC-07: Cross-Tenant Access

Now:

```text
Acme
 └── PAY-431

Beta
 └── WEB-17
```

Alice is only a Member of Acme.

Alice attempts:

```http
GET /issues/WEB-17
```

The server finds the Issue.

But:

```text
Issue
 ↓
Project
 ↓
Beta
 ↓
Alice membership?
 ↓
NO
```

The ideal response is:

```http
404 Not Found
```

rather than always returning:

```http
403 Forbidden
```

because we do not want to disclose the existence of another tenant's resource.

This leads to the concept:

> **Authorization is not only about "what can be done", but also "to whose resource".**

---

### UC-08: Revoke Membership

Diana is now removed from Acme.

But Diana is currently assigned to:

```text
PAY-431
assigneeMembership = Diana's Acme Membership
```

What happens?

There are several possible designs.

### Option A

Set:

```text
assignee = null
```

The Issue remains.

### Option B (not selected)

Reject Membership revocation while any Issues remain assigned to that Membership.

### Option C (not selected)

Automatically transfer all Issues to another person.

For v1, the final decision is **Option A**.

Therefore:

```text
Revoke Membership
       ↓
validate Owner invariant
       ↓
find assigned issues
       ↓
assignee = null + Activity
       ↓
Membership.status = REMOVED
```

For v1, **Option A** is used: every Issue assigned to Diana's Membership is unassigned (`assigneeMembershipId = null`), one assignment-change Activity is recorded for each affected Issue, one membership-revoked Activity is recorded, and then the Membership changes to `REMOVED`. The Membership record is not physically deleted. The operation is rejected if it would remove the last Owner. An Admin cannot revoke an Owner's Membership.

Both changes must occur in one database transaction. If unassignment or the Membership status change fails, the entire transaction is rolled back. The system must not leave an Issue pointing to an inactive Membership.

```text
BEGIN
  find Issues assigned to Diana's Membership
  set assigneeMembershipId = null
  record relevant Activity
  set Membership.status = REMOVED
COMMIT
```

This preserves the invariant that an Assignee must be an active Membership in the same Organization.

---

## 3. Types of Invariants Identified

This is important for your mental model.

Not all invariants are the same kind.

### Structural invariant

The shape of the data must be valid.

```text
Issue.title must not be empty.
```

### Referential invariant

Relationships must be valid.

```text
An Issue must have a Project.
```

### Authorization invariant

The User must have access rights.

```text
A Member may access only resources
within their Organization.
```

### State invariant

State transitions must be valid.

```text
TODO cannot transition directly to DONE.
```

### Uniqueness invariant

Certain duplicates are not allowed.

```text
organization + project.key must be unique.
```

### Temporal invariant

Something is valid only under a time-based condition.

```text
An expired Invitation cannot be accepted.
```

### Concurrency invariant

An update must be based on the correct state.

```text
version must match before an update.
```

### Audit invariant

History must not be manipulated.

```text
Activity is append-only.
```

These are already beginning to form our **domain specification**.

---

## 4. Domain Validation Results So Far

We now have:

```text
Problem
   ↓
Domain
   ↓
Entities
   ↓
Relationships
   ↓
Cardinality
   ↓
Attributes
   ↓
Ownership
   ↓
Lifecycle
   ↓
Business Invariants
   ↓
Use Case Validation
```

Most importantly:

```text
Use Case
   ↓
forces us to discover
   ↓
rules/invariants that were not previously visible
```

Domain modeling is therefore not a diagram-drawing exercise. **We use the model to explain and test system behavior.**

These validation results are inputs to Domain Specification v1 (Document 07), Permission Matrix (Document 08), ERD (Document 09), and PostgreSQL Database Design (Document 10). These documents are part of Stage 03 Design.

---

## Reconciliation with Requirements v1

### Applicable Constraint Matrix

| Entity | Identity | Required relationship / invariant |
|---|---|---|
| User | `userId` | Email is unique after normalization; may have many Memberships |
| Organization | `organizationId` | At least one Owner; defines the tenant boundary |
| Membership | `membershipId` | Exactly one User and Organization; User–Organization pair is unique; status `ACTIVE/REMOVED`; `REMOVED` can be reactivated upon re-invitation |
| Invitation | `invitationId` | One Organization; four-state lifecycle; `expiresAt` is authoritative |
| Project | `projectId` | Exactly one Organization; key unique per Organization; cannot move between tenants |
| Issue | `issueId` | Requires `organizationId` and `projectId`; nullable `assigneeMembershipId` must reference an active Membership in the same Organization |
| Comment | `commentId` | Exactly one Issue and author; soft delete; edit/delete according to role/ownership |
| Label | `labelId` | Exactly one Organization; name unique within Organization; may only be attached to an Issue in the same tenant |
| IssueLabel | `(issueId, labelId)` | Many-to-many relationship; both sides must belong to the same Organization |
| Activity | `activityId` | Organization required; actor and issue nullable; append-only |
| Notification | `notificationId` | Exactly one recipient User; only the recipient may read/mark as read |
| Session | `sessionId` | Exactly one User; token hash, expiry, revocation |

### Locked Use Case Expected Outcomes

- **Create Organization:** Organization and initial Owner Membership are created together; the creating User becomes Owner.
- **Invitation acceptance:** only a `PENDING` Invitation that has not passed `expiresAt` may be accepted; Membership creation and changing the Invitation to `ACCEPTED` happen atomically; duplicate acceptance does not create duplicate Membership.
- **Create Issue:** the Issue stores `organizationId` and `projectId`; the Project must be active; an Assignee, if provided, must be an active Membership in that Organization; Activity is created in the same transaction.
- **Status transition:** all transitions follow the Requirements table, including `CANCELLED → TODO`. Every successful transition generates one Activity.
- **Concurrent Issue update:** updates are based on the observed version; conflicts must not cause lost updates.
- **Cross-tenant access:** another tenant's resource must not be disclosed or mutated; the response details are defined in the API Contract.
- **Revoke Membership:** Issues assigned to that Membership are unassigned (`assigneeMembershipId = null`), Activity is recorded, and the Membership status changes to `REMOVED` within a transaction that preserves consistency.
- **Archive Project:** it cannot accept new Issues or be modified; child Issues are not automatically archived, but cannot be mutated while the parent is archived.
- **Comment:** soft delete; authors manage their own Comments; Owners/Admins may manage others' Comments; Comments cannot be created/updated on archived Issues or Projects.

### Decision Boundaries

The Constraint Matrix records invariants and enforcement responsibilities. SQL shape, composite foreign keys, partial indexes, locking, and transaction isolation remain database-design details. Error response details remain part of the API Contract. Invitation roles follow the final rule: an Owner may invite `ADMIN` or `MEMBER`; an Admin may invite `MEMBER` only; `OWNER` cannot be granted through an Invitation. Permanent Organization deletion is outside v1 scope.
