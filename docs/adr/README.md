# Architecture Decision Records

An ADR records one consequential decision: the context that forced it, what was chosen, what was rejected, and what it costs. ADRs explain **why**; the design documents describe **what**.

## Index

| ADR | Decision | Status |
|---|---|---|
| [0001](0001-monorepo-and-modular-monolith.md) | pnpm monorepo, modular monolith API, pragmatic Clean Architecture | Accepted |
| [0002](0002-json-error-envelope.md) | Custom JSON error envelope with stable codes; request ID in a header | Accepted |
| [0003](0003-opaque-bearer-session-tokens.md) | Opaque Bearer session tokens with rotation and a 30-day absolute lifetime | Accepted |
| [0004](0004-cursor-pagination.md) | Cursor pagination with exact `totalCount` | Accepted |
| [0005](0005-postgresql-native-enums.md) | PostgreSQL native enums for closed value sets | Accepted |
| [0006](0006-tenant-isolation-strategy.md) | Tenant isolation by scoped queries and composite foreign keys, without RLS | Accepted |
| [0007](0007-concurrency-control.md) | Optimistic concurrency with `version` in the body; row locks for multi-row invariants | Accepted |
| [0008](0008-transactional-outbox-for-email.md) | Transactional Outbox for invitation email | Accepted |
| [0009](0009-pragmatic-persistence-boundary.md) | Prisma confined to repositories and one transaction helper | Accepted |
| [0010](0010-web-client-session-via-bff.md) | Web client holds the session through a Next.js backend-for-frontend | Accepted |

## When to write one

Write an ADR when a decision is expensive to reverse or shapes many files: a new dependency category, a data-model convention, a security mechanism, a deployment topology, or a cross-cutting API rule. Routine choices inside one module do not need one.

## Lifecycle

`Proposed` → `Accepted` → (`Superseded by NNNN` | `Deprecated`). An accepted ADR is not edited to change its decision; write a new ADR that supersedes it and update the old one's status line. Fixing typos or adding links is fine.

## Template

```markdown
# NNNN. Title in imperative or noun form

- Status: Proposed | Accepted | Superseded by NNNN
- Date: YYYY-MM-DD

## Context
What problem or force requires a decision? What constraints apply?

## Decision
What we will do, stated so it can be checked in code review.

## Alternatives considered
Each realistic option with why it lost.

## Consequences
What becomes easier, what becomes harder, and what must now be maintained.
```
