# Stage 04 --- Plan: Conceptual Overview

  -----------------------------------------------------------------------
  Field                               Value
  ----------------------------------- -----------------------------------
  Project                             Multi-Tenant Project Management API

  Workflow Stage                      04 --- Plan

  Document Type                       Conceptual Learning Guide

  Version                             1.0

  Status                              Learning Reference

  Related Stages                      01 --- Understand, 02 --- Specify,
                                      03 --- Design, 05 --- Implement, 06
                                      --- Verify, 07 --- Review, 08 ---
                                      Integrate, 09 --- Deploy
  -----------------------------------------------------------------------

## 1. Purpose

Stage 04 --- Plan turns the agreed scope, requirements, and design into
an actionable approach for delivering the software.

Stage 01 establishes the problem and domain. Stage 02 specifies what the
system must satisfy. Stage 03 designs a technical solution. Stage 04
determines how the work should be organized, sequenced, estimated,
coordinated, and controlled.

Planning connects technical intent to execution. It helps the team
understand what needs to be done, in what order, what depends on what,
what risks may affect delivery, and how progress and completion will be
evaluated.

A plan is not a guarantee that the future will unfold exactly as
predicted. It is a reasoned model that should be updated when evidence
or circumstances change.

## 2. The Core Question: How Will We Deliver the Solution?

A design may describe the complete system, but it does not automatically
tell the team how to build it efficiently.

For example, the design may include: - Authentication and session
management. - Organization and Membership. - Projects and Issues. -
Invitations and email delivery. - Comments, Activity, and Notifications.

Planning must decide: - Which capability should be built first? - Which
components depend on others? - What is the smallest useful vertical
slice? - Which work can be done independently? - What should be verified
before proceeding? - What risks could block the work? - What constitutes
completion?

The result is a sequence and structure of work that can be executed and
adapted.

## 3. Main Planning Areas

### 3.1 Scope and deliverables

Scope defines what the plan intends to deliver. A deliverable is a
concrete output that can be reviewed or accepted.

Examples: - A working registration and login flow. - Organization
creation and membership authorization. - A documented API contract. -
Database migrations for a defined feature. - Automated tests for
specified behavior. - A deployable application artifact.

A deliverable should be described in terms of observable outcomes, not
merely activity.

"Work on authentication" is vague. "Implement registration and login
with the specified validation, session lifecycle, error contract, and
automated tests" is more actionable.

### 3.2 Work breakdown

A Work Breakdown Structure (WBS) decomposes a larger outcome into
smaller, manageable pieces of work.

For example:

``` text
Identity and Organization
├── Registration
│   ├── Request validation
│   ├── Account creation
│   ├── Password hashing
│   └── Tests
├── Login
│   ├── Credential verification
│   ├── Session creation
│   └── Tests
└── Organization creation
    ├── Authorization
    ├── Database transaction
    └── Tests
```

The decomposition should be detailed enough to estimate, assign, and
verify work without turning the plan into a list of trivial keystrokes.

### 3.3 Dependencies and sequencing

Some work cannot begin safely until other work is available.

Examples: - API routes depend on application behavior and request
contracts. - Authentication-protected endpoints depend on session
validation. - Issue assignment depends on Membership and Organization
relationships. - Integration tests depend on the relevant components
existing. - Deployment depends on a buildable and verifiable release
candidate.

A dependency graph helps identify prerequisites and critical paths.

The sequence should consider both technical dependencies and risk. A
foundational or high-risk capability may deserve early implementation so
uncertainty is discovered sooner.

### 3.4 Milestones

A milestone marks a meaningful point of progress or a deliverable state.

Examples: - Technical Foundation complete. - Identity and Organization
slice accepted. - Project management slice integrated. - Issue lifecycle
verified. - Release candidate ready for deployment.

Milestones should represent outcomes, not merely dates or activity
completion.

### 3.5 Estimates and capacity

Estimation predicts the effort, duration, or resources needed for work.

These are different concepts: - **Effort:** amount of work required. -
**Duration:** elapsed time from start to completion. - **Capacity:**
amount of work the team can realistically handle.

Estimates are uncertain. They are affected by unknowns, dependencies,
interruptions, technical risk, and experience.

For an individual portfolio project, a lightweight estimate based on
task size and uncertainty is often more useful than pretending to have
precise enterprise project forecasts.

### 3.6 Risk planning

A risk is an uncertain event or condition that could affect objectives.

