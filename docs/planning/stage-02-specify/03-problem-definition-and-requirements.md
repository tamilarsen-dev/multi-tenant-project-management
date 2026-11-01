**Project:** Multi-Tenant Project Management API  
**Workflow Stage:** 02 — Specify  
**Document:** 03  
**Version:** 1.0  
**Status:** Approved

---

# Multi-Tenant Project Management API

## Problem Definition and Requirements Specification

## 1. Document Purpose

This document defines the problem to be solved, system actors, functional requirements, business rules, non-functional requirements, and project scope boundaries.

This is the primary artifact for **02. Specify** in the engineering workflow.

Its purpose is to produce a sufficiently clear specification so that the Design stage can determine the domain model, database design, API contract, and architecture based on established requirements.

This document describes **what** the system must do and **what must always be true**, not the technical details of **how** the system will be built.

## 2. Problem Definition

### 2.1 Problem statement

Software teams need a centralized system to manage work within an organization. Each work item must have clear ownership, status, priority, context, and history, while access to data must be restricted according to the user's organization and permissions.

The primary problems to address are:

1. **Coordination:** Who is working on what?
2. **State:** What is the current state of the work?
3. **Context & History:** Why did data or status change, who changed it, and what was the context?
4. **Tenant isolation:** How can the system ensure that data belonging to one Organization cannot be accessed by another Organization?

### 2.2 Multi-tenancy

In this project, an **Organization is a tenant**. Multiple Organizations use the same application, but each Organization's data and access must remain isolated.

```text
Organization A
    ├── Members
    ├── Projects
    └── Issues

Organization B
    ├── Members
    ├── Projects
    └── Issues
```

A user who belongs to Organization A must not gain access to Organization B's data merely by knowing or guessing the identifier of a resource owned by Organization B.

Tenant isolation is a system requirement, not merely a role check.

## 3. Actors

### 3.1 User

A User is an individual's account identity within the application.

A single User may belong to multiple Organizations. A User's role is determined by their Membership in a specific Organization, not by a global role on the User account.

```text
Alice
  ├── Acme            → OWNER
  ├── Startup X       → MEMBER
  └── Open Source Org → ADMIN
```

### 3.2 Organization roles

The roles included in v1 scope are:

- `OWNER`
- `ADMIN`
- `MEMBER`

`GUEST` is outside v1 scope. Adding a new role requires a separate design decision, including its permissions and access rules.

## 4. Functional Requirements

This section defines the capabilities the system must provide. The list describes requirements, not endpoints or implementation order.

### 4.1 Authentication

| ID | Requirement |
|---|---|
| FR-AUTH-01 | The system must allow a User to register an account. |
| FR-AUTH-02 | The system must allow a User to log in. |
| FR-AUTH-03 | The system must allow a User to log out and terminate the relevant session. |
| FR-AUTH-04 | The system must allow a User to refresh their authentication session. |

### 4.2 Organization & Membership

| ID | Requirement |
|---|---|
| FR-ORG-01 | A User must be able to create an Organization. |
| FR-ORG-02 | A User must be able to view the Organizations they belong to. |
| FR-ORG-03 | Owners and Admins must be able to update Organization information. |
| FR-ORG-04 | Owners and Admins must be able to invite people to join an Organization. |
| FR-ORG-05 | An invitee must be able to accept an Invitation that is still valid. |
| FR-ORG-06 | Owners and Admins must be able to revoke Memberships subject to role-management restrictions. Revocation changes the status to `REMOVED`; the record is not physically deleted. |
| FR-ORG-07 | Owners and Admins must be able to change Membership roles subject to role-management restrictions. |
| FR-ORG-08 | Owners and Admins must be able to revoke Invitations that are still pending. |

### 4.3 Projects

