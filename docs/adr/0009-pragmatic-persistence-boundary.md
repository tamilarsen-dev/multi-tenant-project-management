# 0009. Pragmatic persistence boundary

- Status: Accepted
- Date: 2026-11-11

## Context

[ADR-0001](0001-monorepo-and-modular-monolith.md) requires that business rules do not depend on Prisma. A repository audit found services importing the Prisma client directly and calling `prisma.$transaction`, and proposed full ports-and-adapters: an interface per repository, a unit-of-work abstraction, and a dependency-injection composition root. For a solo V1 with one database and one ORM, that would double the number of files without a second implementation to justify it, while ADR-0001 itself says not to create an interface for every repository.

## Decision

1. Only `src/db/` and `*.repository.ts` files import the Prisma client or generated Prisma types.
2. `src/db/transaction.ts` exports `runInTransaction(fn)` and two types: `Db` (the client or a transaction) and `Tx` (a transaction). Services start transactions only through `runInTransaction`.
3. Services receive `tx` from `runInTransaction` and pass it to repository functions. They treat it as an opaque handle and never call Prisma methods on it.
4. Repository functions take `db: Db` as their last parameter (defaulting to the shared client for reads outside a transaction) and, for organization-scoped tables, a required `organizationId`.
5. Repositories translate expected database outcomes (unique violations, zero-row conditional updates) into application errors from the [error catalog](../design/api/errors.md). Prisma error classes do not escape a repository.
6. Pure domain rules live in `*.rules.ts` and import nothing from other layers.
7. No repository interfaces and no DI container. If a second implementation appears (for example an in-memory email sender for tests), an interface is introduced for that dependency only.

## Alternatives considered

- **Full ports and adapters.** Maximal decoupling and in-memory fakes for every repository. But the behaviors that matter most here (constraints, locks, transactions) can only be tested against PostgreSQL, so in-memory repositories would test the wrong thing. Rejected for V1.
- **Services use Prisma directly.** Fewest files, but persistence details and error classes spread through business code, and tenant filters are easy to forget. Rejected.

## Consequences

- Services depend on the `Tx` type name from `src/db/`, which is a type-only dependency on infrastructure. Accepted as the pragmatic cost.
- Integration tests use real PostgreSQL; unit tests target `*.rules.ts` and pure helpers.
- A lint rule (`no-restricted-imports` for the Prisma client outside `src/db/` and repositories) can enforce item 1 mechanically.
