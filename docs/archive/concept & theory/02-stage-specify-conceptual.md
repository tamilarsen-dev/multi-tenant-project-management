# Stage 02 --- Specify: Conceptual Overview

  -----------------------------------------------------------------------
  Field                               Value
  ----------------------------------- -----------------------------------
  Project                             Multi-Tenant Project Management API

  Workflow Stage                      02 --- Specify

  Document Type                       Conceptual Learning Guide

  Version                             1.0

  Status                              Learning Reference

  Related Stages                      01 --- Understand, 03 --- Design,
                                      04 --- Plan, 05 --- Implement, 06
                                      --- Verify
  -----------------------------------------------------------------------

## 1. Purpose

Stage 02 --- Specify translates the understanding established in Stage
01 into explicit, structured, and verifiable requirements for the
system.

Stage 01 asks what problem exists and how the relevant domain works.
Stage 02 determines what the system must do, what constraints it must
satisfy, and what conditions will demonstrate that the requirements have
been met.

The purpose is to reduce ambiguity before design and implementation.
Requirements should be sufficiently clear that different engineers can
make compatible design decisions and later evaluate whether the
implementation satisfies the intended behavior.

## 2. From Problem Understanding to System Requirements

Consider the project context:

An organization needs to control who can manage its projects and work
items.

That is a problem or business need. It is not yet a sufficiently precise
system requirement.

The specification process progressively makes it explicit:

  -----------------------------------------------------------------------
  Level                               Example
  ----------------------------------- -----------------------------------
  Business need                       Organizations need controlled
                                      access to their work.

  Requirement                         The system must support role-based
                                      authorization.

  Specification                       An Admin may invite a Member but
                                      may not invite an Owner.

  Acceptance criterion                When an Admin attempts to invite a
                                      user with the Owner role, the API
                                      rejects the request with the
                                      documented response and creates no
                                      Invitation or outbox event.
  -----------------------------------------------------------------------

The levels are related but serve different purposes: - Business needs
explain why the capability matters. - Requirements state what the system
must satisfy. - Specifications clarify expected behavior and
constraints. - Acceptance criteria define observable conditions for
accepting a particular requirement or feature.

A requirement can have multiple acceptance criteria. A single acceptance
criterion may also contribute evidence toward more than one requirement.

## 3. Types of Requirements

### 3.1 Functional requirements

Functional requirements describe capabilities and behaviors the system
must provide.

They answer questions such as: - What can a user do? - What information
can be created, read, updated, or archived? - What happens after an
operation? - Which state transitions are allowed? - How does the system
respond to invalid actions?

Examples for the project: - A user can register an account. - An
authenticated user can create an Organization. - An Owner can invite an
Admin or Member. - A Member can create and manage accessible Issues
according to the domain rules. - The system records Activity for
meaningful business changes.

Functional requirements should describe behavior rather than prematurely
dictate implementation.

### 3.2 Non-functional requirements

Non-functional requirements describe qualities, constraints, or
operating characteristics the system must satisfy.

Examples: - Security and tenant isolation. - Reliability and
availability. - Performance and scalability. - Maintainability. -
Usability and accessibility. - Compatibility. - Observability. - Data
durability and recoverability.

Non-functional requirements need careful wording. "The API must be fast"
is not verifiable. A useful performance requirement needs a defined
workload, measurement, environment, and target.

Not every quality attribute needs a numerical target at the beginning.
If the workload or service expectation is not known, record the
uncertainty rather than inventing a target.

### 3.3 Business rules and domain constraints

Business rules define conditions that govern the domain, independent of
the technical mechanism used to enforce them.

Examples: - An Organization must always have at least one Owner. - A
Member cannot invite another user. - An Issue assignee must belong to
the same Organization as the Issue. - An archived Project cannot accept
new Issues. - An Issue may transition only through allowed status
transitions.

Business rules often influence multiple requirements and components.
They should be expressed consistently so they do not become
contradictory across API, application logic, and database design.

### 3.4 Interface and integration requirements

These describe how the system interacts with users, clients, or external
systems.

Examples: - API endpoints and HTTP methods. - Request and response
contracts. - Authentication requirements. - Error response semantics. -
Email provider integration. - Pagination and filtering behavior.

Detailed API design may be produced in Stage 03, but Stage 02 should
identify the externally required behavior and constraints.

### 3.5 Data requirements

Data requirements describe what information must be stored, retained,
related, or protected.

Examples: - An Issue belongs to a Project. - A Project belongs to an
Organization. - Membership records preserve removal state. - Session
tokens are not stored in raw form. - Activity records preserve
meaningful business changes.

Stage 02 identifies the information and integrity needs. Stage 03
determines the detailed data model and enforcement mechanisms.

## 4. Requirement Quality

A useful requirement should be:

-   **Clear:** readers can understand it consistently.
-   **Necessary:** it supports a real product or system need.
-   **Consistent:** it does not contradict other requirements.
-   **Feasible:** it can reasonably be implemented within known
    constraints.
