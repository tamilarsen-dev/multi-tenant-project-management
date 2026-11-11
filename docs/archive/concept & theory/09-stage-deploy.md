# Stage 09 --- Deploy

  -----------------------------------------------------------------------
  Field                               Value
  ----------------------------------- -----------------------------------
  Project                             Multi-Tenant Project Management API

  Workflow Stage                      09 --- Deploy

  Document Type                       Stage Overview and Preparation Plan

  Version                             1.0

  Status                              Conceptual Preparation

  Related Stages                      05 --- Implement, 06 --- Verify, 07
                                      --- Review, 08 --- Integrate, 10
                                      --- Observe, 11 --- Improve
  -----------------------------------------------------------------------

## 1. Purpose

Stage 09 --- Deploy moves an integrated and release-ready version of the
application into a target environment.

Deployment is not merely copying files to a server or starting a
process. It is a controlled change to a running environment. It includes
preparing infrastructure, configuring runtime settings, managing
secrets, applying database migrations, starting the application,
checking its health, and having a recovery strategy if the release
fails.

The objective is to release a version safely, predictably, and
reproducibly while minimizing downtime, data risk, and disruption to
users.

**Important:** This document prepares the project for Stage 09. It does
not claim that the API has been deployed to production. Stage 05 remains
deliberately deferred while the remaining workflow stages are studied.

## 2. Position in the Workflow

  -----------------------------------------------------------------------
  Stage                               Main question
  ----------------------------------- -----------------------------------
  Implement                           Has the change been built?

  Verify                              Does it satisfy specified behavior?

  Review                              Is the change technically
                                      acceptable?

  Integrate                           Does it work with the shared
                                      codebase?

  Deploy                              Can this version be safely released
                                      to its target environment?

  Observe                             Does the running system behave as
                                      expected?

  Improve                             What should change based on
                                      evidence and feedback?
  -----------------------------------------------------------------------

Deployment is a transition from a version in the development and
integration workflow to a version running in an environment. Observation
then provides evidence about its behavior in that environment.

## 3. Environments

An environment is a configured place where an application runs for a
particular purpose.

Common environments include:

### 3.1 Development

Used for local implementation and debugging.

Typical characteristics: - Developer-controlled configuration. - Local
or shared development database. - Debug logging and development
tooling. - Frequent changes and resets when safe. - No production data
or production secrets.

### 3.2 Testing / CI

Used for automated validation.

Typical characteristics: - Reproducible environment setup. - Isolated
test data. - Automated database setup where required. - Deterministic
dependency installation. - Short-lived execution.

### 3.3 Staging

A pre-production environment intended to resemble production closely
enough to validate release behavior.

Useful for: - Deployment rehearsal. - Migration validation. -
Configuration checks. - Smoke tests. - Integration with external
services. - Operational readiness checks.

Staging is useful but not mandatory for every small project. Its value
depends on deployment risk and complexity.

### 3.4 Production

The environment serving actual users or consumers.

Production requires stronger controls for: - Secrets and access
permissions. - Database durability and backups. - Logging and
monitoring. - Network exposure. - Deployment and recovery procedures. -
Resource limits and operational security.

Environment separation reduces the chance that development activity
accidentally affects production systems.

## 4. Deployment Artifacts and Reproducibility

A deployment should use a known, identifiable version of the
application.

Typical artifacts and inputs include: - Source code at a specific commit
or release tag. - Dependency lockfile. - Build output or container
image. - Runtime configuration. - Database migration files. -
Infrastructure configuration. - Release metadata.

The goal is to make it possible to answer: - Which version is running? -
Which source commit produced it? - Which dependencies were installed? -
Which configuration is required? - Which migrations have been applied?

A deployment should not depend on undocumented files or accidental state
on an individual developer's machine.

### 4.1 Build once, promote deliberately

Where practical, build an immutable artifact once and promote the same
artifact through environments.

For example: 1. Build a container image from a known commit. 2. Validate
that image in a test or staging environment. 3. Promote the same image
to production. 4. Supply environment-specific configuration at runtime.

This reduces differences caused by rebuilding separately for each
environment.

## 5. Deployment Models

### 5.1 Traditional server deployment

The application runs directly on a virtual machine or physical server.

The deployment process may involve: - Provisioning the server. -
Installing the runtime. - Transferring application artifacts. -
Configuring environment variables. - Managing a process supervisor. -
Configuring a reverse proxy and TLS. - Restarting or replacing the
application process.

This model provides control but requires server maintenance and
operational knowledge.

### 5.2 Container deployment

