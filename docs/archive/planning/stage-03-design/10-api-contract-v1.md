**Project:** Multi-Tenant Project Management API  
**Workflow Stage:** 03 — Design  
**Document:** 10  
**Version:** 1.0  
**Status:** Approved

---

# API Contract v1

We now define the API Contract v1. We have a domain model and an initial database design. The next step is to define how clients communicate with the backend without depending on implementation details.

The principle is straightforward: an API contract describes what a client can request, what conditions must be satisfied, what result is returned, and how failures are reported.

This document does not prescribe every line of Express code or the final shape of each Zod schema. Those belong to implementation after the contract is sufficiently clear.

## 1. Define the API Shape

We use a REST API with a version prefix:

```text
/api/v1
```

Example resources:

```text
/api/v1/organizations
/api/v1/organizations/{organizationId}/projects
/api/v1/projects/{projectId}/issues
/api/v1/issues/{issueId}
```

Why use resource-oriented URLs?

Organization, Project, and Issue are domain resources with identity and lifecycle. Operations use HTTP methods, while business rules remain enforced by the backend.

Example:

```http
POST /api/v1/projects/{projectId}/issues
```

This means creating an Issue within a specific Project.

It does not mean that the client may choose an Organization simply by sending `organizationId` in the request body. The backend must verify that the Project belongs to the correct Organization context and that the User is authorized to create an Issue there.

## 2. Group Endpoints by Domain

### Authentication

User identity and sessions. API v1 uses an **opaque database-backed session token**, not JWT.

- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/refresh`
- `POST /auth/logout`
- `GET /auth/me`

After login, the server generates a high-entropy random token (32 bytes from a cryptographically secure random generator) and returns it to the client once. The client sends the token through `Authorization: Bearer <session-token>`. The database stores only the SHA-256 token hash in `sessions.token_hash`, not the raw token. Every authenticated request validates the hash, `revoked_at IS NULL`, and `expires_at > now()`.

The v1 session lifetime is 7 days. `POST /auth/refresh` accepts only a still-valid session; the server revokes the old session and creates a new token/session with a 7-day lifetime in one transaction. `POST /auth/logout` revokes the current session. JWT, a separate refresh-token pair, and cookie-based browser sessions are outside the v1 design.

### Organizations & Memberships

Tenant and membership operations:

- `POST /organizations`
- `GET /organizations`
- `GET /organizations/{organizationId}`
- `GET /organizations/{organizationId}/members`
- `PATCH /organizations/{organizationId}/members/{membershipId}`
- `DELETE /organizations/{organizationId}/members/{membershipId}`

These operations revoke a Membership by changing its `status` to `REMOVED`, not by physically deleting the record. Therefore, HTTP `DELETE` here means revoke at the API resource level, not physical deletion from the database. Issues assigned to that Membership must be unassigned and Activity recorded in the same transaction. The operation is rejected if it would revoke or demote the last Owner; an Admin cannot revoke an Owner's Membership.

### Invitations

Member onboarding. The create-Invitation body must include the destination email and requested role. The server rejects an Invitation if that email already has an `ACTIVE` Membership in the target Organization; a `REMOVED` Membership may be invited again. The server validates the inviter's role against the invited role: Owner → ADMIN/MEMBER; Admin → MEMBER; Member cannot invite.

- `POST /organizations/{organizationId}/invitations` — body contains `email` and `role`; the allowed role depends on the inviter's role.
- `POST /invitations/accept`
- `POST /organizations/{organizationId}/invitations/{invitationId}/resend`
- `DELETE /organizations/{organizationId}/invitations/{invitationId}`

### Projects & Issues

Core work resources:

- `POST /organizations/{organizationId}/projects`
- `GET /organizations/{organizationId}/projects`
- `POST /projects/{projectId}/issues`
- `GET /projects/{projectId}/issues`
- `GET /issues/{issueId}`
- `PATCH /issues/{issueId}`
- `POST /projects/{projectId}/archive` (Owner/Admin)
- `POST /projects/{projectId}/restore` (Owner/Admin)
- `POST /issues/{issueId}/archive` (Owner/Admin)
- `POST /issues/{issueId}/restore` (Owner/Admin; parent Project must be active)
- `POST /issues/{issueId}/comments`
- `PATCH /comments/{commentId}` (author or Owner/Admin)
- `DELETE /comments/{commentId}` (soft delete; author or Owner/Admin)

### History & Notifications

Audit and user activity:

- `GET /organizations/{organizationId}/activity`
- `GET /issues/{issueId}/activity`
- `GET /notifications`
- `PATCH /notifications/{notificationId}`

This is a candidate endpoint list, not a promise that every endpoint will be implemented immediately. We will prioritize complete vertical flows: register, create an Organization, create a Project, create an Issue, and update an Issue.

## 3. Define the Core Endpoint Contracts

We start with five endpoints that form the basic workflow.

### A. Create an Organization

`POST /api/v1/organizations`

Request:

```json
{
  "name": "Acme"
}
```

Response `201 Created`:

```json
{
  "data": {
    "id": "org_123",
    "name": "Acme",
    "slug": "acme",
    "role": "OWNER",
    "status": "ACTIVE"
  }
}
```

Business contract:

- The User must be authenticated.
- The system creates the Organization and Owner Membership in one transaction.
- The slug must be valid and unique.
- The client cannot freely choose the initial role. The creator automatically becomes Owner.

### B. Create a Project

`POST /api/v1/organizations/{organizationId}/projects`

Request:

```json
{
  "name": "Payment System",
  "key": "PAY",
  "description": "Payment processing backend"
}
```

Response `201 Created`:

```json
{
  "data": {
    "id": "project_123",
    "organizationId": "org_123",
    "name": "Payment System",
    "key": "PAY",
    "status": "ACTIVE"
  }
}
```

`status: ACTIVE` in the response is an API representation derived from `archived_at IS NULL`; the database stores a nullable `archived_at` marker, not an `ACTIVE | ARCHIVED` status column.

Business contract:

- The User must have an active Membership.
- All roles (`OWNER`, `ADMIN`, `MEMBER`) have the `project:create` permission, provided their Membership is active in the target Organization.
- `key` must be unique within that Organization.
- Organization archiving is outside v1 scope.

### C. Create an Issue

`POST /api/v1/projects/{projectId}/issues`

Request:

```json
{
  "title": "Prevent duplicate webhook",
  "description": "Handle repeated provider events",
  "priority": "HIGH",
  "assigneeMembershipId": "membership_456"
}
```

Response `201 Created`:

```json
{
  "data": {
    "id": "issue_123",
    "identifier": "PAY-431",
    "title": "Prevent duplicate webhook",
    "status": "TODO",
    "priority": "HIGH",
    "version": 1
  }
}
```

Business contract:

- The Project must exist and be active (`archivedAt` is null).
- The User must have an active Membership in the Organization that owns the Project and the `issue:create` permission.
- If provided, the Assignee must be an active Membership in the same Organization.
- The server sets the initial status to `TODO`.
- The Issue and Activity are created atomically.
- The Issue number must be unique within the Project.

### D. Update an Issue Status

`PATCH /api/v1/issues/{issueId}`

Request:

```json
{
  "status": "IN_REVIEW",
  "version": 7
}
```

Response `200 OK`:

```json
{
  "data": {
    "id": "issue_123",
    "status": "IN_REVIEW",
    "version": 8,
    "updatedAt": "2026-10-13T08:00:00Z"
  }
}
```

Business contract:

- The User must be authenticated and authorized.
- The status transition must be valid.
- `version` must match the current version.
- If the version has changed, the server returns `409 Conflict`.
- Activity is recorded in the same transaction as the Issue update.

Design note: `PATCH` may accept multiple permitted fields, but the client must not be allowed to change `version`, `createdBy`, or administrative attributes that can only be set by the server.

### E. Accept an Invitation

`POST /api/v1/invitations/accept`

Request:

```json
{
  "token": "invitation-secret-token"
}
```

Response `200 OK`:

```json
{
  "data": {
    "organizationId": "org_123",
    "membershipRole": "MEMBER",
    "membershipStatus": "ACTIVE"
  }
}
```

Business contract:

- The token must be valid and not expired.
- The Invitation must have `PENDING` status, must not have been revoked, and must satisfy `expiresAt > now()`. `expiresAt` remains authoritative even if the worker has not changed the status to `EXPIRED`.
- The accepting account's email must match the Invitation email after normalization.
- An Owner may invite `ADMIN` or `MEMBER`; an Admin may invite `MEMBER` only; an Invitation cannot grant the `OWNER` role.
- Creating or reactivating the Membership and marking the Invitation as accepted must be atomic. If no Membership exists, create one. If a Membership already exists with `REMOVED` status, reactivate the same record, use the Invitation role, update `joinedAt`, and clear `removedAt`. If the Membership is already `ACTIVE`, reject acceptance as a duplicate/current Membership. Retrying the request must not create a duplicate Membership.

The raw token is sent only to the authorized recipient. The database stores the token hash, not the raw token.

## 4. Standardize Error Responses

API v1 uses a stable custom error envelope. This format is the project's chosen contract; there is no need to adopt another format in v1. The API must give clients a consistent way to understand failures.

Final format:

```json
{
  "error": {
    "code": "INVALID_STATUS_TRANSITION",
    "message": "The requested status transition is not allowed.",
    "details": {
      "from": "TODO",
      "to": "DONE"
    },
    "requestId": "req_abc123"
  }
}
```

`code` is a stable identifier for the client. `message` explains the problem to a person. `details` is optional and must not disclose another tenant's data.

HTTP status codes:

| Status | Usage |
|---|---|
| `400 Bad Request` | Request cannot be processed or parameter format is invalid |
| `401 Unauthorized` | Authentication is missing or invalid |
| `403 Forbidden` | Actor has an active Membership in the resource's Organization, but their role/permission does not allow the action |
| `404 Not Found` | Resource does not exist, or actor has no active Membership in the resource's Organization (including another tenant's resource); resource existence is concealed |
| `409 Conflict` | Stale `version`, a client-understandable unique conflict, or concurrent state conflict |
| `422 Unprocessable Content` | Syntactically valid input violates a domain rule, such as a disallowed Issue status transition |
| `429 Too Many Requests` | Rate limit exceeded |
| `500 Internal Server Error` | Unexpected internal failure |

We do not need to use every status for every case. What matters is consistent semantics. Do not return `500` for every problem and expect the frontend to read the server's mind.

## 5. Pagination, Filtering, Sorting, and Issue Search

List endpoints must be designed from the start so they do not return the entire database.

v1 Issue search is scoped to one Project only. The `q` parameter performs a case-insensitive substring search over `title` and `description`; if `q` is entirely numeric, the system also matches `number` exactly. Search continues to respect status, priority, and archive-state filters. Results use cursor pagination and deterministic ordering. Fuzzy/semantic search and cross-Organization search are outside v1.

Example:

```http
GET /api/v1/projects/{projectId}/issues?q=webhook&status=IN_PROGRESS&priority=HIGH&limit=20
```

Response:

```json
{
  "data": [
    {
      "id": "issue_123",
      "identifier": "PAY-431",
      "title": "Prevent duplicate webhook",
      "status": "IN_PROGRESS",
      "priority": "HIGH"
    }
  ],
  "page": {
    "nextCursor": "opaque-cursor",
    "hasMore": true
  }
}
```

For v1, use cursor pagination for lists that may grow large, with deterministic ordering such as `created_at` and `id`. Filtering and sorting must use server-allowed fields, not arbitrary SQL column names supplied by the client.

## 6. Domain and Persistence Consistency

- `organizationId` on an Issue must match the Organization that owns its Project. If present, the Assignee must be an active Membership in the same Organization.
- Project/Issue archiving uses nullable `archived_at` in the database. The API response may expose a derived status such as `ACTIVE` or `ARCHIVED`, but this is not the Issue workflow status.
- Comment uses soft deletion (`deleted_at`). Activity remains append-only and is written atomically with the business mutation.
- Archiving a Project does not automatically archive its Issues. Issues in an archived Project cannot be mutated until the Project is restored.
- The error envelope and HTTP semantics in Section 4 are the final API v1 contract: cross-tenant access or no active Membership returns 404; an active Membership without permission returns 403; a stale version returns 409; a domain-rule violation such as an invalid status transition returns 422.

## 7. Document the API Contract

Add `docs/api-contract.md` with these sections:

1. Base URL and API version.
2. Authentication and authorization.
3. Endpoints and HTTP methods.
4. Request and response schemas.
5. Error codes and HTTP statuses.
6. Pagination, filtering, and sorting.
7. Idempotency and concurrency.
8. Tenant-isolation rules.

Later, this contract can be represented as OpenAPI, then used to generate interactive documentation and support API testing.

## 8. Next Implementation Sequence

We now have a design path from problem to API contract:

- Problem definition and domain modeling.
- Business rules and initial Permission Matrix.
- Initial ERD and database design.
- Initial API Contract.
- Finalize the specification and OpenAPI.
- Project setup, migrations, and automated tests.
- Implement the first vertical slice.

The next step is a final design review before coding. We will check whether the ERD, business rules, Permission Matrix, and API Contract are consistent with one another. After that, we can define the first implementation scope, for example register/login → create Organization → create Project, complete with migrations and integration tests.

One note: the examples above began as an initial contract draft. Identifier names, HTTP status details, error policy, and some rules must be aligned before they are considered final. We do not need a perfect design, but we do need to know which decisions have been made and which are still assumptions.
