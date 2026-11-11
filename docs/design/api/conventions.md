# API Conventions

| Field | Value |
|---|---|
| Status | Active |
| Owner | T. Tamil Arsen |
| Last updated | 2026-11-11 |
| Applies to | Every endpoint under `/api/v1` |

These rules apply to every endpoint. The [API Contract](contract.md) defines individual endpoints and may only deviate from a rule here if it says so explicitly. Error codes are catalogued in [Errors](errors.md).

---

## 1. Principles

1. **HTTP semantics first.** Status codes and headers carry their standard meaning; the body does not duplicate them.
2. **A stable public contract.** Responses are explicit DTOs, never ORM models, so the schema can change without breaking clients.
3. **Machine-readable errors.** Clients branch on `error.code`, never on `error.message`.
4. **Tenant isolation is part of the contract.** Responses, counts, cursors, and errors never reveal data from another Organization.
5. **Consistency over cleverness.** One envelope, one pagination format, one error format, for every module.

## 2. Base path, transport, and versioning

- All V1 endpoints live under `/api/v1`. Health endpoints (`/healthz`, `/readyz`) and API docs (`/docs`) are outside the versioned path.
- Request and response bodies are JSON (`application/json; charset=utf-8`).
- A request with a body must send `Content-Type: application/json`; otherwise the server responds `415 UNSUPPORTED_MEDIA_TYPE`.
- No multipart or file upload in V1.

**Versioning.** The version is in the URI (`/api/v1`). Backward-compatible changes stay in `v1`. A breaking change requires `/api/v2` and a documented migration period for `v1`. Breaking changes include: removing or renaming a field, changing a field's type or meaning, adding a required request field, removing an endpoint, changing an error code or status for an existing condition, and adding an enum value to a response field that clients are documented to handle exhaustively. Adding an optional request field or a new response field is not breaking.

## 3. Serialization

| Rule | Detail |
|---|---|
| Property names | `camelCase` |
| Identifiers | UUID strings (v4) |
| Timestamps | ISO 8601 UTC with milliseconds and `Z`, e.g. `2026-11-11T10:00:00.000Z` |
| Enums | Uppercase strings identical to the database values, e.g. `"IN_PROGRESS"` |
| Empty values | Every field in a DTO is always present; an empty value is `null`, never omitted |
| Relationships | Represented by ID (`projectId`) by default; a nested object is returned only where the contract shows one |
| Excluded data | Password hashes, token hashes, raw invitation tokens, internal columns (`nextIssueNumber`, `normalizedName`, lease fields) |

Responses are produced by an explicit mapper per resource. Returning a Prisma model directly is a defect, because a new column would leak automatically.

## 4. Authentication

Protected endpoints use an opaque Bearer token ([ADR-0003](../../adr/0003-opaque-bearer-session-tokens.md)):

```http
Authorization: Bearer <token>
```

- The raw token is returned only by Register, Login, and Refresh. Invitation tokens are delivered by email and never returned by the API.
- A missing or malformed `Authorization` header produces `401 MISSING_AUTHENTICATION`. A token that is unknown, expired, revoked, or already rotated produces `401 INVALID_SESSION`.
- Every `401` response includes `WWW-Authenticate: Bearer`.
- The actor's identity and Membership come from the Session and server-side data only. Client-supplied `userId`, `role`, or `membershipId` fields never establish who the actor is.
- JWT and cookie authentication are not V1 API mechanisms. The web client keeps the token server-side in its own Next.js backend and forwards it as a Bearer header ([ADR-0010](../../adr/0010-web-client-session-via-bff.md)).

## 5. Success responses

**Single resource**: the representation is wrapped in a key named after the resource, which lets an endpoint return related objects together (for example `organization` and `membership`).

```json
{ "data": { "project": { "id": "…", "name": "Backend Platform" } } }
```

**Collection**

```json
{
  "data": [],
  "pagination": { "nextCursor": null, "hasMore": false, "totalCount": 0 }
}
```

| Situation | Status | Notes |
|---|---|---|
| Read, update, archive, restore | `200 OK` | Body contains the resulting representation |
| Created | `201 Created` | Body contains the new resource; `Location` header points to it when it has its own `GET` endpoint |
| Accepted for asynchronous work | `202 Accepted` | Work was durably queued, not completed (for example Resend Invitation) |
| Success without a representation | `204 No Content` | No body |

There is no `success: true` field; the status code already says that.

## 6. Error responses

