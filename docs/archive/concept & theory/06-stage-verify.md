# Stage 06 --- Verify

  -----------------------------------------------------------------------
  Field                               Value
  ----------------------------------- -----------------------------------
  Project                             Multi-Tenant Project Management API

  Workflow Stage                      06 --- Verify

  Document Type                       Stage Overview and Preparation Plan

  Version                             1.0

  Status                              Conceptual Preparation

  Related Stages                      02 --- Specify, 03 --- Design, 04
                                      --- Plan, 05 --- Implement, 07 ---
                                      Review
  -----------------------------------------------------------------------

## 1. Purpose

Stage 06 --- Verify establishes how the team will determine whether an
implemented change satisfies its specified requirements and behaves
correctly under its defined conditions.

Verification is not simply running a test suite and checking whether it
turns green. It is a structured activity that connects requirements,
design decisions, implementation, test evidence, and acceptance
criteria.

For this project, verification must provide evidence that the API
behaves correctly, preserves tenant boundaries, enforces authorization,
maintains transactional integrity, and handles failure conditions
predictably.

**Important:** This document prepares the project for Stage 06. It does
not claim that the future product features have been verified.
Implementation has deliberately been deferred while the remaining
workflow stages are studied to establish the full engineering picture.

## 2. Position in the Workflow

Stage 06 follows Stage 05 --- Implement.

-   Stage 05 produces implementation changes.
-   Stage 06 verifies those changes against requirements and expected
    behavior.
-   Stage 07 --- Review evaluates the quality and suitability of the
    changes, including maintainability and design concerns.
-   Stage 08 --- Integrate controls how verified changes are combined
    with the shared codebase.

These stages are related, but they answer different questions:

  -----------------------------------------------------------------------
  Stage                               Main question
  ----------------------------------- -----------------------------------
  Implement                           Has the planned behavior been
                                      built?

  Verify                              Does the implementation satisfy its
                                      specified behavior and constraints?

  Review                              Is the implementation and its
                                      design acceptable?

  Integrate                           Can the change be safely combined
                                      with the rest of the codebase?
  -----------------------------------------------------------------------

Verification can reveal defects that require returning to
implementation. It is therefore an iterative activity, not a one-way
approval ceremony.

## 3. Verification Scope

Verification should cover more than the happy path. The project needs
evidence across several dimensions.

### 3.1 Functional correctness

Confirm that each operation produces the expected result for valid and
invalid inputs.

Examples: - Registration creates an account under the specified
conditions. - Login creates a valid session for authenticated users. -
Organization creation establishes the correct ownership and membership
state. - Project and Issue operations follow their documented business
rules.

### 3.2 Authorization and tenant isolation

Confirm that users can access only the data and operations permitted by
their active organization membership and role.

Examples: - A user from Organization A cannot read or mutate
Organization B's resources. - A user without active membership cannot
access organization-scoped resources. - A Member cannot perform
operations reserved for an Owner or Admin. - A forbidden operation does
not partially mutate data.

Tenant isolation is a critical security property for this system. It
must be tested at API and data-access boundaries, not assumed from
route-level checks alone.

### 3.3 Data integrity and transaction behavior

Confirm that related changes remain consistent, especially when an
operation spans multiple records.

Examples: - Creating an Issue and incrementing its project issue number
behave atomically. - Revoking a Membership and unassigning its Issues
happen atomically. - A business mutation and its Activity record commit
or roll back together. - Concurrent operations do not violate uniqueness
or ownership constraints.

### 3.4 State transitions and lifecycle rules

Confirm that entities move only through allowed states and that archived
resources obey their lifecycle restrictions.

Examples: - Issue status changes follow the documented transition
graph. - An archived Project cannot accept new Issues. - Comments cannot
be created or updated when the Issue or Project is archived. - Restoring
a Project does not automatically restore Issues that were independently
archived.

### 3.5 Error behavior

Confirm that failures are predictable and expose the correct API
contract.

Examples: - Invalid input returns the documented validation response. -
A missing or cross-tenant resource returns the specified not-found
behavior. - An authenticated user lacking permission receives the
specified forbidden behavior. - A stale version produces the documented
conflict response. - Unexpected internal failures do not expose stack
traces, secrets, or implementation details.

### 3.6 Operational and integration behavior

As the system grows, verification should also cover: - Database
connectivity and migration behavior. - Session expiration, rotation, and
revocation. - Email outbox retry behavior. - Logging and request
correlation. - Build, lint, typecheck, and CI workflow behavior.

Not every operational concern belongs in an individual feature test.
Some require integration tests, deployment checks, or operational
validation.

## 4. Verification Levels

Testing can be organized by scope. The levels below describe the
project's intended strategy, not a requirement to create a test for
every possible combination.

### 4.1 Unit tests

Test a small unit of behavior in isolation, usually a pure function or a
component with controlled dependencies.

Useful for: - Issue status transition rules. - Permission decision
functions. - Input normalization. - Expiration and retry calculations. -
Mapping domain errors to API errors.

