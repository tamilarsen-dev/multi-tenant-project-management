# Phase 0.4 --- Implementation Plan

**Project:** Multi-Tenant Project Management API\
**Status:** Finalized planning artifact; implementation not yet
verified.\
**Stack:** Node.js 24, TypeScript, Express 5, PostgreSQL 18, Prisma,
Zod, Vitest, Supertest, Pino.

## 1. Purpose and principles

This plan turns Phase 0.1 (Domain Map), Phase 0.2 (API Specification),
and Phase 0.3 (Database Specification) into executable work.

Principles: 1. Deliver feature-based vertical slices, not isolated
layers. 2. Decompose each slice into small, independently verifiable
technical tasks. 3. Introduce schema incrementally in dependency order.
4. Resolve specification gaps before implementing assumptions. 5.
Prioritize tenant isolation, authorization, concurrency, and data
integrity tests. 6. Keep V1 infrastructure aligned with the agreed
single-VPS architecture. 7. Use forward-only migrations; applied
migrations are immutable. 8. Never perform external I/O inside a
database transaction. Use the transactional Outbox.

## 2. Overall sequence

  -------------------------------------------------------------------------------------------------
                  Order Epic / Slice     Outcome                                   Dependency
  --------------------- ---------------- ----------------------------------------- ----------------
                      0 Implementation   Conventions and test harness ready        Existing
                        foundation                                                 technical
                                                                                   foundation

                      1 Authentication & Register, login, sessions,                Foundation
                        Organization     create/list/read/update Organization      

                      2 Membership &     Role management, revocation, invitations, Epic 1
                        Invitation       acceptance, email Outbox                  

                      3 Project          Create/read/list/update/archive/restore   Epic 2
                        Management       Projects                                  

                      4 Issue Management Create, number, assign, transition,       Epic 3
                                         archive/restore Issues                    

                      5 Collaboration    Comments, Activity feed, Notifications    Epic 4

                      6 Hardening &      Security, concurrency, operations,        Required slices
                        Release          deployment, release                       
  -------------------------------------------------------------------------------------------------

First delivery target: **Register → Login → Create Organization**.

## 3. Implementation foundation

This is shared technical preparation, not a business feature.

  -----------------------------------------------------------------------
  Task                    Deliverable             Verification
  ----------------------- ----------------------- -----------------------
  FND-01                  Define                  Architecture notes
                          route/controller,       reviewed
                          application service,    
                          repository, domain,     
                          infrastructure          
                          responsibilities        

  FND-02                  Standard application    Unit tests
                          error and HTTP          
                          error-envelope mapping  

  FND-03                  Shared Zod validation   Invalid-input API tests
                          convention for          
                          params/query/body       

  FND-04                  Managed Prisma client   PostgreSQL integration
                          lifecycle and           smoke test
                          repository access       
                          convention              

  FND-05                  Deterministic test DB   Repeated test runs
                          setup, migration,       
                          cleanup, teardown       

  FND-06                  Test factories/fixtures Helpers exercised in
                          and authenticated       tests
                          request helpers         

  FND-07                  OpenAPI update and      CI validation
                          validation workflow     

  FND-08                  Request ID, structured  Inspect logs for secret
                          logging, safe error     leakage
                          context                 
  -----------------------------------------------------------------------

Exit: clean database can be migrated; tests initialize and teardown
reliably; validation/error conventions are documented.

## 4. Migration plan

Incremental migration baseline:

  Migration   Tables / structures
  ----------- -------------------------------------
  M001        Users, Sessions
  M002        Organizations, Memberships
  M003        Invitations, OutboxEvents
  M004        Projects
  M005        Issues
  M006        Comments, Activities, Notifications

This is a dependency-based baseline, not a requirement that every group
be exactly one migration. If Activity is required by an earlier slice,
introduce its minimum schema earlier and extend it later. Review actual
FK dependencies before authoring migrations.

Every migration must apply from a valid prior state, include required
constraints/indexes, be tested, and never be edited after application.

## 5. Epic 1 --- Authentication & Organization

**Outcome:** User can register, authenticate, manage sessions, and
create/list/read/update Organizations.

