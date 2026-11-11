# 0006. Tenant isolation by scoped queries and composite foreign keys

- Status: Accepted
- Date: 2026-11-09

## Context

Organizations share one database. Leaking one Organization's data to another is the most serious failure this product can have. Isolation must hold for direct reads, writes, lists, counts, search, and references between rows (an Issue in Organization A must never point at a Project or assignee in Organization B), and it must survive application bugs.

## Decision

Isolation is enforced in three layers:

1. **Request layer:** every organization-scoped request resolves the actor's ACTIVE Membership in the Organization from the path before doing anything else. No Membership → `404 ORGANIZATION_NOT_FOUND`, indistinguishable from a missing Organization.
2. **Query layer:** every repository function for an organization-scoped table requires `organizationId` and includes it in every `WHERE`. Resources are never loaded by `id` alone and checked afterwards.
3. **Schema layer:** tenant-owned tables carry `organization_id`, and references between them are composite foreign keys on `(organization_id, id)` ([Database §3.4](../design/database.md#34-tenant-safe-foreign-keys)), so a cross-tenant reference cannot be stored at all.

Hidden resources return `404`; `403` is reserved for a visible resource and an insufficient role.

## Alternatives considered

- **PostgreSQL Row-Level Security.** Enforces filters even if a query forgets them. But it needs the tenant set on every connection or transaction (`SET LOCAL app.org_id`), interacts badly with connection pooling and Prisma's transaction API, and makes queries harder to debug. Rejected for V1; revisit if the test suite ever catches a missing filter in production code.
- **Schema or database per tenant.** Strong isolation, but migrations multiply per tenant and cross-tenant Users (one User in many Organizations) become awkward. Rejected.
- **Application filtering without composite FKs.** Simpler schema, but a bug can persist an invalid cross-tenant reference that later leaks. Rejected.

## Consequences

- Without RLS, the test suite carries the weight: every organization-scoped endpoint has negative tests with two Organizations ([Testing §4](../engineering/testing.md#4-mandatory-suites)).
- Tables duplicate `organization_id` and need `UNIQUE (organization_id, id)` to be FK targets.
- Composite FKs guarantee same-tenant references, not that a referenced Membership is ACTIVE; that remains an application check under a row lock.