Unit tests should be fast and deterministic. They are not sufficient
evidence for database constraints, transaction behavior, or actual HTTP
integration.

### 4.2 Integration tests

Test interactions between components or infrastructure boundaries.

Useful for: - Prisma queries against PostgreSQL. - Database constraints
and foreign keys. - Transaction rollback and atomicity. - Session
persistence and revocation. - Concurrent invitation or issue-number
operations. - Transactional outbox behavior.

For this project, PostgreSQL integration tests are particularly
important because several critical invariants are enforced by the
database, not only by application code.

### 4.3 API / HTTP tests

Test the externally observable behavior of an HTTP endpoint, including
routing, middleware, validation, authentication, authorization, response
status, and response body.

The existing foundation uses Vitest and Supertest. These tools can
support API-level tests without requiring a separately deployed server
for every test.

Useful for: - Register and Login flows. - Organization creation. -
Cross-tenant access attempts. - Role-based authorization. - Error
response consistency. - Pagination and filtering contracts.

### 4.4 End-to-end tests

Test a complete user-facing or system workflow across multiple
components.

Potential examples: - Register → Login → Create Organization. - Create
Project → Create Issue → Assign Member. - Invite Member → Accept
Invitation → Access Organization. - Revoke Membership → Confirm access
is denied and assignments are cleared.

End-to-end tests provide broad confidence but are usually slower and
more expensive to diagnose. They should focus on critical workflows
rather than duplicate every unit and integration test.

### 4.5 Static and build-time checks

Not all verification requires executing application behavior.

The CI pipeline already performs: - Dependency installation using the
lockfile. - Prisma Client generation. - Linting. - Type checking. -
Build. - Automated tests.

These checks detect classes of problems early, but a successful build
does not prove that business behavior is correct.

## 5. Test Design Techniques

Test cases should be derived from requirements, domain rules,
constraints, and risks.

Useful techniques include:

### 5.1 Equivalence partitioning

Divide inputs into groups expected to behave similarly, then test
representative values.

Example for an organization name: - Valid non-empty name. - Empty or
whitespace-only name. - Name exceeding the maximum length.

### 5.2 Boundary-value analysis

Test values at and around important boundaries.

Examples: - Session expires immediately before, at, and after its
expiration time. - Pagination limit at minimum, maximum, and outside
allowed range. - Invitation acceptance when `expires_at` is equal to the
current time.

### 5.3 Decision-table testing

Use a table when behavior depends on combinations of roles, membership
states, resource states, or actions.

Example dimensions: - Role: Owner, Admin, Member. - Membership: active,
removed. - Action: read, create, update, archive. - Resource: active,
archived.

The permission matrix from Stage 03 is a source for deriving these
cases.

### 5.4 State-transition testing

Test valid and invalid transitions between states.

The Issue status transition graph and Invitation lifecycle are direct
sources for state-transition tests.

### 5.5 Negative and adversarial testing

Attempt invalid, unauthorized, cross-tenant, duplicated, stale, and
concurrent operations.

For a multi-tenant application, negative security tests are not optional
polish. They are central evidence that isolation and authorization rules
actually hold.

## 6. Traceability: From Requirement to Evidence

A verification case should be traceable to the rule it protects.

A useful chain is:

`Requirement / Domain Rule → Acceptance Criteria → Test Case → Test Result → Defect (if any)`

For example:

  -----------------------------------------------------------------------
  Element                             Example
  ----------------------------------- -----------------------------------
  Requirement                         A Member cannot invite another
                                      user.

  Acceptance criterion                An authenticated Member attempting
                                      to invite receives the documented
                                      forbidden response.

  Test case                           Create an organization with a
                                      Member session, call the invitation
                                      endpoint, assert status and
                                      response body.

  Additional assertion                No Invitation record or outbox
                                      event is created.

  Evidence                            Automated test result and relevant
                                      test report.
  -----------------------------------------------------------------------

Traceability prevents a common failure: a large test suite that reports
high coverage but does not demonstrate that important business
requirements are protected.

## 7. Project-Specific Verification Priorities

The following areas deserve particularly strong verification because
failures can compromise security or data consistency.

  -----------------------------------------------------------------------
  Priority                Area                    Why it matters
  ----------------------- ----------------------- -----------------------
  Critical                Tenant isolation        Prevents
                                                  cross-organization data
                                                  exposure or mutation.

  Critical                Authorization           Enforces Owner, Admin,
                                                  and Member
                                                  capabilities.

  Critical                Transactional integrity Prevents partially
                                                  applied business
                                                  operations.

  High                    Membership lifecycle    Membership changes
                                                  affect access and Issue
                                                  assignments.

  High                    Invitation lifecycle    Expiry, acceptance,
                                                  retries, and
                                                  concurrency interact.

  High                    Issue state transitions Prevents invalid domain
                                                  state.

  High                    Session lifecycle       Protects authentication
                                                  and session revocation.

  Medium                  Search and pagination   Ensures predictable
                                                  query behavior and API
                                                  contracts.

  Medium                  Activity and            Preserves event
                          notifications           consistency and
                                                  recipient rules.
  -----------------------------------------------------------------------