**Migration:** M001 Users/Sessions; M002 Organizations/Memberships.

  -----------------------------------------------------------------------
  Task                    Deliverable             Verification
  ----------------------- ----------------------- -----------------------
  AUTH-01                 User schema, normalized Migration and schema
                          unique email, migration tests

  AUTH-02                 Argon2id hash/verify    Unit tests; plaintext
                          service                 never persisted

  AUTH-03                 Register User + Session API tests; duplicate
                          atomically              email and validation

  AUTH-04                 Session repository;     PostgreSQL integration
                          SHA-256 token hash      tests

  AUTH-05                 Login and create new    Valid/invalid
                          Session                 credential API tests

  AUTH-06                 Bearer authentication   Expired, revoked,
                          middleware              invalid-token tests

  AUTH-07                 Atomic refresh rotation Concurrent refresh:
                                                  only one succeeds

  AUTH-08                 Logout current Session  Other sessions remain
                          only                    valid

  ORG-01                  Organization schema and Migration/constraint
                          OCC version             tests

  ORG-02                  Create Organization +   Rollback/atomicity
                          Owner Membership +      tests
                          Activity atomically     

  ORG-03                  List Organizations with Multi-organization API
                          Membership context      tests

  ORG-04                  Read Organization with  Cross-tenant 404
                          tenant-aware lookup     

  ORG-05                  Owner/Admin update with Role matrix and
                          OCC                     stale-version 409

  DOC-01                  Auth and Organization   OpenAPI validation
                          OpenAPI definitions     
  -----------------------------------------------------------------------

Acceptance: - Register atomically creates User and Session. - Passwords
use Argon2id; raw session tokens are not stored. - Session lifetime is
seven days; refresh rotates atomically; logout revokes current session
only. - Create Organization atomically creates Organization, Owner
Membership, and Activity. - Cross-tenant/inaccessible resource lookup
follows 404 tenant-hiding policy. - Relevant tests, typecheck, lint,
OpenAPI validation, and CI pass.

## 6. Epic 2 --- Membership & Invitation

**Outcome:** Role-aware Membership management and secure Invitation
lifecycle with asynchronous email.

**Migration:** M003 Invitations/OutboxEvents; M002 already introduced
Membership.

  -------------------------------------------------------------------------------
  Task                    Deliverable             Verification
  ----------------------- ----------------------- -------------------------------
  MEM-01                  Centralized             Role-matrix unit tests
                          role/authorization      
                          policy                  

  MEM-02                  Membership list, active Role-specific API tests
                          default, permitted      
                          removed filter          

  MEM-03                  OCC-protected role      Stale-version and authorization
                          change                  tests

  MEM-04                  Last Owner protection   Concurrent demotion/removal
                          using Organization lock test

  MEM-05                  Revocation, Issue       Integration and consistency
                          unassignment, Activity  tests
                          atomically              

  INV-01                  Invitation schema,      Migration/constraint tests
                          token hash, partial     
                          unique index            

  INV-02                  Invitation policy,      Concurrent duplicate-create
                          normalized email,       tests
                          advisory lock           

  INV-03                  Secure token generation Unit tests; raw token absent
                          and SHA-256 hash        from table

  INV-04                  AES-256-GCM Outbox      Round-trip and tamper-detection
                          payload encryption      tests

  INV-05                  Worker claim with SKIP  Concurrent worker claim test
                          LOCKED and lease        

  INV-06                  Delivery,               Retry schedule and
                          transient/permanent     terminal-state tests
                          errors, bounded retries 

  INV-07                  Lease recovery and      Failure-injection/concurrency
                          stale-worker protection tests

  INV-08                  Email provider adapter  Provider test-double
                          outside DB transaction  integration test

  INV-09                  Lazy and scheduled      `expires_at <= now` boundary
                          Invitation expiration   tests

  INV-10                  Resend same token,      API/concurrency tests
                          60-second cooldown, no  
                          expiry extension        

  INV-11                  Authenticated           Integration/API atomicity tests
                          acceptance, email       
                          match, Membership       
                          create/reactivate       

  DOC-02                  Membership and          OpenAPI validation
                          Invitation OpenAPI      
                          definitions             
  -------------------------------------------------------------------------------

Acceptance: - Owner invites Admin/Member; Admin invites Member only;
Member cannot invite; Owner cannot be assigned through Invitation. - One
pending Invitation per Organization/normalized email. - Acceptance
requires authenticated User and normalized email match. - Membership
creation/reactivation and Invitation acceptance are atomic. - Last
active Owner cannot be removed/demoted. - Revocation unassigns Issues in
the same transaction. - Outbox is at-least-once, lease-based, and
protects against stale workers. - Raw Invitation token is never logged
or stored unencrypted in Outbox.