-   **Verifiable:** evidence can determine whether it is satisfied.
-   **Traceable:** it can be connected to its source and downstream
    design, implementation, and tests.
-   **Scoped:** its boundaries and exclusions are understood.

Weak requirement:

"The system should handle invitations properly."

Stronger requirement:

"When an invitation reaches or passes its `expires_at` timestamp, the
system must reject acceptance and must not create or reactivate
Membership."

The stronger statement identifies the condition and expected behavior.
Its acceptance criteria can then define the observable API and
persistence outcomes.

## 5. Acceptance Criteria

Acceptance criteria define the conditions that must be satisfied for a
requirement or feature to be accepted.

They should describe observable outcomes, not merely implementation
tasks.

Example requirement:

"An Admin can invite a Member to the Admin's Organization."

Possible acceptance criteria: 1. An authenticated Admin with active
Membership can submit a valid invitation for the Member role. 2. The
invitation is associated with the Admin's Organization. 3. The
invitation is persisted with the specified initial state and expiry. 4.
The system records the required outbox event atomically with invitation
creation. 5. An attempt to invite an Owner is rejected. 6. An Admin
without active Membership cannot create the invitation.

Acceptance criteria help connect specification to verification. They can
be expressed as examples, scenarios, decision tables, or structured
statements.

### 5.1 Given--When--Then

A common scenario format is:

-   **Given:** the initial context.
-   **When:** an action occurs.
-   **Then:** the expected outcome.

Example:

``` text
Given an authenticated user with the Admin role
And the user has active membership in an Organization
When the user attempts to invite someone as an Owner
Then the API rejects the request
And no Invitation is created
And no outbox event is created
```

This format is useful for communicating behavior. It is not mandatory
for every requirement.

## 6. Scope, Non-Goals, and Constraints

### 6.1 Scope

Scope defines what the current product or release intends to include.

It prevents the project from expanding without deliberate decisions.

For example, the initial project scope includes account registration,
authentication, organizations, projects, issues, membership,
invitations, and related activity.

### 6.2 Non-goals

Non-goals explicitly identify capabilities that are not part of the
current scope.

Examples for an initial release may include: - Custom workflow
builders. - Real-time collaboration. - Push notifications. - Global
semantic search. - Organization deletion. - Complex enterprise identity
federation.

A non-goal is not necessarily a permanent rejection. It means the
capability is intentionally excluded from the current scope.

### 6.3 Constraints

Constraints limit acceptable solutions.

Examples: - The initial product is a backend API. - The agreed
technology stack is Node.js, TypeScript, Express, PostgreSQL, and
Prisma. - The first release has a defined feature scope. - Certain
security or data-integrity invariants must always hold.

A constraint differs from a preference. A preference may be
reconsidered; a constraint must be respected unless it is formally
changed.

## 7. Prioritization

Requirements often compete for limited time and resources.
Prioritization helps decide what must be delivered first.

Common approaches include:

### 7.1 MoSCoW

-   **Must have:** essential for the intended release.
-   **Should have:** important but not absolutely essential.
-   **Could have:** useful if capacity allows.
-   **Won't have (this time):** explicitly excluded from the current
    release.

### 7.2 Risk-based prioritization

Prioritize requirements according to the impact and likelihood of
failure.

For a multi-tenant API, tenant isolation and authorization deserve high
priority because mistakes can expose or alter another organization's
data.

Prioritization should be explicit. A long list of requirements without
priority or release boundaries is difficult to turn into a useful plan.

## 8. Traceability

Traceability connects a requirement to the decisions and evidence that
follow from it.

A simplified chain:

`Problem / Business Need → Requirement → Design Decision → Implementation → Test Case → Verification Result`

Example:

  -----------------------------------------------------------------------
  Element                             Example
  ----------------------------------- -----------------------------------
  Business need                       Organizations must control access
                                      to their resources.

  Requirement                         Users can access organization
                                      resources only with active
                                      membership and sufficient
                                      permission.

  Design                              Organization-scoped authorization
                                      policy and tenant-scoped data
                                      access.

  Implementation                      Authentication and authorization
                                      middleware plus application-level
                                      checks.

  Test                                Attempt to access another
                                      Organization's Project.

  Expected evidence                   The API returns the documented
                                      not-found behavior and does not
                                      expose the resource.
  -----------------------------------------------------------------------

Traceability helps answer: - Why does this feature exist? - Which
requirement justifies this design? - Which tests protect this rule? -
What else may be affected if the requirement changes?

Traceability does not require an expensive tool. A consistent document
structure and stable requirement identifiers may be sufficient for a
small project.

## 9. Requirement Validation and Change

Requirements themselves can be wrong, incomplete, ambiguous, or
inconsistent. They should be reviewed before downstream design depends
on them.

Validation questions: - Does this requirement solve the identified
problem? - Is the expected behavior clear? - Are exceptions and failure
cases considered? - Does it conflict with another requirement? - Can it
be tested? - Is it within the agreed scope? - Are stakeholders or
decision-makers aligned?