A useful risk record includes: - Description. - Likelihood. - Impact. -
Early warning signs. - Mitigation or response. - Owner, when applicable.

Examples: - A database design decision proves difficult to migrate. -
Authentication integration takes longer than expected. - External email
delivery is unreliable. - A dependency introduces a breaking change. - A
production migration causes data disruption.

Risk planning does not eliminate uncertainty. It makes important
uncertainty visible and prepares a response.

## 4. Work Sequencing Strategies

### 4.1 Component-based sequencing

Work is grouped by technical component, such as database, API, or
authentication.

This can be useful when components have clear boundaries, but it may
delay discovery of end-to-end integration problems.

### 4.2 Feature-based sequencing

Work is grouped around a user-visible capability.

For example, complete registration from API contract through persistence
and tests before moving to the next capability.

### 4.3 Vertical slices

A vertical slice delivers a thin but complete path through relevant
layers of the system.

Example: Create Organization: - HTTP endpoint. - Authentication and
authorization. - Input validation. - Application/domain behavior. -
Database transaction. - Response and error handling. - Automated tests.

A vertical slice validates that the layers work together. It often
reveals integration issues earlier than building all database work, then
all services, then all routes.

A slice should be small enough to finish and verify, but meaningful
enough to demonstrate behavior.

## 5. Planning Verification and Quality

Planning should include how work will be verified, not just how it will
be implemented.

For each deliverable, identify: - Relevant requirements. - Acceptance
criteria. - Unit or component tests. - Integration tests. - Contract or
API tests where appropriate. - Review expectations. - Required build and
CI checks.

Definition of Done (DoD) is a shared quality threshold for considering
work complete.

A feature's DoD might require: - Acceptance criteria satisfied. -
Relevant tests passing. - Typecheck, lint, and build passing. - Security
and authorization implications reviewed. - API and design documentation
updated when necessary. - Changes integrated without unresolved
conflicts.

DoD should be explicit and proportionate. "Code is written" is not a
sufficient completion condition.

## 6. Release and Delivery Planning

Planning should connect implementation work to the later workflow
stages.

Consider: - Which changes must be integrated together? - Which
migrations are required? - What configuration is needed? - What must be
validated before release? - What deployment dependencies exist? - What
recovery plan is appropriate? - What operational signals must be
available?

A feature plan that ignores integration and deployment can produce
software that is locally complete but difficult to release.

## 7. Plans, Backlogs, and Roadmaps

These artifacts are related but not interchangeable.

### 7.1 Roadmap

A roadmap communicates major outcomes, direction, and approximate
sequencing over a broader horizon.

It should not be mistaken for a guaranteed schedule.

### 7.2 Backlog

A backlog is an ordered collection of work items that may be selected
for execution.

Items can include features, defects, technical tasks, risks, and
improvements.

A backlog is continuously refined. Not every item is a commitment.

### 7.3 Implementation plan

An implementation plan explains how a defined scope will be delivered,
including work breakdown, dependencies, sequence, milestones,
verification, and risks.

### 7.4 Sprint or iteration plan

An iteration plan selects a limited set of work for a short execution
period, based on priority and capacity.

A solo developer may use a lightweight task list and milestones rather
than formal sprint ceremonies.

## 8. Change Management and Plan Adaptation

Plans must respond to new information.

A requirement change, design discovery, failed test, or integration
problem may affect: - Scope. - Dependencies. - Estimates. - Sequence. -
Risk. - Milestones. - Release expectations.

When a change occurs: 1. Understand what changed and why. 2. Assess its
impact on requirements and design. 3. Identify affected work and
dependencies. 4. Reprioritize if necessary. 5. Update the plan and
communicate the decision.

Do not preserve an outdated plan merely because effort was spent writing
it. A plan is useful when it reflects the best current understanding.

## 9. Project-Specific Planning Example

The Multi-Tenant Project Management API is planned around a Technical
Foundation followed by feature-driven vertical slices.

A simplified sequence:

1.  Technical Foundation.
2.  Slice 1: Identity and Organization.
3.  Slice 2: Projects.
4.  Slice 3: Issues.
5.  Slice 4: Membership and Invitations.

This sequence reflects dependencies. For example, Projects depend on
Organizations, while Issue assignment depends on Membership and project
relationships.

Each slice should define: - Included capabilities. - Prerequisite
work. - API and data changes. - Acceptance criteria. - Verification
approach. - Integration points. - Risks and completion conditions.

This is a planning model, not a claim that all slices have already been
implemented.

