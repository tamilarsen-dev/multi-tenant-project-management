# API Contract

| Field | Value |
|---|---|
| Status | Active |
| Owner | T. Tamil Arsen |
| Last updated | 2026-11-11 |
| API version | v1 (`/api/v1`) |

This document defines every V1 endpoint: path, request, response, authorization, rules, and endpoint-specific errors. Rules that apply to all endpoints (envelopes, pagination, status semantics, validation, field limits) are in [API Conventions](conventions.md) and are not repeated here. Error codes are defined in [Errors](errors.md). The OpenAPI document in `apps/api/docs/openapi/` describes the **implemented** subset of this contract and must never describe an endpoint that does not exist yet.

Ownership: product behavior comes from [Requirements](../../product/requirements.md), domain rules from the [Domain Model](../domain-model.md), role rules from [Permissions](../permissions.md), and persistence mechanics from [Database](../database.md). If this contract disagrees with one of them, the owning document wins and this contract is corrected.

---

## 1. How to read an endpoint

Each endpoint lists:

- **Auth**: `public` or `bearer`. Bearer endpoints require a valid Session.
- **Roles**: which Membership roles may call it. Organization-scoped endpoints always require an ACTIVE Membership in the Organization in the path.
- **Rules**: behavior the implementation must guarantee, including transaction scope.
- **Response**: status and body.
- **Errors**: codes specific to this endpoint, in addition to the common errors in §1.1.

### 1.1 Common errors

These apply wherever their condition can occur and are not repeated per endpoint:

| Condition | Error |
|---|---|
| Endpoint accepts params, query, or body | `400 VALIDATION_ERROR`, `400 INVALID_JSON`, `413 PAYLOAD_TOO_LARGE`, `415 UNSUPPORTED_MEDIA_TYPE` |
| Auth is `bearer` | `401 MISSING_AUTHENTICATION`, `401 INVALID_SESSION` |
| Path contains `{organizationId}` | `404 ORGANIZATION_NOT_FOUND` (also when the actor has no ACTIVE Membership) |
| Path contains `{projectId}` | `404 PROJECT_NOT_FOUND` |
| Path contains `{issueId}` | `404 ISSUE_NOT_FOUND` |
| Any endpoint | `429 RATE_LIMIT_EXCEEDED`, `500 INTERNAL_SERVER_ERROR` |

### 1.2 Shared rules for mutations

