# Repository Readiness Audit — API

**Version:** 1.0  
**Date:** 2026-11-09  
**Status:** Recorded findings; remediation deferred  
**Scope:** `apps/api` archive (`api.zip`)  
**Related plan:** Phase 0.4 Implementation Plan V1.1  
**Architecture authority:** ADR-001 and `architecture.md`

---

## 1. Purpose

This document records the repository readiness findings from the static review of the supplied API archive. It is an audit record, not an implementation report.

The user has chosen to defer the fixes and continue with the next planned work. The findings below must remain visible as known technical debt and be revisited before the relevant implementation work is considered complete.

No code changes are made by this document.

## 2. Audit scope and limitations

The supplied archive contains the API project. It does not provide the complete monorepo root.

Therefore, the audit can assess visible API source files and their structure, but cannot fully verify:
- pnpm workspace configuration at repository root;
- root-level package scripts and workspace orchestration;
- `pnpm-lock.yaml` consistency;
- `apps/web` integration;
- GitHub Actions workflows and CI execution;
- root TypeScript configuration and shared tooling;
- actual runtime behavior in the user's environment.

This was a static source review. Findings about runtime success, clean migration execution, and CI behavior remain unverified unless supported by explicit test or command output.

## 3. Executive summary

The API already contains meaningful implementation foundations, particularly around authentication, Organization membership, request validation, error handling, logging, and PostgreSQL integration tests.

However, the implementation is not yet fully aligned with ADR-001. The most important architectural gap is the persistence boundary: Application services and repository code are coupled directly to Prisma.

The current implementation should be treated as an existing starting point, not as proof that the architecture baseline has been fully implemented.

### 3.1 Readiness matrix

| Plan item | Area | Audit status | Summary |
|---|---|---|---|
| FND-01 | Architecture conventions | Partial | Module structure exists, but the four architectural layers are not consistently separated. |
| FND-02 | Application errors | Mostly ready | `AppError` and centralized error handling exist. |
| FND-03 | Request validation | Partial | Zod and validation middleware exist; the generic middleware reviewed validates `req.body` only. |
| FND-04 | Prisma boundary | Needs refactor | Application services and repositories access or depend directly on Prisma. |
| FND-05 | PostgreSQL test workflow | Partial / unverified | Test database guard and PostgreSQL integration tests exist; clean migration verification is not established by the archive alone. |
| FND-06 | Factories and fixtures | Partial | Test app helpers exist, but test data setup is frequently manual. |
| FND-07 | OpenAPI and CI | Unverified | API documentation middleware is present; root OpenAPI source and CI workflow were not included. |
| FND-08 | Request ID and logging | Partial | Pino/request logging exists; request ID is not included in the reviewed error response. |

Status meanings:
- **Mostly ready:** the core capability is present; verify edge cases and final acceptance criteria.
- **Partial:** some implementation exists, but the plan's acceptance criteria are not fully demonstrated.
- **Needs refactor:** visible implementation conflicts with the accepted architecture or needs structural correction.
- **Unverified:** required evidence was not available in the supplied archive.

---

## 4. Detailed findings

### FND-01 — Architecture conventions

**Status:** Partial

The API is already organized by business module, including Identity and Organization. This is a useful starting point.

The reviewed structure includes files such as:
- `auth.controller.ts`
- `auth.service.ts`
- `user.repository.ts`
- `session.repository.ts`
- `organization.controller.ts`
- `organization.service.ts`
- `organization.repository.ts`

The current organization is module-oriented, but the Presentation, Application, Domain, and Infrastructure boundaries are not consistently explicit. In particular, service files combine application orchestration with direct persistence dependencies.

**Required follow-up**
- Establish the layer conventions defined by ADR-001.
- Make module ownership and cross-module dependencies explicit.
- Keep HTTP concerns in Presentation.
- Keep use-case orchestration in Application.
- Keep business rules independent of Express and Prisma in Domain.
- Keep Prisma adapters and database access in Infrastructure.
- Avoid broad file moves that do not improve actual dependency direction.

**Acceptance reminder**
- Domain imports neither Express nor Prisma.
- Presentation does not access Prisma directly.
- Application depends on Domain and application ports, not concrete infrastructure implementations.
- Infrastructure implements the required ports.
- No circular module dependencies are introduced.

