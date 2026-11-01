**Project:** Multi-Tenant Project Management API  
**Workflow Stage:** 01 — Understand  
**Document:** 2  
**Version:** 1.0  
**Status:** Approved

---

# Collaborative Issue Tracking Backend

## Domain Understanding

## 1. Document Purpose

This document describes the problem the project aims to solve, its business context, the core concepts in the issue-tracking domain, and the boundaries of the system to be built.

This document belongs to **01. Understand** in the engineering workflow.

Its focus is understanding the problem and domain, not defining implementation details. Decisions about business rules, the domain model, database schema, API contract, architecture, and technical mechanisms will be covered in subsequent stage documents.

## 2. Understanding the Business Problem

Jira and Linear are **project/issue management tools**. They help teams manage work that needs to be done and track changes to that work.

Imagine a team of 10 people developing an application.

Without a centralized system:

```text
Andi:
"Has the login bug been fixed?"

Budi:
"I think so."

Andi:
"Where is the PR?"

Budi:
"In the branch."

Citra:
"Which one?"

Budi:
"...the one from yesterday."
```

Work information is scattered across conversations, pull requests, documents, and team members' memories. As a result, team members may have different understandings of the status of the same piece of work.

With an issue tracker, work is represented as an **issue**:

```text
Issue #123
"Login fails after the password is changed"

Status: In Progress
Priority: High
Assignee: Budi
Project: Authentication
Labels: bug, backend

Comments:
Andi: "It happens in production."
Budi: "Found the cause."
Citra: "Verified on staging."
```

The fundamental problem is not simply how to create a task list.

> **How can a team coordinate continuously changing software work, with ownership and priority, while preserving context and history without losing information consistency?**

That is the primary problem this system aims to address.

## 3. Understanding the Work Management Domain

Conceptually, a work management system connects work, projects, and the people doing that work.

```text
                 Work Management
                       |
       +---------------+----------------+
       |               |                |
     Issues          Projects         People
       |               |                |
    Bug/task        Roadmap          Assignee
       |
   +---+---------+
   |       |     |
 Status Priority Comments
   |
 History
```

For example, a team wants to build a Google login feature.

That work can be divided into several issues:

```text
Project: Authentication

ISSUE-101
Setup Google OAuth

ISSUE-102
Database schema for OAuth accounts

ISSUE-103
Google callback endpoint

ISSUE-104
Frontend login button

ISSUE-105
Integration testing
```

Each issue has a state or **lifecycle**. A simple example:

```text
TODO
  |
  v
IN PROGRESS
  |
  v
IN REVIEW
  |
  v
DONE
```

In practice, a workflow can be more complex:

```text
TODO
  |
  v
IN PROGRESS
  |
  v
BLOCKED
  |
  v
IN PROGRESS
  |
  v
IN REVIEW
  |
  v
CHANGES REQUESTED
  |
  v
IN REVIEW
  |
  v
DONE
```

The diagram illustrates a possible workflow. It is not the final definition of statuses or transition rules in this project. The actual statuses and business rules will be determined during the Specify and Design stages.

The important point is that a team needs to know who is working on what, the current state of the work, why it is delayed, and what has happened previously.

## 4. The Role of an Issue Tracker in the Software Development Ecosystem

For a small team, GitHub Issues may be sufficient. A dedicated issue tracker becomes more useful as coordination needs grow, for example:

```text
20 developers
5 teams
100+ issues
multiple projects
dependencies
different priorities
release cycles
permissions
notifications
activity history
```

In this context, an issue tracker can act as the **system of record for work**: a centralized place to understand what work is being done and the context behind it.

Different systems have different responsibilities:

```text
Git:
"What code changed?"

Issue Tracker:
"What work are we doing?"
"Why are we doing it?"
"Who owns it?"
"What is its current state?"
"What happened to it?"

CI/CD:
"Can this code be built, tested, and deployed?"
```

They are connected, but they are not the same thing. Git manages code changes, the issue tracker manages work context, and CI/CD handles the build, test, and deployment process.

## 5. Core Problems in a Collaborative System

This domain is interesting because multiple people can interact with the same resource. That creates problems that are not apparent in simple CRUD examples.

### 5.1 Concurrent Change Consistency

Suppose Alice and Bob open the same issue. Both see:

```text
status = IN_PROGRESS
```

Alice changes the status to:

```text
IN_PROGRESS -> DONE
```

A few seconds later, Bob submits a change based on stale information:

```text
IN_PROGRESS -> BLOCKED
```

