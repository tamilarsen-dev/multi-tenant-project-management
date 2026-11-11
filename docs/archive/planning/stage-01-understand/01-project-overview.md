**Project:** Multi-Tenant Project Management API  
**Workflow Stage:** 01 — Understand  
**Document:** 1  
**Version:** 1.0  
**Status:** Approved

---

# Multi-Tenant Project Management API
## Project Overview / Project Charter

## 1. Project Overview

Multi-Tenant Project Management API is a project management backend inspired by products such as Jira and Linear. The application allows multiple Organizations to use the same platform while keeping each Organization's data and access isolated.

This project is developed as a portfolio project to demonstrate an understanding of software engineering and the ability to apply it, rather than merely the ability to create endpoints or write TypeScript.

The primary focus is to build a backend with realistic engineering requirements and challenges, then develop and verify it incrementally.

## 2. Product Scope

Application users can:

- Create an account and log in.
- Create an Organization.
- Invite other users to join an Organization.
- Manage members and roles.
- Create and manage Projects.
- Create and manage Issues or tasks.
- Assign Organization members to Issues.
- Manage Issue priorities and labels.
- Comment on Issues.
- Change Issue statuses.
- View Activities or change history.
- Receive notifications.
- Search, filter, sort, and paginate data.

The application uses a multi-tenant model. Each Organization has its own members, Projects, and operational data. Access to data must follow the user's membership and permissions in the relevant Organization.

## 3. Version 1 Scope

The first version focuses on an end-to-end usable project management foundation.

Organization roles in v1:

- `OWNER`
- `ADMIN`
- `MEMBER`

The `GUEST` role is outside the v1 scope. Adding a new role requires a separate design decision, including its permission definitions and access rules.

Core features will be developed through the following vertical slices:

1. **Identity & Organization**: registration, login, authentication, Organization creation, and Owner Membership.
2. **Projects**: Project creation, listing, details, updates, and archiving.
3. **Issues**: Issue creation, listing, details, updates, assignment, status, priority, labels, comments, Activities, filtering, and pagination.
4. **Membership & Invitations**: invitations, invitation acceptance and revocation, role changes, Membership revocation, and Invitation lifecycle.

Notifications and background processing will be developed when the feature flows that require them are implemented. Detailed priorities, business rules, data models, API contracts, acceptance criteria, and task sequencing are defined in the corresponding workflow-stage documents.

Each slice is developed as an end-to-end feature and verified before moving to the next slice.

## 4. Technology Stack

The current stack:

| Area | Technology |
|---|---|
| Runtime | Node.js |
| Language | TypeScript |
| HTTP framework | Express |
| Database | PostgreSQL |
| ORM | Prisma |
| Validation | Zod |
| Testing | Vitest, Supertest |
| API documentation | OpenAPI, Swagger UI |
| Containerization | Docker |
| Logging | Pino, pino-http |

Redis is not part of the active stack. Its use will be decided if implementation requirements justify it.

The repository structure and code architecture follow the actual repository state. This document does not prescribe an alternative folder structure or architectural pattern.

## 5. Engineering Concepts and Learning Scope

This project is intentionally designed to explore and apply software engineering problems more complex than ordinary CRUD implementation. The following concepts will be studied when feature requirements bring them into scope, then applied and verified in the application context.

### 5.1 Authentication

- Password hashing.
- Opaque database-backed Bearer session tokens.
- Storing token hashes rather than raw tokens.
- Session expiry and refresh rotation.
- Session management, logout, and session revocation.
- Authentication middleware.

### 5.2 Authorization

- Role-Based Access Control (RBAC).
- Organization-level permissions.
- `OWNER`, `ADMIN`, and `MEMBER` roles.
- Resource-level authorization.
- Tenant isolation.
- The distinction between authentication and authorization.

Authentication answers who is accessing the system. Authorization determines which actions and resources that user is allowed to access.

### 5.3 Database Design

- Relational data modeling.
- Entity relationships and cardinality.
- Primary keys, foreign keys, and composite foreign keys.
- Database normalization and deliberate denormalization.
- Unique constraints, check constraints, and indexes.
- Multi-tenant data modeling.
- Referential integrity.

### 5.4 Transactions & Concurrency

- ACID transactions.
- Transaction boundaries.
- Race conditions.
- Optimistic concurrency control.
- Pessimistic locking.
- Database consistency.

### 5.5 API Design

- RESTful API design.
- Request validation using Zod.
- Error handling and HTTP status codes.
- Pagination, filtering, and sorting.
- API documentation using OpenAPI.
- Consistent API contracts and response structures.

### 5.6 Software Architecture

- Separation of concerns.
- Layered architecture.
- Modular design.
- Domain modeling.
- Dependency management.
- Maintainability and testability.

### 5.7 Testing & Quality

- Unit testing.
- Integration testing.
- API testing.
- Test databases.
- Authorization and tenant-isolation testing.
- Edge cases and failure scenarios.

### 5.8 Background Processing

- Background jobs.
- Scheduled tasks.
- Invitation expiration.
- Notification processing.
- Retry and failure handling.

### 5.9 Observability

- Structured logging.
- Application health checks.
- Error monitoring.
- Metrics.
- Production issue debugging.

### 5.10 Deployment & Infrastructure

- Docker and Docker Compose.
- Development vs. production environments.
- Environment configuration.
- Database migrations.
- CI/CD pipelines.
- Deployment workflows.

This list represents the learning scope, not a requirement to use every technology at once. Each concept is implemented according to feature requirements and project design decisions. For example, concurrency will be studied when operations can conflict, such as two users updating the same Issue.

Detailed business rules, data models, API contracts, technical decisions, acceptance criteria, and implementation steps remain defined in the corresponding workflow-stage documents. This section serves as a competency map that the project aims to develop.

## 6. Development Approach

Feature development follows **feature-driven implementation through vertical slices**.

Work is sequenced according to the application's required features and dependencies between them. Each slice includes the components needed to make the feature work end to end, including database changes, application logic, APIs, validation, and automated tests.

Engineering foundations such as Node.js and TypeScript configuration, Express, PostgreSQL, Prisma, Docker, and testing are prepared before the first vertical slice. This preparation is supporting technical work, not a product-feature implementation phase.

## 7. Engineering Workflow

All project work follows this workflow:

1. **Understand** — understand the problem, context, and needs.
2. **Specify** — define requirements and business rules.
3. **Design** — design the domain, database, API, and architecture.
4. **Plan** — break the work into slices, tasks, and acceptance criteria.
5. **Implement** — write code and migrations.
6. **Verify** — run tests, security checks, and quality gates.
7. **Review** — conduct code and design reviews.
8. **Integrate** — merge and integrate changes.
9. **Deploy** — release the application to an environment.
10. **Observe** — monitor logs, metrics, and system health.
11. **Improve** — improve the system based on observations and feedback.

This workflow is iterative. Results from Verify, Review, or Observe may send work back to an earlier stage when issues or change requirements are found.

## 8. Learning and Engineering Principles

This project is also a way to build independent engineering skills. AI may assist with tasks such as generating boilerplate, explaining errors, reviewing code, suggesting tests, and identifying edge cases. However, AI usage must not replace the process of understanding and making technical decisions.

Before implementing a feature, the following questions should be answerable:

- What problem does it solve?
- Which invariants must be preserved?
- What data changes?
- Who is authorized to make the change?
- What happens if the request is repeated?
- What happens if the operation fails midway?
- What happens if multiple requests run concurrently?

The ultimate goal is to demonstrate the ability to design, build, test, and operate software, not merely produce code.
