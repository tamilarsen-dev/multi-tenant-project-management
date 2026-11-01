**Project:** Multi-Tenant Project Management API  
**Workflow Stage:** 03 — Design  
**Document:** 04  
**Version:** 1.0  
**Status:** Approved

---

# Domain Modeling

This document is an artifact of **Workflow Stage 03: Design**. Domain Modeling defines business concepts and relationships between domains before they are mapped to an ERD and database.

One important principle: **a domain model is not an ERD**. At this point, we are not thinking about tables, foreign keys, ORMs, or PostgreSQL. We are modeling the business domain first. Jumping straight to tables risks producing a database that looks tidy while representing the wrong business model.

The sequence:

```text
Problem
   ↓
Domain Model
   ├── Entity
   ├── Attribute
   ├── Relationship
   ├── Cardinality
   ├── Ownership
   └── Invariant
        ↓
Database Model
        ↓
Implementation
```

## 1. Entities

An **Entity** is a domain object with an identity whose existence must be tracked by the system.

For this project:

```text
User
Organization
Membership
Invitation
Project
Issue
Comment
Label
Activity
Notification
Session
```

These entities do not all serve the same purpose. They can be grouped as follows:

```text
Core entities
├── User
├── Organization
├── Project
└── Issue

Relationship entities
└── Membership

Supporting entities
├── Invitation
├── Comment
├── Label
├── Activity
├── Notification
└── Session
```

`Membership` is especially important. It is not merely a junction table.

The relationship:

```text
User ←→ Organization
```

has its own data and behavior:

```text
role
joinedAt
status
```

Therefore, this relationship deserves to be modeled as an entity:

```text
User
   │
   │ has
   ▼
Membership
   │
   │ belongs to
   ▼
Organization
```

This is called an **association entity**.

---

## 2. Attributes

Each entity is now given the data required by the domain.

### User

```text
User
├── id
├── email
├── name
├── passwordHash
└── createdAt
```

The domain does not store plaintext passwords. The persisted credential is a hash (`passwordHash`); the hashing algorithm and credential policy belong to the authentication/security design.

### Organization

```text
Organization
├── id
├── name
├── slug
└── createdAt
```

`slug` may later be used as a more human-friendly identifier:

```text
acme
```

instead of:

```text
org_01J...
```

### Membership

```text
Membership
├── id
├── userId
├── organizationId
├── role
├── joinedAt
├── removedAt?
└── status (ACTIVE | REMOVED)
```

`REMOVED` represents logical revocation. The Membership record is retained for referential integrity and audit history. All Issues still assigned to that Membership are unassigned in the same transaction before its status changes. If the User is invited again, the same record is reactivated; `joinedAt` is updated, `removedAt` is cleared, and the role follows the new Invitation.

Example:

```text
Alice
   ↓
Membership
   ├── organization = Acme
   ├── role = OWNER
   └── status = ACTIVE
```

The role belongs here, not on User.

### Invitation

```text
Invitation
├── id
├── organizationId
├── invitedEmail
├── invitedBy
├── role
├── tokenCredential
├── expiresAt
├── acceptedAt?
├── status (PENDING | ACCEPTED | REVOKED | EXPIRED)
└── createdAt
```

Why `invitedEmail` rather than `userId`?

Because the invited person **may not have an account yet**.

For example:

```text
Alice → invite → bob@gmail.com
```

Bob has not registered yet, so there is no:

```text
userId = ?
```

An Invitation can exist before the User does.

After Bob accepts the Invitation:

```text
Invitation
      ↓
accepted
      ↓
Membership
```

---

## 3. Project

```text
Project
├── id
├── organizationId
├── name
├── key
├── description
├── createdBy
├── createdAt
└── archivedAt?
```

For example:

```text
Payment System
key = PAY
```

An Issue can then have an identifier such as:

```text
PAY-431
PAY-432
PAY-433
```

`key` is not merely cosmetic. Uniqueness and concurrency problems arise when generating Issue numbers.

---

## 4. Issue

This is one of the primary entities.

```text
Issue
├── id
├── organizationId
├── projectId
├── number
├── title
├── description
├── status
├── priority
├── assigneeMembershipId?
├── createdBy
├── version
├── createdAt
├── updatedAt
└── archive state
```

For example:

```text
PAY-431
```

Conceptually, it consists of:

```text
Project key = PAY
Issue number = 431
```

Its internal `id` remains different.

```text
id       = issue_abc123
number   = 431
key      = PAY
display  = PAY-431
```

This illustrates that **internal identifier ≠ business identifier ≠ display identifier**.

---

## 5. Comment

```text
Comment
├── id
├── issueId
├── authorId
├── body
├── createdAt
├── updatedAt
└── deletedAt?
```

Relationship:

```text
Issue
  │
  └── has many
        ↓
     Comment
```

---

## 6. Label

Labels are slightly more interesting.

A single Issue can have multiple Labels:

```text
PAY-431
├── bug
├── backend
└── payment
```

A single Label can also be used by many Issues:

```text
bug
├── PAY-431
├── PAY-455
├── PAY-490
└── PAY-501
```

