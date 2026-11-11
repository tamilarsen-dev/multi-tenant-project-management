# Product Requirements Document

| Field | Value |
|---|---|
| Status | Active |
| Owner | T. Tamil Arsen |
| Last updated | 2026-11-11 |
| Scope | Product V1 |

This PRD defines **why** the product exists, **who** it serves, and **what** V1 includes. Detailed, testable requirements live in [Requirements](requirements.md). Implementation progress lives in the [Roadmap](../plan/roadmap.md), never here.

---

## 1. Product Overview

### 1.1 Product Description

A multi-tenant project management SaaS platform that enables teams to organize projects, manage issues, assign responsibilities, and track work progress within an organization.

The platform provides organization-scoped workspaces. An Organization acts as the primary tenant boundary. A user can belong to multiple organizations and may hold different roles in each organization.

The product focuses initially on software teams that need structured project and issue management.

### 1.2 Product Positioning

The product is a SaaS-style collaborative project and issue management platform inspired by tools such as Jira and Linear.

Its initial value proposition is to provide:

- Organization-based workspaces.
- Secure multi-tenant data isolation.
- Role-based access control.
- Structured project and issue workflows.
- Collaboration through comments and activity history.
- Notifications for important work events.

The product is designed with SaaS operation in mind. However, commercial capabilities such as billing, subscription management, and usage-based plans are outside the V1 scope.

The initial release does not claim validated market demand or established commercial traction.

---

## 2. Problem Statement

Software teams need a centralized environment to organize projects, track issues, assign responsibilities, and maintain the context and history of their work.

Without a structured system:

- Work items become difficult to track.
- Ownership and responsibility may be unclear.
- Project progress is difficult to understand.
- Discussions and decisions become disconnected from the work they concern.
- Organizational access may be difficult to control consistently.
- Data belonging to different organizations must remain isolated.

The product addresses these problems through organization-scoped project and issue management, membership-based authorization, and collaboration capabilities.

---

## 3. Target Users and Actors

### 3.1 Primary Target Segment

Small software teams that need structured project and issue tracking.

This is the initial target segment and product assumption. It has not yet been validated through customer research.

### 3.2 Organization Roles

The V1 product defines three organization-level roles.

| Role | Responsibility |
|---|---|
| OWNER | Owns the organization and has full organization-level administrative authority. |
| ADMIN | Manages delegated organization-level administrative responsibilities. |
| MEMBER | Participates in projects and manages issues within the organization. |

A user's role belongs to their Membership, not to their global User identity.

The same user may have different roles in different organizations.

GUEST is excluded from V1.

### 3.3 Primary Actors

- **Unauthenticated visitor:** Registers or logs in.
- **Authenticated user:** Accesses resources permitted by their membership and role.
- **Organization Owner:** Manages organization-level administration and ownership.
- **Organization Admin:** Manages delegated organizational resources.
- **Organization Member:** Participates in project and issue workflows.

Detailed authorization rules are maintained in [Permissions](../design/permissions.md).

---

## 4. Product Goals

The V1 product aims to:

1. Provide secure user registration and authentication.
2. Allow users to create and participate in multiple organizations.
3. Enforce organization-level tenant isolation.
4. Provide role-based access control within organizations.
5. Allow teams to create and manage projects.
6. Allow teams to create, assign, prioritize, and track issues.
7. Preserve collaboration context through comments and activity history.
8. Provide notifications for relevant work events.
9. Maintain predictable behavior during failures and concurrent operations.
10. Provide a secure, maintainable, testable, and deployable SaaS backend foundation.

These goals describe intended product outcomes, not current implementation completion.

---

## 5. V1 Product Scope

### 5.1 Identity and Authentication

Users should be able to:

- Register an account.
- Log in.
- Retrieve their current authenticated identity.
- Log out.
- Maintain an authenticated session.
- Refresh an authenticated session.

The intended authentication model uses opaque Bearer session tokens, with token hashes stored in the database.

### 5.2 Organization Management

Users should be able to:

- Create an organization.
- Become the initial Owner of the organization.
- Access organizations in which they have active membership.
- Manage organization information within their permissions.
- Manage organization membership.
- Invite users to an organization.

Organization creation and initial Owner membership must be established atomically.

Organization deletion and archiving are excluded from V1.

### 5.3 Membership and Invitations

The product should support:

