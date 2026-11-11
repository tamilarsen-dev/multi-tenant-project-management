# Stage 01 --- Understand: Conceptual Overview

  Field            Value
  ---------------- --------------------------------------------
  Project          Multi-Tenant Project Management API
  Workflow Stage   01 --- Understand
  Document Type    Conceptual Learning Guide
  Version          1.0
  Status           Learning Reference
  Related Stages   02 --- Specify, 03 --- Design, 04 --- Plan

## 1. Purpose

Stage 01 --- Understand establishes a shared and accurate understanding
of the problem before the team decides what to build.

The goal is not to begin designing endpoints, database tables, classes,
or screens. The goal is to understand the context in which the software
will exist:

-   Who experiences the problem?
-   What are they trying to accomplish?
-   What is difficult, inefficient, risky, or currently unsupported?
-   How does the relevant business or operational domain work?
-   Which concepts and relationships govern that domain?
-   What is inside and outside the intended product scope?
-   What assumptions remain uncertain?

A technically elegant solution to the wrong problem is still the wrong
solution. Stage 01 reduces that risk.

## 2. The Core Distinction: Problem Space and Solution Space

A useful way to understand this stage is to distinguish two spaces.

**Problem space** describes the situation that needs improvement: users,
goals, workflows, pain points, domain rules, and constraints.

**Solution space** describes the software and technical mechanisms
proposed to address that situation: APIs, database schemas, frameworks,
services, and infrastructure.

Stage 01 primarily investigates the problem space. It should not
prematurely lock the project into a solution.

For example:

-   Problem-space statement: teams need a reliable way to organize work,
    assign responsibility, and track progress across projects.
-   Premature solution statement: build a Node.js API with PostgreSQL,
    Prisma, JWT, and microservices.

The second statement describes a possible implementation, not the
underlying problem. Technology choices belong later, after the problem
and requirements are sufficiently understood.

## 3. Main Areas of Understanding

### 3.1 Product context

Understand what the product is intended to accomplish and why it should
exist.

Questions: - What kind of product is this? - What user or organizational
problem does it address? - What value should it provide? - What would
count as a useful outcome? - What is deliberately excluded from the
initial scope?

For the project, the product is a collaborative project-management
system. Its intended value is to help organizations coordinate projects,
issues, responsibilities, and progress.

### 3.2 Users and stakeholders

A user interacts with the product. A stakeholder is anyone with an
interest in its outcomes, constraints, or operation. A stakeholder may
or may not use the software directly.

Questions: - Who uses the system? - What are their goals? - What
responsibilities do they have? - What information do they need? - Who
owns or administers the organization? - Who operates and maintains the
software?

For the project, likely user roles include organization Owners, Admins,
and Members. These roles are part of the domain context; their exact
permissions must be specified later.

### 3.3 Domain understanding

A domain is the area of business or activity the software supports.

Domain understanding identifies: - Important concepts and terminology. -
Relationships between concepts. - Business rules. - Lifecycle and state
changes. - Ownership and responsibility. - Domain boundaries and
exceptions.

For the project, concepts include Organization, Membership, Project,
Issue, Invitation, Comment, Activity, and Notification.

At this stage, the purpose is to understand what these concepts mean and
how the business works. It is not yet necessary to settle every database
column or API route.

### 3.4 Existing workflows and pain points

Understand how work is performed today, whether manually or through
existing tools.

Questions: - What triggers a workflow? - Who performs each step? - What
information is created or changed? - Where do delays or errors occur? -
What exceptions are common? - What happens when an operation fails?

A workflow description should reflect actual or intended work, not
merely a list of screens or endpoints.

### 3.5 Constraints and assumptions

A constraint is a condition that limits the solution space. An
assumption is something treated as true despite not yet having
sufficient confirmation.

Examples of constraints: - The project is initially focused on backend
API engineering. - The first release has a limited feature scope. - The
implementation uses an agreed technology stack.

Examples of assumptions: - An organization has multiple members. - A
user may belong to multiple organizations. - Projects belong to one
organization. - Issues belong to projects.

Assumptions should be identified because incorrect assumptions can
propagate into requirements, data models, and implementation.

## 4. Understanding a Domain Through Concrete Questions

For the Multi-Tenant Project Management API, consider the concept of
Organization.

Questions to investigate: - What is an Organization in this product? -
Who creates it? - Who owns it? - Can a user belong to more than one
Organization? - How does a user gain access? - What happens when
membership is revoked? - Does deleting a user delete the Organization? -
What resources belong to an Organization?