| ID | Requirement |
|---|---|
| FR-PROJ-01 | Organization Members must be able to create a Project. |
| FR-PROJ-02 | Organization Members must be able to view Projects they are authorized to access. |
| FR-PROJ-03 | Organization Members must be able to update Project information. |
| FR-PROJ-04 | Owners and Admins must be able to archive a Project. |
| FR-PROJ-05 | Owners and Admins must be able to restore an archived Project. |
| FR-PROJ-06 | Organization Members must be able to view the list of active Projects they are authorized to access. |

### 4.4 Issues

| ID | Requirement |
|---|---|
| FR-ISSUE-01 | Organization Members must be able to create an Issue in an active Project they are authorized to access. |
| FR-ISSUE-02 | Organization Members must be able to view Issues they are authorized to access. |
| FR-ISSUE-03 | Organization Members must be able to update information on Issues they are authorized to access. |
| FR-ISSUE-04 | Organization Members must be able to assign or change an Issue's Assignee according to domain rules. |
| FR-ISSUE-05 | Organization Members must be able to change an Issue's status according to the transition rules. |
| FR-ISSUE-06 | Organization Members must be able to change an Issue's priority. |
| FR-ISSUE-07 | Organization Members must be able to add and remove Labels on an Issue. |
| FR-ISSUE-08 | Owners and Admins must be able to archive and restore an Issue. |
| FR-ISSUE-09 | Organization Members must be able to view the list of Issues they are authorized to access. |
| FR-ISSUE-10 | Organization Members must be able to search and filter Issues. |
| FR-ISSUE-11 | The Issue list must support pagination. |

### 4.5 Collaboration

| ID | Requirement |
|---|---|
| FR-COL-01 | All roles must be able to add a Comment to an active Issue in an active Project. |
| FR-COL-02 | A User must be able to edit their own Comments. Owners and Admins may edit other Members' Comments. |
| FR-COL-03 | A User must be able to delete their own Comments. Owners and Admins may delete other Members' Comments. |
| FR-COL-04 | Organization Members must be able to view the Activity History they are authorized to access. |
| FR-COL-05 | The system must create in-app Notifications for events relevant to their recipients. |
| FR-COL-06 | The system must send email for Invitations and provide a resend mechanism if delivery fails. |
| FR-COL-07 | A User must be able to mark an in-app Notification as read. |

### 4.6 Authentication, Authorization, and Tenant Isolation

All features that require identity or restricted access must comply with authentication, authorization, and tenant isolation. Checks must consider the User, active Membership in the relevant Organization, permissions, and the resource's ownership by that Organization.

## 5. Business Rules

A business rule is a domain rule that must always be enforced, regardless of the endpoint, UI, or technology used.

### 5.1 Organization

| ID | Business rule |
|---|---|
| BR-ORG-01 | The User who creates an Organization automatically becomes its Owner. |
| BR-ORG-02 | The same User must not have more than one Membership in the same Organization. |
| BR-ORG-03 | Every Organization must have at least one Owner. |
| BR-ORG-04 | Projects and the Organization's operational data must remain within that Organization's tenant boundary. |

### 5.2 Membership and roles

| ID | Business rule |
|---|---|
| BR-MEM-01 | A role belongs to a Membership within an Organization, not globally to a User. |
| BR-MEM-02 | v1 roles are limited to `OWNER`, `ADMIN`, and `MEMBER`. |
| BR-MEM-03 | `GUEST` is outside v1 scope. |
| BR-MEM-04 | An Admin may manage other Admin and Member Memberships, but cannot change or revoke an Owner's Membership. |
| BR-MEM-05 | An Admin cannot promote their own Membership to Owner. |
| BR-MEM-06 | An Owner may manage other Memberships, including those of other Owners, provided the Organization retains at least one Owner. Revoking a Membership changes its `status` to `REMOVED`, sets `removed_at`, and retains the record. |
| BR-MEM-07 | No one may revoke or demote the last remaining Owner. |
| BR-MEM-08 | Administrative actions must follow the Permission Matrix in Section 6. |
| BR-MEM-09 | A User–Organization pair has only one Membership record. If a User whose Membership is `REMOVED` receives a new Invitation, the existing record is reactivated (`ACTIVE`), its `role` is updated according to the Invitation, `joined_at` is reset to the activation time, and `removed_at` is cleared. If the Membership is already `ACTIVE`, an Invitation must not create a duplicate Membership. |