The application is packaged into a container image containing the
application and its runtime dependencies.

A container image improves consistency between environments. It does not
automatically provide orchestration, high availability, backups, or
security.

The project already uses Docker Compose for local PostgreSQL
infrastructure. Production container deployment would require additional
decisions about image building, networking, persistent storage, secrets,
health checks, and process management.

### 5.3 Platform as a Service (PaaS)

A PaaS provider manages much of the runtime infrastructure.

The developer typically supplies application code or a container image
and configures build, runtime, environment variables, networking, and
attached services.

Advantages: - Less server administration. - Faster initial deployment. -
Managed runtime and infrastructure features.

Trade-offs: - Provider-specific behavior. - Pricing and resource
constraints. - Less control over infrastructure. - Potential migration
costs.

### 5.4 Orchestrated container deployment

An orchestrator manages container scheduling, service discovery,
scaling, and rollout behavior across infrastructure.

This can be useful for larger or more complex systems, but adds
operational complexity. A small portfolio API does not need Kubernetes
merely to demonstrate engineering competence.

## 6. Deployment Strategies

A deployment strategy controls how a new version replaces or runs
alongside the existing version.

### 6.1 Recreate deployment

Stop the old version, then start the new version.

Advantages: - Simple to understand and operate. - Low infrastructure
overhead.

Trade-offs: - Causes downtime during replacement. - A failed startup can
extend the outage.

### 6.2 Rolling deployment

Replace instances gradually while keeping other instances available.

Advantages: - Can reduce downtime. - Allows gradual replacement.

Trade-offs: - Old and new versions may run simultaneously. - They may
need backward-compatible APIs and database schemas. - Rollout
coordination is more complex.

### 6.3 Blue-green deployment

Maintain two production-like environments: - Blue serves the current
version. - Green receives and validates the new version. - Traffic
switches to Green after validation.

Advantages: - Fast traffic switch. - Clear separation between current
and candidate versions. - Potentially fast application rollback by
switching traffic back.

Trade-offs: - Requires additional infrastructure. - Database changes may
not be reversible by switching application traffic. - Both environments
may need to coexist temporarily.

### 6.4 Canary deployment

Release the new version to a small portion of traffic first, then
increase exposure if health and behavior remain acceptable.

Advantages: - Limits initial exposure. - Can reveal production-only
issues before full rollout.

Trade-offs: - Requires traffic control and reliable observability. -
Data and behavior must remain compatible across versions. - More complex
for small deployments.

The appropriate strategy depends on availability requirements,
infrastructure, traffic, and failure impact. More elaborate deployment
strategies are not automatically better.

## 7. Configuration and Secrets

Applications require environment-specific configuration.

Examples: - Database connection strings. - Session token secrets or
cryptographic keys, where applicable. - Email provider credentials. -
Public application URL. - Port and runtime mode. - Logging and telemetry
configuration.

Rules: - Never commit production secrets to Git. - Use the deployment
platform's secret-management mechanism. - Apply least-privilege
access. - Separate development, staging, and production credentials. -
Rotate credentials when exposure is suspected or required by policy. -
Validate required configuration before the application begins serving
traffic. - Avoid logging secrets or complete credential-bearing
connection strings.

The project's Zod environment validation provides a foundation, but
production configuration and secret delivery still need to be defined
for the selected hosting platform.

## 8. Database Deployment and Migrations

Application releases and database changes must be coordinated.

For this project: - Use versioned Prisma migrations. - Use
`prisma migrate dev` during development. - Use `prisma migrate deploy`
in deployment environments. - Do not use `migrate reset` in
production. - Back up important data before high-risk migrations. -
Review destructive changes and compatibility with application
versions. - Confirm migration status and application readiness after
deployment.

### 8.1 Backward-compatible migration

A deployment may temporarily run old and new application versions at the
same time. The database schema must support both versions during that
interval when the deployment strategy requires it.

The expand-and-contract pattern can help: 1. Add new schema elements
without removing old ones. 2. Deploy code compatible with both
representations. 3. Migrate or backfill data. 4. Switch application
reads and writes. 5. Remove old schema elements in a later release.

### 8.2 Migration failure

A failed migration must be treated as a release incident or deployment
blocker.

Do not blindly rerun, manually edit migration history, or drop data to
make the error disappear. First establish: - Which migration ran. -
Whether it partially changed the database. - Whether the migration is
transactional. - Whether application traffic is still using the
database. - Whether a corrective migration or restoration is
appropriate.

Database rollback is not equivalent to application rollback. Data
transformations may be irreversible.

