# Permissions Specification

## Multi-Tenant Project Management SaaS

| Document Information | Value |
|---|---|
| Status | Approved for V1 Planning |
| Version | 1.1 |
| Product Version | V1 |
| Last Updated | 2026-11-09 |
| Parent Documents | `docs/product/prd.md` v1.2; `docs/product/requirements.md` v1.1 |
| Domain Authority | `docs/design/domain.md` v1.1 |

> **Purpose:** Define which authenticated actors may perform which actions on which resources, under what conditions.
>
> **Boundary:** This document defines authorization policy. It does not define HTTP routes, SQL constraints, locking algorithms, or UI visibility. Those belong to API, Database, Architecture, and client specifications.
>
> **Core rule:** A role is not a global property of a User. It belongs to that User's Membership in a particular Organization.

---

## 1. Authorization Model

An authorization decision is not a simple role lookup. It depends on the actor, the target Organization, the Membership, the action, the resource, and the resource's current state.

### 1.1 Required decision inputs

| Input | Meaning |
|---|---|
| Actor | Authenticated User making the request |
| Session | Valid, non-revoked, non-expired Session |
| Organization | Tenant context in which the action is requested |
| Membership | Actor's Membership in that Organization |
| Membership status | Must be `ACTIVE` for ordinary Organization access |
| Role | `OWNER`, `ADMIN`, or `MEMBER` |
| Action | Requested operation |
| Resource | Target resource, resolved within the Organization |
| Resource state | Active/archived/deleted or other relevant lifecycle state |
| Domain invariants | Additional constraints that must remain true |

A User's role in Organization A grants no authority in Organization B.

### 1.2 Roles

| Role | Responsibility |
|---|---|
| `OWNER` | Highest Organization-level authority. Manages Organization membership and settings, subject to the last-Owner invariant. |
| `ADMIN` | Helps manage Organization settings, eligible memberships, invitations, and work resources. Cannot manage Owner memberships. |
| `MEMBER` | Participates in Project and Issue workflows and collaboration. Does not administer Organization membership or Project lifecycle. |

`GUEST` and custom roles are excluded from V1.

### 1.3 Authorization decision sequence

```text
1. Authenticate the actor
        ↓
2. Validate the current Session
        ↓
3. Resolve the target Organization
        ↓
4. Resolve the actor's Membership in that Organization
        ↓
5. Require Membership status = ACTIVE
        ↓
6. Resolve the target resource within the same tenant
        ↓
7. Check role/action permission
        ↓
8. Check resource lifecycle and domain invariants
        ↓
9. Allow or deny
```

Every step is enforced server-side. Hiding a button in a client is not authorization.

### 1.4 Default-deny policy

- An action is denied unless explicitly allowed by this specification.
- A missing Membership, a `REMOVED` Membership, or a resource from another Organization results in denial.
- A client-provided role, Organization ID, or resource relationship is never trusted without server-side verification.
- Authorization must be checked for every request, not only when a resource is first loaded.
- Background workers use narrowly scoped system authority and must not impersonate an ordinary User or bypass tenant ownership checks.

---

## 2. Permission Matrix

Legend:
- **Allow**: permitted when authentication, active Membership, tenant scope, and resource-state conditions are satisfied.
- **Deny**: not permitted.
- **Conditional**: permitted only under the explicit rules in the relevant section.
- **N/A**: feature is not available in V1.

### 2.1 Organization

| Action | OWNER | ADMIN | MEMBER |
|---|---:|---:|---:|
| Read Organization details | Allow | Allow | Allow |
| Update Organization details | Allow | Allow | Deny |
| Archive Organization | N/A | N/A | N/A |
| Permanently delete Organization | N/A | N/A | N/A |
| List own active Organizations | Allow | Allow | Allow |

Organization read access is available to all active members. Updating Organization details is restricted to OWNER and ADMIN. Organization archive and deletion are not V1 capabilities.

### 2.2 Membership

| Action | OWNER | ADMIN | MEMBER |
|---|---:|---:|---:|
| List Organization members | Allow | Allow | Allow |
| Read member details | Allow | Allow | Allow |
| Change another MEMBER's role | Allow | Allow* | Deny |
| Change another ADMIN's role | Allow | Allow* | Deny |
| Promote another member to OWNER | Allow* | Deny | Deny |
| Change another OWNER's role | Allow* | Deny | Deny |
| Remove another MEMBER | Allow | Allow* | Deny |
| Remove another ADMIN | Allow | Allow* | Deny |
| Remove another OWNER | Allow* | Deny | Deny |
| Change own role | Conditional | Deny | Deny |
| Remove own Membership / leave Organization | Conditional | Conditional | Conditional |