## 7. Epic 3 --- Project Management

**Outcome:** Active Organization members create Projects; Owner/Admin
update, archive, and restore.

**Migration:** M004 Projects.

  -----------------------------------------------------------------------
  Task                    Deliverable             Verification
  ----------------------- ----------------------- -----------------------
  PRJ-01                  Project schema, OCC     Migration tests
                          version, archive        
                          timestamp, migration    

  PRJ-02                  Create Project          Active Membership
                                                  authorization tests

  PRJ-03                  Cursor-paginated        Pagination tests
                          active/archived listing 

  PRJ-04                  Tenant-aware Project    Cross-tenant 404
                          read                    

  PRJ-05                  Owner/Admin update with Role and stale-version
                          OCC                     tests

  PRJ-06                  Idempotent archive      API tests; Issues
                                                  unchanged

  PRJ-07                  Idempotent restore      API tests

  PRJ-08                  Activity events for     Transaction atomicity
                          Project mutations       tests

  DOC-03                  Project OpenAPI         OpenAPI validation
                          definitions             
  -----------------------------------------------------------------------

Acceptance: - All active roles may create Projects. - Owner/Admin may
update/archive/restore. - Names are not assumed unique. - Archive does
not archive Issues automatically. - Archived Project cannot be modified
or accept new Issues. - Cursor pagination is deterministic; mutation and
Activity are atomic.

## 8. Epic 4 --- Issue Management

**Outcome:** Active Organization members create/manage Issues, assign
them, transition status, archive, and restore.

**Migration:** M005 Issues, tenant composite FKs, number uniqueness,
listing indexes.

  -----------------------------------------------------------------------
  Task                    Deliverable             Verification
  ----------------------- ----------------------- -----------------------
  ISS-01                  Issue schema and tenant Migration/constraint
                          FKs                     tests

  ISS-02                  Atomic Project counter  Concurrent creation; no
                          allocation              duplicate numbers

  ISS-03                  Create Issue, optional  API/integration tests
                          assignee, Activity      

  ISS-04                  Cursor-paginated list   Pagination/query tests
                          and exact number lookup 

  ISS-05                  Tenant-aware read       Cross-tenant 404

  ISS-06                  OCC-protected update    Stale-version tests

  ISS-07                  Assignment with         Assignment/revocation
                          Membership lock and     race test
                          active check            

  ISS-08                  Domain status           All allowed/invalid
                          transition policy       transitions unit tests

  ISS-09                  Idempotent archive      API tests

  ISS-10                  Idempotent restore      API tests, archived
                                                  Project rules

  ISS-11                  Activity integration    Atomicity tests

  DOC-04                  Issue OpenAPI           OpenAPI validation
                          definitions             
  -----------------------------------------------------------------------

Acceptance: - Composite FKs prevent cross-tenant Project/assignee
references. - Assignee must be an active Membership at assignment
time. - Issue number unique per Project and allocated atomically. -
Invalid transitions return 422; stale version returns 409. - Archived
Project blocks Issue creation/modification. - Tenant, concurrency, API,
and integration tests pass.

Allowed transitions:

  Current       Allowed next
  ------------- ------------------------------
  TODO          IN_PROGRESS, CANCELLED
  IN_PROGRESS   IN_REVIEW, CANCELLED
  IN_REVIEW     IN_PROGRESS, DONE, CANCELLED
  DONE          IN_PROGRESS
  CANCELLED     TODO

## 9. Epic 5 --- Collaboration

**Outcome:** Comments, append-only Activity feed, and persisted in-app
Notifications work together.

