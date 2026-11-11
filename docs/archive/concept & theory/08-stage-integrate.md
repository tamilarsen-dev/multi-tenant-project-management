# Stage 08 --- Integrate

  -----------------------------------------------------------------------
  Field                               Value
  ----------------------------------- -----------------------------------
  Project                             Multi-Tenant Project Management API

  Workflow Stage                      08 --- Integrate

  Document Type                       Stage Overview and Preparation Plan

  Version                             1.0

  Status                              Conceptual Preparation

  Related Stages                      04 --- Plan, 05 --- Implement, 06
                                      --- Verify, 07 --- Review, 09 ---
                                      Deploy
  -----------------------------------------------------------------------

## 1. Purpose

Stage 08 --- Integrate ensures that independently developed changes can
be combined into a coherent, compatible, and testable codebase.

A change may work correctly on its own branch and still fail when
combined with other changes. Integration exposes problems caused by
conflicting assumptions, incompatible interfaces, overlapping database
changes, dependency differences, configuration drift, or incomplete
coordination.

Integration is therefore more than running `git merge`. It includes
source-control coordination, compatibility checks, automated validation,
conflict resolution, and confirmation that the combined system still
behaves as expected.

**Important:** This document prepares the project for Stage 08. It does
not claim that future product feature branches have been integrated.
Stage 05 remains deliberately deferred while the remaining workflow
stages are studied.

## 2. Position in the Workflow

  -----------------------------------------------------------------------
  Stage                               Main question
  ----------------------------------- -----------------------------------
  Implement                           Has the change been built?

  Verify                              Does the change satisfy its
                                      specified behavior?

  Review                              Is the change technically
                                      acceptable?

  Integrate                           Can the change coexist safely with
                                      the rest of the codebase?

  Deploy                              Can the integrated version be
                                      released to its target environment?
  -----------------------------------------------------------------------

The stages may overlap in practice. Continuous integration runs
automated checks throughout development, while integration as a workflow
stage also includes the deliberate act of bringing changes together and
resolving incompatibilities.

## 3. What Is Being Integrated?

Integration can occur at several levels.

### 3.1 Source-code integration

Combining changes from branches into a shared branch, usually through a
pull request and merge.

Potential problems: - Conflicting edits to the same files. - Changes
based on outdated interfaces. - Incompatible assumptions across
modules. - Accidentally omitted files or generated artifacts.

### 3.2 Module and component integration

Connecting independently implemented modules through their defined
interfaces.

Examples: - Route handlers with application services. - Application
services with repositories. - Authentication middleware with session
persistence. - Domain logic with database operations. - Activity
creation with business transactions.

The objective is to verify that modules interact through clear contracts
rather than hidden assumptions.

### 3.3 Database integration

Combining schema and migration changes from different features.

Potential problems: - Conflicting migration histories. - Incompatible
schema assumptions. - Foreign-key dependencies. - Unique constraints
that conflict with new behavior. - Application code deployed before or
after an incompatible schema change.

Database integration requires special care because a migration can
affect existing data and other application versions.

### 3.4 API and contract integration

Ensuring that independently developed endpoints and consumers agree
on: - Routes and HTTP methods. - Request and response schemas. -
Authentication requirements. - Error formats and status codes. -
Pagination and filtering semantics. - Versioning and compatibility
expectations.

A frontend or another service may depend on a contract even when the
backend implementation changes internally.

### 3.5 Infrastructure and configuration integration

Ensuring that application code, environment variables, Docker
configuration, CI workflows, and external dependencies work together.

Examples: - Required environment variables are documented and
available. - Prisma Client generation matches the schema. - Docker
Compose services expose the expected network and ports. - CI uses the
intended Node.js and pnpm versions. - Test and production configurations
do not rely on accidental local state.

## 4. Integration Strategies

### 4.1 Continuous Integration

Continuous Integration (CI) is the practice of integrating changes
frequently into a shared codebase and validating them automatically.

A typical CI pipeline: 1. Checks out the proposed change. 2. Installs
dependencies deterministically. 3. Generates required code. 4. Runs lint
and static checks. 5. Runs type checking and build. 6. Executes
automated tests. 7. Reports whether the change passed the configured
checks.