If Alice is the only Owner and attempts to leave, have her Membership revoked, or have her role demoted, the operation must be rejected until another Owner exists.

### 5.3 Project

| ID | Business rule |
|---|---|
| BR-PROJ-01 | Every Project must belong to exactly one Organization. |
| BR-PROJ-02 | A User may access a Project only if they have an active Membership in the Organization that owns the Project. |
| BR-PROJ-03 | A Project cannot be moved to another Organization in v1. |
| BR-PROJ-04 | An archived Project cannot accept new Issues or be modified until it is restored. |
| BR-PROJ-05 | Archiving a Project does not automatically change the archive status of each Issue within it. |
| BR-PROJ-06 | Existing Issues, Comments, and Activities are retained when a Project is archived. |
| BR-PROJ-07 | An archived Project may be restored by an Owner or Admin. Restoring a Project does not automatically restore Issues that were individually archived earlier. |

### 5.4 Issue

| ID | Business rule |
|---|---|
| BR-ISSUE-01 | Every Issue must belong to exactly one Project. |
| BR-ISSUE-02 | An Issue's Assignee must be a Membership in the Organization that owns the Project. |
| BR-ISSUE-03 | An Issue in an archived Project cannot be created or modified until the Project is restored. |
| BR-ISSUE-04 | An archived Issue is excluded from the active Issue list by default. |
| BR-ISSUE-05 | An archived Issue retains its Comments and Activity History. |
| BR-ISSUE-06 | An Issue may be restored by an Owner or Admin if its parent Project is active. |
| BR-ISSUE-07 | Hard deletion of Projects and Issues is unavailable in v1. Archiving is the mechanism for removing a resource from normal activity. |

### 5.5 Issue lifecycle and status transitions

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

Lifecycle rules:

1. Any Member who has access to an Issue may change its status.
2. A transition not listed in the table must be rejected.
3. `DONE` and `CANCELLED` are not permanent statuses; both can be reopened through their specified transitions.
4. The same statuses apply to every Organization in v1. Custom workflows per Project are outside scope.
5. Every successful transition must generate an Activity recording the previous and new status.

### 5.6 Comment

| ID | Business rule |
|---|---|
| BR-COM-01 | Every Comment is associated with exactly one Issue. |
| BR-COM-02 | All roles may create and read Comments on Issues they are authorized to access. |
| BR-COM-03 | A User may edit and delete only their own Comments, except that Owners and Admins may manage other Members' Comments. |
| BR-COM-04 | A Comment cannot be added or edited if its associated Issue or Project is archived. |
| BR-COM-05 | Comment deletion uses soft delete; its original content is no longer shown to ordinary users after deletion. |
| BR-COM-06 | v1 does not retain every version of a Comment. The latest content, update time, and Activity trace of changes are retained. |
| BR-COM-07 | Editing and deleting a Comment generate an Activity. |

### 5.7 Activity

| ID | Business rule |
|---|---|
| BR-ACT-01 | Activity is an Organization-level event log. |
| BR-ACT-02 | Activity is append-only and cannot be edited or deleted through the application. |
| BR-ACT-03 | Every Activity must be associated with one Organization. |
| BR-ACT-04 | `actor_id` may be null for system-generated activities. |
| BR-ACT-05 | `issue_id` may be null for activities not associated with an Issue. |
| BR-ACT-06 | Metadata stores relevant change context, such as before-and-after values. |
| BR-ACT-07 | Activities are not created for read operations. |
| BR-ACT-08 | A business change and the Activity recording that change must be persisted atomically when they form a single operation. |