Requirements can change as understanding improves. A change should be
assessed for its impact on: - Other requirements. - Domain rules. - Data
model and API contract. - Architecture. - Implementation plan. -
Existing tests and documentation. - Release scope and risk.

Do not silently alter a requirement in code while leaving the
specification unchanged.

## 10. Typical Activities

Stage 02 commonly involves:

1.  Identifying functional and non-functional requirements.
2.  Expressing business rules and domain constraints.
3.  Defining system boundaries and external interfaces.
4.  Describing expected behavior and failure cases.
5.  Writing acceptance criteria.
6.  Defining scope and non-goals.
7.  Identifying technical and operational constraints.
8.  Prioritizing requirements.
9.  Checking for ambiguity, contradiction, and missing cases.
10. Establishing traceability to later design and verification work.

## 11. Typical Artifacts

Possible Stage 02 artifacts include: - Problem statement. - Requirements
specification. - Functional requirements list. - Non-functional
requirements list. - Business rules and constraints. - Use cases or user
stories. - Acceptance criteria. - Scope and non-goals. - Requirement
priority list. - Requirement traceability information. - Open questions
and decision records.

For this project, the Stage 02 problem definition and requirements
document captures the agreed problem, scope, and required system
behavior.

An artifact should be maintained when it helps people make consistent
decisions. More documents do not automatically mean better
specification.

## 12. What Stage 02 Does Not Do

Stage 02 does not need to finalize: - Exact database tables, indexes,
and foreign keys. - Detailed class and module structure. - Full software
architecture. - Exact source-code implementation. - Deployment
infrastructure. - Detailed engineering task sequencing.

Those decisions are addressed in Stage 03 and Stage 04.

Stage 02 may define required outcomes and constraints that influence
those decisions. For example, it can require atomic behavior without
dictating the exact transaction implementation.

## 13. Relationship with the Next Stages

### Stage 02 → Stage 03: Specify to Design

Stage 02 states what the system must satisfy. Stage 03 develops a
technical solution that satisfies those requirements.

Example: - Specify: Issue assignees must belong to the same Organization
as the Issue. - Design: define the domain relationship and database
integrity mechanism that enforce this invariant.

### Stage 02 → Stage 04: Specify to Plan

Requirements, priorities, dependencies, and scope determine
implementation sequencing and release planning.

### Stage 02 → Stage 05: Specify to Implement

Implementation should be guided by approved requirements and acceptance
criteria, not by guesses made while coding.

### Stage 02 → Stage 06: Specify to Verify

Acceptance criteria and explicit rules become sources for test cases and
verification evidence.

## 14. Common Failure Modes

-   **Vague requirements:** terms such as "fast", "secure", or
    "user-friendly" without defined meaning.
-   **Solution disguised as a requirement:** prescribing a technology
    when the actual need is a behavior or quality.
-   **Missing negative cases:** defining only successful behavior.
-   **Contradictory rules:** different documents define incompatible
    permissions or lifecycle behavior.
-   **Uncontrolled scope:** adding features without evaluating their
    impact.
-   **Unverifiable statements:** no observable way to determine whether
    a requirement is satisfied.
-   **No traceability:** design and tests cannot be connected to the
    reasons a feature exists.
-   **Silent requirement changes:** implementation behavior changes
    without updating the specification.
-   **Over-specification:** locking down technical details before design
    has evaluated alternatives.

## 15. Readiness Questions

Before moving from specification to design, the team should be able to
answer:

-   [ ] Are the product scope and non-goals explicit?
-   [ ] Are functional requirements documented?
-   [ ] Are relevant non-functional requirements identified?
-   [ ] Are important business rules and constraints explicit?
-   [ ] Are success, failure, and edge-case behaviors described?
-   [ ] Are acceptance criteria observable and verifiable?
-   [ ] Are requirements consistent and feasible?
-   [ ] Are priorities and release boundaries understood?
-   [ ] Are assumptions and unresolved questions visible?
-   [ ] Can requirements be traced into later design and verification?

Not every requirement needs exhaustive detail before design. The goal is
enough clarity to make sound design decisions without pretending that
all uncertainty has disappeared.

## 16. Key Principles

1.  Specification translates problem understanding into explicit system
    expectations.
2.  Requirements describe what the system must satisfy, not necessarily
    how it will be implemented.
3.  Functional requirements, quality requirements, business rules, and
    constraints serve different purposes.
4.  Acceptance criteria make expected behavior verifiable.
5.  Scope and non-goals control what belongs in the current release.
6.  Requirements should be clear, consistent, feasible, and traceable.
7.  Negative cases and lifecycle behavior matter as much as happy paths.
8.  Requirement changes should be assessed and communicated rather than
    silently introduced.
9.  Specification guides design and provides a basis for verification.

------------------------------------------------------------------------

**Learning objective:** Be able to translate a problem and domain
understanding into clear, prioritized, verifiable requirements,
acceptance criteria, constraints, and explicit scope boundaries.
