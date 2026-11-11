# Testing Strategy

| Field | Value |
|---|---|
| Status | Active |
| Owner | T. Tamil Arsen |
| Last updated | 2026-11-11 |

Tests exist to produce evidence that behavior and invariants hold. A feature is not done because an endpoint returns `200`; it is done when the tests below would fail if its rules were broken.

---

## 1. Principles

1. Test behavior and invariants, not implementation details.
2. Use real PostgreSQL whenever database behavior is what is being verified. Never mock Prisma to test a constraint, lock, or transaction.
3. After a failed operation, assert the database state, not only the error.
4. Treat tenant isolation and authorization as security properties with their own suites.
5. Test failure paths and concurrent operations explicitly.
6. Keep tests isolated and deterministic: no order dependence, no reliance on wall-clock time, no implicit row order.
7. Coverage percentage is not a goal. No global coverage threshold in V1.

## 2. Levels

| Level | Scope | Tools | Location |
|---|---|---|---|
| Unit | Pure functions: status transitions, permission policy, normalization (email, label names), cursor encoding, error mapping | Vitest | `test/unit/` |
| Integration | Repositories and services against PostgreSQL: constraints, transactions, locks, rollback | Vitest + test database | `test/integration/` |
| API | HTTP through the Express app: routing, middleware, validation, status codes, envelopes, headers, plus resulting DB state | Vitest + Supertest | `test/api/` |
| End-to-end workflow | A critical multi-endpoint flow through the API | Vitest + Supertest | `test/api/workflows/` |

Most tests are unit and API tests. Workflow tests are few and cover the flows in §4.5.

## 3. Environment and data

- **Dedicated database.** Tests run against `project_management_test`. A guard in the test setup refuses any other database name.
- **Migrations, not `db push`.** The suite runs against a database built by `prisma migrate deploy`, so migrations are tested too.
- **Isolation.** A `resetDatabase()` helper truncates all application tables before each test (`TRUNCATE … RESTART IDENTITY CASCADE`). Wrapping each test in a rolled-back transaction is not used, because concurrency tests need several independent connections and committed data. Test files run sequentially (`fileParallelism: false`).
- **Factories.** `test/factories/` provides `createUser`, `createSession` (returns the raw token), `createOrganization` (with OWNER Membership), `createMembership`, and later `createProject`, `createIssue`. Factories insert through repositories or Prisma with valid defaults and accept overrides. Tests do not copy setup blocks between files.
- **Time.** Expiry logic takes a clock (or `now`) parameter; tests use a fixed or fake clock instead of sleeping.
- **Ordering.** Tests never assert on row order unless the query has an explicit `ORDER BY`.

## 4. Mandatory suites

### 4.1 Tenant isolation

Every organization-scoped endpoint gets these cases, using two Organizations A and B with their own users and data:

| Case | Expected |
|---|---|
| A's member reads B's resource by ID | `404` with B's `*_NOT_FOUND` code; no data in body |
| A's member mutates or archives B's resource | `404`; B's row unchanged |
| A's member lists in A | B's rows absent; `totalCount` excludes them |
| Body references a B resource (e.g. assignee Membership from B) | `404` (not `403`, not `422`); nothing written |
| User with a REMOVED Membership in A calls any A endpoint | `404 ORGANIZATION_NOT_FOUND` |
| Nonexistent Organization vs. Organization without Membership | Identical status, body, and headers |

### 4.2 Authorization matrix

Table-driven tests for every action in [Permissions](../design/permissions.md): each of OWNER, ADMIN, MEMBER, for both allowed and denied cases. A denied case asserts `403 FORBIDDEN` **and** that nothing changed. Special rules: last-Owner protection, ADMIN cannot touch OWNER Memberships or promote to OWNER, ADMIN cannot change own role, comment ownership, invitation role limits.

### 4.3 Concurrency

Run competing operations with real parallel requests (`Promise.all`) or separate connections, then assert the final state.

| Scenario | Expected |
|---|---|
| N parallel refreshes with one token | Exactly one `200`; exactly one new active Session |
| Two Owners demote each other simultaneously | One succeeds, one gets `409 LAST_OWNER_REQUIRED`; one OWNER remains |
| N parallel Issue creates in one Project | N distinct consecutive numbers |
| Two updates with the same `version` | One `200`, one `409 VERSION_CONFLICT` |
| Accept and revoke one Invitation simultaneously | Exactly one wins; state is consistent |
| Two parallel accepts | One success, one `409` |
| Assign to a Membership while it is being removed | Final state never has an Issue assigned to a REMOVED Membership |
| Two parallel invitations to one email | One `201`, one `409 PENDING_INVITATION_EXISTS` |

### 4.4 Atomicity and failure

Inject a failure in the middle of a transaction (for example make the Activity insert throw) and assert that nothing from that transaction persisted:

- Register: no User without Session.
- Create Organization: no Organization without OWNER Membership and `ORGANIZATION_CREATED` Activity.
- Create Issue: number counter not incremented, no Issue, no Activity.
- Remove Membership: no REMOVED Membership with Issues still assigned.
- Invitation create: no Invitation without its Outbox row.
- Email provider failure: Invitation remains `PENDING`; Outbox event is retried.

### 4.5 Critical workflows

1. Register → login → create Organization → list and read it.
2. Invite → accept (new user and removed user) → member appears in roster.
3. Create Project → create Issue with assignee → change status → assignee receives Notification only for assignment.
4. Remove member → their Issues are unassigned → removed user can read only the removal Notification.

### 4.6 Security controls

The checks listed in [Security §9](../design/security.md#9-verification).

## 5. Definition of Done for tests in a slice

A slice is not complete until:

- [ ] Every endpoint in the slice has success, validation, and authentication-failure API tests.
- [ ] Every organization-scoped endpoint has the §4.1 cases.
- [ ] Every role rule in the slice has §4.2 cases.
- [ ] Every transaction in the slice has a §4.4 rollback test.
- [ ] Every OCC endpoint and locking protocol in the slice has a §4.3 test.
- [ ] Every error code the slice can return is produced by at least one test.

## 6. In CI

CI starts PostgreSQL 18, applies migrations from an empty database, and runs the whole suite on every pull request ([Workflow §4](workflow.md#4-continuous-integration)). A failing or skipped test blocks merge; tests are never disabled to get a green pipeline. Load testing is separate and happens during hardening ([Operations §6](operations.md#6-performance-and-capacity)).
