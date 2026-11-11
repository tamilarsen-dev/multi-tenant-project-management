# Development Workflow

| Field | Value |
|---|---|
| Status | Active |
| Owner | T. Tamil Arsen |
| Last updated | 2026-11-11 |

How changes move from an idea to `main`: branches, commits, pull requests, CI, code conventions, and releases.

---

## 1. Branching

GitHub Flow with short-lived branches.

- `main` is always releasable and protected: no direct pushes, no force pushes, required CI checks.
- Each task gets a branch from the latest `main`, named `<type>/<short-description>`: `feat/session-refresh`, `fix/login-timing`, `refactor/persistence-boundary`, `docs/error-catalog`, `chore/ci-openapi-lint`, `test/tenant-isolation`.
- No long-lived `develop`, `release`, or `hotfix` branches in V1.

## 2. Commits

[Conventional Commits](https://www.conventionalcommits.org/):

```text
<type>(<scope>): <imperative summary, ≤ 72 chars>

<why the change was needed, when not obvious>
```

- Types: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`, `ci`, `perf`, `build`.
- Scope is the module or area: `auth`, `organization`, `membership`, `db`, `http`, `ci`, `docs`.
- One logical change per commit. Never commit secrets, `.env` files, build output, or generated Prisma client code.
- Messages like `dirty state`, `wip`, or `fix stuff` do not reach `main`; squash merge replaces them with the PR title.

## 3. Pull requests

- Every change reaches `main` through a PR, including solo work. Self-review is acceptable when working alone.
- One PR, one purpose. A PR that mixes a refactor with a feature is split.
- The PR title is a Conventional Commit line; it becomes the squash commit.
- The description answers: **what** changed, **why**, **how it was tested**, **migration or configuration impact**, and **known risks**.
- Merge with **squash merge**; delete the branch afterwards.

Reviewer checklist (applied to your own PRs too):

- [ ] Behavior matches the owning document; if behavior changed, that document changed in the same PR.
- [ ] Tenant scope and authorization are enforced on the server for every new query.
- [ ] New error conditions use catalog codes and appear in OpenAPI.
- [ ] Transactions cover every write that must be atomic; no external I/O inside them.
- [ ] Tests from [Testing §5](testing.md#5-definition-of-done-for-tests-in-a-slice) exist.
- [ ] No secrets, tokens, or passwords in code, logs, or fixtures.
- [ ] Migrations are forward-only and reviewed as SQL.

## 4. Continuous integration

Runs on every PR to `main` and every push to `main`:

```text
checkout → setup pnpm + Node 24 → pnpm install --frozen-lockfile
→ prisma generate → prisma migrate deploy (empty PostgreSQL 18)
→ lint → typecheck → build → test → OpenAPI bundle + lint
```

Rules:

- The lockfile is the source of dependency truth; CI never updates it.
- Caches speed things up but are never the source of truth.
- Every step is a required check. A red pipeline blocks merge.
- OpenAPI is validated in CI so the documentation cannot drift into an invalid state.

## 5. Code conventions

Formatting and linting are enforced by tools; these are the conventions tools cannot fully enforce.

| Topic | Convention |
|---|---|
| Files | `kebab-case` plus role suffix: `issue.service.ts`, `issue.repository.ts` ([Architecture §7.2](../design/architecture.md#72-concrete-layout-and-persistence-boundary)) |
| Variables, functions | `camelCase`; functions start with a verb (`createIssue`, `findActiveMembership`) |
| Booleans | `is` / `has` / `can` prefix |
| Types | `PascalCase`; derive request types from Zod schemas with `z.infer`, never duplicate them |
| Constants | `SCREAMING_SNAKE_CASE` |
| Exports | Named exports only |
| Database | `snake_case` tables (plural) and columns; Prisma models `PascalCase` singular mapped with `@@map`/`@map` |
| Constraint names | `<table>_<columns>_<kind>`, e.g. `projects_org_id_unique`, `issues_project_tenant_fk` (they are referenced by the error mapper) |
| JSON | `camelCase` |
| URLs | Plural nouns, `kebab-case`, IDs as path params: `/organizations/{organizationId}/projects` |
| Environment variables | `SCREAMING_SNAKE_CASE`, read only in `src/config/env.ts` |
| Logging | Pino only; no `console.log` in `src/` |
| Errors | Throw catalog errors; never call `res.status()` outside controllers and the error handler |

## 6. Releases

- [Semantic Versioning](https://semver.org/): `MAJOR.MINOR.PATCH`; `0.x` until V1 scope is complete.
- A release is a Git tag (`v0.3.0`), a GitHub Release with notes, and a Docker image tagged with the version and identified by digest. The mutable `latest` tag is never the deployment identity.
- Release notes sections: Added, Changed, Fixed, Security, Migrations, Breaking changes.
- Application rollback and database rollback are separate operations; see [Operations §3](operations.md#3-deployment-and-migrations).