If the system does not handle concurrent changes correctly, Alice's change may be overwritten by Bob's. This problem is known as a **lost update**.

This demonstrates that a collaborative system must preserve consistency when multiple users modify the same data.

### 5.2 Duplicate Requests

Suppose a user clicks the Create Issue button, but the internet connection is poor. The user retries, and the server receives two requests:

```text
POST /issues
POST /issues
```

Without proper handling, two issues may be created even though the user intended to create only one.

This is a **duplicate request** problem. The system needs clearly defined behavior when the same request is submitted more than once.

### 5.3 Authentication, Authorization, and Tenant Isolation

Suppose a user attempts to remove a member from an Organization:

```http
DELETE /organizations/A/members/B
```

The system needs to answer three different questions:

```text
Who are you?
        |
        v
Authentication

Are you allowed to do this?
        |
        v
Authorization

Does this resource belong to the Organization
you are acting within?
        |
        v
Tenant isolation
```

Authentication identifies the user. Authorization determines which actions the user is allowed to perform. Tenant isolation ensures that data access is restricted to the correct Organization context.

All three are essential requirements in a multi-tenant system, not merely middleware details.

### 5.4 History and Change Context

If an issue stores only its latest status, the system may know that its current status is `DONE`, but it will not know how the issue reached that state.

Example of the required history:

```text
Activity #981

Alice changed status
IN_PROGRESS -> IN_REVIEW

2026-08-27 10:32
```

History helps team members understand what changed, who made the change, and when it happened.

Therefore, the system stores not only the **current state**, but also relevant change context.

## 6. The System to Be Built

We will not build a complete Jira or Linear clone. They serve only as **domain references**.

This project focuses on the core problem:

> A team needs a centralized system to manage software work, coordinate members, and keep work information and changes consistent.

Conceptually, the system has the following structure:

```text
Organization
    |
    +-- Members
    |
    +-- Projects
          |
          +-- Issues
                |
                +-- Status
                +-- Priority
                +-- Assignee
                +-- Labels
                +-- Comments
                +-- Activity History
```

Example:

```text
Organization
"Acme"

Project
"Payment System"

Issue
"Payment webhook occasionally duplicated"

status       = IN_PROGRESS
priority     = HIGH
assignee     = Alice
```

Alice then changes the issue status:

```text
IN_PROGRESS -> IN_REVIEW
```

The system records this change as an Activity. Bob can add a comment, and other team members can see the same work context.

This structure is a high-level view of the domain. Details about entities, relationships, attributes, constraints, and business rules will be defined during the Specify and Design stages.

## 7. System Boundaries and Conceptual Scope

This project focuses on a backend for collaborative issue tracking and team work management.

The system will cover the following core concepts:

- Organizations and Memberships.
- Projects within an Organization.
- Issues within Projects.
- Status and priority.
- Assignees who are members of the Organization.
- Labels.
- Comments.
- Activity history.
- Invitations and member management.
- Authentication and authorization in a multi-tenant context.
- Notifications that support workflows.

This project is **not** an implementation of every Jira or Linear feature. Features such as complex integrations with various external services, advanced roadmap planning, and all enterprise capabilities are not automatically included in scope.

The v1 feature scope and supported roles are summarized in the Project Overview. Detailed business rules will be defined during the Specify stage.

## 8. Why Was This Domain Chosen?

This domain is suitable for a portfolio project because it introduces real engineering problems without requiring an excessively broad business domain.

Through this domain, we can encounter and study:

```text
HTTP/API design
        |
        v
Authentication and authorization
        |
        v
Relational data modeling
        |
        v
Transactions and data integrity
        |
        v
Concurrency
        |
        v
Duplicate requests and idempotency
        |
        v
Background processing
        |
        v
Testing
        |
        v
Observability
        |
        v
Deployment
```

Each concept must have a reason rooted in system requirements. We do not use technology merely because it is popular.

For example, Redis is not automatically necessary just because many modern backends use it. Technology choices must be based on the problem being solved and the trade-offs being accepted.

## 9. Expected Outcomes of the Understand Stage

After understanding this domain, we should be able to explain:

1. What problems teams face when managing software work without a centralized system.
2. Why issues, projects, organizations, and memberships are core concepts.
3. How an issue tracker relates to Git and CI/CD.
4. Why collaborative systems need data consistency, change history, and access control.
5. The boundaries of the system being built and what is intentionally excluded from scope.

The Understand stage does not aim to produce a database schema, API endpoints, or a final architecture design. Its output is a sufficiently clear understanding of the domain and problem statement to proceed to **02. Specify**.
