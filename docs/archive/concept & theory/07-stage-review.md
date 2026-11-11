# Stage 07 --- Review

  -----------------------------------------------------------------------
  Field                               Value
  ----------------------------------- -----------------------------------
  Project                             Multi-Tenant Project Management API

  Workflow Stage                      07 --- Review

  Document Type                       Stage Overview and Preparation Plan

  Version                             1.0

  Status                              Conceptual Preparation

  Related Stages                      03 --- Design, 04 --- Plan, 05 ---
                                      Implement, 06 --- Verify, 08 ---
                                      Integrate
  -----------------------------------------------------------------------

## 1. Purpose

Stage 07 --- Review evaluates whether a proposed change is suitable to
become part of the product and codebase.

Verification asks whether the implementation satisfies specified
requirements and expected behavior. Review asks broader questions:

-   Is the implementation understandable and maintainable?
-   Does it follow the agreed architecture and design?
-   Are the chosen abstractions appropriate?
-   Does it introduce unnecessary complexity or risk?
-   Are security, performance, reliability, and operational implications
    understood?
-   Is the change sufficiently clear for other engineers to maintain?

A change can pass its tests and still be a poor change. Tests may
confirm that the current behavior works while overlooking duplicated
logic, confusing boundaries, unsafe assumptions, or a design that will
be expensive to evolve.

Review is therefore a distinct quality activity, not another name for
testing.

**Important:** This document prepares the project for Stage 07. It does
not claim that product implementation has been reviewed. Stage 05
remains deliberately deferred while the remaining workflow stages are
studied.

## 2. Position in the Workflow

Stage 07 follows Stage 06 --- Verify in the project's workflow.

  -----------------------------------------------------------------------
  Stage                               Main question
  ----------------------------------- -----------------------------------
  Implement                           Has the planned change been built?

  Verify                              Does it satisfy the specified
                                      behavior and constraints?

  Review                              Is the change technically sound,
                                      understandable, and maintainable?

  Integrate                           Can it be safely combined with the
                                      shared codebase?
  -----------------------------------------------------------------------

The sequence is a workflow model, not a prohibition on earlier feedback.
Design and code reviews can happen during implementation, and findings
can send work back to implementation or design.

Review and verification complement each other: - Tests provide
repeatable evidence about behavior. - Review uses engineering judgment
to evaluate structure, reasoning, risks, and long-term consequences. -
Neither replaces the other.

## 3. Types of Review

### 3.1 Code Review

Code review examines the actual implementation changes.

Typical concerns: - Correctness and edge cases. - Readability and
naming. - Cohesion and separation of responsibilities. - Duplication and
unnecessary abstraction. - Error handling and resource management. -
Security-sensitive behavior. - Query efficiency and transaction
boundaries. - Test quality and coverage of meaningful behavior. -
Consistency with established project conventions.

Code review should focus on the change and its context, not stylistic
preferences without engineering value.

### 3.2 Design Review

Design review evaluates the technical approach before or during
implementation.

Typical concerns: - Does the solution satisfy the domain requirements? -
Are component boundaries and dependencies appropriate? - Are data
ownership and transaction boundaries clear? - Are alternatives and
trade-offs understood? - Does the design preserve required invariants? -
Will the approach remain manageable as the system evolves?

For this project, design review may revisit decisions such as tenant
scoping, membership ownership, issue assignment, invitation lifecycle,
session persistence, and Activity recording.

A design review does not automatically authorize changing an approved
design. A substantive change should be recorded and reconciled with the
relevant planning and design documents.

### 3.3 Architecture Review

Architecture review focuses on system-level structure and significant
technical decisions.

Typical concerns: - Dependency direction and module boundaries. -
Coupling between domain, application, infrastructure, and transport
layers. - Data consistency and transaction strategy. - Security
boundaries and trust assumptions. - Scalability and performance
bottlenecks. - Reliability and failure modes. - Operational complexity
and deployment implications.

Architecture review is most useful for decisions with broad
consequences. It should not become a ceremony for every small function
or file rename.

### 3.4 Product and Requirement Review

This review checks whether the change still reflects the intended
product behavior.

Typical concerns: - Does the implementation match the acceptance
criteria? - Are important user workflows supported? - Have edge cases or
constraints been omitted? - Does the API contract remain consistent? -
Have changes in scope been explicitly approved?

This is especially useful when implementation reveals ambiguity or
conflict in the original requirements.