## 9. Health Checks and Release Validation

A process starting successfully does not prove the application is ready
to serve requests.

Common health concepts:

-   **Liveness:** is the process alive and should it continue running?
-   **Readiness:** can the application currently handle requests?
-   **Startup check:** has the application completed initialization?

The project currently has `/healthz` as a liveness-style endpoint. A
readiness endpoint such as `/readyz` may be added when deployment needs
to validate dependencies such as database connectivity.

Post-deployment validation may include: - Confirm expected version or
commit. - Confirm process startup. - Check liveness and readiness. -
Verify database connectivity. - Verify migration status. - Run smoke
tests against critical endpoints. - Inspect logs and error rates. -
Confirm external integrations work.

Health endpoints should reveal only the information needed by the
infrastructure. They should not expose credentials, internal topology,
or sensitive diagnostics publicly.

## 10. Rollback, Roll-forward, and Recovery

A deployment plan must explain what happens when a release fails.

### 10.1 Application rollback

Restore the previously known-good application version.

This may be straightforward when application artifacts are immutable and
database changes remain backward-compatible.

### 10.2 Roll-forward

Deploy a corrective version that fixes the problem.

Roll-forward is often safer than attempting to reverse a destructive
database migration.

### 10.3 Database recovery

Database recovery may involve: - A corrective migration. - Restoring
from a backup. - Point-in-time recovery, if supported. - Data repair
procedures.

Recovery choices depend on the failure and data-loss tolerance.

A rollback plan should identify: - What can be rolled back. - What
cannot be rolled back safely. - Who makes the decision. - Which data or
migrations are affected. - How application health is confirmed
afterward.

A backup is not a recovery strategy until restoration has been tested.

## 11. Deployment Security

Production deployment expands the system's attack surface.

Important controls include: - TLS for traffic in transit. - Restricted
database network access. - Least-privilege database and service
accounts. - Secret storage outside source control. - Secure session and
authentication configuration. - Dependency and image vulnerability
management. - Request size and rate controls where appropriate. - Safe
error responses. - Regular backups and controlled access to them. -
Minimal exposed ports and services.

Security must be considered throughout the deployment lifecycle, not
added after the application is publicly reachable.

## 12. Entry and Exit Criteria

### Entry criteria

A release candidate is ready for deployment when: - The intended version
is identified. - Required verification and review are complete. - The
change is integrated into the release source branch. - Build artifacts
are reproducible. - Required configuration and secrets are available. -
Database migrations have been reviewed. - Deployment and recovery
procedures are understood. - The target environment is prepared.

### Exit criteria

A deployment is complete when: - The intended version is running in the
target environment. - Required migrations have completed successfully. -
Health and readiness checks meet expectations. - Critical smoke tests
pass. - No release-blocking error or unexpected behavior is detected. -
The deployed version and outcome are recorded. - Monitoring and incident
response are active.

If these conditions are not met, the release should be treated as
failed, degraded, or blocked according to the actual state. Do not
report success merely because the deployment command exited with code
zero.

## 13. Preparation Checklist for Future Stage 09 Execution

These are planning items, not claims that production deployment already
exists.

-   [ ] Select a hosting model appropriate to the project's needs.
-   [ ] Define development, test, staging, and production configuration
    boundaries.
-   [ ] Define how the application artifact is built and identified.
-   [ ] Define secret storage and injection.
-   [ ] Define database provisioning, backups, and migration procedure.
-   [ ] Define deployment and recovery strategy.
-   [ ] Add readiness checks when the runtime environment requires them.
-   [ ] Define post-deployment smoke tests.
-   [ ] Define basic security and network controls.
-   [ ] Record deployment version and outcome.
-   [ ] Verify that database restoration is possible, not merely that
    backups exist.

## 14. Key Principles

1.  Deployment is a controlled change to a running environment, not
    merely process startup.
2.  A reproducible, identifiable artifact reduces uncertainty.
3.  Environment configuration and secrets must be managed separately
    from source code.
4.  Application releases and database migrations must be planned
    together.
5.  Health checks and smoke tests provide evidence after deployment.
6.  Application rollback and database recovery are different problems.
7.  A backup is useful only when restoration is understood and tested.
8.  Deployment strategy should match availability needs and operational
    capacity.
9.  A successful deployment command does not prove a healthy release.
10. Deployment must be followed by observation of the running system.

------------------------------------------------------------------------

**Document status:** Conceptual preparation. Stage 09 deployment
activities will be executed after implementation, verification, review,
and integration are available.
