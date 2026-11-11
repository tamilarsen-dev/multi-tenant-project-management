# 0008. Transactional Outbox for invitation email

- Status: Accepted
- Date: 2026-11-09

## Context

Creating or resending an Invitation must send an email containing a secret token. An email provider cannot take part in a PostgreSQL transaction. Sending inside the transaction blocks it on network I/O and can send an email for an Invitation that then rolls back; sending after commit can lose the email if the process crashes in between.

## Decision

1. The Invitation change and an `outbox_events` row are inserted in the **same transaction**. Nothing is sent during the request.
2. A worker process claims pending rows in a short transaction with `FOR UPDATE SKIP LOCKED`, records a lease, commits, then calls the provider outside any transaction.
3. Results are written back only if the worker still owns the lease, so a slow or crashed worker cannot overwrite a newer result. Expired leases are reclaimed.
4. Delivery is **at least once**. Retry policy: up to eight attempts; exponential backoff from 1 minute capped at 60 minutes with ±20% jitter; retry network errors, timeouts, HTTP 408, 429, and 5xx; other 4xx fail immediately. Terminal failures are not reset; the user resends.
5. The raw token is stored in the payload only encrypted (AES-256-GCM, key outside the database, key version recorded). Resend increments the Invitation's `token_version`; an event for an older version is marked `SUPERSEDED` and never sent.
6. Terminal rows are redacted and deleted after 30 days.

Full mechanics: [Database §5.13](../design/database.md#513-outbox_events).

## Alternatives considered

- **Send inside the request.** Simple, but a provider outage makes Invitation creation fail or hang, and a rollback after sending cannot unsend. Rejected.
- **Message broker or Redis queue.** Standard at scale, but adds infrastructure and still needs an outbox to publish atomically with the database change. Rejected for V1.
- **Store the raw token in plaintext in the outbox.** Simpler worker, but a database leak would expose usable invitation tokens. Rejected.

## Consequences

- A worker process must run alongside the API (same codebase, separate command).
- Duplicate emails are possible; each contains the currently valid token, so a duplicate is harmless.
- Requires an encryption key in the environment and a documented rotation procedure.
- Resend quotas are counted from outbox rows, which is why terminal rows are retained for 30 days.