## 4. Review Principles

### 4.1 Review against agreed criteria

Use requirements, domain rules, architecture decisions, coding
conventions, and acceptance criteria as the basis for review.

Do not reject a change merely because the reviewer would have written it
differently. A different approach is not automatically a better
approach.

### 4.2 Focus on risk and impact

Prioritize issues that can cause: - Security vulnerabilities or
cross-tenant data exposure. - Data corruption or inconsistent state. -
Incorrect authorization. - Production incidents or difficult recovery. -
Significant maintainability costs. - Violations of established API or
domain contracts.

Minor formatting preferences should not obscure serious correctness or
security concerns.

### 4.3 Make feedback actionable

Useful review feedback identifies: 1. The location or behavior being
discussed. 2. The problem or risk. 3. Why it matters. 4. A suggested
direction, when appropriate.

Distinguish between: - **Blocking issue:** must be resolved before
approval. - **Non-blocking suggestion:** improvement worth considering
but not required for this change. - **Question:** clarification needed
before the reviewer can assess the change.

### 4.4 Keep review collaborative and evidence-based

Review evaluates the work, not the worth of the person who produced it.

Disagreements should be resolved through requirements, constraints,
reproducible evidence, and explicit trade-offs rather than authority or
personal preference.

## 5. Project-Specific Review Focus

The Multi-Tenant Project Management API has several areas that deserve
special attention.

  -----------------------------------------------------------------------
  Area                                Review questions
  ----------------------------------- -----------------------------------
  Tenant isolation                    Is organization scope enforced
                                      consistently across reads and
                                      writes?

  Authorization                       Are role and membership checks
                                      performed at the correct boundary?

  Data integrity                      Do database constraints reinforce
                                      critical application invariants?

  Transactions                        Are related mutations atomic? Are
                                      race conditions considered?

  Session management                  Are token handling, rotation,
                                      expiry, and revocation safe?

  Invitations                         Are expiry, duplicate prevention,
                                      retries, and concurrent requests
                                      handled?

  Issue lifecycle                     Are state transitions and archive
                                      rules enforced consistently?

  Activity and notifications          Are events recorded atomically and
                                      recipients selected correctly?

  API contract                        Are status codes, error shapes, and
                                      response semantics consistent?

  Observability                       Do logs provide useful diagnostics
                                      without exposing secrets or
                                      sensitive data?
  -----------------------------------------------------------------------

These are review prompts, not a claim that all features already exist.

## 6. Review Workflow

A practical review workflow can follow these steps:

1.  **Understand the change.** Read its purpose, linked requirement,
    acceptance criteria, and scope.
2.  **Check completeness.** Confirm that relevant implementation, tests,
    documentation, and migrations are included.
3.  **Review behavior and risk.** Inspect authorization, data access,
    transactions, error paths, and edge cases.
4.  **Review design and maintainability.** Evaluate boundaries,
    cohesion, naming, duplication, and complexity.
5.  **Inspect verification evidence.** Check relevant automated tests
    and CI results. Do not treat a green pipeline as a substitute for
    review.
6.  **Record findings.** Classify issues by severity and make feedback
    actionable.
7.  **Resolve findings.** The author updates the change or explains why
    a suggestion is not applicable.
8.  **Re-review.** Confirm that fixes address the findings and have not
    introduced new problems.
9.  **Approve or request changes.** Record the outcome clearly.

For a small change, these steps may be quick. For a high-risk database
or authorization change, they may require deeper analysis.

## 7. Review Severity and Outcomes

A consistent severity vocabulary helps prevent both overreaction and
underreaction.

  -----------------------------------------------------------------------
  Classification          Meaning                 Typical action
  ----------------------- ----------------------- -----------------------
  Blocking                Serious correctness,    Resolve before approval
                          security,               
                          data-integrity, or      
                          contract issue          

  Major                   Significant             Normally resolve before
                          maintainability,        approval
                          reliability, or design  
                          concern                 

  Minor                   Local improvement with  May be deferred with
                          limited impact          rationale

  Suggestion              Optional alternative or Author may accept or
                          refinement              decline

  Question                Reviewer needs          Explain before final
                          clarification           assessment
  -----------------------------------------------------------------------

Possible review outcomes: - **Approved:** no unresolved blocking
findings; the change is acceptable for the next workflow step. -
**Changes requested:** one or more findings must be addressed. -
**Commented:** feedback is provided, but no approval decision is
recorded. - **Deferred:** review cannot be completed because required
context or dependencies are missing.

