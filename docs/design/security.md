# Security

| Field | Value |
|---|---|
| Status | Active |
| Owner | T. Tamil Arsen |
| Last updated | 2026-11-11 |

The security baseline for V1: what is protected, by which control, and how each control is verified. A control listed here is a requirement, not evidence that it exists; evidence is a passing test or a reviewed configuration, tracked in the [Roadmap](../plan/roadmap.md).

Principles: defense in depth, deny by default, enforcement on the server, failures that reveal nothing, bounded input and cost, and thresholds set from evidence rather than guessed.

---

## 1. Threat model summary

| Threat | Primary controls |
|---|---|
| Cross-tenant data access (IDOR) | Tenant-scoped queries, Membership check on every request, composite FKs, `404` masking, tenant-isolation test suite (§7) |
| Credential stuffing and brute force | Argon2id, generic login errors, dummy verification, rate limiting (§2–§4) |
| Account enumeration | Identical response and similar timing for unknown email and wrong password (§3) |
| Session theft or replay | Opaque high-entropy tokens, hashed at rest, fixed and absolute expiry, rotation with reuse detection (§5) |
| Mass assignment | Strict request schemas reject unknown fields ([Conventions §7](api/conventions.md#7-validation-and-limits)) |
| Resource exhaustion | Body limit, field limits, pagination caps, rate limits, DB timeouts (§4, [Database §7.11](database.md#711-single-vps-connection-and-timeout-baseline)) |
| Secret leakage | Secrets only in environment, log redaction, no secrets in images or Git (§8) |
| Stored XSS via user text | Text stored and returned as plain text; the web client renders it as text, never HTML |
| Supply-chain compromise | Committed lockfile, frozen installs, dependency review, build-script allowlist (§8) |

## 2. Passwords

- Hashed with **Argon2id** (library default parameters until a benchmark on the deployment host justifies different ones); a unique salt per hash is handled by the library.
- 12–128 characters, no composition rules, whitespace allowed, never trimmed or normalized.
- Never stored in plaintext, never logged, never returned.
- Verification uses the library's `verify` function; the password is never re-hashed and compared.

## 3. Authentication abuse

- Login with an unknown email and with a wrong password return the same `401 INVALID_CREDENTIALS` body and headers.
- For an unknown email the server verifies the supplied password against a fixed, valid dummy Argon2id hash, so both paths spend comparable time.
- Registration reveals that an email exists (`409 EMAIL_ALREADY_EXISTS`). This is accepted for V1 because the product has no email verification; it is mitigated by rate limiting the endpoint.
- Hard account lockout is not used, because it lets an attacker lock out a victim. Failed logins are throttled per IP and per target email instead (§4).
- Security events (failed login, rotated-token reuse) are logged with timestamp, request ID, source IP, and a hashed account identifier, never the raw credential.

## 4. Rate limiting and input limits

| Scope | Applies to |
|---|---|
| Global per IP | Every request |
| Per IP and per normalized email | `POST /auth/login`, `POST /auth/register` |
| Per Invitation | Resend cooldown and quota (domain rule, not middleware) |

- Algorithm: the library's window counter for V1; a token bucket is acceptable if a library supports it. Thresholds live in configuration, not scattered constants, and are tuned from measurements.
- Store: in-memory, valid only because V1 runs a single API instance. Moving to multiple instances requires a shared store and a new ADR.
- Exceeding a limit returns `429 RATE_LIMIT_EXCEEDED` with `Retry-After` and IETF `RateLimit` headers.
- Without a reverse proxy the limiter uses the socket address. If a proxy is introduced, Express `trust proxy` must be set to exactly that proxy; `X-Forwarded-For` from clients is never trusted.
- Body limit 1 MB at the parser; field limits in [Conventions §7.1](api/conventions.md#71-field-limits); `limit` ≤ 100; sort and filter values come from allowlists.

## 5. Sessions

Decision record: [ADR-0003](../adr/0003-opaque-bearer-session-tokens.md).

- Token: 32 bytes from a CSPRNG, sent as `Authorization: Bearer`. Stored as SHA-256 hex; a fast hash is appropriate because the input has 256 bits of entropy, unlike a password.
- Lifetime: 7 days from creation, never extended by use, and never beyond `absoluteExpiresAt` (30 days after login).
- Refresh rotates atomically; only one concurrent refresh wins; a rotated token is rejected and logged.
- Logout revokes the current Session only.
- Expired and revoked Sessions are rejected by the query itself, never by relying on a cleanup job.
- **Open:** how the web client stores the token. Options are memory plus refresh on reload, or a backend-for-frontend that holds the token server-side and gives the browser an `HttpOnly` cookie. Must be decided before browser login ships ([Roadmap](../plan/roadmap.md#open-decisions)).

## 6. CORS and headers

- CORS: explicit origin allowlist from configuration, no wildcard, no credentials. Allowed methods: those the API uses. Allowed headers: `Authorization`, `Content-Type`, `X-Request-Id`.
- CORS is a browser policy, not access control; every request is still authenticated and authorized.
- Helmet baseline (`nosniff`, frame denial, referrer policy). HSTS only on HTTPS deployments. A Content Security Policy is applied to the HTML API documentation page; it is irrelevant for JSON responses.
- `X-Powered-By` is disabled.

## 7. Tenant and data protection

Decision record: [ADR-0006](../adr/0006-tenant-isolation-strategy.md).

- Order of checks: authenticate → resolve ACTIVE Membership → resolve resource within the Organization → check permission → execute ([Conventions §10](api/conventions.md#10-tenant-scoping-order)).
- Never load a tenant resource by `id` alone and check its Organization afterwards; the Organization is part of the `WHERE` clause of the first query.
- `404` for anything outside the actor's visibility, `403` only for a visible resource with insufficient role.
- Composite foreign keys make cross-tenant references impossible to store even if application code is wrong.
- PostgreSQL Row-Level Security is not used in V1; therefore the tenant-isolation test suite is mandatory ([Testing §4](../engineering/testing.md#4-mandatory-suites)).
- Responses are explicit DTOs; hashes, tokens, and internal columns never appear.

## 8. Secrets and dependencies

- Secrets (`DATABASE_URL`, `POSTGRES_PASSWORD`, email API key, outbox encryption key) come from the environment. `.env` files are git-ignored; `.env.example` holds placeholders only.
- Configuration is validated with Zod at startup; a missing or invalid required value stops the process.
- Pino redacts: `password`, `token`, `accessToken`, `authorization`, `cookie`, `DATABASE_URL`, and nested variants. Full request bodies are never logged.
- `pnpm-lock.yaml` is committed; CI installs with `--frozen-lockfile`; new dependencies are reviewed in the PR; dependency lifecycle scripts run only for the packages allowed in `pnpm-workspace.yaml`.
- `pnpm audit` and GitHub dependency alerts are checked; a critical vulnerability with real exposure blocks release.
- Secret rotation is manual in V1 and documented in [Operations](../engineering/operations.md#7-runbooks).

## 9. Verification

| Control | Test that proves it |
|---|---|
| Password never stored in plaintext | Integration: stored hash ≠ password and verifies with Argon2id |
| Generic login failure | API: unknown email and wrong password produce identical status, body, headers |
| Dummy verification | Unit: the login service calls verify for unknown emails |
| Expired / revoked / rotated session rejected | Integration, one test each |
| Single refresh winner | Concurrency: N parallel refreshes with one token → exactly one `200` |
| Absolute session expiry | Unit with a fake clock: refresh after day 30 fails |
| Strict body schemas | API: unknown field → `400 VALIDATION_ERROR` with `unrecognized_keys` |
| Body limit | API: 1 MB + 1 byte → `413` |
| Tenant isolation | Suite in [Testing §4](../engineering/testing.md#4-mandatory-suites) |
| Log redaction | Unit: logging an object with sensitive keys emits `[REDACTED]` |
| CORS allowlist | API: allowed origin gets the header, other origin does not |
| Security headers | API: expected Helmet headers present; HSTS only in production config |