`*` Subject to target-role restrictions and the invariant that at least one ACTIVE OWNER must remain.

Detailed rules:
- OWNER may manage other Memberships, including other OWNER Memberships, provided the Organization retains at least one ACTIVE OWNER after the operation.
- OWNER may promote an existing ACTIVE ADMIN or MEMBER to OWNER. This is the supported V1 path for establishing an additional Owner; Invitations cannot grant OWNER.
- OWNER may demote or remove another OWNER only if another ACTIVE OWNER remains after the operation.
- ADMIN may manage other ADMIN and MEMBER Memberships, including role changes and removal. ADMIN cannot modify an OWNER Membership.
- ADMIN cannot change their own role through Membership administration.
- MEMBER cannot administer other Memberships.
- No actor may use a role-change or removal operation to leave the Organization without an ACTIVE OWNER.
- Self-removal is treated as leaving the Organization, not as permission to administer another Membership. OWNER may leave only if another ACTIVE OWNER already exists. ADMIN and MEMBER may leave their own Organization Membership.
- A removed Membership remains stored with status `REMOVED`; it is not physically deleted.
- Membership removal and automatic unassignment of the removed member's Issues are atomic.
- A removed User loses access to Organization resources immediately after the removal operation commits. Their global account and Sessions are not revoked by this operation.

### 2.3 Invitations

| Action | OWNER | ADMIN | MEMBER |
|---|---:|---:|---:|
| List Organization invitations | Allow | Allow | Deny |
| Read invitation details | Allow | Allow | Deny |
| Create invitation for ADMIN | Allow | Deny | Deny |
| Create invitation for MEMBER | Allow | Allow | Deny |
| Create invitation for OWNER | Deny | Deny | Deny |
| Resend pending invitation | Allow | Allow | Deny |
| Revoke pending invitation | Allow | Allow | Deny |
| Accept invitation addressed to self | Conditional | Conditional | Conditional |

Invitation acceptance is not an Organization-role permission. It requires:
- A valid, unexpired, PENDING Invitation token.
- An authenticated User.
- A normalized email match between the authenticated User and invitation recipient.
- No existing ACTIVE Membership in the target Organization.
- Successful creation or reactivation of the Membership.

The invitee may be unaffiliated with the Organization before acceptance. Acceptance establishes access only after the transaction succeeds.

Additional rules:
- OWNER may invite ADMIN or MEMBER.
- ADMIN may invite MEMBER only.
- MEMBER cannot create, resend, or revoke invitations.
- Invitation cannot assign OWNER.
- Resend is allowed only while the Invitation is still valid and PENDING. Resend rotates the token and invalidates the old token; it does not extend the expiry.
- A pending invitation to an email that already has an ACTIVE Membership is not allowed.
- A REMOVED Membership may be reinvited and reactivated.
- Revoked, expired, and accepted invitations cannot be accepted again.

### 2.4 Projects

| Action | OWNER | ADMIN | MEMBER |
|---|---:|---:|---:|
| List Projects | Allow | Allow | Allow |
| Read active Project | Allow | Allow | Allow |
| Read archived Project/history | Allow | Allow | Allow |
| Create Project | Allow | Allow | Allow |
| Update active Project | Allow | Allow | Deny |
| Archive active Project | Allow | Allow | Deny |
| Restore archived Project | Allow | Allow | Deny |
| Hard-delete Project | Deny | Deny | Deny |

Rules:
- Project operations require active Membership in the Project's Organization.
- Project cannot be moved to another Organization.
- Project name is not an authorization key.
- Archived Projects remain readable for historical context.
- An archived Project cannot be updated or accept new Issues.
- Project archive does not automatically archive child Issues.
- Issues within an archived Project cannot be mutated.
- Project restore does not automatically restore individually archived Issues.

### 2.5 Issues