Approval does not mean the change is defect-free. It means the reviewers
consider it acceptable against the agreed criteria and known risks.

## 8. Review Artifacts

Depending on change size and risk, review may produce or update:

-   Pull request description and discussion.
-   Review comments and requested changes.
-   Design decision records (ADRs), where significant decisions change.
-   Updated architecture or domain documentation.
-   Test and CI evidence.
-   Migration review notes.
-   Known-risk or follow-up items.

Not every change needs a separate review report. The review record
should be proportional to the change and sufficient for future engineers
to understand important decisions.

## 9. Relationship with Pull Requests and CI

A pull request (PR) is a common mechanism for proposing, discussing,
reviewing, and approving a change before it is merged.

A PR should make it easy to understand: - What changed. - Why it
changed. - Which requirement or task it addresses. - How it was
tested. - Whether it includes schema or migration changes. - Any known
limitations or risks.

CI provides automated signals such as lint, typecheck, build, and test
results. Reviewers use those signals as evidence, then examine aspects
automation cannot reliably judge, such as design clarity, appropriate
abstractions, and whether the tests meaningfully represent the
requirement.

A passing CI run is not equivalent to approval. A reviewer should not
approve a change solely because the pipeline is green.

## 10. Entry and Exit Criteria

### Entry criteria

A change is ready for substantive review when: - Its purpose and scope
are clear. - Relevant requirements or tasks are identified. - The
implementation is available for inspection. - Relevant tests have been
run, or failures are explicitly explained. - CI results are available
where the workflow requires them. - Significant design deviations are
documented.

### Exit criteria

A review can be considered complete when: - Blocking findings are
resolved. - Required major findings are resolved or explicitly accepted
by the responsible decision-maker. - The implementation is consistent
with the approved design or deviations are recorded. - Relevant tests
and CI checks provide the required evidence. - Remaining non-blocking
feedback is recorded with a clear disposition. - The review outcome is
explicit.

Review completion does not itself merge or deploy the change. Those
actions belong to later workflow stages and their controls.

## 11. Common Review Failure Modes

Avoid these patterns:

-   **Rubber-stamp approval:** approving without understanding the
    change.
-   **Style-only review:** spending time on preferences while missing
    correctness or security risks.
-   **Scope expansion:** turning a focused PR into an unrelated
    redesign.
-   **Unexplained blocking comments:** demanding changes without
    identifying a concrete risk or criterion.
-   **Review by test count:** assuming many tests guarantee good design
    or adequate behavior.
-   **Late architecture surprises:** discovering major design problems
    only after a large implementation has accumulated.
-   **Silent design drift:** changing approved domain behavior in code
    without updating its source documents.
-   **Unbounded PRs:** submitting changes too large to understand
    carefully.

Small, coherent changes generally make review more effective, although
some changes necessarily span multiple components.

## 12. Preparation Checklist for Future Stage 07 Execution

These are preparation items for when implementation begins.

-   [ ] Define a concise PR description template.
-   [ ] Establish review criteria for security-sensitive and
    data-integrity-sensitive changes.
-   [ ] Decide which changes require design or architecture review.
-   [ ] Define blocking, major, minor, and suggestion classifications.
-   [ ] Require relevant test and CI evidence in PRs.
-   [ ] Review tenant isolation and authorization paths explicitly.
-   [ ] Review database constraints, migrations, and transaction
    boundaries.
-   [ ] Record significant design changes in the planning documents or
    decision records.
-   [ ] Ensure review feedback has a clear resolution or disposition.
-   [ ] Avoid merging changes with unresolved blocking findings.

## 13. Key Principles

1.  Review and verification answer different questions.
2.  Passing tests do not prove that a design is maintainable or
    appropriate.
3.  Review should be grounded in requirements, constraints, and risk.
4.  Prioritize security, tenant isolation, data integrity, and
    reliability over stylistic preferences.
5.  Feedback should be specific, actionable, and respectful.
6.  Significant design deviations must be made explicit and documented.
7.  Approval is a decision based on known evidence and accepted risk,
    not a guarantee of perfection.
8.  Review does not replace integration, deployment, or production
    observation.

------------------------------------------------------------------------

**Document status:** Conceptual preparation. Stage 07 review activities
will be executed when implementation changes exist after Stage 05 ---
Implement begins.
