# 0003. Opaque Bearer session tokens with rotation and an absolute lifetime

- Status: Accepted
- Date: 2026-11-11 (amends the session decision recorded on 2026-11-09 by adding the absolute lifetime)

## Context

The API needs authentication for browser and non-browser clients, immediate revocation (logout, compromised token), and a way to stay logged in without re-entering a password weekly. The earlier policy said sessions have a "fixed seven-day lifetime, no sliding expiration", but also allowed refresh to issue a new seven-day session from any valid one. Together those rules make a session live forever as long as the client refreshes, which is sliding expiration in practice.

## Decision

1. **Token:** 32 random bytes, sent as `Authorization: Bearer <token>`. The database stores only its SHA-256 hex digest. A fast hash is sufficient because the token has 256 bits of entropy; there is nothing to brute-force.
2. **Lifetime:** each Session expires 7 days after creation. Use never extends it.
3. **Absolute lifetime:** login sets `absolute_expires_at = login time + 30 days`. Refresh copies it to the new Session and sets `expires_at = min(now + 7 days, absolute_expires_at)`. After 30 days the user must log in again.
4. **Refresh:** one transaction conditionally revokes the old Session (`UPDATE … WHERE revoked_at IS NULL AND expires_at > now() RETURNING …`) and inserts the new one, so concurrent refreshes with one token produce exactly one winner.
5. **Reuse:** presenting a rotated token returns `401 INVALID_SESSION` and is logged as a security event. It does not revoke the replacement Session.
6. **Logout** revokes only the current Session.

## Alternatives considered

- **JWT access tokens with refresh tokens.** Verification without a database lookup, which matters for many services; here there is one API and one database, so the lookup is cheap. JWTs cannot be revoked before expiry without a denylist, which reintroduces the lookup. Rejected for V1.
- **HttpOnly session cookie.** Protects the token from JavaScript (XSS), but requires CSRF protection and credentialed CORS, and is awkward for non-browser clients. Rejected as the API mechanism; adopted later for the web client's own session, see [ADR-0010](0010-web-client-session-via-bff.md).
- **Sliding expiration** (extend on every request). Convenient, but a stolen token stays valid indefinitely while used. Rejected.
- **Revoke the whole refresh chain on reuse** (OAuth refresh-token reuse detection). Stronger against stolen refresh tokens, but needs a chain identifier and logs out the legitimate user when a client merely retries a lost response. Deferred; the absolute lifetime already bounds the damage to 30 days.

## Consequences

- `sessions` gains `absolute_expires_at` with `CHECK (expires_at <= absolute_expires_at)`.
- Every authenticated request costs one indexed lookup by token hash.
- A client that loses a refresh response must log in again (no grace window).
- Browser token storage is decided in [ADR-0010](0010-web-client-session-via-bff.md).