The project's current GitHub Actions workflow already provides a
foundation for these checks.

CI reduces the time between introducing an incompatibility and
discovering it. It does not guarantee that all integration problems are
detected.

### 4.2 Trunk-Based Development

Trunk-based development keeps changes close to a shared mainline branch.
Developers integrate small changes frequently, often using short-lived
branches.

Advantages: - Smaller integration batches. - Less long-lived
divergence. - Faster feedback. - Lower risk of large merge conflicts.

Trade-offs: - Requires reliable automated checks. - Requires
disciplined, small changes. - Incomplete features may need feature flags
or carefully scoped commits.

### 4.3 Feature Branch Workflow

A feature branch isolates a change until it is ready for review and
integration.

Advantages: - Work can be developed independently. - Pull requests
provide a review boundary. - Incomplete work does not immediately enter
the shared branch.

Trade-offs: - Long-lived branches drift from the main branch. - Large
merges are harder to understand. - Conflicts can accumulate.

The project can use short-lived feature branches with pull requests
while keeping the integration frequency high.

### 4.4 Merge and Rebase

Both merge and rebase can synchronize work, but they produce different
commit histories.

-   **Merge** combines histories and creates a merge commit when needed.
    It preserves the fact that branches diverged and came together.
-   **Rebase** replays commits on top of another base, producing a more
    linear history but rewriting commit identities.

Neither is universally superior. The team should use a consistent policy
and avoid rebasing shared branches in ways that rewrite history other
people depend on.

## 5. Integration Workflow

A practical pull-request integration workflow:

1.  **Synchronize.** Update the feature branch against the current
    target branch.
2.  **Resolve conflicts.** Understand conflicting changes and reconcile
    intent, not merely remove conflict markers.
3.  **Validate locally.** Run relevant lint, typecheck, build, and
    tests.
4.  **Open or update the PR.** Explain scope, related requirements,
    migrations, and risks.
5.  **Run CI.** Confirm the combined branch passes required automated
    checks.
6.  **Review.** Resolve blocking review findings and obtain required
    approval.
7.  **Integrate.** Merge using the repository's chosen strategy.
8.  **Validate the target branch.** Confirm the resulting shared branch
    remains healthy.
9.  **Record follow-up work.** Track known limitations or integration
    debt explicitly.

A successful merge is not sufficient evidence that the integrated system
is correct. The target branch must remain buildable and testable.

## 6. Integration Risks and Controls

  -----------------------------------------------------------------------
  Risk                    Example                 Control
  ----------------------- ----------------------- -----------------------
  Merge conflict          Two branches modify the Small changes, frequent
                          same service            synchronization,
                                                  semantic conflict
                                                  resolution

  Interface mismatch      Caller expects a        Explicit contracts,
                          different service or    type checking,
                          API signature           integration tests

  Schema conflict         Two changes introduce   Migration review and
                          incompatible migrations coordinated schema
                                                  ownership

  Dependency drift        Different branches      Lockfile discipline and
                          update incompatible     reproducible
                          packages                installation

  Configuration drift     Code requires an        Centralized
                          undocumented            configuration
                          environment variable    validation and updated
                                                  examples

  Hidden shared-state     Tests pass individually Isolated tests and
  assumptions             but fail together       controlled integration
                                                  tests

  Regression              New change breaks       Automated regression
                          existing behavior       suite

  Incomplete integration  New module is merged    PR checklist and
                          without required wiring end-to-end workflow
                                                  checks
  -----------------------------------------------------------------------

## 7. Database Migration Integration

Database migrations deserve explicit treatment because they change
persistent state.

For this project: - Schema changes should be represented by versioned
Prisma migrations. - Migration history should be committed with the
related code. - CI should validate the schema and migration workflow at
an appropriate level. - Production deployment should use
`prisma migrate deploy`, not development migration commands. - Migration
ordering and dependencies should be reviewed before integration. -
Destructive changes should be planned carefully, especially when old and
new application versions may run concurrently.

For changes that cannot be applied atomically with an application
release, consider an expand-and-contract approach:

1.  **Expand:** add a backward-compatible schema structure.
2.  **Migrate:** deploy code that can work with the old and new
    representations, then backfill data if needed.
