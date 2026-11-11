# Error Catalog

| Field | Value |
|---|---|
| Status | Active |
| Owner | T. Tamil Arsen |
| Last updated | 2026-11-11 |

Every error code the API can return. The envelope is defined in [API Conventions §6](conventions.md#6-error-responses); which endpoint returns which code is in the [API Contract](contract.md).

Rules:

- A code is specific enough that a client can act on it without reading `message`. Two conditions that require different client behavior get different codes, even if they share an HTTP status.
- Codes are `SCREAMING_SNAKE_CASE`. Resource-specific codes follow `<RESOURCE>_<CONDITION>` (`PROJECT_NOT_FOUND`, `ISSUE_ARCHIVED`).
- Once released, a code's name and HTTP status never change. A new condition gets a new code.
- The implementation keeps all codes in one typed catalog (`apps/api/src/http/errors.ts`), so an unknown code fails type-checking.

## 1. Request and transport errors

| Code | HTTP | When | `details` |
|---|---:|---|---|
| `INVALID_JSON` | 400 | Body is not parseable JSON | none |
| `VALIDATION_ERROR` | 400 | Params, query, or body fail schema validation (wrong type, missing field, out-of-range length or number, unknown field, malformed cursor) | `{ "fields": [ { "path": ["email"], "code": "invalid_format", "message": "Invalid email address" } ] }` |
| `ROUTE_NOT_FOUND` | 404 | No route matches the method and path | none |
| `PAYLOAD_TOO_LARGE` | 413 | Body exceeds 1 MB | none |
| `UNSUPPORTED_MEDIA_TYPE` | 415 | Body sent without `Content-Type: application/json` | none |
| `RATE_LIMIT_EXCEEDED` | 429 | Global, IP, or endpoint rate limit reached; `Retry-After` header set | none |
| `INTERNAL_SERVER_ERROR` | 500 | Any unexpected failure; the cause is only in the server log, correlated by `X-Request-Id` | none |

`VALIDATION_ERROR` field entries: `path` is the location as an array of keys and indexes (`["items", 0, "name"]`); `code` is the validator's issue code (`invalid_type`, `too_small`, `too_big`, `invalid_format`, `invalid_value`, `unrecognized_keys`, `custom`); `message` is human-readable. Parameters from the path or query are reported with a first path element of `"params"` or `"query"`.

## 2. Authentication and authorization

| Code | HTTP | When | `details` |
|---|---:|---|---|
| `MISSING_AUTHENTICATION` | 401 | No `Authorization` header, or not in `Bearer <token>` form | none |
| `INVALID_SESSION` | 401 | Token unknown, expired, revoked, or already rotated | none |
| `INVALID_CREDENTIALS` | 401 | Login email or password wrong (deliberately indistinguishable) | none |
| `FORBIDDEN` | 403 | Actor has an ACTIVE Membership and can see the resource, but the role does not allow the action | none |
| `INVITATION_EMAIL_MISMATCH` | 403 | Accepting an Invitation addressed to a different email | none |

All `401` responses include `WWW-Authenticate: Bearer`.

## 3. Not found

All of these also cover "exists, but outside the actor's visibility" ([Conventions §6.2](conventions.md#62-tenant-visibility)).

| Code | HTTP | When |
|---|---:|---|
| `ORGANIZATION_NOT_FOUND` | 404 | Organization missing, or actor has no ACTIVE Membership in it |
| `MEMBERSHIP_NOT_FOUND` | 404 | Membership missing, in another Organization, REMOVED where only ACTIVE is visible, or used as an assignee reference that does not resolve |
| `INVITATION_NOT_FOUND` | 404 | Invitation missing, in another Organization, or token does not match |
| `PROJECT_NOT_FOUND` | 404 | Project missing or in another Organization |
| `ISSUE_NOT_FOUND` | 404 | Issue missing or not in the Project in the path |
| `LABEL_NOT_FOUND` | 404 | Label missing or in another Organization |
| `COMMENT_NOT_FOUND` | 404 | Comment missing or not on the Issue in the path |
| `NOTIFICATION_NOT_FOUND` | 404 | Notification missing or addressed to another User |

## 4. Conflicts (`409`)

Retrying after refreshing state may succeed.

| Code | When | `details` |
|---|---|---|
| `EMAIL_ALREADY_EXISTS` | Registering an email that is already used | none |
| `VERSION_CONFLICT` | Supplied `version` is stale | `{ "currentVersion": 5 }` |
| `LAST_OWNER_REQUIRED` | The change would leave the Organization without an ACTIVE OWNER | none |
| `ALREADY_ORGANIZATION_MEMBER` | Inviting an email whose User already has an ACTIVE Membership | none |
| `PENDING_INVITATION_EXISTS` | A PENDING, unexpired Invitation already exists for that email | `{ "invitationId": "uuid" }` |
| `INVITATION_NOT_PENDING` | Invitation is ACCEPTED, REVOKED, or EXPIRED | `{ "status": "REVOKED" }` |
| `INVITATION_EXPIRED` | Accepting an Invitation past `expiresAt` | none |
| `MEMBERSHIP_ALREADY_ACTIVE` | Accepting an Invitation while already an ACTIVE member | none |
| `PROJECT_ARCHIVED` | Mutating a Project, or anything inside it, while it is archived | none |
| `ISSUE_ARCHIVED` | Mutating an archived Issue or its children | none |
| `LABEL_ARCHIVED` | Renaming or newly attaching an archived Label | none |
| `LABEL_NAME_ALREADY_EXISTS` | Another active Label in the Organization has the same normalized name | none |
| `COMMENT_DELETED` | Editing a deleted Comment | none |

## 5. Domain rule violations (`422`)

The request is well-formed but can never succeed as written.

| Code | When | `details` |
|---|---|---|
| `INVALID_STATUS_TRANSITION` | The transition is not in the Issue status matrix | `{ "from": "TODO", "to": "DONE", "allowed": ["IN_PROGRESS", "CANCELLED"] }` |
| `ASSIGNEE_NOT_ACTIVE` | Assignee Membership exists in the Organization but is REMOVED | none |

## 6. Throttling (`429`)

| Code | When | `details` |
|---|---|---|
| `RESEND_COOLDOWN` | Resend within 60 seconds of the previous successful resend | `{ "retryAfterSeconds": 42 }` |
| `RESEND_LIMIT_REACHED` | Five successful resends in the last 24 hours | `{ "retryAfterSeconds": 3600 }` |

Both also set the `Retry-After` header.

## 7. Mapping database errors

Expected database outcomes are translated into catalog codes in the repository or service layer, never surfaced as `500`:

| Database outcome | Code |
|---|---|
| Unique violation on `users_email_unique` | `EMAIL_ALREADY_EXISTS` |
| Unique violation on `invitations_one_pending_per_org_email` | `PENDING_INVITATION_EXISTS` |
| Unique violation on `labels_active_name_unique` | `LABEL_NAME_ALREADY_EXISTS` |
| Conditional `UPDATE … WHERE version = $n` affects 0 rows and the row still exists in scope | `VERSION_CONFLICT` |
| Conditional session revoke affects 0 rows | `INVALID_SESSION` |

Constraint names in the [Database design](../database.md) are part of this mapping, so renaming a constraint requires updating the mapper and its test.