Every error uses one envelope:

```json
{
  "error": {
    "code": "VERSION_CONFLICT",
    "message": "The resource was modified by another request.",
    "details": { "currentVersion": 5 }
  }
}
```

| Field | Rule |
|---|---|
| `code` | Stable, `SCREAMING_SNAKE_CASE`, listed in [Errors](errors.md). Changing an existing code is a breaking change. |
| `message` | Human-readable, safe to display, may change at any time. Never contains stack traces, SQL, tokens, or data from another tenant. |
| `details` | Optional object. Its shape is defined per code in [Errors](errors.md). |

**Request correlation.** Every response carries an `X-Request-Id` header. If the client sends `X-Request-Id` matching `^[A-Za-z0-9._-]{1,128}$`, the server reuses it; otherwise it generates a UUID. The same value appears as `requestId` in the server log line for that request. The request ID is not repeated in the body ([ADR-0002](../../adr/0002-json-error-envelope.md)).

### 6.1 Status semantics

| Status | Meaning |
|---:|---|
| `400` | Malformed JSON, or the request fails structural validation (types, required fields, limits, unknown fields, invalid cursor) |
| `401` | Authentication missing or invalid |
| `403` | The actor has an ACTIVE Membership and can see the resource, but the role does not permit the action; also an invitation email mismatch |
| `404` | The resource does not exist, or exists outside the actor's visibility (see §6.2); also an unknown route |
| `409` | Conflict with current state: duplicate, stale `version`, or an operation not allowed in the resource's current lifecycle state |
| `413` | Body larger than 1 MB |
| `415` | Body sent without `Content-Type: application/json` |
| `422` | Structurally valid, but violates a domain rule (invalid status transition, inactive assignee) |
| `429` | Rate limit, cooldown, or quota reached; includes `Retry-After` when a wait time is known |
| `500` | Unexpected failure; details only in logs |

Rule of thumb for `409` versus `422`: `409` means "the request might succeed against a different current state" (retry after refreshing), `422` means "this request can never be valid for this resource as described" (fix the request).

### 6.2 Tenant visibility

- An Organization that does not exist and an Organization where the actor has no ACTIVE Membership produce the same `404 ORGANIZATION_NOT_FOUND`. The two cases must be indistinguishable by status, body, and headers.
- A resource that belongs to another Organization produces that resource's `*_NOT_FOUND` code.
- An actor with an ACTIVE Membership who lacks the permission for a visible resource gets `403 FORBIDDEN`.
- A Notification addressed to another User produces `404 NOTIFICATION_NOT_FOUND`.
- The same rules apply to lists, counts, cursors, and relationship references inside request bodies (for example an `assigneeMembershipId` from another Organization is treated as not found, not as forbidden).

## 7. Validation and limits

- Zod validates `params`, `query`, and `body` before the use case runs. A use case never receives unvalidated input.
- Request body objects are **strict**: unknown fields are rejected with `400 VALIDATION_ERROR`. This prevents mass assignment of server-owned fields such as `role`, `version` in creates, `organizationId`, or `createdBy`.
- Strings are trimmed where the contract says so; passwords are never trimmed or normalized.
- The JSON body limit is 1 MB, enforced by the body parser before validation.
- Validation does not replace authorization, tenant scoping, or domain checks; those run afterwards in the service.

### 7.1 Field limits