**Migration:** M006 Comments, Activities, Notifications, constraints,
and indexes. If Activity is needed earlier, introduce the minimum
required structure earlier and extend it later.

  -------------------------------------------------------------------------
  Task                    Deliverable             Verification
  ----------------------- ----------------------- -------------------------
  COL-01                  Comment schema, tenant  Migration tests
                          FKs, length constraint, 
                          index                   

  COL-02                  Create Comment with     API/integration tests
                          active Membership and   
                          archive checks          

  COL-03                  Update Comment with     Authorization/version
                          author/role policy and  tests
                          OCC                     

  COL-04                  Soft delete and deleted Idempotency/API tests
                          placeholder             

  COL-05                  Activity schema and     Runtime-role privilege
                          runtime append-only     test
                          privileges              

  COL-06                  Activity writer in      Rollback/atomicity tests
                          domain transaction      

  COL-07                  Tenant-aware cursor     Pagination/cross-tenant
                          Activity feed           tests

  COL-08                  Notification schema,    Migration/constraint
                          snapshot, uniqueness    tests

  COL-09                  Event-to-recipient      Unit/integration tests
                          policy and no           
                          self-notification       

  COL-10                  Notification inbox and  API/query tests
                          unread filtering        

  COL-11                  Idempotent              API tests
                          mark-one/read-all       

  COL-12                  Indexed 90-day batched  Cleanup integration test
                          retention cleanup       

  DOC-05                  Collaboration OpenAPI   OpenAPI validation
                          definitions             
  -------------------------------------------------------------------------

Acceptance: - All active roles read/create Comments; Member manages own,
Owner/Admin manage others'. - Archived Issue/Project blocks Comment
create/update. - Comment body is never copied into Activity metadata. -
Runtime role cannot UPDATE/DELETE Activity. - Domain mutation, Activity,
and Notification commit atomically. - Notification includes
`schemaVersion: 1`, persists after Membership removal, and is unique per
Activity/recipient. - No self-notification or notifications to users no
longer members at event time. - Retention, tenant, authorization, and
pagination tests pass.

## 10. Epic 6 --- Hardening & Release

  ------------------------------------------------------------------------
  Workstream              Deliverable              Verification
  ----------------------- ------------------------ -----------------------
  Security                Tenant/authorization     Automated security
                          matrix, token/secret/log tests and manual review
                          review                   

  Concurrency             Last Owner, invitation   Deterministic DB-backed
                          uniqueness, refresh,     concurrency tests
                          numbering,               
                          assignment/revocation,   
                          leases, OCC              

  Database                Clean migration,         CI migration tests;
                          FK/constraint/index      controlled EXPLAIN
                          review, query plans      

  Reliability             Worker restart, lease    Failure-injection tests
                          expiry, retries,         
                          provider/DB failures     

  Performance             Representative workload, Load test; p50/p95/p99
                          pagination, pool and     observations
                          slow-query review        

  Observability           Request IDs, structured  Staging verification
                          logs, metrics,           
                          health/readiness,        
                          alerts/runbooks          

  Deployment              Compose production       Staging deploy and
                          config, HTTPS, firewall, restore test
                          non-root, secrets,       
                          backup                   

  Release                 Migration order,         Release review/sign-off
                          compatibility, incident  
                          procedure, release       
                          checklist                
  ------------------------------------------------------------------------

Acceptance: - CI passes from clean checkout and clean database. -
Production migration uses `prisma migrate deploy`. - Tenant isolation
and authorization matrix pass. - Concurrency invariants pass under
concurrent requests. - Outbox survives worker crash and lease expiry. -
Backup restore is demonstrated. - Staging health checks work; logs
contain no secrets or raw tokens. - Runbooks and release notes are
ready.

## 11. Testing strategy

  -----------------------------------------------------------------------
  Test type               Purpose                 Typical tools
  ----------------------- ----------------------- -----------------------
  Unit                    Isolated domain rules   Vitest
                          and pure logic          

  Integration             Real component          Vitest + PostgreSQL
                          interactions,           
                          especially              
                          PostgreSQL/Prisma       

  API/HTTP                Status, headers, auth,  Supertest
                          validation, response    
                          envelope                

  E2E                     Complete business       Vitest + Supertest +
                          workflow                PostgreSQL

  Security                Tenant isolation,       Automated tests +
                          authorization, token    review
                          and privilege           
                          boundaries              

  Concurrency             Race conditions, locks, Concurrent DB-backed
                          OCC, leases, uniqueness operations
  -----------------------------------------------------------------------

Not every function needs every test type. Choose the smallest test set
that proves the behavior and important failure modes. Coverage is
diagnostic, not proof of tenant isolation or concurrency correctness.

## 12. Definition of Done

