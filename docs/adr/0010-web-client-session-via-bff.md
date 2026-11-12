# 0010. Web client holds the session through a backend-for-frontend

- Status: Accepted
- Date: 2026-11-11

## Context

The API authenticates with an opaque Bearer token valid for up to 7 days ([ADR-0003](0003-opaque-bearer-session-tokens.md)). Whoever holds it acts as the user. The web client (`apps/web`, Next.js) must keep the user logged in across page reloads without exposing the token to JavaScript running in the browser, where a single XSS flaw (in our code or an npm dependency) could steal it.

## Decision

1. The browser never sees the API token. The Next.js server is a backend-for-frontend (BFF).
2. Login, register, and refresh go through Next.js route handlers, which call the API, receive the Session, and store the token in a cookie: `HttpOnly; Secure` (production); `SameSite=Lax`; `Path=/`; `Max-Age` equal to the Session's remaining lifetime. A `__Host-` cookie name prefix is used in production.
3. All browser requests for API data go to Next.js (route handlers, server components, server actions). Next.js reads the cookie and calls the API with `Authorization: Bearer <token>`.
4. CSRF protection lives in Next.js: `SameSite=Lax`, plus a check that state-changing requests carry an `Origin` header matching the app's own origin. Server actions get Next.js's built-in origin check.
5. When the API returns `401 INVALID_SESSION`, the BFF tries one refresh; if that fails it clears the cookie and redirects to login. Logout calls the API, then clears the cookie.
6. The API itself is unchanged: Bearer only, no cookies, no credentialed CORS. Non-browser clients keep calling it directly.

## Alternatives considered

- **Token in `localStorage`.** Simplest, but readable by any script on the page; one XSS gives an attacker a portable 7-day credential. Rejected.
- **Token only in memory.** Not readable after the page closes, but lost on every reload, forcing re-login unless a second long-lived credential is introduced. Rejected.
- **API sets the cookie itself.** Removes the proxy hop, but makes the API responsible for cookies, CSRF, and credentialed CORS for every origin. Rejected; keeps the API client-agnostic.

## Consequences

- Every web request has one extra hop (browser → Next.js → API). Acceptable at V1 scale; both run on the same host.
- `apps/web` needs a small API client used only on the server, plus route handlers for auth.
- The web app must be served over HTTPS in production for the `Secure` cookie.
- XSS can still act **as** the user while the page is open (it can call the BFF), but cannot exfiltrate the token for later use. XSS prevention (rendering user text as text) remains required.

## Amendment (2026-11-12, during the M1 web implementation)

Clarifications from building the BFF; the decision itself is unchanged.

- **Item 2:** login and register are Next.js server actions rather than route handlers. Server actions can set cookies and get the built-in origin check required by item 4. The only route handler is `GET /auth/expired` (below), which changes nothing except clearing an already-invalid cookie.
- **Item 5:** refreshing *after* a `401` cannot work: ADR-0003 refuses to refresh an expired or revoked session, which is exactly what `401` means. Refresh is proactive instead: on a full page load, once less than half of the 7-day window remains and the absolute expiry still allows the window to grow, the Next.js proxy rotates the token and passes the new one both to the current request and to the browser. A `401` sends the user to `/auth/expired`, which re-checks the cookie once (a parallel request may have just rotated it) and otherwise clears it and redirects to sign in.
- **Rate limiting:** the BFF forwards the browser's address in `X-Forwarded-For` and the API trusts it only from the BFF (`TRUST_PROXY`); see [Security §4](../design/security.md#4-rate-limiting-and-input-limits), including the remaining gap.
- **Cookie deletion:** a `__Host-` cookie is only deleted when the deleting `Set-Cookie` repeats `Secure` and `Path=/`; the BFF clears cookies by expiring them with their original attributes.