- Organization membership.
- Organization-level roles.
- Membership lifecycle management.
- Invitation creation, acceptance, revocation, and expiration.
- Invitation resend with token rotation.
- Membership removal.

Every organization must retain at least one active Owner.

A removed member must lose access to organization resources while historical attribution remains preserved.

### 5.4 Project Management

Users should be able to:

- Create projects within an organization.
- View projects.
- Update project information.
- Archive projects.
- Restore archived projects.

Project ownership and access are organization-scoped.

All active organization roles may create and read projects. Only OWNER and ADMIN may update, archive, or restore projects.

### 5.5 Issue Management

Users should be able to:

- Create and view issues.
- Update issue information.
- Assign issues to organization members.
- Set issue priority.
- Change issue status.
- Manage labels.
- Archive issues.
- Restore archived issues.

All active organization roles may participate in issue management, including archive and restore operations.

An Issue belongs to exactly one Project. An Issue assignee must be an active member of the same Organization.

When a member is removed, their assigned issues are automatically unassigned.

### 5.6 Collaboration

The product should support:

- Comments on issues.
- Comment editing and deletion.
- Activity history.
- Notifications for relevant work events.

Comment authors may edit or delete their own comments. Moderation of other members' comments follows [Permissions](../design/permissions.md#26-comments).

Deleted comments should preserve historical context through a deletion state rather than being silently hard-deleted.

### 5.7 Notifications

V1 includes in-app notifications for important events:

- Organization invitations.
- Issue assignment.
- Issue reassignment.
- Relevant comments on assigned issues.
- Membership removal where notification delivery is appropriate.

Notifications should not be broadcast indiscriminately to every organization member.

The system should avoid notifying the actor about their own action.

Invitation email delivery is asynchronous and retryable (see [ADR-0008](../adr/0008-transactional-outbox-for-email.md)).

Email delivery beyond invitation-related communication is not required for the initial V1 scope.

---

## 6. Product Rules and Constraints

### 6.1 Tenant Isolation

An Organization is the primary tenant boundary.

All organization-scoped resources must be accessible only through valid membership and authorization.

A user's global identity does not independently grant access to organizational resources.

Cross-tenant data access must be prevented at the application and data-access boundaries.

### 6.2 Membership and Authorization

Organization-level permissions depend on active Membership and its role.

A user may have different roles in different organizations.

A removed member cannot access organization resources.

Each organization must have at least one active Owner.

### 6.3 Project and Issue Relationships

- A Project belongs to exactly one Organization.
- An Issue belongs to exactly one Project.
- An Issue assignee must belong to the same Organization as the Project.
- Project and Issue relationships must not cross tenant boundaries.

### 6.4 Membership Lifecycle

Membership uses the following lifecycle:

- ACTIVE
- REMOVED

Removing a member revokes access and unassigns their assigned issues.

Historical comments and activity attribution remain preserved.

Re-inviting a previously removed user reactivates the existing membership rather than creating a duplicate membership for the same organization-user pair.

### 6.5 Invitation Lifecycle

Invitation uses the following states:

- PENDING
- ACCEPTED
- REVOKED
- EXPIRED

An invitation expires after seven days.

Resending a pending invitation rotates its token and invalidates the previous token.

Invitation acceptance requires an authenticated user whose email matches the invitation recipient.

Invitation tokens must be stored as hashes, not plaintext.

### 6.6 Resource Lifecycle

Projects and Issues use archive and restore operations rather than hard deletion.

Comments preserve historical context through soft deletion.

Organizations cannot be deleted or archived in V1.

---

## 7. Success Criteria

V1 is considered functionally successful when:

1. Users can register, log in, retrieve their identity, refresh their session, and log out.
2. Users can create organizations and become their initial Owner.
3. Users can participate in multiple organizations with independent roles.
4. Organization data is isolated from other tenants.
5. Unauthorized users cannot access protected organization resources.
6. Projects can be created and managed according to role permissions.
7. Issues can be created, assigned, updated, archived, and restored.
8. Membership removal revokes access and preserves historical attribution.
9. Comments and activity history remain associated with relevant work items.
10. Notifications are delivered for supported events without unnecessary broadcasts.
11. Business invariants remain valid during concurrent operations and partial failures.
12. The application can be tested, deployed, monitored, backed up, and recovered using documented procedures.

These are V1 acceptance outcomes, not claims of current completion. Detailed verification criteria belong in the Requirements and testing documentation.

