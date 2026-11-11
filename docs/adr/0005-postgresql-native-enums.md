# 0005. PostgreSQL native enums for closed value sets

- Status: Accepted
- Date: 2026-11-11 (supersedes the earlier "VARCHAR with CHECK constraints" rule)

## Context

The schema has several closed value sets: roles, membership and invitation statuses, issue status and priority, notification types, Activity event types, Outbox states. The earlier database design specified `VARCHAR` columns with `CHECK (… IN (…))`, while the existing migration already used a native enum (`organization_role`) through Prisma. Values must be validated by the database, typed in TypeScript, and identical in the API.

## Decision

1. Every closed value set is a PostgreSQL enum type, declared in `schema.prisma` as a Prisma `enum` with `@@map("snake_case_name")`. The list is in [Database §4.7](../design/database.md#47-enumerated-values).
2. Enum values are uppercase and identical to the strings in the API.
3. A value is added by the migration of the slice that first uses it (`ALTER TYPE … ADD VALUE`). Removing or renaming a value requires a data migration and a new ADR.
4. Subsets are expressed with a `CHECK` on top of the enum (for example invitations: `role <> 'OWNER'`).

## Alternatives considered

- **`VARCHAR` + `CHECK`.** Changing the set is an ordinary constraint swap, and values can be removed easily. But Prisma does not model `CHECK`, so every constraint is hand-written SQL that the Prisma schema cannot see, and TypeScript gets `string` instead of a union type unless types are maintained by hand. Rejected.
- **Lookup tables with foreign keys.** Most flexible, but adds joins and seed data for sets that change only with code. Rejected.
- **Application-only validation.** No database guarantee; a bug or manual SQL can store invalid values. Rejected.

## Consequences

- Prisma generates TypeScript union types, so an invalid value fails type-checking.
- `ORDER BY` uses declaration order, which is useful for `issue_priority` (`LOW < MEDIUM < HIGH < URGENT`) and must be kept in mind when adding values.
- Removing a value is deliberately hard. That matches the domain: statuses and roles are not removed casually, and Activity history must keep old event types readable.
- Adding a value inside a transaction cannot use the value in the same transaction; migrations that add and use a value must be split.
