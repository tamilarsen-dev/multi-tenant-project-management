# Product Requirements Document (PRD)

## Multi-Tenant Project Management API

  -----------------------------------------------------------------------
  Field                               Value
  ----------------------------------- -----------------------------------
  Product version                     V1

  Document status                     Draft for implementation baseline

  Scope                               V1

  Last updated                        2026-11-02

  Related artifacts                   Project Overview, Problem
                                      Definition & Requirements, Domain
                                      Map, API Specification, Database
                                      Specification, Implementation Plan
  -----------------------------------------------------------------------

> **Purpose:** This PRD summarizes product intent, users, capabilities,
> scope, and product-level acceptance outcomes. Detailed business rules
> belong to the Domain Map and requirements specification; HTTP behavior
> belongs to the API Specification; persistence belongs to the Database
> Specification; implementation order belongs to the Implementation
> Plan.
>
> **Accuracy:** This is a portfolio project specification, not evidence
> of a released or customer-validated product. The domain implementation
> has not yet been completed. Where older planning drafts conflict with
> the consolidated V1 Domain Map, API Specification, or Database
> Specification, identify and reconcile the conflict rather than
> silently copying the older draft.

## 1. Product overview

Multi-Tenant Project Management API is the backend for a collaborative
project-management application inspired by products such as Jira and
Linear.

The product provides a shared platform where multiple organizations can
coordinate work while keeping each organization's members, projects, and
operational data isolated from other organizations.

A user may belong to multiple organizations and hold a different role in
each one. Within an organization, members collaborate through projects
and issues, assign responsibility, track work status, discuss issues,
and review meaningful activity history.

The project is a portfolio project intended to demonstrate end-to-end
backend engineering: translating product needs into domain rules,
designing APIs and data integrity, implementing features, verifying
behavior, and preparing the system for operation.

## 2. Problem statement

Software teams need a central place to organize projects and work items
so they can answer:

-   What work exists, and which project does it belong to?
-   Who is responsible for an issue?
-   What is the current state of the work?
-   What changed, and who changed it?
-   Which people may access or modify the work?
-   How can multiple organizations use one platform without accessing
    one another's data?

The product addresses coordination, ownership, work state,
context/history, and organization-scoped access control. The core
problem is not simply storing tasks; it is providing a consistent shared
workspace with clear ownership and access boundaries.

## 3. Product goals

V1 aims to:

1.  Allow a user to create an account and establish an organization
    workspace.
2.  Allow an organization to manage membership and organization-scoped
    roles.
3.  Allow organization members to create and manage projects.
4.  Allow organization members to create, assign, update, and track
    issues within projects.
5.  Preserve meaningful history of changes.
6.  Support collaboration through comments and relevant notifications.
7.  Prevent users from accessing organization data without valid
    membership and permission.
8.  Provide predictable behavior when operations conflict, fail, or
    occur concurrently.
9.  Provide a backend foundation that can be tested, deployed,
    monitored, and improved.

These are goals, not claims that the capabilities are already
implemented.

## 4. Target users and actors

The initial target context is a small software team or organization that
needs to coordinate project work. These are product roles, not validated
market personas.

### User

A person with an account on the platform. A user may belong to multiple
organizations and may have different roles in each.

### Organization Owner

A user with the `OWNER` role in a specific organization. The Owner has
the highest organization-level authority, manages membership within
product rules, and ensures at least one active Owner remains.

### Organization Admin

A user with the `ADMIN` role in a specific organization. The Admin helps
manage membership and work resources but has fewer membership-management
permissions than Owner.

### Organization Member

A user with the `MEMBER` role in a specific organization. The Member
participates in projects and issues and performs ordinary
work-management actions permitted by the product.

V1 roles are `OWNER`, `ADMIN`, and `MEMBER`. `GUEST` is excluded from
V1.

## 5. Product concepts

  Concept        Product meaning
  -------------- ---------------------------------------------------------
  Organization   Tenant workspace and primary data-access boundary
  Membership     A user's participation and role within one organization
  Invitation     Invitation for a person to join an organization
  Project        Container for organizing related work
  Issue          Trackable work item within a project
  Comment        Discussion attached to an issue
  Activity       Record of a meaningful event or change
  Notification   User-facing notice about a relevant event

User identity and authentication sessions support access. Outbox
processing supports reliable delivery of asynchronous work such as
invitation email. Their technical details are defined in the domain and
technical specifications.

## 6. V1 product scope

### 6.1 Identity and access

-   Account registration.
-   Login and logout.
-   Session refresh.
-   Authenticated access to protected capabilities.
-   Organization-scoped membership and authorization.

### 6.2 Organization and membership

-   Create an organization.
-   List and view organizations where the user has active membership.
-   Update organization information within permission rules.
-   View organization membership.
-   Change membership roles within permission rules.
-   Remove membership while preserving the membership record and
    relevant history.