| Action | OWNER | ADMIN | MEMBER |
|---|---:|---:|---:|
| List Issues in accessible Project | Allow | Allow | Allow |
| Read active Issue | Allow | Allow | Allow |
| Read archived Issue/history | Allow | Allow | Allow |
| Create Issue | Allow | Allow | Allow |
| Update Issue details | Allow | Allow | Allow |
| Change Issue status | Allow* | Allow* | Allow* |
| Change Issue priority | Allow | Allow | Allow |
| Assign/reassign/unassign Issue | Allow | Allow | Allow |
| Create Organization Label | Allow | Allow | Allow |
| Rename Organization Label | Allow | Allow | Allow |
| Archive/restore Organization Label | Allow | Allow | Allow |
| Add Label to Issue | Allow | Allow | Allow |
| Remove Label from Issue | Allow | Allow | Allow |
| Archive Issue | Allow | Allow | Allow |
| Restore Issue | Allow | Allow | Allow |
| Hard-delete Issue | Deny | Deny | Deny |

`*` Status changes must follow the fixed V1 transition matrix. Permission to request a status change does not make an invalid transition valid.

Additional rules:
- All Issue operations require active Membership and access to the parent Project.
- An Issue must belong to the same Organization as its Project.
- Assignee must be an ACTIVE Membership in that Organization.
- A User cannot assign an Issue to a Membership in another Organization.
- Removing a Membership clears its Issue assignments atomically.
- An archived Issue cannot be updated, assigned, relabeled, or otherwise mutated until restored.
- Label catalogue actions require active Membership in the owning Organization. Archived Labels cannot be newly attached to Issues; existing associations remain visible as historical context.
- An Issue whose parent Project is archived cannot be mutated, even if the Issue itself is not archived.
- Restoring an Issue requires its parent Project to be active.
- Archiving or restoring an Issue is allowed to all active roles, consistent with the approved Domain Map and Requirements.
- Hard deletion is not available in V1.

### 2.6 Comments

| Action | OWNER | ADMIN | MEMBER |
|---|---:|---:|---:|
| Read Comments on accessible Issue | Allow | Allow | Allow |
| Create Comment | Allow | Allow | Allow |
| Edit own Comment | Allow | Allow | Allow |
| Delete own Comment | Allow | Allow | Allow |
| Edit another member's Comment | Allow | Allow | Deny |
| Delete another member's Comment | Allow | Allow | Deny |
| Permanently purge Comment | Deny | Deny | Deny |

Rules:
- Comment access follows access to its parent Issue and Organization.
- A Comment author is identified through their Membership in the Organization.
- OWNER and ADMIN may edit/delete Comments created by other members.
- A MEMBER may edit/delete only their own Comments.
- Comment creation and update are blocked if the Issue or parent Project is archived.
- Deletion is soft deletion/tombstone. Normal retrieval displays a deletion placeholder, not the original body.
- This matrix does not define permanent retention or erasure. V1 has no automatic permanent-purge capability.

### 2.7 Activity

| Action | OWNER | ADMIN | MEMBER |
|---|---:|---:|---:|
| Read Organization Activity | Allow | Allow | Allow |
| Read Issue-filtered Activity | Allow | Allow | Allow |
| Create Activity directly | Deny | Deny | Deny |
| Update Activity | Deny | Deny | Deny |
| Delete Activity | Deny | Deny | Deny |

Activity is generated by trusted application workflows as part of the corresponding business transaction. Ordinary Users cannot create arbitrary Activity records or rewrite historical records.

Issue-filtered Activity is a filtered view of the Organization-level Activity stream, not a separate authorization model.

### 2.8 Notifications

| Action | OWNER | ADMIN | MEMBER |
|---|---:|---:|---:|
| List own Notifications | Allow | Allow | Allow |
| Read own Notification | Allow | Allow | Allow |
| Mark own Notification read/unread | Allow | Allow | Allow |
| Read another User's Notification | Deny | Deny | Deny |
| Modify another User's Notification | Deny | Deny | Deny |
| Create arbitrary Notification | Deny | Deny | Deny |

Rules:
- Notification is addressed to one User.
- Notification access is recipient-scoped, not role-scoped.
- A Notification does not grant access to the Organization or resource it references.
- A removed User may read a final membership-removal Notification addressed to them. This exception does not restore Organization Membership or access to other Organization resources.
- System-generated Notification creation follows the event-recipient policy in the Domain Map.

---

## 3. Resource-State Constraints

Role permission is necessary but not sufficient. The resource's current state may still make an operation invalid.