Therefore:

```text
Issue ←→ Label
```

is a **many-to-many relationship**.

We will later need an association:

```text
IssueLabel
├── issueId
└── labelId
```

Do not immediately treat this as a "database feature". It represents a domain relationship.

---

## 7. Activity

Activity stores important changes:

```text
Activity
├── id
├── organizationId
├── actorId?
├── issueId?
├── action
├── metadata
└── createdAt
```

Example:

```text
Diana changed status
IN_PROGRESS → IN_REVIEW
```

Activity is generally **append-only**.

That means:

```text
CREATE ✓
UPDATE ✗
DELETE ✗
```

Why? Because the purpose of Activity is to provide history and an audit trail.

If history could be edited:

```text
Bob deleted production database
```

could later be changed to:

```text
Bob reviewed documentation
```

That would make for a creative audit trail, but not a useful one.

---

## 8. Notification

```text
Notification
├── id
├── userId
├── type
├── payload
├── readAt
└── createdAt
```

Example:

```text
user = Diana

type = ISSUE_ASSIGNED

payload:
{
  issueId: "issue_431"
}
```

A Notification is **per-user state**.

Activity answers:

> What happened?

Notification answers:

> What does this particular User need to know?

These are different concepts, even though they are often generated by the same event.

---

## 9. Session

```text
Session
├── id
├── userId
├── tokenHash
├── expiresAt
├── revokedAt
└── createdAt
```

A single User can have multiple sessions:

```text
Alice
├── Laptop
├── Phone
└── Tablet
```

Therefore:

```text
User 1 ─── N Session
```

---

## 10. Relationships

Let's combine the entities.

```text
User
 ├──────────────< Session
 ├──────────────< Notification
 ├──────────────< Membership >──────────── Organization
 │                                           ├────< Invitation
 │                                           ├────< Project
 │                                           └────< Issue
 │                                                  ▲
 │                                                  │ belongs to Project
 │
 Membership ───────────────────────────────────────┘
   (optional assignee relationship)

Project
 └──────────────< Issue
                  ├──────────────< Comment
                  ├──────────────< Activity (optional Issue context)
                  └──────────────< IssueLabel >──────────── Label
```

This is still a simplification. `Issue` has a relationship to both `Organization` and `Project`. `assigneeMembershipId` is an optional relationship to a `Membership` in the same Organization. `Activity` is also scoped to an Organization, while its relationship to an Issue is optional.

Let's make this more precise.

---

## 11. Cardinality

**Cardinality** describes how many instances can be associated with another instance.

We use:

```text
1 : 1
1 : N
N : N
```

### User → Membership

```text
User 1 ─── N Membership
```

A single User:

```text
Alice
├── Acme membership
├── Beta membership
└── Gamma membership
```

Each Membership has exactly one User.

### Organization → Membership

```text
Organization 1 ─── N Membership
```

Acme:

```text
Acme
├── Alice
├── Bob
├── Charlie
└── Diana
```

Overall:

```text
User N ─── N Organization
```

implemented through:

```text
Membership
```

### Organization → Project

```text
Organization 1 ─── N Project
```

A Project belongs to exactly one Organization.

```text
Acme
├── Payment
├── Authentication
└── Mobile App
```

### Project → Issue

```text
Project 1 ─── N Issue
```

An Issue belongs to exactly one Project.

### Issue → Comment

```text
Issue 1 ─── N Comment
```

### Issue ↔ Label

```text
Issue N ─── N Label
```

through:

```text
IssueLabel
```

### User → Notification

```text
User 1 ─── N Notification
```

### User → Session

```text
User 1 ─── N Session
```

---

## 12. Ownership

Now we reach a very important concept.

**Ownership** answers:

> "Who owns or scopes this resource in the domain?"

For example:

```text
Organization
   ↓ owns
Project
   ↓ owns
Issue
   ↓ owns
Comment
```

But a User does not "own" an Organization in the same sense.

```text
User
   ↓
Membership
   ↓
Organization
```

Because:

```text
User ≠ Organization owner
```

even when a person has the `OWNER` role.

`OWNER` is a **role within a Membership**. It does not mean that the Organization entity is literally the User's personal property.

---

## 13. Tenant Boundary

This is one of the most important rules.

Every organization-scoped resource must be traceable to an Organization.

For example:

```text
Issue
 ↓
Project
 ↓
Organization
```

Therefore, we can determine:

```text
Issue #431 belongs to Acme
```

And:

```text
User Alice
 ↓
Membership
 ↓
Acme
```

Authorization can then compare:

```text
User tenant context
        ↓
      Acme

Resource tenant
        ↓
      Acme

        ↓
      MATCH
        ↓
      continue
```

If:

```text
Alice → Acme
Issue → Beta
```

then:

```text
MISMATCH
   ↓
DENY
```

This is the core of tenant isolation.

---

## 14. Invariants

Now we state the rules that **must always be true**.

Some invariants identified so far:

```text
INV-01
Membership.userId + organizationId must be unique.
```

Alice must not have:

```text
Alice + Acme
Alice + Acme
```