The following events generate an Activity in v1:

- An Organization is created or updated.
- A Member joins, has their Membership revoked (`REMOVED`), is reactivated, or has their role changed.
- An Invitation is created, accepted, revoked, or expired.
- A Project is created, updated, archived, or restored.
- An Issue is created, updated, archived, or restored.
- An Issue's Assignee, status, priority, or Labels change.
- A Comment is created, edited, or deleted.

Changes to an Issue's title and description are also recorded. Metadata only needs to record the changed fields and required context; it must not copy the entire description.

### 5.8 Notification

| ID | Business rule |
|---|---|
| BR-NOTIF-01 | Activity records an event; a Notification informs a relevant User about that event. |
| BR-NOTIF-02 | In-app Notifications are stored in the database and can be marked as read by their recipients. |
| BR-NOTIF-03 | Email is a v1 channel only for Invitations. Email Notifications for all activities are outside v1 scope. |
| BR-NOTIF-04 | Creating an Invitation generates an email to its destination address. |
| BR-NOTIF-05 | Accepting an Invitation generates a Notification for the inviter. |
| BR-NOTIF-06 | Assigning an Issue generates a Notification for the new Assignee. |
| BR-NOTIF-07 | A mention in a Comment generates a Notification for the mentioned User. |
| BR-NOTIF-08 | Adding a Comment and changing an Issue's status generate a Notification for the Issue's Assignee. |
| BR-NOTIF-09 | A User does not receive a Notification for their own activity. |
| BR-NOTIF-10 | A User who is no longer a Member of the relevant Organization does not receive Notifications for that Organization's activities. |
| BR-NOTIF-11 | Watchers/subscribers, push Notifications, and real-time delivery are outside v1 scope. |
| BR-NOTIF-12 | Notification processing failures must not roll back the primary business operation. |

### 5.9 Invitation lifecycle

Invitations follow the agreed decisions:

- An Owner may invite a User with the `ADMIN` or `MEMBER` role.
- An Admin may invite a User with the `MEMBER` role only.
- An Invitation cannot grant the `OWNER` role; adding or transferring ownership must use a separate mechanism, which is outside the v1 Invitation flow.

- Statuses: `PENDING`, `ACCEPTED`, `REVOKED`, and `EXPIRED`.
- A scheduled worker checks for expired Invitations every minute and changes `PENDING` Invitations to `EXPIRED`.
- `expires_at` remains the source of truth for validity. The acceptance process must reject an Invitation if `expires_at <= now()`, even if the worker has not updated its status yet.
- An expired Invitation cannot be accepted.
- A User who already has an `ACTIVE` Membership in the target Organization cannot be invited again. A User with a `REMOVED` Membership may be invited again, and the existing Membership is reactivated upon acceptance.
- At most one active (`PENDING`) Invitation may exist for a given Organization and normalized email combination.
- When an existing Invitation has passed its `expires_at`, the process that creates a new Invitation must handle the transition to `EXPIRED` within a transaction before creating the replacement Invitation.
- Concurrent attempts to create duplicate Invitations must be handled so they cannot produce two active Invitations.
- Email delivery failure does not make the Invitation fail or cancel its record. The Invitation remains `PENDING` until it is accepted, revoked, or expired.

## 6. Permission Matrix

A role determines a Membership's permissions within an Organization. The following is the agreed v1 Permission Matrix.

**v1 scope limitation:** An Organization cannot be permanently deleted. Organization deletion lifecycle has not been defined and is outside v1 scope.

