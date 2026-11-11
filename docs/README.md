# Documentation

Documentation for the **Multi-Tenant Project Management** platform: a Jira/Linear-style backend where Organizations are isolated tenants, Users can belong to several Organizations with a different role in each, and work is tracked as Projects and Issues with full history.

Start with the [PRD](product/prd.md) for the why, then [Architecture](design/architecture.md) for the how. The [Roadmap](plan/roadmap.md) says what exists today.

## Map

```text
docs/
├── README.md                 you are here
├── product/
│   ├── prd.md                why the product exists, who it serves, what V1 includes
│   └── requirements.md       testable functional and non-functional requirements (FR-*, BR-*, NFR-*)
├── design/
│   ├── architecture.md       code organization, layers, allowed dependencies
│   ├── domain-model.md       entities, lifecycles, invariants, event and notification catalogs
│   ├── database.md           PostgreSQL schema, constraints, indexes, transactions, locking
│   ├── permissions.md        who may do what, per role
│   ├── security.md           threat model and security controls
│   └── api/
│       ├── conventions.md    rules shared by every endpoint
│       ├── errors.md         every error code
│       └── contract.md       every endpoint
├── adr/                      architecture decision records (why things are the way they are)
├── engineering/
│   ├── testing.md            test levels, mandatory suites, definition of done
│   ├── workflow.md           branches, commits, PRs, CI, code conventions, releases
│   └── operations.md         deployment, health, observability, backups, runbooks
├── plan/
│   └── roadmap.md            milestones, current status, open decisions
└── ui/                       web client design system
```

The OpenAPI description of the **implemented** endpoints lives with the code in `apps/api/docs/openapi/` and is served at `/docs`.

## Authority map

Each kind of decision has exactly one owning document. Other documents may summarize it and link to it, but never redefine it.