twice.

```text
INV-02
A Project belongs to exactly one Organization.
```

```text
INV-03
An Issue belongs to exactly one Project.
```

```text
INV-04
An Issue's Assignee must be an active Membership
in the Organization that owns that Issue.
```

```text
INV-05
A User can access an Organization only with
a valid Membership.
```

```text
INV-06
An Organization must always have at least one Owner.
```

```text
INV-07
Activity must not be modified after creation.
```

```text
INV-08
Issue version may only increase.
```

Example:

```text
7 → 8 ✓
8 → 9 ✓
9 → 7 ✗
```

```text
INV-09
Issue status may change only through an allowed transition,
including CANCELLED → TODO.
```

```text
INV-10
A Label used by an Issue must belong to
the same Organization.

INV-11
An Invitation has a PENDING, ACCEPTED, REVOKED, or EXPIRED lifecycle;
expiresAt is the source of truth for validity.

INV-12
Projects and Issues can be archived without deleting history.

INV-13
Deleted Comments are retained through soft deletion.

INV-14
Activity must be associated with an Organization;
actor and issue are optional.
```

This is how a domain model starts becoming something we can **formally test**.

---

## 15. Interim Result

We have moved from:

```text
"A User can create an Issue."
```

to:

```text
User
  ↓
Membership
  ↓
Organization
  ↓
Project
  ↓
Issue
```

with:

```text
Attributes
Relationships
Cardinality
Ownership
Invariants
```

This will later be derived into:

```text
Domain Model
      ↓
ERD
      ↓
Database Schema
      ↓
API
      ↓
Application Code
      ↓
Tests
```

This Domain Model is next validated against the use cases and constraints in Documents 05 and 06. The Invitation, Membership, Activity, Notification, and Issue state-transition lifecycles are no longer considered undecided: the agreed decisions are included in the Requirements consistency section below and detailed in Domain Validation and Domain Specification.

Use-case validation is still necessary to test whether the entities, attributes, relationships, and invariants are sufficient to support business behavior. Validation may propose model changes, but it must not silently alter business rules already locked in Document 03.

---

## 16. Consistency with Requirements v1 (Locked Decisions)

This section binds the Domain Model to the decisions in the Problem Definition and Requirements document. These are domain rules, not column-type or ORM implementation decisions.

### Required attributes and relationships

- `Issue` has both `organizationId` and `projectId`. Both are required, and a Project cannot be moved between Organizations in v1.
- `Issue.assigneeMembershipId` is nullable and references a Membership, not a User directly. That Membership must belong to the same Organization and be active when the assignment is created or changed.
- `Invitation` has a status of `PENDING`, `ACCEPTED`, `REVOKED`, or `EXPIRED`, as well as `expiresAt`. Expiration time remains authoritative for validity even if the worker has not updated the status.
- `Activity.organizationId` is required; `actorId` is nullable for system activity; `issueId` is nullable for Organization-level or Membership events. There is no direct `projectId`; Project context may be recorded in metadata.
- `Comment` supports soft deletion. A persistence field such as `deletedAt` is one possible representation, not the only domain option.
- Projects and Issues have archive states separate from the Issue workflow status. Archiving does not delete Comments or Activity.

### Final Issue status transitions

| Current | Allowed next |
|---|---|
| `TODO` | `IN_PROGRESS`, `CANCELLED` |
| `IN_PROGRESS` | `IN_REVIEW`, `CANCELLED` |
| `IN_REVIEW` | `IN_PROGRESS`, `DONE`, `CANCELLED` |
| `DONE` | `IN_PROGRESS` |
| `CANCELLED` | `TODO` |

Any Member with access may perform a valid transition. A transition not listed is rejected.

### Final archive behavior

- Owners/Admins may archive and restore Projects and Issues.
- An archived Project cannot accept new Issues or be modified. Issues within it also cannot be modified until the Project is restored.
- Archiving a Project does not automatically archive its Issues. Restoring a Project does not automatically restore Issues that were individually archived.
- Hard deletion of Projects and Issues is unavailable in v1.

### Abstraction boundary

The Domain Model establishes the meaning and relationships described above. Choices such as `archivedAt`, `deletedAt`, composite foreign keys, partial unique indexes, PostgreSQL types, and transaction/locking strategies are discussed in the logical ERD and Database Design.

## 17. Final Decisions on Membership and Issue Numbers

- Membership has an `ACTIVE` or `REMOVED` status and a nullable `removedAt`. Revocation changes the status to `REMOVED` and sets `removedAt`; the record is not physically deleted. Re-invitation reactivates the same record, updates `joinedAt` and role, and clears `removedAt`.
- All Issues assigned to that Membership are unassigned before its status changes, within the same transaction.
- Issue numbers are sequential within each Project. The `projects.next_issue_number` counter mechanism is a persistence detail, not a domain attribute supplied by the client. Its initial value is 1 and it is allocated atomically when creating an Issue.
- v1 Sessions use opaque database-backed tokens, not JWTs; `tokenHash` is stored, a session is valid for 7 days, refresh rotates the token, and logout revokes the session.
