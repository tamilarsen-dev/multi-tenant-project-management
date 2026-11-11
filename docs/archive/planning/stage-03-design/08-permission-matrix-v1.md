**Project:** Multi-Tenant Project Management API  
**Workflow Stage:** 03 — Design  
**Document:** 8  
**Version:** 1.0  
**Status:** Approved

---

# Permission Matrix v1

**Authority:** Problem Definition and Requirements (Document 3)

## 1. Authorization Model

A role belongs to a Membership, not to a global User account. Every authorization decision considers the User identity, active Membership in the target Organization, role, action, resource, and resource state. A role alone is not sufficient.

v1 roles: `OWNER`, `ADMIN`, `MEMBER`. `GUEST` is outside the scope.

## 2. Permission Matrix

`✓` = allowed; `✗` = denied; `Conditional` = requires additional conditions described in the special rules section. All permissions apply only to resources in the Organization where the User has an active Membership.

| Action | Owner | Admin | Member |
|---|:---:|:---:|:---:|
| Read active Projects and Issues | ✓ | ✓ | ✓ |
| Create Project | ✓ | ✓ | ✓ |
| Update active Project | ✓ | ✓ | ✓ |
| Archive/Restore Project | ✓ | ✓ | ✗ |
| Create/Read Issue | ✓ | ✓ | ✓ |
| Update Issue details | ✓ | ✓ | ✓ |
| Change Issue status/priority | ✓ | ✓ | ✓ |
| Change Issue assignee | ✓ | ✓ | ✓ |
| Add/Remove Labels on Issue | ✓ | ✓ | ✓ |
| Archive/Restore Issue | ✓ | ✓ | ✗ |
| Create/Read Comment | ✓ | ✓ | ✓ |
| Edit/Delete own Comment | ✓ | ✓ | ✓ |
| Edit/Delete others' Comments | ✓ | ✓ | ✗ |
| Read Activity in Organization | ✓ | ✓ | ✓ |
| Read/Mark own Notification | ✓ | ✓ | ✓ |
| Invite role ADMIN | ✓ | ✗ | ✗ |
| Invite role MEMBER | ✓ | ✓ | ✗ |
| Invite role OWNER | ✗ | ✗ | ✗ |
| Revoke pending Invitation | ✓ | ✓ | ✗ |
| Revoke other ADMIN/MEMBER Membership | ✓ | ✓* | ✗ |
| Revoke/change role of another OWNER Membership | ✓* | ✗ | ✗ |
| Manage own Membership role | Conditional | ✗ | ✗ |
| Update Organization settings | ✓ | ✓ | ✗ |
| Permanently delete Organization | Not in v1 | ✗ | ✗ |

`*` Subject to the last-Owner rule and Membership-management restrictions. An Admin cannot manage their own Membership to promote themselves to Owner.

## 3. Special Rules

### Owner

- An Owner can manage other Memberships, including those of other Owners, as long as the Organization retains at least one Owner. Revocation changes the status to `REMOVED`; it does not delete the record.
- An Owner cannot revoke the Membership or demote the role of the last remaining Owner.
- An Owner can invite users with the ADMIN or MEMBER role. An Invitation cannot grant the OWNER role. A User who already has an ACTIVE Membership cannot be invited again; a REMOVED Membership can be invited and reactivated when the Invitation is accepted.

### Admin

- An Admin can manage other ADMIN and MEMBER Memberships, including changing their roles or revoking them. Revocation changes the status to `REMOVED`; it does not delete the record.
- An Admin cannot change or revoke an Owner Membership.
- An Admin cannot promote themselves to Owner or manage their own Membership for that purpose.
- An Admin can invite only users with the MEMBER role. The reactivation rule for a REMOVED Membership still applies when the Invitation is accepted.

### Member

- A Member can create Projects, create and manage Issues they can access, manage Labels on Issues, and create Comments.
- A Member cannot archive/restore Projects or Issues, manage Memberships, or send Invitations.

### Resource State and Invariants

- All roles are subject to Issue state transitions. Permission to change status does not authorize an invalid transition.
- An archived Project cannot be modified and cannot accept new Issues. Issues in an archived Project cannot be modified.
- An archived Issue cannot be modified until restored. Restoring an Issue requires its Project to be active.
- Comments cannot be created or modified while the Issue or Project is archived.
- Hard deletion of Projects/Issues and permanent deletion of Organizations are not available in v1.
- All operations require the correct tenant context. Resources belonging to another tenant must not be exposed merely because their IDs are known.

## 4. Authorization Decision Flow

```text
Authenticate User
      ↓
Resolve active Membership in target Organization
      ↓
Resolve target resource and its Organization
      ↓
Check role-based permission for action
      ↓
Check resource state and domain invariants
      ↓
Allow or deny
```

Checks are performed on the server. Hiding a button in the frontend is not a security control. For resources accessed by ID, the backend must ensure that the resource's Organization matches the Organization context being authorized.

## 5. Permissions and Business Invariants

Permission answers whether an actor may request an action. A business invariant answers whether the action is valid under the current domain conditions. For example, a Member has permission to change an Issue status, but `TODO → DONE` is still rejected because that transition is not allowed.

A final decision requires all of the following: active Membership, permission, tenant/resource ownership, and a valid state transition.

## 6. Decision Examples

### A Member Can Create a Project

Alice is an active Member in Beta. Alice requests `project:create` in Beta. Result: **ALLOW**, because every role can create a Project and Alice has an active Membership in the target Organization.

### A Member Cannot Archive a Project

Alice, as an active Member in Beta, requests `project:archive`. Result: **DENY**, because Project archive/restore is restricted to Owners/Admins.

### An Admin Cannot Invite an Admin

Bob is an active Admin in Acme and requests an Invitation with the ADMIN role. Result: **DENY**. An Admin may invite Members only.

### An Owner Cannot Remove the Last Owner

Alice is the only Owner of Acme and attempts to change her own Membership to `REMOVED`. Result: **DENY**, until another Owner exists.

## 7. Out of Scope and Open Items

- Permanent Organization deletion is not available in v1. Organization archiving is also not a v1 feature.
- An Invitation cannot grant the OWNER role. Adding or transferring an Owner must use a separate mechanism; its detailed permissions and flow are not defined in this document and must not be assumed.
- The API error contract for authorization and cross-tenant responses is defined in the API Contract.
- The detailed concurrency mechanism for the last-Owner invariant is defined in the Database Design.