| Action | Owner | Admin | Member |
|---|:---:|:---:|:---:|
| View Organization | ✓ | ✓ | ✓ |
| Update Organization | ✓ | ✓ | - |
| Invite Member | ✓ | ✓ | - |
| Invite Admin | ✓ | - | - |
| Revoke Invitation | ✓ | ✓ | - |
| Revoke Membership | ✓ | ✓* | - |
| Change Member Role | ✓ | ✓* | - |
| Create Project | ✓ | ✓ | ✓ |
| View Project | ✓ | ✓ | ✓ |
| Update Project | ✓ | ✓ | ✓ |
| Archive Project | ✓ | ✓ | - |
| Restore Project | ✓ | ✓ | - |
| Create Issue | ✓ | ✓ | ✓ |
| View Issue | ✓ | ✓ | ✓ |
| Update Issue | ✓ | ✓ | ✓ |
| Assign Issue | ✓ | ✓ | ✓ |
| Change Issue Status | ✓ | ✓ | ✓ |
| Change Issue Priority | ✓ | ✓ | ✓ |
| Manage Issue Labels | ✓ | ✓ | ✓ |
| Archive Issue | ✓ | ✓ | - |
| Restore Issue | ✓ | ✓ | - |
| Create Comment | ✓ | ✓ | ✓ |
| View Comment | ✓ | ✓ | ✓ |
| Edit Own Comment | ✓ | ✓ | ✓ |
| Edit Others' Comment | ✓ | ✓ | - |
| Delete Own Comment | ✓ | ✓ | ✓ |
| Delete Others' Comment | ✓ | ✓ | - |
| View Activity History | ✓ | ✓ | ✓ |
| View In-app Notification | ✓ | ✓ | ✓ |
| Mark Own Notification as Read | ✓ | ✓ | ✓ |

`*` Target restrictions:
- An Admin may manage other Admin and Member Memberships.
- An Admin cannot change or revoke an Owner's Membership.
- An Admin cannot promote their own Membership to Owner.
- An Owner may manage other Memberships, including those of other Owners, provided the minimum-one-Owner rule remains satisfied.
- No one may revoke the last Owner's Membership or demote the last Owner.

For Issues, a Member may update any Issue they are authorized to access, not only Issues they created. All actions remain subject to tenant isolation and the archive status of the relevant resource.

## 7. Non-Functional Requirements

Non-functional requirements (NFRs) define system quality and behavioral constraints, not the features the system provides.

### 7.1 Security

| ID | Requirement |
|---|---|
| NFR-SEC-01 | Passwords must never be stored in plaintext. |
| NFR-SEC-02 | A User must not be able to access another tenant's data without valid authorization. |
| NFR-SEC-03 | Authorization must be checked for every protected resource and action. |
| NFR-SEC-04 | Input must be validated before processing. |
| NFR-SEC-05 | Sensitive information must not be written to application logs. |

### 7.2 Consistency & Reliability

| ID | Requirement |
|---|---|
| NFR-REL-01 | Operations consisting of multiple data changes that must remain consistent must not leave partial state. Example: creating an Issue and the Activity recording its creation. |
| NFR-REL-02 | Retrying a request must not produce a duplicate operation for operations defined as idempotent. |
| NFR-REL-03 | Concurrent changes to a resource must be handled so conflicting updates do not silently overwrite one another. |
| NFR-REL-04 | Failure of an external service, such as email, must not roll back business changes that have already been successfully persisted. |
| NFR-REL-05 | Failed background jobs must be retryable within defined limits or manually handled without damaging data consistency. |

### 7.3 Performance

| ID | Requirement |
|---|---|
| NFR-PERF-01 | Issue list read operations must support pagination so the amount of returned data can be controlled. |
| NFR-PERF-02 | Numeric response-time targets will be established after a workload and measurement baseline are available. |

### 7.4 Maintainability

| ID | Requirement |
|---|---|
| NFR-MAIN-01 | The codebase must be modular and have clear separation of responsibilities. |
| NFR-MAIN-02 | Important parts of the system must be testable automatically. |
| NFR-MAIN-03 | The implementation must make use of type safety. |
| NFR-MAIN-04 | The API and important system decisions must be documented. |
| NFR-MAIN-05 | System behavior must be consistent and predictable. |

## 8. Non-Goals

The following features are outside the current project scope:

