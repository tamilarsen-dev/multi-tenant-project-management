# 0002. JSON error envelope with stable codes

- Status: Accepted
- Date: 2026-11-09

## Context

Clients need to tell apart conditions that share an HTTP status, for example `409 VERSION_CONFLICT` (re-read and retry) and `409 LAST_OWNER_REQUIRED` (promote someone first). An earlier implementation returned generic codes (`CONFLICT`, `UNAUTHENTICATED`), which forced clients to parse human-readable messages. Responses must also never leak stack traces, SQL, or data from another tenant, and every error must be traceable to a log line.

## Decision

1. Every error response is `{ "error": { "code", "message", "details"? } }`.
2. `code` is specific and stable, defined in one catalog ([Errors](../design/api/errors.md)). Clients branch on `code`; `message` is for humans and may change.
3. `details` has a documented shape per code (field list for validation errors, `currentVersion` for version conflicts, and so on).
4. The request ID travels in the `X-Request-Id` response header (reusing a well-formed client-supplied value) and in the server log, not in the body.
5. Success responses use `{ "data": … }`, plus `pagination` for collections. There is no `success` boolean.

## Alternatives considered

- **RFC 9457 Problem Details** (`type`, `title`, `status`, `detail`, `instance`, `application/problem+json`). A recognized standard, but domain codes and field errors would live in extension members anyway, `status` duplicates the HTTP status, and `type` URIs would need hosting or conventions. The custom envelope is smaller and carries the same information. Rejected for V1; can be adopted in a future API version.
- **Generic codes only** (`CONFLICT`, `NOT_FOUND`). Fewer codes to maintain, but clients cannot act without reading messages. Rejected.
- **Request ID in the body.** Duplicates the header and is missing on responses that have no body (`204`). Rejected.

## Consequences

- Every new failure condition requires a catalog entry, an OpenAPI response, and a test; code review checks this.
- The error handler is the only place that serializes errors; services throw typed application errors carrying a catalog code.
- `Idempotency-Key` support is deferred (see [Conventions §11](../design/api/conventions.md#11-idempotency-and-retries)); if added later it needs its own error codes.