## 10. Typical Activities

Stage 04 commonly involves:

1.  Confirming scope and deliverables.
2.  Decomposing work into manageable tasks.
3.  Identifying dependencies and sequencing.
4.  Defining milestones and release boundaries.
5.  Estimating effort and capacity.
6.  Identifying and assessing risks.
7.  Defining verification activities and Definition of Done.
8.  Planning integration and deployment dependencies.
9.  Recording assumptions and unresolved decisions.
10. Establishing how progress and changes will be managed.

## 11. Typical Artifacts

Possible Stage 04 artifacts include: - Implementation roadmap. - Work
Breakdown Structure. - Backlog or task breakdown. - Dependency map. -
Milestone plan. - Release plan. - Risk register. - Estimate and capacity
assumptions. - Definition of Done. - Verification plan. - Technical
Foundation plan.

For this project, Stage 04 includes the Implementation Roadmap and
Technical Foundation Plan.

Artifacts should remain consistent with requirements and design. If the
plan requires work that the design does not support, the inconsistency
should be resolved rather than hidden in the task list.

## 12. What Stage 04 Does Not Do

Stage 04 does not: - Guarantee exact delivery dates. - Eliminate
technical uncertainty. - Replace engineering judgment. - Require every
implementation detail to be known. - Make all future changes
predictable. - Prove that a design is correct. - Substitute task
completion for verification.

Planning should create a credible path to delivery, not an illusion of
certainty.

## 13. Relationship with the Next Stages

### Stage 04 → Stage 05: Plan to Implement

The plan provides the work sequence, dependencies, deliverables, and
completion conditions used during implementation.

### Stage 04 → Stage 06: Plan to Verify

Verification work should be planned alongside implementation so quality
is not postponed until the end.

### Stage 04 → Stage 07 and 08: Review and Integrate

Planning should account for review effort, branch integration,
compatibility, and shared dependencies.

### Stage 04 → Stage 09: Deploy

Release prerequisites, migration steps, configuration, and recovery
needs should be considered before deployment is imminent.

The plan may be updated as implementation and verification reveal new
information.

## 14. Common Failure Modes

-   **Task lists without outcomes:** activities are recorded but
    completion is unclear.
-   **No dependency analysis:** work is started before prerequisites
    exist.
-   **Overly large tasks:** progress and failures are difficult to
    isolate.
-   **Overly small tasks:** planning overhead exceeds the value of
    decomposition.
-   **False precision:** estimates are treated as guarantees.
-   **No risk planning:** high-impact unknowns are discovered too late.
-   **Testing postponed:** verification becomes a rushed final activity.
-   **No integration planning:** individually completed components fail
    when combined.
-   **Static plan:** new evidence is ignored because the original plan
    is treated as fixed.
-   **Planning without execution:** planning becomes an endless
    substitute for building and learning.

## 15. Readiness Questions

Before beginning implementation, the team should be able to answer:

-   [ ] Is the implementation scope clear?
-   [ ] Are deliverables and completion conditions defined?
-   [ ] Is work decomposed into manageable units?
-   [ ] Are important dependencies and sequence understood?
-   [ ] Are milestones and release boundaries identified?
-   [ ] Are estimates and capacity assumptions realistic enough for
    planning?
-   [ ] Are significant risks visible with response strategies?
-   [ ] Is verification planned alongside implementation?
-   [ ] Is Definition of Done explicit?
-   [ ] Are integration and deployment dependencies considered?
-   [ ] Is there a process for updating the plan when new evidence
    appears?

The plan does not need to predict every detail. It needs to make the
next meaningful work clear and expose the important risks and
dependencies.

## 16. Key Principles

1.  Planning turns scope, requirements, and design into an actionable
    delivery approach.
2.  Decompose work around meaningful deliverables, not arbitrary
    activity.
3.  Sequence work according to dependencies and risk.
4.  Vertical slices validate complete paths through the system.
5.  Distinguish effort, duration, and capacity.
6.  Estimates are uncertain models, not guarantees.
7.  Plan verification and quality as part of delivery.
8.  Define completion conditions before declaring work done.
9.  Keep integration and deployment in view while planning
    implementation.
10. Update the plan when evidence changes.
11. Planning should enable execution, not become a reason to postpone
    it.

------------------------------------------------------------------------

**Learning objective:** Be able to turn an approved scope and design
into a realistic, dependency-aware implementation plan with
deliverables, milestones, risk responses, and verification criteria.
