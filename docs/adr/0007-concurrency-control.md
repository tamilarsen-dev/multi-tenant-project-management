# 0007. Concurrency control

- Status: Accepted
- Date: 2026-11-09

## Context

Several users edit the same Issues; two admins may demote the last two Owners at the same moment; two requests may create Issues in one Project simultaneously; a member may be removed while someone assigns them. Some of these are "lost update" problems for one row; others are invariants across many rows that a single-row check cannot protect.

## Decision

1. **Isolation level:** PostgreSQL `READ COMMITTED` (the default). Correctness comes from explicit mechanisms, not from a global `SERIALIZABLE` level.
2. **Optimistic concurrency (OCC) for user edits:** Organization, Membership, Project, Issue, and Comment have an integer `version`. The client sends the version it read in the request body; the server runs `UPDATE … WHERE id = $1 AND organization_id = $2 AND version = $3`. Zero rows on an existing row → `409 VERSION_CONFLICT`. No automatic retry.
3. **Pessimistic row locks for multi-row invariants:** operations that can change the active-Owner count lock the Organization row first (`SELECT … FOR UPDATE`); assignment and member removal lock the target Membership; invitation accept and revoke lock the Invitation; invitation create and resend use a transaction advisory lock on `(organization_id, email)`.
4. **Atomic counters:** Issue numbers are allocated with `UPDATE projects SET next_issue_number = next_issue_number + 1 … RETURNING`, inside the Issue-creation transaction.
5. **Lock order:** Organization → Invitation (advisory, then row) → Membership → Project → Issue → Label → Comment ([Database §7.2](../design/database.md#72-global-lock-ordering)); rows of one kind are locked in primary-key order.
6. **Database constraints** (unique, composite FK) remain the final guard behind every mechanism above.

## Alternatives considered

- **`ETag` / `If-Match` headers with `412 Precondition Failed`** for OCC. The standard HTTP mechanism, but it requires clients to keep headers next to data, does not fit `DELETE` with a body or list items, and complicates the web client. The version-in-body approach is explicit in the JSON a client already holds. Rejected for V1; `DELETE` carries `version` as a query parameter instead.
- **Global `SERIALIZABLE`.** Detects anomalies automatically but turns them into serialization failures that every transaction must retry, including read-mostly ones. Rejected.
- **`SELECT MAX(number) + 1`** for Issue numbers. Races under concurrency. Rejected.
- **Pre-checks outside the transaction** for the last-Owner rule. Two requests can both pass the check. Rejected.

## Consequences

- Every OCC endpoint and every locking protocol needs a concurrency test using real parallel transactions ([Testing §4](../engineering/testing.md#4-mandatory-suites)).
- Two edits to different fields of the same Issue conflict; this is accepted for V1 simplicity.
- Deadlocks (`40P01`) may be retried a bounded number of times only when the whole transaction is safe to repeat; consistent lock order is the primary defense.