---

## 8. Non-Functional Requirements

### 8.1 Security

- Authentication is required for protected resources.
- Authorization must be enforced server-side.
- Tenant isolation must prevent cross-organization access.
- Passwords must be securely hashed.
- Session and invitation tokens must not be stored in plaintext.
- Sensitive information must not leak through error responses or logs.

### 8.2 Consistency and Reliability

- Critical multi-step operations must preserve atomicity.
- Organization ownership invariants must remain valid.
- Membership and Issue assignment must remain consistent.
- Concurrent modifications must have predictable outcomes.
- Asynchronous event delivery must support retry and failure handling.

### 8.3 Performance

Initial V1 performance acceptance targets:

| Metric | Target |
|---|---|
| Read API latency | p95 ≤ 500 ms |
| Write API latency | p95 ≤ 700 ms |
| Valid-request error rate under test | < 1% |
| Unauthorized cross-tenant access | 0 successful cases |

Latency targets must be measured under documented test conditions and a defined workload. The workload profile is defined in [Operations §6](../engineering/operations.md#6-performance-and-capacity); until a load test with that profile has run, these are engineering targets, not measured performance claims.

### 8.4 Maintainability

- Clear separation of responsibilities.
- Consistent API conventions.
- Automated tests for critical business behavior.
- Documented architectural decisions.
- Reproducible development and deployment procedures.

### 8.5 Operational Reliability

The initial deployment target is a single VPS.

The system must provide:

- HTTPS.
- Secure configuration and secret management.
- Application logging.
- Error monitoring.
- Health checks.
- Database backup.
- Tested database recovery procedures.
- Migration management.
- Deployment and rollback procedures.

High availability and horizontal scaling are not guaranteed by the initial deployment model.

---

## 9. Non-Goals

The following are excluded from V1:

- GUEST role.
- Real-time collaborative editing.
- Built-in chat or video calls.
- Billing and subscription management.
- SSO/SAML.
- Native mobile applications.
- Microservices architecture.
- Custom permission systems.
- Custom workflows.
- Watchers.
- Dedicated search infrastructure.
- Global or semantic search.
- Real-time push notification infrastructure.
- Kubernetes.
- Multi-region deployment.
- Multi-instance high availability.
- Redis unless justified by a concrete requirement.

These exclusions limit initial scope; they do not prohibit future product evolution.

---

## 10. Product Assumptions and Constraints

### 10.1 Product Assumptions

- Small software teams are an appropriate initial target segment.
- Organization-based isolation is essential.
- OWNER, ADMIN, and MEMBER are sufficient roles for V1.
- Issue tracking is a central workflow.
- A backend API is the primary initial product deliverable.
- A single VPS is sufficient for the initial deployment target, subject to operational safeguards.
- Commercial SaaS capabilities can be introduced after the core product workflows are established.

These assumptions may be revisited when evidence or requirements change.

### 10.2 Technical Foundation

The intended technical stack is:

- Node.js 24
- TypeScript
- Express 5
- PostgreSQL 18
- Prisma 7
- Zod
- Vitest
- Supertest
- Pino
- Docker Compose
- pnpm workspace
- GitHub Actions
- Single VPS deployment

The dependency manifests (`package.json`, `pnpm-lock.yaml`) are the authoritative evidence of the actual versions in use.

---

## 11. Risks

### 11.1 Tenant Isolation

Incorrect authorization or data access boundaries can expose one organization's data to another.

Tenant isolation must be tested as a critical security requirement.

### 11.2 Authorization Complexity

Permissions must remain consistent across organization, membership, project, issue, and collaboration operations.

### 11.3 Data Consistency

Membership removal, Issue assignment, organization ownership, and concurrent updates must preserve domain invariants.

### 11.4 Scope Expansion

The product includes several domains. Development must follow a controlled implementation sequence rather than introducing all domains simultaneously.

### 11.5 Operational Risk

A single VPS introduces a single point of failure. Backup, recovery, monitoring, and deployment procedures are therefore required.

### 11.6 Product Validation

The initial target segment and product assumptions have not been validated with real customers. Product-market fit and commercial demand remain unknown.

---

## 12. Maintenance

Update this document when product goals, target users, V1 scope, assumptions, or acceptance outcomes change. Implementation progress must not redefine product scope: a feature that is not built yet is still in scope until this document says otherwise.