| Resource state | Operation | Result |
|---|---|---|
| Project active | Create Issue | Allowed for all active roles |
| Project archived | Create Issue | Denied |
| Project archived | Update child Issue | Denied |
| Project archived | Archive/restore child Issue | Denied while parent Project remains archived |
| Project archived | Read Project/Issue history | Allowed for active Organization members |
| Issue active, Project active | Update Issue | Allowed for all active roles |
| Issue archived | Update Issue | Denied |
| Issue archived | Restore Issue | Allowed for all active roles if parent Project is active |
| Issue active | Archive Issue | Allowed for all active roles if parent Project is active |
| Issue or Project archived | Create Comment | Denied |
| Issue or Project archived | Update Comment | Denied |
| Issue or Project archived | Read historical Comment | Allowed subject to normal tenant/resource access |
| Membership REMOVED | Access Organization resource | Denied |
| Membership REMOVED | Read own final removal Notification | Allowed, if such Notification exists |

### 3.1 Issue status transition constraint

All three roles may request a status change, but only these transitions are valid:

| From | To |
|---|---|
| `TODO` | `IN_PROGRESS`, `CANCELLED` |
| `IN_PROGRESS` | `IN_REVIEW`, `CANCELLED` |
| `IN_REVIEW` | `IN_PROGRESS`, `DONE`, `CANCELLED` |
| `DONE` | `IN_PROGRESS` |
| `CANCELLED` | `TODO` |

An invalid transition is a domain validation failure, not an authorization failure. API error mapping is specified separately.

---

## 4. Special Invariants and Edge Cases

### 4.1 Last active Owner

The Organization must always have at least one ACTIVE OWNER.

Examples:
- If Alice is the only Owner, she cannot demote or remove herself.
- If Alice and Bob are Owners, Alice may leave or demote herself because Bob remains an active Owner.
- An Owner may promote an existing active member to Owner before leaving.
- Concurrent removal/demotion operations must not both pass based on the same stale count and leave zero active Owners.
- The exact transaction and locking protocol belongs to Database Specification.

### 4.2 Membership removal

Removal is a domain transition, not physical deletion:
1. Verify the actor may remove the target Membership.
2. Verify the target is not the last active Owner.
3. Change Membership status to `REMOVED`.
4. Set removal timestamp.
5. Clear Issues assigned to that Membership.
6. Record required Activity.
7. Generate the appropriate final Notification if applicable.
8. Commit the operation atomically.

A removed User's account and Sessions remain valid globally. Their Organization access is denied because the Membership is no longer ACTIVE.

### 4.3 Cross-tenant access

Every resource must be resolved within its actual Organization context. A client cannot combine an Organization ID from one tenant with a Project, Issue, Comment, or Membership from another tenant.

The authorization layer must not:
- Trust a resource's Organization ID supplied by the client.
- Trust a parent-child relationship supplied by the client without checking it.
- Use a global resource lookup and forget to verify tenant ownership.
- Return protected resource fields before authorization completes.

Exact HTTP response behavior for missing versus cross-tenant resources is defined by the API Specification.

### 4.4 System and background operations

Background workers may perform only the operations required by their defined responsibility, such as expiring invitations or processing invitation delivery. They must:
- Operate on explicitly identified records.
- Preserve tenant relationships.
- Preserve business invariants.
- Record system Activity where the Domain Map requires it.
- Be idempotent or safely retryable where processing can repeat.
- Never gain broad implicit authority merely because they run inside the application.

---

## 5. Permission Is Not the Same as Domain Validity

Three independent questions must be answered:

1. **Authentication:** Who is making the request, and is their Session valid?
2. **Authorization:** Does their active Membership and role permit this action on this resource?
3. **Domain validity:** Is the requested state transition valid under current business rules?

Example: a MEMBER may change an Issue's status. If the Issue is `TODO`, however, changing it directly to `DONE` is still invalid because the V1 transition matrix does not allow that transition.

Similarly, an OWNER may remove a Membership, but cannot remove the last active OWNER.

Do not collapse these checks into one generic `isAdmin` condition.

---

## 6. Authorization Test Requirements

Tests must verify both positive and negative cases. A test that only confirms an Owner can do everything proves very little.

### 6.1 Role matrix tests

For every protected action:
- Verify allowed actions for each role.
- Verify denied actions for each role.
- Verify behavior when the actor has no Membership.
- Verify behavior when Membership status is `REMOVED`.
- Verify behavior when the actor has a role in a different Organization but none in the target Organization.

### 6.2 Tenant isolation tests