-   Invite people to an organization.
-   Accept, revoke, list, inspect, and resend invitations according to
    invitation lifecycle rules.

### 6.3 Project management

-   Create projects within an organization.
-   List and view projects.
-   Update project information within permission rules.
-   Archive and restore projects.
-   Preserve project and issue history when archived.

### 6.4 Issue management

-   Create issues within a project.
-   List and view issues.
-   Update issue information.
-   Assign and unassign organization members.
-   Change issue status according to an explicit transition model.
-   Archive and restore issues.
-   Search issues within a project using the defined V1 search behavior.
-   Paginate issue collections.

V1 issue states: - `TODO` - `IN_PROGRESS` - `IN_REVIEW` - `DONE` -
`CANCELLED`

The allowed transitions are authoritative in the Domain Map. Status
changes must not be treated as arbitrary enum updates.

### 6.5 Collaboration and history

-   Add comments to issues.
-   Update and delete comments within permission rules.
-   Read organization activity history.
-   Create and deliver in-app notifications for defined relevant events.
-   Send invitation email through the asynchronous invitation-delivery
    workflow.

### 6.6 Product boundary

The primary deliverable is a backend API. A complete web or mobile
client is not part of the current V1 implementation scope unless
separately approved.

## 7. Product rules and expected outcomes

This section summarizes product-level rules. The Domain Map and API
Specification contain the detailed authoritative rules.

### Organization isolation

-   An organization is the tenant boundary.
-   A user's role belongs to a Membership, not to the global User
    account.
-   Membership in one organization does not grant access to another
    organization.
-   Organization-scoped resources require valid active membership and
    the relevant permission.

### Membership and roles

-   A user may have at most one Membership record per Organization.
-   An Organization must retain at least one active Owner.
-   Owner, Admin, and Member have different organization-management
    permissions.
-   Removing a Membership does not globally disable the user's account
    or all sessions.
-   Re-inviting a user with a removed Membership follows the defined
    reactivation behavior.

### Projects and issues

-   Every Project belongs to one Organization.
-   Every Issue belongs to one Project and the same Organization.
-   An Issue assignee must be a Membership of the Organization that owns
    the Project.
-   Issue status changes must follow the allowed transitions.
-   Archived resources follow the modification restrictions in the
    Domain Map.

### Collaboration and history

-   Meaningful business changes are recorded as Activity.
-   Activity is historical and append-only.
-   Comments and activity history are preserved according to their
    lifecycle rules.
-   Notifications are generated only for event/recipient combinations
    defined by the product specification.

### Invitation lifecycle

-   Invitations have defined statuses and expiry.
-   Acceptance requires the authenticated user's normalized email to
    match the invitation email.
-   Email delivery failure does not invalidate an otherwise valid
    invitation.
-   Invitation delivery is asynchronous and retryable.

## 8. Product-level non-functional expectations

### Security and privacy

-   Users must not access another organization's data without
    authorization.
-   Protected operations must enforce authentication and authorization.
-   Passwords and session credentials must not be stored or logged in
    plaintext.
-   Error responses must not expose sensitive internal details or
    protected cross-tenant resource information.

### Data consistency

-   Related business changes that must remain consistent must not leave
    partial state.
-   Concurrent operations must preserve critical business invariants.
-   Stale updates must be detected according to the API contract.
-   Database relationships must not permit prohibited cross-organization
    references.

### Reliability

-   Asynchronous invitation delivery must tolerate transient failures
    and worker interruption.
-   Important behavior must be verifiable through automated tests.
-   Backup and recovery procedures must be tested before operational
    recovery readiness is claimed.

### Maintainability

-   The backend should have clear module and responsibility boundaries.
-   Important behavior should be testable.
-   API contracts and consequential engineering decisions should be
    documented.
-   Changes should be integrated through automated quality checks.

### Performance

-   Collection endpoints must support pagination where specified.
-   V1 search and query behavior must follow the API Specification.
-   Numeric latency and throughput targets are not yet established. They
    should be based on workload assumptions and measurements, not
    invented in the PRD.

## 9. Out of scope and deferred capabilities

The following are not part of the current V1 commitment:

-   Guest role.
-   Real-time collaborative editing.
-   Chat and video conferencing.
-   Billing and subscription management.
-   SSO/SAML.
-   Mobile application.
-   Microservices architecture.
-   Arbitrary/custom permission systems.
-   Dedicated search infrastructure such as Elasticsearch.
-   Real-time push notification infrastructure.
-   Watchers/subscribers.
-   Custom issue workflows.
-   Global or semantic search.
-   Kubernetes or multi-instance deployment.
-   Redis unless a concrete requirement justifies introducing it.

Some capabilities may be considered in a future version. Their inclusion
requires explicit scope and design decisions; they are not implied
commitments.

## 10. Product success criteria for V1

V1 should be considered product-capable only when these end-to-end
outcomes are implemented and verified:

1.  A person can register, log in, and maintain a valid session.
2.  An authenticated user can create an organization and becomes its
    Owner.
