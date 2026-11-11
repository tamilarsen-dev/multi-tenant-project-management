# Operations

| Field | Value |
|---|---|
| Status | Active (target state; nothing here is deployed yet) |
| Owner | T. Tamil Arsen |
| Last updated | 2026-11-11 |

How V1 is run: hosting, configuration, deployment, health, observability, backup, and runbooks. These are requirements for the release-hardening phase; the [Roadmap](../plan/roadmap.md) tracks which exist.

---

## 1. Hosting

- One VPS running Docker Compose with three containers: `api`, `worker` (same image, different command), and `postgres`.
- PostgreSQL is reachable only on the internal Docker network and stores data on a persistent volume.
- HTTPS terminates at a reverse proxy on the VPS before any public use. When the proxy is added, Express `trust proxy` is set to it ([Security §4](../design/security.md#4-rate-limiting-and-input-limits)).
- Single point of failure is an accepted V1 limitation. Kubernetes, autoscaling, and multiple API instances are out of scope.
- The hosting provider is not chosen yet.

## 2. Configuration

- Environments: `development`, `test`, `production`. A staging environment is added when there is a deployed production to protect.
- Configuration is read once in `src/config/env.ts` and validated with Zod at startup; a missing required value stops the process with a clear message.
- Secrets are injected by the deployment environment, never baked into images or committed. `.env` files are for local use only.
- Development, test, and production use different credentials.

| Variable | Purpose |
|---|---|
| `NODE_ENV` | `development` / `test` / `production` |
| `PORT` | HTTP port |
| `DATABASE_URL` | PostgreSQL connection string (secret) |
| `CORS_ORIGINS` | Comma-separated allowed origins |
| `OUTBOX_ENCRYPTION_KEY` | Base64 256-bit key for invitation token payloads (secret; added with the Invitation slice) |
| `EMAIL_PROVIDER_API_KEY` | Email provider credential (secret; added with the Invitation slice) |

## 3. Deployment and migrations

V1 uses recreate deployment with one API instance and accepts brief downtime.

```text
CI green on main → build image once (tag = version, recorded digest)
→ back up database (if the release contains a risky migration)
→ prisma migrate deploy (one-off container, migrator credentials)
→ stop old api/worker → start new api/worker → readiness check → smoke test
```

- Migrations run as a separate step before the new version starts, never automatically on every API boot.
- A failed migration stops the deployment.
- Migrations are forward-only. Risky changes use expand → migrate → contract so the previous application version still works against the new schema.
- Application rollback = start the previous image. It does not undo migrations; data recovery after a destructive change relies on backup restore, which is why destructive changes require a backup first.
- `prisma migrate dev` and `prisma db push` are never used against production.

## 4. Health checks

| Endpoint | Checks | Used by |
|---|---|---|
| `GET /healthz` | Process is up; no dependencies | Container liveness |
| `GET /readyz` | Can run `SELECT 1` against PostgreSQL within 1 second | Deployment gate, monitoring |

Both are unauthenticated, return `{ "data": { "status": "ok" } }` or `503` with `{ "data": { "status": "unavailable" } }`, and never reveal versions, hostnames, or error details.

## 5. Observability

- **Logs:** Pino JSON to stdout, one line per request (`requestId`, method, route, status, duration, `userId`, `organizationId`), redaction configured centrally ([Security §8](../design/security.md#8-secrets-and-dependencies)). The container runtime collects stdout.
- **Metrics (target):** request rate, error rate, latency p50/p95/p99 per route, CPU, memory, disk, DB connection usage, slow queries, Outbox backlog and terminal failures.
- **Alerts (target):** readiness failing, disk above threshold, backup job failed, Outbox terminal failures rising. Thresholds are set after a baseline exists.
- Distributed tracing is out of scope for V1.

## 6. Performance and capacity

- Measure first: no optimization without a profile or a query plan showing the bottleneck.
- Latency targets come from the [PRD §8.3](../product/prd.md#83-performance) and are claims only after a documented load test (open decision: workload profile).
- Vertical scaling first. Horizontal scaling requires shared rate-limit state and a new ADR.
- Connection pool and timeouts start from [Database §7.11](../design/database.md#711-single-vps-connection-and-timeout-baseline).

## 7. Runbooks

Each runbook is a short procedure in `docs/runbooks/`, written when the thing it covers is first deployed:

| Runbook | Covers |
|---|---|
| Deploy and roll back | §3 step by step, including how to start the previous image |
| Restore database | Restoring a `pg_dump` into a fresh database and verifying row counts |
| Rotate a secret | `DATABASE_URL` password, email API key, Outbox encryption key (with key versioning) |
| Disk full | Find the cause (logs, WAL, backups), free space, prevent recurrence |
| Outbox stuck | Inspect backlog and expired leases, restart the worker, identify provider errors |
| Compromised credential | Revoke, rotate, review logs, notify if needed |

## 8. Backup and recovery

- Daily logical backup with `pg_dump`, encrypted, stored off the VPS.
- Restore is tested into a separate database on a schedule; an untested backup does not count.
- **Open decision:** retention period, RPO, and RTO. A starting proposal is 7 daily plus 4 weekly backups, RPO 24 hours, RTO 4 hours; it becomes a commitment only after a successful restore drill. WAL archiving and point-in-time recovery are out of scope for V1.

## 9. Incidents

- Severity: **SEV-1** service or database down; **SEV-2** a core function broken for all users (login, create Issue); **SEV-3** limited feature failure; **SEV-4** minor.
- Lifecycle: detect → triage → mitigate → resolve → verify → review. Restore service first, investigate root cause second.
- SEV-1 and SEV-2 get a blameless written review: timeline, impact, cause, fix, and prevention actions.

## 10. Server security

- SSH by key only; password login and direct root login disabled; deployment uses a non-root user.
- Firewall opens only SSH and HTTPS; PostgreSQL is never exposed.
- Containers run as non-root; the Docker socket is never mounted into application containers; images use pinned versions.
- OS and dependency security updates are applied on a regular schedule.