Priority describes risk and verification attention. It does not mean
lower-priority behavior can be left untested.

## 8. Defect Management and Verification Outcomes

A failed test is evidence of a mismatch, not automatically proof that
the implementation is wrong. The expected behavior, test assumptions,
and environment may also be incorrect.

When a failure occurs: 1. Reproduce it reliably. 2. Identify the
violated requirement or expected behavior. 3. Determine whether the
cause is implementation, test, environment, or specification. 4. Record
the defect with reproduction steps and impact. 5. Fix the cause at the
appropriate stage. 6. Re-run the relevant test and regression suite.

A verification result should be explicit: - **Passed:** required checks
completed and evidence supports acceptance. - **Failed:** one or more
required checks reveal an unresolved defect. - **Blocked:** verification
cannot proceed because a dependency or environment is unavailable. -
**Not run:** the check has not been executed.

Do not mark a feature verified merely because no test currently fails.
Untested behavior is unknown, not passed.

## 9. Entry and Exit Criteria

### Entry criteria

Before verifying an implementation change: - The relevant requirement
and acceptance criteria are defined. - Applicable domain rules and
constraints are known. - The implementation change is available in a
testable state. - Required test infrastructure and configuration are
available. - The expected API contract is documented where applicable.

### Exit criteria

A change can leave verification when: - Required tests for the change
have been executed. - Critical security and data-integrity cases
relevant to the change have passed. - No unresolved defect violates an
acceptance criterion or release requirement. - Regression checks have
passed to the agreed scope. - Test results and known limitations are
recorded. - Any remaining risk is explicitly documented and accepted by
the responsible decision-maker.

Exit criteria should be proportionate to the change. A small
documentation-only change does not require the same test scope as a
membership-revocation transaction.

## 10. Relationship with CI/CD

Continuous Integration (CI) automates repeatable checks whenever changes
are proposed or integrated.

The current project CI workflow runs: 1. Checkout. 2. Setup pnpm. 3.
Setup Node.js. 4. Install dependencies using the frozen lockfile. 5.
Generate Prisma Client. 6. Lint. 7. Typecheck. 8. Build. 9. Run tests.

This is an automated verification baseline. As product features are
implemented, the test suite should expand to cover domain behavior,
PostgreSQL integration, API contracts, security boundaries, and critical
workflows.

CI is not the entire verification strategy. It can only execute checks
that have actually been encoded, and a green pipeline cannot prove the
absence of defects.

## 11. What Stage 06 Does Not Replace

-   **Stage 07 --- Review:** verification asks whether specified
    behavior is satisfied; review also evaluates code quality,
    maintainability, architecture, and design suitability.
-   **Stage 08 --- Integrate:** passing tests on a branch does not
    eliminate integration conflicts or incompatibilities with other
    changes.
-   **Stage 09 --- Deploy:** a passing test suite does not prove
    production deployment configuration, migration execution, or
    rollback behavior.
-   **Stage 10 --- Observe:** pre-release verification cannot replace
    monitoring real system behavior in its operating environment.
-   **Stage 11 --- Improve:** verification results and production
    feedback inform future improvements.

## 12. Preparation Checklist for the Future Execution of Stage 06

The following items should be addressed when implementation begins. They
are preparation items, not claims of completed product verification.

-   [ ] Define acceptance criteria for each implemented feature.
-   [ ] Derive tests from Stage 03 domain rules and permission matrix.
-   [ ] Add unit tests for pure domain rules and decision logic.
-   [ ] Add PostgreSQL integration tests for constraints and
    transactions.
-   [ ] Add API tests for authentication, authorization, validation, and
    error contracts.
-   [ ] Add cross-tenant negative tests for every organization-scoped
    resource family.
-   [ ] Add concurrency tests for operations with known race conditions.
-   [ ] Add end-to-end tests for critical user workflows.
-   [ ] Ensure CI executes the required test suites.
-   [ ] Record verification results, defects, and accepted limitations.

## 13. Key Principles

1.  Verification is evidence-based, not confidence-based.
2.  Tests should be derived from requirements and risks, not written
    merely to increase test counts.
3.  Tenant isolation, authorization, and transactional integrity are
    first-class verification concerns for this project.
4.  Unit tests, integration tests, API tests, and end-to-end tests serve
    different purposes.
5.  A green CI pipeline proves only that the configured checks passed.
6.  Untested behavior is unknown, not verified.
7.  Verification is iterative and may send work back to implementation
    or specification.
8.  Verification, review, integration, deployment, and observation are
    related but distinct workflow stages.

------------------------------------------------------------------------

**Document status:** Conceptual preparation. Stage 06 execution will
occur after the project begins Stage 05 --- Implement.
