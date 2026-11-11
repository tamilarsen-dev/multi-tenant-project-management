# Cross-Document Consistency Review

## Multi-Tenant Project Management SaaS

| Field | Value |
|---|---|
| Review date | 2026-11-09 |
| Review version | 1.1 |
| Result | PASS for V1 planning baseline |
| PRD | V1.2 |
| Requirements Specification | V1.2 |
| Domain Map | V1.2 |
| Permissions Specification | V1.1 |
| Database Specification | V1.3 |

## 1. Verdict

The five-document baseline is internally consistent for V1 planning after closing the four follow-ups from Review V1.0.

No unresolved contradiction was found across product scope, functional behavior, domain lifecycle, role authorization, persistence constraints, retention, retry behavior, and the seven settled design decisions.

This is a design consistency review. It does not prove that code, SQL migrations, PostgreSQL constraints, background workers, cleanup jobs, or deployment settings have been implemented or verified.

## 2. Four follow-ups closed

### F-01 — Domain Map readiness checklist

**Closed.** The Domain Map now marks these decisions as complete:
- Comment deletion erases the body and retains a metadata-only tombstone indefinitely in V1.
- Invitation delivery has eight total attempts, bounded exponential backoff with jitter, and terminal failure handling.

The checklist still leaves physical database constraints/concurrency and API contracts unchecked because those are owned by their respective specifications and require implementation verification. This is intentional.

### F-02 — Label restore collision

**Closed.** Requirements, Domain Map, and Database Specification now agree:
- An archived Label can be restored only if no other active Label in the same Organization has the same normalized name.
- A collision rejects restoration.
- The Label remains archived.
- Existing Issue-Label associations are unchanged.

The Database Specification's partial unique index remains the persistence-level integrity defense.

### F-03 — Invitation resend quota counting

**Closed.** A resend counts toward the five-per-rolling-24-hour quota only when the transaction that rotates the token and creates the Outbox event commits successfully.
- Email provider delivery outcome does not affect quota counting.
- Requests rejected by cooldown/rate limiting do not consume quota.
- Rejected requests do not rotate the token or enqueue an Outbox event.
- The initial invitation delivery event (`token_version = 1`) is excluded from the resend count.
- The Database Specification uses Outbox records with `invitation_token_version > 1` and `created_at` inside the rolling window; terminal Outbox records are retained for 30 days, longer than the 24-hour counting window.
- A supporting partial index was added for the rolling-window lookup.

### F-04 — Notification read/unread retention

**Closed.** Requirements, Domain Map, and Database Specification now agree:
- Read: purge 180 days after the current `read_at`.
- Unread: purge 365 days after `created_at`.
- Marking unread clears `read_at`.
- A later unread-to-read transition sets a new `read_at` and establishes a new 180-day deadline.
- Repeated read requests while already read are idempotent and do not reset the timestamp.
- Cleanup evaluates current state and deadline at deletion time; the delete predicate must be atomic against concurrent read-state transitions.

## 3. Seven-decision consistency matrix

| Decision | Requirements V1.2 | Domain Map V1.2 | Permissions V1.1 | Database V1.3 | Result |
|---|---|---|---|---|---|
| Issue priority | LOW, MEDIUM, HIGH, URGENT; default MEDIUM | Same | All active roles may change priority | Column default and CHECK constraint match | Consistent |
| Label lifecycle | Normalization, active-name uniqueness, archive/restore, collision behavior | Same domain lifecycle | All active roles may manage Labels | Partial unique index; restore collision rejected | Consistent |
| Outbox retry/failure | Eight total attempts; retryable classes; bounded exponential backoff; terminal FAILED | Same high-level policy | Not an authorization concern | Worker state machine, lease recovery, retry schedule | Consistent |
| Comment deletion/retention | Erase body; retain metadata tombstone indefinitely in V1 | Same; readiness checklist corrected | Tombstone presentation and role rules | `body = NULL`, `deleted_at`, no automatic purge | Consistent |
| Notification retention | Current read state determines deadline | Same, including read/unread transitions | Recipient-scoped read-state control | Matching cleanup rules and indexes | Consistent |
| Connection pool/timeouts | References Database Specification | Technical configuration delegated | Not applicable | Single-instance initial baseline: pool limit 10 and bounded timeouts | Consistent |
| Invitation resend | 60-second cooldown; five successful resends per rolling 24h; rejected requests do not count | Same | Owner/Admin authorization unchanged | Outbox-based quota count and atomic Invitation lock | Consistent |