### FND-02 — Application error model and HTTP error envelope

**Status:** Mostly ready

The API contains an `AppError` abstraction and centralized error handling.

**Required follow-up**
- Verify stable error codes and HTTP mappings for validation, authentication, authorization, not-found, conflict, rate limiting, and unexpected failures.
- Verify production responses do not expose stack traces or internal details.
- Ensure tests assert both HTTP status and response envelope.

### FND-03 — Shared request validation

**Status:** Partial

Zod and validation middleware are present. The generic middleware reviewed validates the request body, but does not demonstrate a shared convention for route parameters and query parameters.

**Required follow-up**
- Establish consistent validation for `params`, `query`, and `body`.
- Keep transport validation distinct from business invariants.
- Ensure validation failures use the common error envelope.
- Do not treat request validation as a replacement for authorization or domain validation.

### FND-04 — Prisma client lifecycle and persistence boundary

**Status:** Needs refactor

The reviewed `organization.service.ts` imports the Prisma client directly and coordinates a Prisma transaction. Repository code also depends on Prisma client types.

This creates a direct dependency from application-level code toward a concrete persistence implementation. That conflicts with ADR-001's intended dependency direction.

**Required follow-up**
- Keep Prisma access inside Infrastructure.
- Define an application-facing transaction coordination mechanism appropriate to the use cases.
- Keep Prisma transaction/client types out of Domain.
- Let Application coordinate atomic workflows without depending on concrete Prisma implementation details.
- Keep the composition root responsible for wiring adapters.
- Verify deterministic Prisma lifecycle and shutdown behavior in application and test environments.

**Priority:** High. Address before expanding the number of use cases that depend on this pattern.

### FND-05 — Database migration and test database workflow

**Status:** Partial / unverified

A test database guard was found. It checks that the database name is `project_management_test` before allowing the relevant test setup to proceed. PostgreSQL integration tests are also present.

The archive alone does not establish that the full migration chain has been executed successfully from an empty database or that the workflow is enforced in CI.

**Required follow-up**
- Run all migrations against a clean PostgreSQL database.
- Verify the documented migration command and environment configuration.
- Verify repeated test runs do not depend on leftover state.
- Ensure CI fails when migration execution fails.
- Keep integration tests on PostgreSQL rather than substituting SQLite for PostgreSQL behavior.

### FND-06 — Test factories and request helpers

**Status:** Partial

Test application helpers and authenticated request support are present. However, test data setup appears frequently manual.

**Required follow-up**
- Introduce small, explicit factories/fixtures for common entities.
- Reuse authenticated request helpers.
- Keep test setup readable and avoid opaque global state.
- Ensure factories do not bypass the database constraints being tested.

### FND-07 — OpenAPI contract and CI validation

**Status:** Unverified

API documentation middleware is present in the API source. The root OpenAPI document/source of truth and GitHub Actions workflows were not available in the supplied archive.

**Required follow-up**
- Inspect the complete monorepo.
- Identify the authoritative OpenAPI source.
- Verify the documentation matches implemented request, response, and error contracts.
- Add or verify workspace-compatible OpenAPI validation in CI.
- Ensure invalid API documentation fails CI.

### FND-08 — Request ID, structured logging, and safe context

**Status:** Partial

Pino and request logging are present. The reviewed request logger makes a request ID available to the server-side logging path. The reviewed error response does not include that request ID.

**Required follow-up**
- Include request ID in structured logs and error responses.
- Validate any client-provided request ID according to the chosen policy.
- Redact passwords, session tokens, invitation tokens, and sensitive payloads.
- Verify unexpected errors do not expose sensitive internal details.

---

## 5. Existing foundations to preserve

The following capabilities were observed in the API archive and should be retained unless later testing reveals defects:

- Argon2 password hashing.
- Session token hashing rather than storing raw session tokens.
- Seven-day session lifetime.
- Registration creates User and Session within one transaction.
- Duplicate email handling through uniqueness/error mapping.
- Authentication middleware checks active sessions.
- Organization Membership roles include OWNER, ADMIN, and MEMBER.
- Organization creation transactionally creates the Organization and Owner Membership.
- Centralized error handling.
- Zod validation.
- Pino structured logging and redaction configuration.
- Rate limiting, CORS, and security headers.
- PostgreSQL integration tests using Vitest and Supertest.
- Tests covering important authentication failure/rollback paths.

These observations do not imply that every associated acceptance criterion has passed.

---

## 6. Known domain alignment gap

The current Organization creation implementation was observed to create:
1. Organization;
2. OWNER Membership.

The accepted project baseline additionally requires the initial Activity record to be created atomically with Organization and Owner Membership.

**Required follow-up**
- Ensure the minimum Activity schema is available before implementing or accepting the Organization creation use case.
- Create Organization, Owner Membership, and required Activity in one transaction.
- Add an integration test proving all three commit or all three roll back.

This aligns with the migration sequencing in Phase 0.4 Implementation Plan V1.1.

---

## 7. Deferred remediation register

The following items are recorded for later correction. Deferral does not mean they are considered resolved.

| ID | Item | Priority | Suggested timing |
|---|---|---|---|
| AUD-01 | Align module structure and dependencies with ADR-001 | High | Before expanding feature implementation |
| AUD-02 | Remove direct Prisma dependency from Application and Domain | High | Before adding more use cases |
| AUD-03 | Define transaction coordination and Prisma adapter boundary | High | Alongside AUD-02 |
| AUD-04 | Add Activity creation to Organization creation transaction | High | Before accepting the Organization vertical slice |
| AUD-05 | Extend validation convention to params/query/body | Medium | During Foundation hardening |
| AUD-06 | Include request ID in error responses | Medium | During Foundation hardening |
| AUD-07 | Verify clean PostgreSQL migration workflow | High | Before relying on migration readiness |
| AUD-08 | Improve reusable test factories/fixtures | Medium | Incrementally as test duplication appears |
| AUD-09 | Verify OpenAPI source and CI validation | Medium | After root monorepo audit |
| AUD-10 | Verify root workspace scripts, lockfile, CI, and web integration | High | When complete repository is available |

### Deferral rule

When a deferred item becomes relevant to the feature being implemented, it must be resolved before that feature is marked complete. Do not let a deferred architectural issue silently become a permanent convention.

---

## 8. Next audit required: monorepo root

The next repository-level verification requires the complete project root, excluding generated or sensitive files.

Expected relevant structure:

```text
project-root/
├── apps/
│   ├── api/
│   └── web/
├── docs/
├── package.json
├── pnpm-workspace.yaml
├── pnpm-lock.yaml
├── tsconfig.json
└── .github/
    └── workflows/
```

Do not include:
- `node_modules/`
- `.git/`
- `.env` files or real credentials
- build output or caches unless specifically requested

The root audit must verify:
- pnpm workspace membership;
- root and API package scripts;
- dependency and lockfile consistency;
- TypeScript configuration inheritance;
- CI workflow coverage;
- OpenAPI validation integration;
- API/web workspace integration where applicable.

---

## 9. Relationship to implementation plan

This audit supplements Phase 0.4 Implementation Plan V1.1. It does not replace the plan or modify the accepted product/domain/database specifications.

The implementation sequence remains:

1. Complete or defer foundation remediation deliberately.
2. Verify PostgreSQL migration and test workflow.
3. Implement and verify Register.
4. Implement and verify Login/session behavior.
5. Implement and verify Create Organization, including OWNER Membership and Activity atomically.
6. Verify the complete first vertical slice before proceeding to Membership and Invitation.

The user has explicitly chosen to defer the listed fixes for now and continue with subsequent work. Preserve this record so the findings can be revisited without repeating the audit.

---

## 10. Audit conclusion

The supplied API archive contains a meaningful implementation foundation, but it is not yet fully aligned with ADR-001. The highest-risk issue is direct Prisma coupling across the intended architecture boundary. The Organization creation flow also needs the required Activity write.

The root monorepo and CI remain unverified because they were not included in the archive.

**Final status:** Findings recorded. Remediation deferred. Do not describe the API as fully architecture-compliant or the complete monorepo as audited.