This table is the single source for length limits. Zod schemas and database `CHECK` constraints must use the same numbers ([Database §4.8](../database.md#48-text-length-limits)).

| Field | Rule |
|---|---|
| `email` | Valid address; trimmed and lowercased before use; ≤ 254 characters |
| `password` | 12–128 characters; not trimmed; no composition rules |
| `displayName` | 1–100 characters after trim |
| Organization `name` | 1–100 characters after trim |
| Project `name` | 1–100 characters after trim |
| Project `description` | ≤ 5,000 characters; empty string stored as `null` |
| Issue `title` | 1–200 characters after trim |
| Issue `description` | ≤ 10,000 characters; empty string stored as `null` |
| Label `name` | 1–50 characters after normalization |
| Comment `body` | 1–10,000 characters after trim |
| `limit` (query) | Integer 1–100, default 20 |
| `cursor` (query) | ≤ 512 characters, server-issued only |
| Search `q` (query) | ≤ 200 characters |

## 8. Pagination

Collections use cursor (keyset) pagination ([ADR-0004](../../adr/0004-cursor-pagination.md)).

| Parameter | Rule |
|---|---|
| `limit` | Default `20`, minimum `1`, maximum `100`. Out-of-range values are rejected with `400`, never silently clamped. |
| `cursor` | Opaque value from a previous response's `nextCursor`. Omit for the first page. |

- Every collection has a deterministic order ending in `id` as the tie-breaker. The order is stated per endpoint in the contract.
- The cursor is base64url-encoded JSON containing the sort-key values of the last row. The server validates its structure and rejects anything malformed with `400 VALIDATION_ERROR`. A cursor never widens the query: the tenant and authorization filters are always applied from the current request, so a tampered cursor can at most skip rows the actor could already see.
- `totalCount` is the exact number of rows matching the same filters and scope at the time of the request. It is not a snapshot guarantee across pages.
- `hasMore` is `true` exactly when `nextCursor` is not `null`.
- Filter and sort parameters accept only allowlisted values mapped server-side; raw column names are never accepted.

## 9. PATCH and optimistic concurrency

- `PATCH` is a partial update. Omitted fields do not change. `null` clears a field only if the field is nullable.
- Resources with a `version` (Organization, Membership, Project, Issue, Comment) require the client to send the `version` it last read.
- The server performs a conditional update on `id`, tenant, and `version`. A successful real change increments `version` by exactly one and updates `updatedAt`.
- A request whose values equal the current values is a **no-op**: `200` with the current representation, no version change, no Activity, no Notification. The no-op check runs before the version check, so a no-op with a stale `version` still returns `200`: nothing would be overwritten.
- A stale `version` returns `409 VERSION_CONFLICT` with `details.currentVersion`. The server never retries automatically; the client re-reads and reconciles.
- Version-in-body was chosen over `ETag`/`If-Match`; see [ADR-0007](../../adr/0007-concurrency-control.md).

## 10. Tenant scoping order

Every organization-scoped request is processed in this order:

1. Authenticate the Session.
2. Resolve the Organization from the path or from the target resource.
3. Resolve the actor's ACTIVE Membership in that Organization (`404` if none).
4. Resolve the target resource within that Organization (`404` if not found there).
5. Check the role permission (`403`).
6. Check lifecycle state and domain rules (`409` / `422`).
7. Execute the use case.

All organization-scoped endpoints carry `{organizationId}` in the path, and nested resources carry their parents (`/projects/{projectId}/issues/{issueId}`), so every lookup is filtered by the Organization and parent from the start. The only endpoints without an Organization in the path are personal (`/auth/*`, `/notifications/*`) or token-addressed (`/invitations/accept`), and each states its own scoping rule.

## 11. Idempotency and retries

- V1 does not support an `Idempotency-Key` header. It is deferred until a client needs automatic retries of creates, because it requires a stored-response table, request hashing, and retention rules that no current use case justifies. Duplicate-sensitive operations are protected by database constraints and by state-transition semantics instead.
- These operations are idempotent by contract: Logout, attaching an already-attached Label (`PUT`), detaching an absent Label (`DELETE`), marking a read Notification read, deleting an already-deleted Comment, and any `PATCH` that results in a no-op.
- `POST` creates are not idempotent. A client that times out on a create must list or read before retrying.
- External email delivery is at-least-once through the Outbox; exactly-once is never promised.

## 12. Security-related HTTP behavior

Defined in [Security](../security.md); summarized here because it affects every response:

- CORS uses an explicit origin allowlist per environment, no wildcard, and no credentialed CORS (Bearer, not cookies). Allowed request headers: `Authorization`, `Content-Type`, `X-Request-Id`. Exposed response headers: `X-Request-Id`, `Retry-After`, `RateLimit`, `RateLimit-Policy`, `Location`.
- Helmet provides baseline security headers. HSTS is sent only on HTTPS deployments.
- Rate limiting returns `429 RATE_LIMIT_EXCEEDED` with `Retry-After` and IETF `RateLimit` headers.

## 13. Logging and sensitive data

- Never log passwords, raw tokens, the `Authorization` header, `DATABASE_URL`, encryption keys, or full request bodies.
- Redaction is configured once in the logger, not remembered per call site.
- One structured log line per request includes `requestId`, method, route, status, duration, and, when known, `userId` and `organizationId`.

## 14. Change control

Changing a rule here changes every endpoint: update this document, the [API Contract](contract.md), the OpenAPI source, and the affected tests in the same pull request. Do not introduce a per-module envelope, pagination format, authentication mechanism, or error format.