| Question | Owner |
|---|---|
| Is this in V1 scope? Why? | [PRD](product/prd.md) |
| What exactly must the system do? | [Requirements](product/requirements.md) |
| What does this entity mean, what states can it be in, what must always be true? | [Domain Model](design/domain-model.md) |
| Which Activity event types and Notification types exist? | [Domain Model §6](design/domain-model.md#62-activity) |
| Who may perform this action? | [Permissions](design/permissions.md) |
| How is it stored, constrained, locked? | [Database](design/database.md) |
| How is the code organized? | [Architecture](design/architecture.md) |
| What is the HTTP behavior shared by all endpoints? Field length limits? | [API Conventions](design/api/conventions.md) |
| What error codes exist? | [Errors](design/api/errors.md) |
| What does this endpoint accept and return? | [API Contract](design/api/contract.md) |
| What security controls apply? | [Security](design/security.md) |
| Why was this structural choice made? | [ADRs](adr/README.md) |
| How is it tested, merged, released, operated? | [Engineering](engineering/) |
| What is built, what is next, what is undecided? | [Roadmap](plan/roadmap.md) |
| What is actually implemented? | The code, migrations, and tests |

When two documents disagree, the owner wins and the other is corrected in the same change. Never resolve a conflict by picking the most recently edited file.

## Conventions for these documents

- **English**, plain and direct. Domain terms are capitalized when they name an entity (Organization, Membership, Issue).
- **No versions in file names.** Git is the version history. Each document starts with a small table: Status, Owner, Last updated.
- **Status values:** `Active` for maintained documents; ADRs use `Proposed`, `Accepted`, `Superseded by NNNN`.
- **Requirement keywords** MUST, SHOULD, MAY have their RFC 2119 meaning where used.
- **Specifications describe intent, the roadmap records progress.** A design document never claims something is implemented; the roadmap never redefines behavior.
- **Link, don't copy.** Reference another document's section with a relative link instead of restating it.
- **Diagrams** are Mermaid or plain-text blocks in Markdown so they are diffable and render on GitHub.

## Changing the documentation

1. Change behavior and its owning document in the **same pull request** as the code (or before it, for design-first work).
2. A consequential structural decision gets an ADR ([when to write one](adr/README.md#when-to-write-one)).
3. A new open question goes into the [Roadmap register](plan/roadmap.md#open-decisions), not into scattered "TBD" notes.
4. Delete superseded content. Git history keeps it; the working tree should contain only what is true now.

## Change log

### 2026-11-11 — M1 implementation

- Database: `memberships_user_status_idx` replaces the partial active-user index; session cleanup partial indexes deferred to the cleanup job.
- Conventions §9: the no-op check runs before the version check.
- Security §4: the per-email auth limiter is deferred to M6.
- Roadmap: M1 tasks done; current-state table rewritten.

### 2026-11-11 — Consolidation

The documentation previously existed in three generations (an archive of stage-by-stage planning documents, six bundled decision records, and a newer set of versioned specifications plus audit reports), was excluded from Git by `.gitignore`, and contained contradictions. This change:

- Tracks all documentation in Git (the pre-consolidation snapshot is commit `419f9e6` on branch `docs/consolidate`).
- Merges the three generations into the structure above, in English, without version numbers in file names.
- Splits the six bundled decision records into nine single-decision ADRs and moves process content into `engineering/`.
- Replaces audit reports with the "Current state" table in the Roadmap; the remaining gaps are M1 tasks.

Contradictions resolved:

| Topic | Before | Now |
|---|---|---|
| Session lifetime | "Fixed 7 days, no sliding", yet refresh could extend a session forever | 7-day sessions inside a 30-day absolute lifetime ([ADR-0003](adr/0003-opaque-bearer-session-tokens.md)) |
| Enum representation | Spec said `VARCHAR` + `CHECK`; code used native enums | Native enums for all closed sets ([ADR-0005](adr/0005-postgresql-native-enums.md)) |
| Notifications | Contract had `USER_MENTIONED`, status-change and invitation-accepted notifications; Requirements had different recipients | Four types matching BR-NOTIF ([Domain Model §6.3](design/domain-model.md#63-notification)) |
| Activity event names | Domain and contract used different names (`ISSUE_LABEL_ADDED` vs `ISSUE_LABEL_ATTACHED`, `ISSUE_ASSIGNED` vs `ISSUE_ASSIGNEE_CHANGED`) | One canonical catalog in the Domain Model |
| Request ID | Audit wanted it in the error body; conventions said it is not public | `X-Request-Id` response header ([ADR-0002](adr/0002-json-error-envelope.md)) |
| Membership key | Audit called the composite primary key a defect | The spec's design stands: composite PK plus a unique `id`; only lifecycle columns are missing |
| Persistence architecture | Audit demanded full ports and adapters | Repositories plus one transaction helper ([ADR-0009](adr/0009-pragmatic-persistence-boundary.md)) |
| `/auth/me` | Implemented, missing from the contract | In the contract |
| Mark notification unread | Required, no endpoint | `PATCH /notifications/{id}/unread` |
| Issue search | Required, no query parameter | `q` on List Issues |
| `DELETE` with JSON body | Membership removal and Comment delete sent `version` in a body | `version` as a query parameter |
| Login enumeration | Dummy verification existed only in the archived security baseline | Restored in the contract and [Security §3](design/security.md#3-authentication-abuse) |
| Activity table in the first migration | Spec required a foreign key to `issues`, which does not exist yet | FK added by the Issues migration |
| Rate-limit algorithm | Token bucket required, fixed window implemented | Either is acceptable; thresholds come from measurement |
| Comment body limit | 5,000 in the archived baseline, 10,000 in the contract | 10,000, defined once in [Conventions §7.1](design/api/conventions.md#71-field-limits) |

### 2026-11-11 — Open decisions closed

- OD-20 browser token storage → Next.js backend-for-frontend with an `HttpOnly` cookie ([ADR-0010](adr/0010-web-client-session-via-bff.md)).
- OD-15 performance workload → profile in [Operations §6](engineering/operations.md#6-performance-and-capacity).
- OD-16 backup → 7 daily + 4 weekly, RPO 24 h, RTO 4 h after the first restore drill ([Operations §8](engineering/operations.md#8-backup-and-recovery)).
- OD-21 hosting → selection criteria fixed; provider chosen at M6.
- OD-22 email → Mailpit for development and tests; production provider chosen at the end of M2.
