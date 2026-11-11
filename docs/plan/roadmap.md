# Roadmap

| Field | Value |
|---|---|
| Status | Active |
| Owner | T. Tamil Arsen |
| Last updated | 2026-11-11 |

The order of work, the status of each capability, and the register of open decisions. This is the only document that records implementation progress.

Status values: **Planned** (not started) · **In progress** · **Implemented** (code merged) · **Verified** (code merged and the tests required by [Testing §5](../engineering/testing.md#5-definition-of-done-for-tests-in-a-slice) pass in CI). "Implemented" never implies "Verified".

---

## 1. Delivery strategy

Work proceeds in **vertical slices**: each slice delivers schema, domain rules, service, endpoints, OpenAPI, and tests for one capability, and leaves `main` releasable. Shared abstractions are extracted when a second slice needs them, not in advance.

| Milestone | Scope | Exit condition |
|---|---|---|
| **M1 — Identity & Organization** | Foundation alignment, auth with refresh, Organization CRUD | Register → login → refresh → create/list/read/update Organization verified end-to-end against PostgreSQL |
| M2 — Membership & Invitation | Roster, role changes, removal, invitations, Outbox worker | Invite → accept/reactivate → remove, with last-Owner and concurrency tests green |
| M3 — Projects | Project lifecycle | Archive/restore and tenant tests green |
| M4 — Issues & Labels | Issues, numbering, assignment, status, labels | Concurrency (numbering, OCC, assign-vs-remove) tests green |
| M5 — Collaboration | Comments, Activity feed, Notifications, retention | Notification recipient rules and retention tests green |
| M6 — Hardening & release | Security review, DB roles, deployment, backups, load test | Release checklist complete with evidence |

## 2. Current state (2026-11-11)

Observed from the repository at commit `642244b`.

| Capability | Requirement | Status | Gap to the specification |
|---|---|---|---|
| Register | FR-AUTH-001 | Implemented | Response shape (`sessionToken` instead of `session`), generic error code `CONFLICT`, no `absoluteExpiresAt` |
| Login | FR-AUTH-002 | Implemented | Generic error code, no dummy verification for unknown email (timing leak) |
| Current user (`/auth/me`) | FR-AUTH-003 | Implemented | Not yet in OpenAPI |
| Logout | FR-AUTH-004 | Implemented | Error code naming |
| Session validation | FR-AUTH-005 | Implemented | `MISSING_AUTHENTICATION` vs `INVALID_SESSION` not distinguished; no `WWW-Authenticate` |
| Session refresh | FR-AUTH-006 | Planned | Endpoint missing |
| Create Organization | FR-ORG-001 | Implemented | No Activity in the transaction; response lacks `membership` |
| List / get / update Organization | FR-ORG-002..004 | Planned | — |
| Membership model | FR-MEM-001 | Implemented | Missing `id`, `status`, `version`, `joined_at`, `removed_at`; FKs use `CASCADE` instead of `RESTRICT` |
| Error catalog | — | Implemented | Generic codes; must follow [Errors](../design/api/errors.md) |
| Request validation | — | Implemented | Body only; params and query not validated; schemas not strict |
| Persistence boundary | ADR-0009 | Implemented | Services import `prisma` directly |
| OpenAPI | — | Implemented | Partial; not validated in CI |
| CI | — | Implemented | Lint, typecheck, build, test, migrations; no OpenAPI check |
| Everything in M2–M6 | — | Planned | — |

## 3. M1 — Identity & Organization (next)

Tasks are ordered; each is one PR. Requirement and decision references show why the task exists.

| # | Task | Refs | Status |
|---|---|---|---|
| 1.1 | **Persistence boundary:** add `src/db/client.ts` and `runInTransaction`; move Prisma usage out of services; repositories take `db` and translate expected DB errors | ADR-0009 | Planned |
| 1.2 | **HTTP foundation:** typed error catalog with the M1 codes; error handler emitting catalog codes, `WWW-Authenticate`, `415`, `ROUTE_NOT_FOUND`; `X-Request-Id` header; `validate({ params, query, body })` with strict schemas; pagination helper (cursor encode/decode, `totalCount`) | ADR-0002, ADR-0004, Conventions §6–§8 | Planned |
| 1.3 | **Schema migration:** native enums; `memberships` gains `id`, `status`, `version`, `joined_at`, `removed_at`, unique `(organization_id, id)`; `organizations.version`; `sessions.absolute_expires_at` (backfilled as `created_at + 30 days`); `activities` table (no Issue FK yet); FKs to `RESTRICT`; `users.email` to `VARCHAR(254)`; length `CHECK`s | Database §4.7, §5.1–§5.4, §5.11; ADR-0005 | Planned |
| 1.4 | **Auth alignment:** response shape `{ user, session }`; specific error codes; dummy Argon2 verification; absolute expiry on login/register | FR-AUTH-001..005, Contract §3, ADR-0003 | Planned |
| 1.5 | **Session refresh:** atomic rotation with inherited absolute expiry; reuse logging | FR-AUTH-006, BR-AUTH-007..008 | Planned |
| 1.6 | **Create Organization with Activity:** Organization + OWNER Membership + `ORGANIZATION_CREATED` in one transaction; response `{ organization, membership }`; `Location` header | FR-ORG-001, Contract §4.1 | Planned |
| 1.7 | **List and get Organization:** ACTIVE-Membership scoping, cursor pagination, `404` masking | FR-ORG-002..003, Contract §4.2–§4.3 | Planned |
| 1.8 | **Update Organization:** OWNER/ADMIN, OCC, no-op semantics, `ORGANIZATION_UPDATED` | FR-ORG-004, Contract §4.4 | Planned |
| 1.9 | **Health:** add `/readyz` | Operations §4 | Planned |
| 1.10 | **OpenAPI and CI:** document every M1 endpoint and error; add bundle + lint step to CI | Workflow §4 | Planned |
| 1.11 | **Test suites for M1:** tenant isolation (§4.1), role matrix for Organization update (§4.2), refresh concurrency (§4.3), rollback tests (§4.4), workflow 1 (§4.5) | Testing §4–§5 | Planned |

Out of scope for M1: Membership endpoints, invitations, Outbox worker, projects, issues, the web client, session cleanup job, database role separation.

## 4. Later milestones

Task lists are refined when the milestone starts; IDs are stable.

**M2 — Membership & Invitation:** MEM-01 list Memberships · MEM-02 change role (Organization lock, last-Owner) · MEM-03 remove/leave (unassign + Notification) · MEM-04 concurrency tests · INV-01 create Invitation (advisory lock, partial unique index) · INV-02 Outbox table + encrypted payload · INV-03 worker claim/lease/retry · INV-04 resend (cooldown, quota, token versioning) · INV-05 accept (create or reactivate) · INV-06 revoke · INV-07 lifecycle and concurrency tests · INV-08 email provider adapter.

**M3 — Projects:** PRJ-01 create · PRJ-02 list · PRJ-03 get · PRJ-04 update · PRJ-05 archive · PRJ-06 restore · PRJ-07 tenant and role tests.

**M4 — Issues & Labels:** ISS-01 create with atomic numbering · ISS-02 list with filters and `q` · ISS-03 get · ISS-04 update fields · ISS-05 assign (Membership lock) · ISS-06 status transitions · ISS-07 archive/restore · ISS-08 concurrency tests · LAB-01 create/rename with normalization · LAB-02 archive/restore with collision rule · LAB-03 attach/detach · LAB-04 tests.

**M5 — Collaboration:** COL-01 comments create/list · COL-02 edit · COL-03 tombstone delete · COL-04 Activity feed · COL-05 Notification creation per recipient rules · COL-06 list/read/unread/read-all · COL-07 retention cleanup job · COL-08 tests.

**M6 — Hardening & release:** REL-01 security review against [Security](../design/security.md) · REL-02 full tenant-isolation pass · REL-03 database roles (`app_runtime`, `app_migrator`) and Activity append-only grants · REL-04 load test and baseline · REL-05 backup and restore drill · REL-06 Docker images and Compose for production · REL-07 deployment pipeline · REL-08 runbooks · REL-09 smoke tests · REL-10 release notes and `v1.0.0`.

## Open decisions

The single register of decisions not yet made. When one is decided, record it in the owning document (or an ADR) and delete the row.

| ID | Decision | Blocks | Owner document |
|---|---|---|---|
| OD-15 | Performance workload profile (dataset size, concurrency, environment) | Claiming PRD latency targets | [Operations §6](../engineering/operations.md#6-performance-and-capacity) |
| OD-16 | Backup retention, RPO, RTO | Production release (REL-05) | [Operations §8](../engineering/operations.md#8-backup-and-recovery) |
| OD-20 | Browser token storage for `apps/web` (in-memory vs. backend-for-frontend with `HttpOnly` cookie) | Web login | [Security §5](../design/security.md#5-sessions) |
| OD-21 | Hosting provider for the VPS | REL-06 | [Operations §1](../engineering/operations.md#1-hosting) |
| OD-22 | Transactional email provider | INV-08 | [Operations §2](../engineering/operations.md#2-configuration) |

## Risks

| Risk | Control |
|---|---|
| Tenant data leak | Scoped repositories, composite FKs, mandatory isolation suite |
| Scope larger than one developer can finish | Milestones are independently releasable; M2–M5 can be cut or reordered without breaking M1 |
| Documentation drifting from code | Docs change in the same PR as behavior; OpenAPI validated in CI; this roadmap is the only status record |
| Race conditions | Locking protocols in [ADR-0007](../adr/0007-concurrency-control.md), each with a concurrency test |
| Unverified operational claims | Nothing is called production-ready without a restore drill and a load-test baseline |