3.  An organization can manage members and invitations according to role
    rules.
4.  An active organization member can create and manage projects within
    their permissions.
5.  An active organization member can create and manage issues within
    project and organization boundaries.
6.  Issues can be assigned only to eligible memberships in the same
    organization.
7.  Issue status transitions enforce the defined workflow.
8.  Comments and activity history follow their access and lifecycle
    rules.
9.  Relevant in-app notifications and invitation delivery follow the
    defined rules.
10. Cross-tenant access attempts are rejected without leaking protected
    resource information.
11. Critical transaction and concurrency invariants are covered by
    automated tests.
12. The application can be deployed and operated using documented
    procedures; backup restoration is verified before recovery readiness
    is claimed.

These are acceptance outcomes, not evidence that V1 has already achieved
them.

## 11. Product constraints and assumptions

-   The product is initially designed for small teams and organizations.
-   Organization is the tenant boundary.
-   V1 uses Owner, Admin, and Member roles.
-   The backend is the primary deliverable.
-   Current stack: Node.js 24, TypeScript, Express 5, PostgreSQL 18,
    Prisma 7 with PostgreSQL adapter, Zod, Vitest, Supertest, Pino,
    Docker Compose, pnpm workspace, and GitHub Actions.
-   The current operational plan targets a single VPS for V1.
-   This is a portfolio engineering project. No commercial demand
    validation, production customer usage, or performance benchmark is
    claimed.

## 12. Product risks

  -----------------------------------------------------------------------
  Risk                    Product impact          Mitigation direction
  ----------------------- ----------------------- -----------------------
  Cross-tenant data       Severe confidentiality  Tenant-scoped
  exposure                failure                 authorization, database
                                                  integrity, negative
                                                  security tests

  Incorrect role          Unauthorized changes or Explicit permission
  permissions             blocked legitimate work rules and authorization
                                                  tests

  Concurrent membership   Organization may lose   Transaction and locking
  changes                 its last Owner          strategy, concurrency
                                                  tests

  Inconsistent issue      Issue assigned to an    Membership-based
  assignment              ineligible user         assignment and database
                                                  constraints

  Invitation delivery     Users cannot receive    Durable outbox, retry,
  failure                 invitations promptly    manual resend

  Scope expansion         V1 becomes too large to Explicit non-goals and
                          finish                  versioned scope
                                                  decisions

  Specification drift     Implementation no       Update authoritative
                          longer matches intended specifications and
                          behavior                decision records
  -----------------------------------------------------------------------

## 13. Relationship to other project documents

This PRD intentionally does not duplicate detailed engineering
specifications.

  -----------------------------------------------------------------------
  Document                            Authority
  ----------------------------------- -----------------------------------
  Project Overview / Project Charter  Overall project purpose,
                                      engineering intent, workflow
                                      context

  Problem Definition & Requirements   Detailed functional requirements,
  Specification                       business rules, NFRs, constraints

  Domain Map                          Domain entities, relationships,
                                      lifecycle rules, authorization
                                      boundaries, invariants

  API Specification                   HTTP endpoints, request/response
                                      contracts, validation, errors, API
                                      behavior

  Database Specification              Physical schema, constraints,
                                      indexes, transactions, locking,
                                      persistence

  Implementation Plan                 Vertical-slice order, dependencies,
                                      tasks, Definition of Done

  Engineering Decision Records        Rationale, alternatives, and
                                      trade-offs for consequential
                                      decisions
  -----------------------------------------------------------------------

If this PRD conflicts with a more detailed approved specification, do
not silently choose one. Identify and reconcile the conflict. Detailed
specifications remain authoritative for their respective technical
domains.

## 14. Change management

-   Product-scope changes must be reviewed before becoming V1
    commitments.
-   New capabilities should be classified as V1, deferred, or
    future-version scope.
-   Changes to business behavior must update the Domain Map or
    requirements.
-   Changes to API behavior must update the API Specification.
-   Changes to persistence or integrity must update the Database
    Specification.
-   Consequential technical choices must be recorded in Engineering
    Decision Records.
-   Superseded decisions and specifications should be retained as
    history, not silently overwritten.

------------------------------------------------------------------------

## Appendix A --- Product description

Multi-Tenant Project Management API is a backend for a collaborative
project-management platform serving multiple organizations through one
application. Each organization has its own members, roles, projects, and
issues, with organization-scoped authorization and tenant isolation. V1
supports account and session management, organization membership and
invitations, project and issue management, comments, activity history,
and notifications. Its product promise is to help teams coordinate
ownership and progress while preserving clear access boundaries and
consistent work history.

## Appendix B --- Interview-safe status statement

The project is a portfolio build moving from specification into
implementation. The domain, API, database, and implementation plans have
been documented. Features should be described as implemented only after
their code, tests, and relevant behavior have been verified. This PRD
makes no claim of production usage, customer validation, or measured
performance.