A slice is complete only when all applicable criteria pass:

  Category         Completion condition
  ---------------- ----------------------------------------------------------
  Specification    Acceptance criteria align with Phases 0.1--0.3
  Database         Migration, FK, constraints, indexes match slice
  Implementation   Business logic, errors, validation complete
  Security         Authentication, authorization, tenant isolation verified
  Testing          Relevant tests pass
  Documentation    OpenAPI and engineering docs updated
  Observability    Structured logs/error context without secret leakage
  Quality          Typecheck, lint, CI pass
  Review           Code and migration reviewed; changes integrated

Mark **Not Applicable** only with a reason. A working endpoint or
completed code is not sufficient by itself.

## 13. Risk register

  -----------------------------------------------------------------------
  Risk                    Impact                  Mitigation
  ----------------------- ----------------------- -----------------------
  Database design         Rework/unsafe           Validate migration and
  mismatch                migrations              integration behavior
                                                  before dependent slices

  Tenant isolation        Cross-organization data Cross-tenant tests for
  failure                 exposure                every resource family

  Concurrency bugs        Duplicate               Locks, OCC, unique
                          data/invariant          constraints,
                          violations              concurrency tests

  Scope expansion         Delivery stalls         Freeze V1; track
                                                  deferred items
                                                  separately

  Prisma abstraction      Incorrect persistence   Reviewed custom SQL
  leakage                 semantics               where PostgreSQL
                                                  behavior requires it

  Overengineering         Complexity and          Keep single-VPS design;
                          operating cost          require evidence for
                                                  added infrastructure

  Unverified assumptions  Design fails despite    Convert assumptions
                          documentation           into acceptance
                                                  tests/staging checks

  Migration               Outage/unsafe rollback  Forward-only and
  incompatibility                                 expand-and-contract

  Duplicate Outbox        Duplicate email         At-least-once design
  delivery                                        and provider
                                                  idempotency where
                                                  supported

  Recovery failure        Downtime/data loss      Restore drills,
                                                  runbooks, backup
                                                  verification
  -----------------------------------------------------------------------

## 14. Dependency tracking

Use existing GitHub Issues or Project Tracker; no additional platform is
required.

Each task records: 1. Prerequisites. 2. Concrete deliverable. 3.
Verification method. 4. Blockers. 5. Relevant security, data-integrity,
concurrency, or operational risk.

Link dependencies explicitly. Keep tasks small enough to review and
verify independently.

## 15. Git and review workflow

-   Use focused feature branches and existing Conventional Commits.
-   Keep schema and application changes reviewable.
-   Never edit an applied migration; add a new migration.
-   Run focused tests during development and full CI before integration.
-   Review generated SQL, composite FKs, partial indexes, CHECK
    constraints, privileges, and locking queries.
-   Merge only when CI passes and acceptance criteria are met.

## 16. Readiness checklist

Before starting the first domain slice: - \[ \] Phase 0.1 Domain Map
reviewed. - \[ \] Phase 0.2 API Specification reviewed. - \[ \] Phase
0.3 Database Specification reviewed. - \[ \] Initial migration order
checked against FK dependencies. - \[ \] Test database lifecycle works
from empty database. - \[ \] Error, validation, repository, and
transaction conventions documented. - \[ \] OpenAPI validation runs in
CI. - \[ \] First slice acceptance criteria understood. - \[ \] Work
decomposed into reviewable tasks. - \[ \] No blocker prevents Register →
Login → Create Organization.

## 17. Decision register

  -----------------------------------------------------------------------
  ID                                  Decision
  ----------------------------------- -----------------------------------
  0.4.1                               Feature-based vertical slices
                                      decomposed into independently
                                      verifiable tasks

  0.4.2                               Incremental schema migrations
                                      following slice dependencies

  0.4.3                               Feature-based slices as planning
                                      unit; endpoint/component tasks
                                      nested inside

  0.4.4                               Unit, integration, API/HTTP, E2E,
                                      plus risk-based
                                      security/concurrency tests

  0.4.5                               Explicit DoD per slice; N/A
                                      requires rationale

  0.4.6                               Risk-based management and
                                      dependency tracking in existing
                                      GitHub Issues/Project Tracker
  -----------------------------------------------------------------------

## 18. Final status

Phase 0.4 is finalized as a planning artifact. It defines implementation
sequence, migration plan, vertical slices, technical tasks, testing,
DoD, risk management, and dependency tracking.

Next: execute the implementation foundation tasks, then the first domain
slice: **Register → Login → Create Organization**.

This plan is not evidence that implementation or verification has
already occurred.