- Real-time collaborative editing.
- Video conferencing.
- Chat system.
- Calendar.
- Gantt chart.
- Billing and subscription.
- SSO/SAML.
- A dedicated search engine such as Elasticsearch.
- Mobile application.
- Microservices.

Non-goals limit v1 scope. This does not mean these features are useless; they are simply not priorities given this project's objectives and capacity.

## 9. Failure Scenarios

The system must define its behavior when failure conditions occur.

| Scenario | Required behavior |
|---|---|
| Invalid input | Reject the request; make no business-data changes. |
| Unauthenticated User | Deny access to protected resources. |
| Unauthorized User | Reject the action even if the User's identity is valid. |
| Resource from another Organization | Do not disclose or modify another tenant's data. |
| Resource not found | Fail the operation without changing data. |
| Duplicate active Invitation | Do not allow more than one active Invitation for the same Organization and email. |
| Concurrent Issue update | Detect the conflict; do not silently overwrite changes. |
| Database failure | Multi-record operations that must be atomic fail together; the system must not report partial success. |
| Notification processing failure | The primary business operation remains successful; the Notification can be handled separately. |
| Invitation email delivery failure | The Invitation remains `PENDING`; delivery failure information is stored and delivery can be retried. |
| Email retries exhausted | The Invitation continues to follow its lifecycle and `expires_at`; an Owner or Admin may manually request another delivery while the Invitation remains valid. |
| Invitation expiration worker failure | Validity is still determined by `expires_at`; acceptance rejects an expired Invitation even if the worker has not updated its status. |
| Background worker failure | Worker failure must not make business state inconsistent; failed work can be retried or manually handled. |

### 9.1 Invitation email retry behavior

1. An Invitation is created and stored with `PENDING` status.
2. Email delivery failure does not cancel the Invitation record.
3. Delivery failure information must be available for retries and diagnosis.
4. The system performs automatic retries with a bounded attempt count.
5. Once the retry limit is reached, an Owner or Admin may manually request another delivery while the Invitation is still valid.
6. Resending does not automatically extend `expires_at`.
7. An Invitation that is already `ACCEPTED`, `REVOKED`, or `EXPIRED` must not be resent as an active Invitation.

v1 technical parameters: transactional outbox, one initial attempt, and up to 3 automatic retries for transient failures with delays of 1, 5, and 15 minutes. Permanent failures are not retried. Retries stop when the Invitation is no longer `PENDING` or `expires_at <= now()`. Manual resend is available only while the Invitation remains valid and does not change `expires_at`.

### 9.2 Transactional consistency

Dependent business changes must either succeed together or fail together. For example, creating an Issue and the Activity recording its creation must not leave one record without the other.

### 9.3 Concurrent updates

If two Users update an Issue based on the same state and their changes conflict, the system must detect the conflict and must not silently allow the last update to overwrite the previous one. The technical mechanism and API response format are determined during the Design stage.

## 10. Use Case: Member Creates an Issue

### Actor

An authenticated Organization Member.

### Preconditions

- The User is authenticated.
- The User has an active Membership in the relevant Organization.
- The User has permission to create an Issue.
- The target Project exists and belongs to that Organization.

### Conceptual input

```json
{
  "title": "Fix payment webhook",
  "description": "Webhook occasionally creates duplicate payment",
  "projectId": "project_123",
  "priority": "HIGH"
}
```

### Expected outcome

- The Issue is created in the target Project.
- The Issue is associated with the correct Organization.
- The Activity History records the Issue creation event.
- The operation does not leave partial data if any required change fails.

### Failure outcomes

The operation must be rejected if the User is unauthenticated, lacks permission, cannot access the Project, provides invalid input, or persistence fails.

Request processing order, transaction boundaries, endpoints, and implementation mechanisms are outside the scope of this use case. Those details will be designed during the Design stage.

## 11. Acceptance Criteria & Remaining Open Items