3.  **Switch:** move reads and writes to the new representation.
4.  **Contract:** remove the old structure only after it is no longer
    used.

This strategy is not necessary for every migration. It is useful when
schema and application compatibility must be maintained across a
rollout.

## 8. Integration Testing

Integration testing checks whether connected components work together.

Examples for this project: - Express route → authentication middleware →
application service → PostgreSQL. - Application service → Prisma
transaction → Activity record. - Membership revocation → Issue
unassignment → persisted state. - Invitation creation → Invitation
record → transactional outbox. - Session token → hash lookup → expiry
and revocation checks.

Integration tests should exercise real boundaries where practical.
Mocking every dependency can hide the exact incompatibilities
integration testing is intended to discover.

The test environment should be controlled and isolated so tests do not
depend on local developer data or interfere with one another.

## 9. Continuous Integration vs Continuous Delivery vs Continuous Deployment

These terms are related but distinct.

-   **Continuous Integration (CI):** changes are integrated frequently
    and validated automatically.
-   **Continuous Delivery (CD):** the system is kept in a releasable
    state; production release may require a human decision.
-   **Continuous Deployment:** every change that passes the required
    pipeline is automatically released to production.

The project currently has a CI workflow. That does not mean it already
has Continuous Delivery or Continuous Deployment.

The distinction matters because deployment introduces additional
concerns: environments, secrets, migrations, rollout strategy, health
checks, rollback or roll-forward, and operational readiness.

## 10. Entry and Exit Criteria

### Entry criteria

A change is ready for integration when: - Its scope and target branch
are clear. - Required implementation files and migrations are
included. - Relevant verification has been performed. - Required review
has been completed. - CI checks meet the repository's merge policy. -
Known incompatibilities and dependencies are documented.

### Exit criteria

Integration is complete when: - The change is merged through the agreed
workflow. - The target branch passes required automated checks. -
Relevant interfaces and migrations are compatible. - No unresolved merge
conflicts or accidental omissions remain. - The integrated state is
reproducible from the committed source and lockfile. - Follow-up
integration risks are recorded.

These criteria describe the project's intended policy. They do not imply
that every feature must use the same number of branches or PRs.

## 11. Project-Specific Integration Policy to Establish

Before implementation scales, the project should decide and document:

-   Main branch naming and protection rules.
-   Feature branch naming convention.
-   Whether merge commits, squash merges, or rebase merges are
    preferred.
-   Required PR approvals.
-   Required CI checks before merge.
-   Migration review expectations.
-   How generated Prisma Client code is handled.
-   How environment-variable changes are communicated.
-   How urgent fixes are integrated.
-   Whether feature flags are needed for incomplete functionality.

These decisions should remain lightweight for a solo portfolio project.
The goal is reproducibility and safe change management, not recreating
the bureaucracy of a large enterprise.

## 12. Preparation Checklist for Future Stage 08 Execution

-   [ ] Define the branch and merge strategy.
-   [ ] Define PR requirements and merge protections.
-   [ ] Keep feature branches short-lived where practical.
-   [ ] Require CI checks before merging.
-   [ ] Integrate schema and migration changes with their dependent
    code.
-   [ ] Review API and module contracts across feature boundaries.
-   [ ] Test critical component interactions against PostgreSQL.
-   [ ] Confirm the target branch remains buildable and testable.
-   [ ] Document integration exceptions and follow-up risks.
-   [ ] Ensure the integrated source can be reproduced from the lockfile
    and documented configuration.

## 13. Key Principles

1.  Integration is more than resolving Git conflicts.
2.  A change that works independently may fail when combined with other
    changes.
3.  Frequent, small integrations reduce divergence and shorten feedback
    loops.
4.  Contracts between modules, APIs, and database schemas must remain
    compatible.
5.  Database migrations are part of the integrated change, not an
    unrelated afterthought.
6.  CI automates repeatable checks but cannot guarantee the absence of
    integration defects.
7.  CI, Continuous Delivery, and Continuous Deployment are distinct
    practices.
8.  The shared branch should remain buildable, testable, and
    reproducible.

------------------------------------------------------------------------

**Document status:** Conceptual preparation. Stage 08 integration
activities will be executed when implementation changes exist after
Stage 05 --- Implement begins.