At minimum:
- User from Organization A cannot read Organization B's Project by guessing its ID.
- User from Organization A cannot read or mutate Organization B's Issue.
- User cannot attach a Comment to an Issue in another Organization.
- User cannot assign an Issue to a Membership from another Organization.
- User cannot attach a Label from another Organization to an Issue.
- List, count, search, and pagination queries enforce the same tenant scope.
- Error responses do not disclose protected cross-tenant resource details.

### 6.3 Lifecycle and invariant tests

At minimum:
- MEMBER cannot archive/restore a Project.
- MEMBER can archive/restore an eligible Issue.
- No role can mutate an Issue whose Project is archived.
- No role can restore an Issue while its Project is archived.
- Comments cannot be created/updated when the Issue or Project is archived.
- MEMBER cannot edit/delete another member's Comment.
- ADMIN cannot modify an OWNER Membership.
- ADMIN cannot invite ADMIN or OWNER.
- OWNER cannot remove/demote the last active Owner.
- Concurrent Owner removal/demotion attempts preserve at least one active Owner.
- Membership removal and Issue unassignment are atomic.
- A removed User cannot access Organization resources but can read their own final removal Notification if generated.
- A User cannot read or modify another User's Notification.

### 6.4 Test organization

Prefer table-driven tests for role/action combinations. Keep domain-state tests separate from role tests so failures identify whether the problem is authorization or domain validity.

---

## 7. Decisions and Boundaries

### 7.1 Decisions fixed by this specification

- Roles are `OWNER`, `ADMIN`, and `MEMBER`; no GUEST role in V1.
- Organization read is available to all active roles.
- Organization update is OWNER/ADMIN.
- All active roles can create/read Projects; OWNER/ADMIN update/archive/restore Projects.
- All active roles can create/read/update Issues, change priority/status/assignee, manage Labels, and archive/restore Issues, subject to resource-state rules.
- OWNER/ADMIN can manage other members' Comments; members can manage only their own.
- OWNER may invite ADMIN/MEMBER; ADMIN may invite MEMBER; MEMBER cannot invite.
- OWNER/ADMIN can list, inspect, resend, and revoke pending invitations.
- OWNER can manage other OWNER Memberships subject to the last-Owner invariant.
- ADMIN can manage ADMIN/MEMBER Memberships but cannot manage OWNER Memberships or themselves.
- OWNER may promote an existing active member to OWNER; invitation cannot assign OWNER.
- Notification access is recipient-scoped.
- Activity is read-only to ordinary Users.

### 7.2 Explicitly outside this document

- HTTP status codes and authorization error response bodies.
- Whether cross-tenant resource lookup returns 403 or 404.
- Database row-level security, composite foreign keys, indexes, and locking.
- Exact transaction isolation and retry strategy.
- Worker service credentials and deployment topology.
- UI button visibility and frontend route guards.

These details must implement this policy, not redefine it.

---

## 8. Relationship to Other Documents

| Document | Authority |
|---|---|
| `docs/product/prd.md` | Product goals, users, scope, non-goals |
| `docs/product/requirements.md` | Functional and non-functional requirements, acceptance criteria |
| `docs/design/domain.md` | Entities, relationships, lifecycle, business invariants |
| `docs/design/permissions.md` | Role/action authorization policy |
| `docs/design/database.md` | Persistence constraints, transactions, locking, indexes |
| `docs/design/architecture.md` | Application boundaries and system components |
| API Specification | HTTP endpoints, request/response, errors, pagination |
| ADRs | Rationale and trade-offs for consequential decisions |

If a permission conflicts with a domain invariant, the invariant still applies. If a technical document cannot enforce this policy as written, the conflict must be resolved explicitly rather than silently weakening authorization.

---

## 9. Completion Checklist

- [x] V1 roles and authorization model defined.
- [x] Organization-level permissions defined.
- [x] Membership administration and last-Owner rules defined.
- [x] Invitation permissions and acceptance conditions defined.
- [x] Project permissions defined.
- [x] Issue permissions defined.
- [x] Comment permissions defined.
- [x] Activity and Notification permissions defined.
- [x] Resource-state constraints defined.
- [x] Tenant isolation requirements defined.
- [x] Authorization test requirements defined.
- [ ] Database enforcement and concurrency strategy specified.
- [ ] API error contract specified.
- [ ] Authorization behavior implemented and verified by tests.

**Document Status: Approved for V1 Planning.**

**Implementation Status:** This document defines intended V1 authorization behavior. It does not claim that all permissions or workflows have been implemented or verified.