These questions expose domain meaning and relationships. They also
reveal uncertainty that must be resolved before specifying exact system
behavior.

Do not jump directly from the word Organization to a database table.
First understand the concept and its rules.

## 5. Typical Activities

Stage 01 commonly involves:

1.  Understanding the product vision and intended outcomes.
2.  Identifying users and stakeholders.
3.  Investigating workflows and pain points.
4.  Establishing domain vocabulary.
5.  Identifying important domain concepts and relationships.
6.  Recording constraints, assumptions, and uncertainties.
7.  Defining initial scope and non-goals.
8.  Reviewing the understanding for gaps or contradictions.

The activities are investigative and analytical. They may involve
discussion, observation, document review, workflow mapping, and domain
modeling.

## 6. Typical Artifacts

Artifacts preserve the understanding so later stages do not depend on
memory or informal conversations.

Possible artifacts include: - Project overview or product context. -
Problem statement. - Stakeholder and user descriptions. - Domain
glossary. - Workflow descriptions. - Initial domain model. - Scope and
non-goals. - Assumption and open-question list.

For this project, the existing Stage 01 documents include the project
overview and collaborative issue-tracking domain description.

Artifacts are not valuable merely because they exist. They are valuable
when they communicate the problem accurately and help later decisions.

## 7. What Stage 01 Does Not Do

Stage 01 does not need to finalize: - Database tables and column
types. - API routes and request schemas. - Class diagrams or module
structure. - Framework-specific architecture. - Deployment topology. -
Detailed task sequencing.

Those belong to later specification, design, and planning work.

Stage 01 may identify technical or operational constraints, but it
should not confuse constraints with a complete solution design.

## 8. Relationship with the Next Stages

### Stage 01 → Stage 02: Understand to Specify

Stage 01 explains the problem and domain context.

Stage 02 converts that understanding into explicit system requirements
and constraints.

Example: - Understand: organizations need to control who can manage
their work. - Specify: define the supported roles, permissions, and
expected API behavior for each action.

### Stage 01 → Stage 03: Understand to Design

Domain understanding provides the concepts and relationships that design
later represents in domain models, data models, and system boundaries.

A poor domain understanding can produce a technically consistent but
conceptually incorrect design.

### Stage 01 → Stage 04: Understand to Plan

The scope and complexity discovered during understanding influence
sequencing, dependencies, risks, and implementation planning.

Planning should not be based on an incomplete or misunderstood problem.

## 9. Common Failure Modes

-   **Solution-first thinking:** choosing frameworks and architecture
    before understanding the problem.
-   **Feature-list thinking:** treating a list of endpoints or screens
    as a complete product understanding.
-   **Ambiguous vocabulary:** using the same term with different
    meanings across documents or stakeholders.
-   **Hidden assumptions:** treating unverified beliefs as established
    facts.
-   **Scope creep:** allowing unrelated ideas to enter the initial
    product without deliberate decisions.
-   **Premature detail:** spending time on schema or code structure
    before the domain is understood.
-   **Missing exceptions:** modeling only the happy path and ignoring
    lifecycle, failure, or ownership cases.

## 10. Readiness Questions

Before moving from understanding to specification, the team should be
able to answer:

-   [ ] Can we explain the problem without naming a technology or
    implementation?
-   [ ] Do we understand who the users and stakeholders are?
-   [ ] Are the product goals and initial scope clear?
-   [ ] Do we understand the main workflows?
-   [ ] Are the key domain concepts and terms defined?
-   [ ] Are important relationships and business rules identified?
-   [ ] Are constraints, assumptions, and unresolved questions visible?
-   [ ] Are non-goals explicit enough to prevent uncontrolled scope
    expansion?

These questions are a thinking aid, not a demand for perfect certainty.
Some details will only become clear during specification and design.

## 11. Key Principles

1.  Understand the problem before selecting the solution.
2.  Distinguish user goals and domain rules from technical
    implementation choices.
3.  Establish shared vocabulary before detailed design.
4.  Make assumptions and uncertainty visible.
5.  Understand workflows, exceptions, ownership, and lifecycle.
6.  Define scope and non-goals deliberately.
7.  Treat domain understanding as an input to requirements and design,
    not as a substitute for them.

------------------------------------------------------------------------

**Learning objective:** Be able to explain the product problem, its
users, domain, workflows, constraints, assumptions, and scope without
relying on implementation details.