Acceptance criteria translate requirements into verifiable conditions. The following criteria are the baseline for the Verify stage and may be extended as the design and implementation become more concrete.

### 11.1 Tenant isolation

- A Member of Organization A can access Organization A resources according to their permissions.
- A Member of Organization A cannot read, update, or delete an Organization B resource merely by knowing its identifier.
- Membership in one Organization does not grant permissions in another Organization.
- An Assignee from another Organization is rejected when assigned to an Issue.

### 11.2 Membership and Owner invariant

- The User who creates an Organization becomes its Owner.
- A User cannot have two Memberships in the same Organization.
- Re-inviting a User whose Membership is `REMOVED` reactivates the same record with the role from the new Invitation.
- An Admin cannot change or remove an Owner.
- An Admin cannot promote their own Membership to Owner.
- An operation that would revoke the last Owner's Membership or demote the last Owner is rejected.
- An Owner may manage another Owner only if at least one Owner remains after the operation.

### 11.3 Issue lifecycle

- Only the statuses and transitions listed in Section 5.5 are accepted.
- A disallowed transition is rejected without changing the Issue status.
- `DONE` can be reopened to `IN_PROGRESS`.
- `CANCELLED` can be reopened to `TODO`.
- Every successful transition generates exactly one Activity containing the previous and new status.

### 11.4 Archive behavior

- An archived Project cannot accept new Issues and cannot be modified.
- Issues in an archived Project cannot be modified until the Project is restored.
- Archiving a Project does not automatically archive its Issues.
- Restoring a Project does not automatically restore Issues that were individually archived.
- Comments and Activities are retained when a Project or Issue is archived.
- Hard deletion of Projects and Issues is unavailable in v1.

### 11.5 Comment and Activity

- A Member can edit and delete their own Comments.
- A Member cannot edit or delete another Member's Comments.
- Owners and Admins can manage other Members' Comments.
- A deleted Comment's original content is not shown to ordinary users.
- Editing and deleting a Comment generate an Activity.
- Activity cannot be edited or deleted through the application.
- Read operations do not generate Activity.

### 11.6 Notification and Invitation

- Issue status changes and Comment creation generate an in-app Notification for the Assignee, unless the actor is the Assignee.
- Assignment generates a Notification for the new Assignee, unless the actor is the recipient.
- A mention generates a Notification for the mentioned User.
- Accepting an Invitation generates a Notification for the inviter. If the invitee previously had a `REMOVED` Membership, that record is reactivated instead of creating a duplicate.
- Email delivery failure does not mark a persisted Invitation as failed or cancel it.
- An Invitation past `expires_at` cannot be accepted even if its status has not yet been updated by the worker.
- Resending an email does not automatically extend `expires_at`.

### 11.7 Remaining open items

The v1 technical decisions for Issue number allocation, API error contract, Invitation email retries, Activity metadata, and Issue search are established in the Stage 03 Design artifacts. Numeric response-time targets remain deferred until a workload and test-environment baseline is available; this does not block planning or implementation of the initial slices.

The v1 authentication/session design is established in the API Contract and PostgreSQL Database Design: opaque database-backed Bearer token, hash-only storage, 7-day expiry, refresh rotation, and logout revocation.

## 12. Expected Outcome of the Specify Stage

The Specify stage is considered to have produced sufficient outputs when:

- The problem statement and scope boundaries are understood.
- Actors and v1 roles are established.
- Functional requirements are traceable through IDs.
- Business rules and invariants are documented.
- The v1 Permission Matrix is confirmed.
- Business rules for the Issue lifecycle, archiving, Comments, Activity, Notifications, and Invitations are established.
- Non-functional requirements and failure expectations are documented.
- Acceptance criteria are available for important domain invariants and behaviors.
- Undecided technical details are recorded as open items and carried into the appropriate Design or API Contract documents.

This document is an input to **03. Design**. The next stage translates these requirements and rules into a domain model, database design, API contract, and software architecture.