- Every mutation that the [Domain Model event catalog](../domain-model.md#62-activity) lists writes its Activity in the **same transaction** as the change. Notifications listed in [Domain Model §6.3](../domain-model.md#63-notification) are written in that transaction too.
- A no-op (requested state equals current state) returns the current representation, does not increment `version`, and writes no Activity or Notification.
- For archive/restore endpoints, the "already in the requested state" check runs **before** the version check, so a retry with a stale `version` succeeds as a no-op.
- `version` in a request body is the version the client last read (see [Conventions §9](conventions.md#9-patch-and-optimistic-concurrency)). For `DELETE` requests, which carry no body, `version` is a required query parameter.

---

## 2. Resource representations

Each resource has exactly one representation, used by every endpoint that returns it. Single-resource responses wrap it in a named key (`{ "data": { "project": { … } } }`); collections return an array in `data`.

### 2.1 User

```json
{ "id": "uuid", "email": "alice@example.com", "displayName": "Alice", "createdAt": "2026-11-11T10:00:00.000Z" }
```

### 2.2 Session

Returned only by Register, Login, and Refresh.

```json
{
  "id": "uuid",
  "accessToken": "opaque-token",
  "tokenType": "Bearer",
  "expiresAt": "2026-11-18T10:00:00.000Z",
  "absoluteExpiresAt": "2026-12-11T10:00:00.000Z"
}
```

### 2.3 Organization

```json
{ "id": "uuid", "name": "Acme Engineering", "version": 1, "createdAt": "…", "updatedAt": "…" }
```

### 2.4 Membership

```json
{
  "id": "uuid",
  "organizationId": "uuid",
  "user": { "id": "uuid", "email": "alice@example.com", "displayName": "Alice" },
  "role": "OWNER",
  "status": "ACTIVE",
  "version": 1,
  "joinedAt": "…",
  "removedAt": null,
  "createdAt": "…",
  "updatedAt": "…"
}
```

### 2.5 Invitation

```json
{
  "id": "uuid",
  "organizationId": "uuid",
  "email": "bob@example.com",
  "role": "MEMBER",
  "status": "PENDING",
  "invitedBy": { "id": "uuid", "displayName": "Alice" },
  "expiresAt": "…",
  "acceptedAt": null,
  "revokedAt": null,
  "createdAt": "…",
  "updatedAt": "…"
}
```

`status` is the **effective** status: a row stored as `PENDING` whose `expiresAt` has passed is presented as `EXPIRED`, without writing. Token and token hash are never returned.

### 2.6 Project

```json
{ "id": "uuid", "organizationId": "uuid", "name": "Backend Platform", "description": null, "archivedAt": null, "version": 1, "createdAt": "…", "updatedAt": "…" }
```

### 2.7 Issue

```json
{
  "id": "uuid",
  "organizationId": "uuid",
  "projectId": "uuid",
  "number": 42,
  "title": "Implement authentication",
  "description": null,
  "status": "TODO",
  "priority": "MEDIUM",
  "assigneeMembershipId": null,
  "archivedAt": null,
  "version": 1,
  "createdAt": "…",
  "updatedAt": "…"
}
```

Labels are read through §10.

### 2.8 Label

```json
{ "id": "uuid", "organizationId": "uuid", "name": "Backend", "archivedAt": null, "createdAt": "…", "updatedAt": "…" }
```

`normalizedName` is internal and never returned.

### 2.9 Comment

```json
{
  "id": "uuid",
  "issueId": "uuid",
  "author": { "membershipId": "uuid", "userId": "uuid", "displayName": "Alice" },
  "body": "Ready for review.",
  "deletedAt": null,
  "version": 1,
  "createdAt": "…",
  "updatedAt": "…"
}
```

A deleted Comment has `body: null` and a non-null `deletedAt`; clients render a placeholder.

### 2.10 Activity

```json
{
  "id": "uuid",
  "organizationId": "uuid",
  "eventType": "ISSUE_STATUS_CHANGED",
  "actor": { "id": "uuid", "displayName": "Alice" },
  "issueId": "uuid",
  "metadata": { "schemaVersion": 1, "entityType": "ISSUE", "entityId": "uuid", "changes": { "status": { "from": "TODO", "to": "IN_PROGRESS" } } },
  "createdAt": "…"
}
```

`actor` is `null` for system events; `issueId` is `null` for events without Issue context.

### 2.11 Notification

```json
{
  "id": "uuid",
  "organization": { "id": "uuid", "name": "Acme Engineering" },
  "type": "ISSUE_ASSIGNED",
  "content": {
    "title": "Issue assigned to you",
    "message": "Alice assigned you to Implement authentication.",
    "resource": { "type": "ISSUE", "id": "uuid" }
  },
  "activityId": "uuid",
  "readAt": null,
  "createdAt": "…"
}
```

`content` is a snapshot taken at creation; it does not change when names change later and never contains secrets or Comment bodies.

---

## 3. Authentication

### 3.1 Register

`POST /api/v1/auth/register` · Auth: public

```json
{ "email": "alice@example.com", "password": "correct horse battery", "displayName": "Alice" }
```

Rules:

- Email is trimmed and lowercased; it must be unique after normalization.
- Password is hashed with Argon2id; it is never trimmed or normalized.
- User and the first Session are created in one transaction. No Organization or Membership is created.
- The Session starts a new refresh chain: `absoluteExpiresAt = now + 30 days`, `expiresAt = now + 7 days`.

Response: `201 Created` · `{ "data": { "user": User, "session": Session } }`

Errors: `409 EMAIL_ALREADY_EXISTS`

### 3.2 Login

`POST /api/v1/auth/login` · Auth: public

```json
{ "email": "alice@example.com", "password": "correct horse battery" }
```

Rules:

- Unknown email and wrong password return the same response. For an unknown email the server still runs an Argon2id verification against a fixed dummy hash, so response time does not reveal whether the account exists.
- Each successful login creates a new Session and a new refresh chain. Other Sessions stay valid.

Response: `200 OK` · `{ "data": { "user": User, "session": Session } }`

Errors: `401 INVALID_CREDENTIALS`

### 3.3 Refresh Session

`POST /api/v1/auth/refresh` · Auth: bearer · no body

Rules:

- In one transaction: conditionally revoke the presented Session (only if not revoked and not expired), then create a new Session with a new token, `absoluteExpiresAt` copied from the old Session, and `expiresAt = min(now + 7 days, absoluteExpiresAt)` ([Database §5.2](../database.md#52-sessions)).
- Of concurrent refreshes with the same token, exactly one succeeds; the others get `401 INVALID_SESSION`.
- Reusing a rotated token returns `401 INVALID_SESSION` and is logged as a security event. It does not revoke the replacement Session.
- After `absoluteExpiresAt` the user must log in again.

Response: `200 OK` · `{ "data": { "user": User, "session": Session } }`

### 3.4 Logout

`POST /api/v1/auth/logout` · Auth: bearer · no body

Rules: revokes only the Session that made the request. Other Sessions stay valid.

Response: `204 No Content`

### 3.5 Current User

`GET /api/v1/auth/me` · Auth: bearer

Response: `200 OK` · `{ "data": { "user": User } }`

---

## 4. Organizations

### 4.1 Create Organization

`POST /api/v1/organizations` · Auth: bearer · Roles: any authenticated User

```json
{ "name": "Acme Engineering" }
```

Rules:

- `name` is trimmed; names are not unique.
- In one transaction: create the Organization, an `ACTIVE` `OWNER` Membership for the caller, and Activity `ORGANIZATION_CREATED`.

Response: `201 Created` · `Location: /api/v1/organizations/{id}` · `{ "data": { "organization": Organization, "membership": Membership } }`

### 4.2 List my Organizations

`GET /api/v1/organizations` · Auth: bearer

Query: `limit`, `cursor`.

Rules: returns only Organizations where the caller has an `ACTIVE` Membership. Order `created_at DESC, id DESC` (of the Organization).

Response: `200 OK` · `{ "data": [ { "organization": Organization, "membership": Membership } ], "pagination": … }`

### 4.3 Get Organization

`GET /api/v1/organizations/{organizationId}` · Auth: bearer · Roles: all

Response: `200 OK` · `{ "data": { "organization": Organization, "membership": Membership } }` where `membership` is the caller's.

### 4.4 Update Organization

`PATCH /api/v1/organizations/{organizationId}` · Auth: bearer · Roles: OWNER, ADMIN

```json
{ "name": "Acme Technologies", "version": 3 }
```

Rules: conditional update on `version`; on real change, Activity `ORGANIZATION_UPDATED` in the same transaction.

Response: `200 OK` · `{ "data": { "organization": Organization } }`

Errors: `403 FORBIDDEN`, `409 VERSION_CONFLICT`

---

## 5. Memberships

### 5.1 List Memberships

`GET /api/v1/organizations/{organizationId}/memberships` · Auth: bearer · Roles: all

Query: `limit`, `cursor`, `status` (`ACTIVE` default, or `REMOVED`).

Rules: any role may list `ACTIVE`; only OWNER and ADMIN may list `REMOVED`. Order `joined_at DESC, id DESC`.

Response: `200 OK` · collection of Membership

Errors: `403 FORBIDDEN` (MEMBER requesting `REMOVED`)

### 5.2 Get Membership

`GET /api/v1/organizations/{organizationId}/memberships/{membershipId}` · Auth: bearer · Roles: all

Rules: OWNER and ADMIN may read `ACTIVE` and `REMOVED` Memberships; MEMBER may read `ACTIVE` only. A REMOVED Membership never grants its own former holder access.

Response: `200 OK` · `{ "data": { "membership": Membership } }`

Errors: `404 MEMBERSHIP_NOT_FOUND`

### 5.3 Change role

`PATCH /api/v1/organizations/{organizationId}/memberships/{membershipId}/role` · Auth: bearer · Roles: OWNER, ADMIN (target restrictions below)

```json
{ "role": "ADMIN", "version": 1 }
```

Rules:

- OWNER may change any role, including other Owners, as long as one `ACTIVE` OWNER remains. OWNER may promote a member to OWNER.
- ADMIN may change ADMIN and MEMBER roles of others; ADMIN cannot touch an OWNER Membership, promote anyone to OWNER, or change their own role.
- Target must be `ACTIVE`.
- Locks the Organization row before reading the Owner set ([Database §7.3](../database.md#73-last-active-owner)); Activity `MEMBERSHIP_ROLE_CHANGED` in the same transaction.

Response: `200 OK` · `{ "data": { "membership": Membership } }`

Errors: `403 FORBIDDEN`, `404 MEMBERSHIP_NOT_FOUND`, `409 LAST_OWNER_REQUIRED`, `409 VERSION_CONFLICT`

### 5.4 Remove Membership (or leave)

`DELETE /api/v1/organizations/{organizationId}/memberships/{membershipId}?version=1` · Auth: bearer

Rules:

- OWNER may remove anyone, including other Owners and themselves, while one `ACTIVE` OWNER remains. ADMIN may remove ADMIN and MEMBER Memberships and themselves, not Owners. MEMBER may remove only themselves (leave).
- Target must be `ACTIVE`; a `REMOVED` target is treated as not found.
- In one transaction, after locking the Organization: set `status = REMOVED`, `removedAt = now`, increment `version`; unassign every Issue assigned to this Membership (each writes `ISSUE_ASSIGNEE_CHANGED` with `reason: "MEMBERSHIP_REMOVED"`); write Activity `MEMBERSHIP_REMOVED`; create Notification `MEMBERSHIP_REMOVED` for the removed User unless they removed themselves.
- The removed User's Sessions stay valid; only access to this Organization ends.

Response: `204 No Content`

Errors: `403 FORBIDDEN`, `404 MEMBERSHIP_NOT_FOUND`, `409 LAST_OWNER_REQUIRED`, `409 VERSION_CONFLICT`

---

## 6. Invitations

Invitation tokens are 32 random bytes, stored only as SHA-256 hashes, and delivered by email through the Outbox ([ADR-0008](../../adr/0008-transactional-outbox-for-email.md)). The API never returns them.

### 6.1 Create Invitation

`POST /api/v1/organizations/{organizationId}/invitations` · Auth: bearer · Roles: OWNER (role `ADMIN` or `MEMBER`), ADMIN (role `MEMBER` only)

```json
{ "email": "bob@example.com", "role": "MEMBER" }
```

Rules:

- Email is normalized like User email. Invitations cannot grant `OWNER`.
- A User with an `ACTIVE` Membership cannot be invited. A `REMOVED` Membership may be invited; acceptance reactivates it.
- In one transaction, under an advisory lock on `(organizationId, email)`: mark stale `PENDING` rows for that email `EXPIRED`; insert the Invitation (`expiresAt = now + 7 days`); write Activity `INVITATION_CREATED`; insert the Outbox event; create Notification `INVITATION_RECEIVED` if the email belongs to an existing User.
- A unique violation on the pending-invitation index is returned as `409 PENDING_INVITATION_EXISTS`, not `500`.
- Email delivery failure never rolls back the Invitation.

Response: `201 Created` · `Location: /api/v1/organizations/{organizationId}/invitations/{id}` · `{ "data": { "invitation": Invitation } }`

Errors: `403 FORBIDDEN`, `409 ALREADY_ORGANIZATION_MEMBER`, `409 PENDING_INVITATION_EXISTS`

### 6.2 List Invitations

`GET /api/v1/organizations/{organizationId}/invitations` · Auth: bearer · Roles: OWNER, ADMIN

Query: `limit`, `cursor`, `status` (optional; filters on effective status).

Rules: returns all Invitations of the Organization, not only the caller's. Order `created_at DESC, id DESC`. Reading never writes.

Response: `200 OK` · collection of Invitation

Errors: `403 FORBIDDEN`

### 6.3 Get Invitation

`GET /api/v1/organizations/{organizationId}/invitations/{invitationId}` · Auth: bearer · Roles: OWNER, ADMIN

Response: `200 OK` · `{ "data": { "invitation": Invitation } }`

Errors: `403 FORBIDDEN`, `404 INVITATION_NOT_FOUND`

### 6.4 Revoke Invitation

`DELETE /api/v1/organizations/{organizationId}/invitations/{invitationId}` · Auth: bearer · Roles: OWNER, ADMIN

Rules:

- Lock the Invitation row. If `PENDING` and not expired: set `REVOKED`, `revokedAt`, and write Activity `INVITATION_REVOKED` in the same transaction.
- If stored `PENDING` but expired: set `EXPIRED` and return `409 INVITATION_NOT_PENDING`.
- `ACCEPTED`, `REVOKED`, `EXPIRED`: `409 INVITATION_NOT_PENDING`.
- Revoke and accept are mutually exclusive; whichever locks first wins.

Response: `204 No Content`

Errors: `403 FORBIDDEN`, `404 INVITATION_NOT_FOUND`, `409 INVITATION_NOT_PENDING`

### 6.5 Resend Invitation

`POST /api/v1/organizations/{organizationId}/invitations/{invitationId}/resend` · Auth: bearer · Roles: OWNER, ADMIN · no body

Rules:

- Only a `PENDING`, unexpired Invitation can be resent.
- Under the Invitation row lock: enforce a 60-second cooldown and at most five successful resends per rolling 24 hours ([Database §5.5](../database.md#55-invitations)); rotate the token (old token stops working at commit), increment `token_version`, insert a new Outbox event, write Activity `INVITATION_RESENT`. Expiry is not extended.
- A rejected request (cooldown or quota) rotates nothing, enqueues nothing, and consumes no quota.
- Success means the email is queued, not delivered.

Response: `202 Accepted` · `{ "data": { "invitation": Invitation, "delivery": "QUEUED" } }`

Errors: `403 FORBIDDEN`, `404 INVITATION_NOT_FOUND`, `409 INVITATION_NOT_PENDING`, `429 RESEND_COOLDOWN` (with `Retry-After`), `429 RESEND_LIMIT_REACHED` (with `Retry-After`)

### 6.6 Accept Invitation

`POST /api/v1/invitations/accept` · Auth: bearer · no Membership required

```json
{ "token": "opaque-invitation-token" }
```

Rules, in one transaction:

1. Hash the token and find the Invitation; lock it.
2. If stored `PENDING` but expired: set `EXPIRED`, return `409 INVITATION_EXPIRED`.
3. If not `PENDING`: `409 INVITATION_NOT_PENDING`.
4. The caller's normalized email must equal the Invitation email, otherwise `403 INVITATION_EMAIL_MISMATCH`.
5. No Membership: create one with the invited role. `REMOVED` Membership: reactivate the same row (role from Invitation, `ACTIVE`, new `joinedAt`, `removedAt = null`, `version + 1`). `ACTIVE` Membership: `409 MEMBERSHIP_ALREADY_ACTIVE`.
6. Set Invitation `ACCEPTED`, `acceptedAt`; write Activity `INVITATION_ACCEPTED` (metadata includes `membershipId`, `reactivated`).

Concurrent accepts of one Invitation produce exactly one success.

Response: `200 OK` · `{ "data": { "invitation": Invitation, "membership": Membership } }`

Errors: `403 INVITATION_EMAIL_MISMATCH`, `404 INVITATION_NOT_FOUND`, `409 INVITATION_EXPIRED`, `409 INVITATION_NOT_PENDING`, `409 MEMBERSHIP_ALREADY_ACTIVE`

### 6.7 Invitation email delivery

Not an endpoint. The Outbox worker delivers at least once with up to eight attempts, exponential backoff from 1 minute capped at 60 minutes with ±20% jitter, retrying network errors, timeouts, HTTP 408, 429, and 5xx; other 4xx fail immediately. Terminal failures are not reset; recovery is a manual resend. Mechanics: [Database §5.13](../database.md#513-outbox_events).

---

## 7. Projects

### 7.1 Create Project

`POST /api/v1/organizations/{organizationId}/projects` · Auth: bearer · Roles: all

```json
{ "name": "Backend Platform", "description": "Project management API" }
```

Rules: blank `description` becomes `null`. Creates an active Project (`version = 1`, internal issue counter at 1) and Activity `PROJECT_CREATED` in one transaction.

Response: `201 Created` · `Location: …/projects/{id}` · `{ "data": { "project": Project } }`

### 7.2 List Projects

`GET /api/v1/organizations/{organizationId}/projects` · Auth: bearer · Roles: all

Query: `limit`, `cursor`, `status` (`ACTIVE` default, or `ARCHIVED`).

Rules: order `created_at DESC, id DESC`.

Response: `200 OK` · collection of Project

### 7.3 Get Project

`GET /api/v1/organizations/{organizationId}/projects/{projectId}` · Auth: bearer · Roles: all

Response: `200 OK` · `{ "data": { "project": Project } }` (active or archived)

### 7.4 Update Project

`PATCH /api/v1/organizations/{organizationId}/projects/{projectId}` · Auth: bearer · Roles: OWNER, ADMIN

```json
{ "name": "Backend Platform v2", "description": null, "version": 3 }
```

Rules: at least one of `name`, `description`. Project must be active. Activity `PROJECT_UPDATED` on real change.

Response: `200 OK` · `{ "data": { "project": Project } }`

Errors: `403 FORBIDDEN`, `409 PROJECT_ARCHIVED`, `409 VERSION_CONFLICT`

### 7.5 Archive Project

`POST /api/v1/organizations/{organizationId}/projects/{projectId}/archive` · Auth: bearer · Roles: OWNER, ADMIN

```json
{ "version": 3 }
```

Rules: sets `archivedAt`; writes `PROJECT_ARCHIVED`. Issues are not archived automatically. Already archived: no-op (§1.2).

Response: `200 OK` · `{ "data": { "project": Project } }`

Errors: `403 FORBIDDEN`, `409 VERSION_CONFLICT`

### 7.6 Restore Project

`POST /api/v1/organizations/{organizationId}/projects/{projectId}/restore` · Auth: bearer · Roles: OWNER, ADMIN

```json
{ "version": 4 }
```

Rules: clears `archivedAt`; writes `PROJECT_RESTORED`. Individually archived Issues stay archived. Already active: no-op.

Response: `200 OK` · `{ "data": { "project": Project } }`

Errors: `403 FORBIDDEN`, `409 VERSION_CONFLICT`

---

## 8. Issues

Base path: `/api/v1/organizations/{organizationId}/projects/{projectId}/issues`. All active roles may perform every Issue operation. Status transitions follow [Domain Model §5.2](../domain-model.md#52-issue).

### 8.1 Create Issue

`POST {base}` · Auth: bearer · Roles: all

```json
{ "title": "Implement authentication", "description": "Registration and login", "priority": "HIGH", "assigneeMembershipId": "uuid" }
```

Rules:

- `priority` defaults to `MEDIUM`; `assigneeMembershipId` is optional and nullable and must be an `ACTIVE` Membership of the same Organization.
- The server sets `number`, `status = TODO`, `version = 1`. Clients cannot set them.
- One transaction: allocate the number with `UPDATE … RETURNING` on the Project counter, insert the Issue, write `ISSUE_CREATED`, and create Notification `ISSUE_ASSIGNED` if an assignee other than the caller was set.

Response: `201 Created` · `Location: {base}/{id}` · `{ "data": { "issue": Issue } }`

Errors: `404 MEMBERSHIP_NOT_FOUND` (assignee not in this Organization), `409 PROJECT_ARCHIVED`, `422 ASSIGNEE_NOT_ACTIVE`

### 8.2 List Issues

`GET {base}` · Auth: bearer · Roles: all

Query: `limit`, `cursor`, `status`, `priority`, `assigneeMembershipId`, `includeArchived` (default `false`), `q`.

Rules:

- `q` matches title or description by case-insensitive substring; if `q` is a positive integer it also matches `number` exactly.
- Order `number DESC, id DESC`. `totalCount` reflects all filters.

Response: `200 OK` · collection of Issue

### 8.3 Get Issue

`GET {base}/{issueId}` · Auth: bearer · Roles: all

Response: `200 OK` · `{ "data": { "issue": Issue } }` (active or archived)

### 8.4 Update Issue

`PATCH {base}/{issueId}` · Auth: bearer · Roles: all

```json
{ "title": "Implement secure authentication", "description": null, "priority": "URGENT", "version": 2 }
```

Rules: at least one of `title`, `description`, `priority` (`priority` cannot be `null`). Status and assignee have their own endpoints. Issue and Project must be active. On real change, `ISSUE_UPDATED` with per-field `from`/`to`.

Response: `200 OK` · `{ "data": { "issue": Issue } }`

Errors: `409 ISSUE_ARCHIVED`, `409 PROJECT_ARCHIVED`, `409 VERSION_CONFLICT`

### 8.5 Assign Issue

`PATCH {base}/{issueId}/assignee` · Auth: bearer · Roles: all

```json
{ "assigneeMembershipId": "uuid", "version": 3 }
```

Rules: `null` unassigns. A non-null target must be `ACTIVE` in the same Organization; the target Membership row is locked to serialize against removal ([Database §7.4](../database.md#74-membership-removal-and-issue-assignment)). On real change: `ISSUE_ASSIGNEE_CHANGED`, plus Notification `ISSUE_ASSIGNED` to a new non-null assignee who is not the caller. The previous assignee is not notified.

Response: `200 OK` · `{ "data": { "issue": Issue } }`

Errors: `404 MEMBERSHIP_NOT_FOUND` (assignee not in this Organization), `409 ISSUE_ARCHIVED`, `409 PROJECT_ARCHIVED`, `409 VERSION_CONFLICT`, `422 ASSIGNEE_NOT_ACTIVE`

### 8.6 Change status

`PATCH {base}/{issueId}/status` · Auth: bearer · Roles: all

```json
{ "status": "IN_PROGRESS", "version": 3 }
```

Rules: transition must be allowed by the matrix; same status is a no-op. On real change: `ISSUE_STATUS_CHANGED`. No Notification.

Response: `200 OK` · `{ "data": { "issue": Issue } }`

Errors: `409 ISSUE_ARCHIVED`, `409 PROJECT_ARCHIVED`, `409 VERSION_CONFLICT`, `422 INVALID_STATUS_TRANSITION`

### 8.7 Archive Issue

`POST {base}/{issueId}/archive` · Auth: bearer · Roles: all

```json
{ "version": 3 }
```

Rules: Project must be active. Sets `archivedAt`; writes `ISSUE_ARCHIVED`. Already archived: no-op.

Response: `200 OK` · `{ "data": { "issue": Issue } }`

Errors: `409 PROJECT_ARCHIVED`, `409 VERSION_CONFLICT`

### 8.8 Restore Issue

`POST {base}/{issueId}/restore` · Auth: bearer · Roles: all

```json
{ "version": 4 }
```

Rules: Project must be active. Clears `archivedAt`; status and assignee are unchanged; writes `ISSUE_RESTORED`. Already active: no-op.

Response: `200 OK` · `{ "data": { "issue": Issue } }`

Errors: `409 PROJECT_ARCHIVED`, `409 VERSION_CONFLICT`

---

## 9. Labels

Labels belong to the Organization. All active roles manage them. Labels have no `version`: concurrent create/rename/restore collisions are resolved by the partial unique index and mapped to `409 LABEL_NAME_ALREADY_EXISTS`.

**Name normalization.** One shared function produces the display `name` (NFKC, trimmed, internal whitespace collapsed to one space, case preserved) and the comparison key `normalizedName` (the display name Unicode case-folded). Active `normalizedName` values are unique per Organization; archived Labels do not reserve a name. Do not use PostgreSQL `LOWER()` for this.

### 9.1 Create Label

`POST /api/v1/organizations/{organizationId}/labels` · Auth: bearer · Roles: all

```json
{ "name": "Backend" }
```

Rules: writes `LABEL_CREATED` in the same transaction.

Response: `201 Created` · `Location: …/labels/{id}` · `{ "data": { "label": Label } }`

Errors: `409 LABEL_NAME_ALREADY_EXISTS`

### 9.2 List Labels

`GET /api/v1/organizations/{organizationId}/labels` · Auth: bearer · Roles: all

Query: `limit`, `cursor`, `includeArchived` (default `false`).

Rules: order `created_at DESC, id DESC`.

Response: `200 OK` · collection of Label

### 9.3 Get Label

`GET /api/v1/organizations/{organizationId}/labels/{labelId}` · Auth: bearer · Roles: all

Response: `200 OK` · `{ "data": { "label": Label } }`

Errors: `404 LABEL_NOT_FOUND`

### 9.4 Rename Label

`PATCH /api/v1/organizations/{organizationId}/labels/{labelId}` · Auth: bearer · Roles: all

```json
{ "name": "Platform Engineering" }
```

Rules: Label must be active. A new name with the same `normalizedName` and same display form is a no-op. On real change: `LABEL_RENAMED` with old and new display names.

Response: `200 OK` · `{ "data": { "label": Label } }`

Errors: `404 LABEL_NOT_FOUND`, `409 LABEL_ARCHIVED`, `409 LABEL_NAME_ALREADY_EXISTS`

### 9.5 Archive Label

`POST /api/v1/organizations/{organizationId}/labels/{labelId}/archive` · Auth: bearer · Roles: all · no body

Rules: sets `archivedAt`; existing Issue associations remain. Writes `LABEL_ARCHIVED`. Already archived: no-op.

Response: `200 OK` · `{ "data": { "label": Label } }`

Errors: `404 LABEL_NOT_FOUND`

### 9.6 Restore Label

`POST /api/v1/organizations/{organizationId}/labels/{labelId}/restore` · Auth: bearer · Roles: all · no body

Rules: rejected if another active Label has the same `normalizedName`; the Label then stays archived and associations are unchanged. On success clears `archivedAt` and writes `LABEL_RESTORED`. Already active: no-op.

Response: `200 OK` · `{ "data": { "label": Label } }`

Errors: `404 LABEL_NOT_FOUND`, `409 LABEL_NAME_ALREADY_EXISTS`

---

## 10. Issue labels

Base path: `/api/v1/organizations/{organizationId}/projects/{projectId}/issues/{issueId}/labels`. Attaching or detaching does not change the Issue's `version` and creates no Notification.

### 10.1 List labels of an Issue

`GET {base}` · Auth: bearer · Roles: all

Query: `limit`, `cursor`.

Rules: includes archived Labels. Allowed for archived Issues and Issues in archived Projects. Order `attached_at DESC, label id DESC`.

Response: `200 OK` · `{ "data": [ { "label": Label, "attachedAt": "…" } ], "pagination": … }`

### 10.2 Attach label

`PUT {base}/{labelId}` · Auth: bearer · Roles: all · no body

Rules: Issue and Project must be active. Already attached: no-op (even if the Label was archived since). Otherwise the Label must be active. Real attach writes `ISSUE_LABEL_ATTACHED`.

Response: `204 No Content`

Errors: `404 LABEL_NOT_FOUND`, `409 ISSUE_ARCHIVED`, `409 PROJECT_ARCHIVED`, `409 LABEL_ARCHIVED`

### 10.3 Detach label

`DELETE {base}/{labelId}` · Auth: bearer · Roles: all

Rules: Issue and Project must be active. Archived Labels can be detached. Not attached: no-op. Real detach writes `ISSUE_LABEL_DETACHED`.

Response: `204 No Content`

Errors: `404 LABEL_NOT_FOUND`, `409 ISSUE_ARCHIVED`, `409 PROJECT_ARCHIVED`

---

## 11. Comments

Base path: `/api/v1/organizations/{organizationId}/projects/{projectId}/issues/{issueId}/comments`. Bodies are stored as plain text; clients must not render them as HTML.

### 11.1 List Comments

`GET {base}` · Auth: bearer · Roles: all

Query: `limit`, `cursor`.

Rules: includes deleted Comments as tombstones; allowed on archived Issues and Projects. Order `created_at ASC, id ASC`.

Response: `200 OK` · collection of Comment

### 11.2 Create Comment

`POST {base}` · Auth: bearer · Roles: all

```json
{ "body": "The authentication flow is ready for review." }
```

Rules: Issue and Project must be active. One transaction: insert the Comment (author = caller's Membership), write `COMMENT_CREATED`, and create Notification `COMMENT_ADDED` for the Issue's assignee unless the assignee is the caller.

Response: `201 Created` · `{ "data": { "comment": Comment } }`

Errors: `409 ISSUE_ARCHIVED`, `409 PROJECT_ARCHIVED`

### 11.3 Edit Comment

`PATCH {base}/{commentId}` · Auth: bearer · Roles: author; OWNER and ADMIN for any Comment

```json
{ "body": "Ready for QA.", "version": 1 }
```

Rules: Comment must not be deleted; Issue and Project must be active. On real change: `COMMENT_UPDATED` (without the body).

Response: `200 OK` · `{ "data": { "comment": Comment } }`

Errors: `403 FORBIDDEN`, `404 COMMENT_NOT_FOUND`, `409 COMMENT_DELETED`, `409 ISSUE_ARCHIVED`, `409 PROJECT_ARCHIVED`, `409 VERSION_CONFLICT`

### 11.4 Delete Comment

`DELETE {base}/{commentId}?version=1` · Auth: bearer · Roles: author; OWNER and ADMIN for any Comment

Rules: tombstone, not physical delete. One transaction: set `deletedAt`, set `body = null`, increment `version`, write `COMMENT_DELETED`. Issue and Project must be active. Already deleted: idempotent `200` (authorization is still checked).

Response: `200 OK` · `{ "data": { "comment": Comment } }` (the tombstone)

Errors: `403 FORBIDDEN`, `404 COMMENT_NOT_FOUND`, `409 ISSUE_ARCHIVED`, `409 PROJECT_ARCHIVED`, `409 VERSION_CONFLICT`

---

## 12. Activities

### 12.1 List Organization Activities

`GET /api/v1/organizations/{organizationId}/activities` · Auth: bearer · Roles: all

Query: `limit`, `cursor`, `eventType`, `actorId`, `issueId`.

Rules: one Organization-level stream; the Issue view is this endpoint filtered by `issueId`. Order `created_at DESC, id DESC`. There is no endpoint to create, edit, or delete Activity, and no detail endpoint.

Response: `200 OK` · collection of Activity

---

## 13. Notifications

Notifications are personal: the recipient comes from the Session and no Membership is required, so a removed User can still read their `MEMBERSHIP_REMOVED` Notification. A Notification never grants access to the resource it mentions.

### 13.1 List my Notifications

`GET /api/v1/notifications` · Auth: bearer

Query: `limit`, `cursor`, `status` (`ALL` default, `UNREAD`, `READ`).

Rules: order `created_at DESC, id DESC`.

Response: `200 OK` · collection of Notification

### 13.2 Mark read

`PATCH /api/v1/notifications/{notificationId}/read` · Auth: bearer · no body

Rules: unread → sets `readAt = now`. Already read: no-op, `readAt` unchanged. Concurrent requests keep the first timestamp (conditional update on `read_at IS NULL`).

Response: `200 OK` · `{ "data": { "notification": Notification } }`

Errors: `404 NOTIFICATION_NOT_FOUND`

### 13.3 Mark unread

`PATCH /api/v1/notifications/{notificationId}/unread` · Auth: bearer · no body

Rules: sets `readAt = null`; a later read sets a new timestamp and a new 180-day retention deadline. Already unread: no-op.

Response: `200 OK` · `{ "data": { "notification": Notification } }`

Errors: `404 NOTIFICATION_NOT_FOUND`

### 13.4 Mark all read

`PATCH /api/v1/notifications/read-all` · Auth: bearer · no body

Rules: one conditional update of the caller's unread Notifications; already-read timestamps are not reset.

Response: `204 No Content`

---

## 14. Explicitly excluded from V1

Email verification, password reset, JWT or cookie authentication, logout of all sessions, Organization archive or deletion, Project or Issue hard delete, custom workflows, fuzzy/semantic/global search, mentions, watchers, Activity detail or mutation endpoints, push or real-time notifications, non-invitation email, Comment edit history, `Idempotency-Key`, and public endpoints for Outbox processing.

## 15. Change management

A public contract change updates this document, the OpenAPI source, and the API tests in the same pull request. A change to a cross-endpoint rule goes to [Conventions](conventions.md) first. A breaking change requires a new API version ([Conventions §2](conventions.md#2-base-path-transport-and-versioning)).