## 4. Product scope and authorization cross-check

The following high-impact rules remain aligned:
- Organization is the tenant boundary; a User may hold different roles in different Organizations.
- Roles are OWNER, ADMIN, and MEMBER; there is no GUEST role in V1.
- Every Organization must retain at least one active Owner, including under concurrent role/removal operations.
- All active roles may create/read Projects; only Owner/Admin may update, archive, or restore Projects.
- All active roles may participate in Issue management, including archive/restore, subject to parent Project and Issue state constraints.
- An Issue assignee must be an active Membership in the same Organization.
- Removing a Membership revokes access and atomically unassigns its Issues while preserving historical attribution.
- Comment authors may manage their own Comments; Owner/Admin may manage other members' Comments.
- A removed User may read their final membership-removal Notification without regaining Organization access.
- Organization deletion/archiving, custom workflows, microservices, Kubernetes, multi-region, and multi-instance high availability remain outside V1.

PRD remains V1.2. The detailed decisions refine implementation behavior and do not change the PRD's product goals or V1 scope.

## 5. Operational and remaining open decisions

The Database Specification defines an initial single-instance baseline:
- One application instance.
- PostgreSQL pool limit: 10 connections.
- Pool acquisition timeout: 5 seconds.
- PostgreSQL `statement_timeout`: 15 seconds.
- PostgreSQL `lock_timeout`: 3 seconds.
- PostgreSQL `idle_in_transaction_session_timeout`: 10 seconds.
- Interactive transaction `maxWait`: 5 seconds.
- Interactive transaction `timeout`: 10 seconds.
- HTTP request timeout: 30 seconds.

These are initial defaults, not capacity guarantees. The connection budget must include migrations, monitoring, and administrative access and must be revisited after load testing.

Two decisions remain open and are not blockers to this design baseline:
- OD-15: representative performance workload and benchmark profile.
- OD-16: backup retention, RPO, and RTO.

They must be resolved before claiming performance targets or operational recovery objectives have been validated.

## 6. Authority map

- PRD V1.2 owns product goals, target users, V1 scope, and non-goals.
- Requirements V1.2 owns functional behavior, business rules, NFRs, and acceptance criteria.
- Domain Map V1.2 owns entities, relationships, lifecycle, and domain invariants.
- Permissions V1.1 owns role/action authorization and resource-state access rules.
- Database Specification V1.3 owns physical persistence, constraints, indexes, transactions, concurrency, retention implementation, and database operational defaults.

If a later implementation detail conflicts with one of these authorities, resolve the conflict in the owning document and update dependent specifications and tests. Do not silently let implementation become a second source of truth.

## 7. Implementation gate

**The design baseline is ready for implementation planning.**

Before production implementation, still require:
- PostgreSQL-backed tests for tenant composite foreign keys and uniqueness constraints.
- Concurrency tests for last Owner, Membership removal vs assignment, Invitation resend/accept/revoke, Session refresh, and Issue number allocation.
- Tests for Outbox lease recovery, retry classification, stale token-version suppression, and terminal failure.
- Tests for Comment tombstones and Notification retention transitions.
- Migration-from-empty-database verification.
- Load testing and connection-budget review.
- Backup/restore exercise once OD-16 is decided.

No Prisma schema or migration is created by this review.
