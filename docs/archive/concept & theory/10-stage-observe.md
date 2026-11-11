# Stage 10 --- Observe

  Field            Value
  ---------------- -------------------------------------------------
  Project          Multi-Tenant Project Management API
  Workflow Stage   10 --- Observe
  Document Type    Stage Overview and Preparation Plan
  Version          1.0
  Status           Conceptual Preparation
  Related Stages   05 --- Implement, 09 --- Deploy, 11 --- Improve

## 1. Purpose

Stage 10 --- Observe establishes how the team understands the behavior
and condition of the application while it is running.

Before deployment, verification provides evidence in controlled
environments. After deployment, the system encounters real
infrastructure conditions, real traffic patterns, external dependencies,
unexpected inputs, and operational failures. Observation provides the
information needed to understand what is happening.

The purpose is not merely to collect logs or display dashboards. It is
to detect abnormal behavior, diagnose incidents, understand system
performance, and provide reliable evidence for operational and product
decisions.

**Important:** This document prepares the project for Stage 10. It does
not claim that production monitoring or observability has been
implemented. Stage 05 remains deliberately deferred while the remaining
workflow stages are studied.

## 2. Position in the Workflow

  -----------------------------------------------------------------------
  Stage                               Main question
  ----------------------------------- -----------------------------------
  Deploy                              Has the intended version been
                                      released to the target environment?

  Observe                             What is happening in the running
                                      system?

  Improve                             What should be changed based on
                                      operational evidence and feedback?
  -----------------------------------------------------------------------

Observation begins as soon as a system runs in an environment. It is not
limited to production; development, testing, and staging environments
can also provide useful signals.

Stage 10 supplies evidence to Stage 11. Improvement decisions should be
based on observed behavior, user feedback, incidents, and measured
outcomes rather than assumptions alone.

## 3. Observability and Monitoring

These terms are related but not identical.

### 3.1 Monitoring

Monitoring is the practice of collecting and checking known signals to
determine whether a system is operating within expected conditions.

Examples: - Is the API responding? - Is the error rate above its
threshold? - Is database connection usage unusually high? - Is request
latency increasing?

Monitoring is often built around predefined metrics, dashboards, and
alerts.

### 3.2 Observability

Observability is the ability to infer the internal state of a system
from the outputs it produces.

It matters when the cause of a problem is not known in advance.
Engineers use correlated logs, metrics, traces, and system context to
investigate unfamiliar behavior.

Monitoring asks whether a known condition is unhealthy. Observability
helps investigate why the system is behaving in an unexpected way.

A system can have dashboards and alerts yet still be difficult to debug
if its telemetry lacks useful context or correlation.

## 4. The Three Main Telemetry Signals

### 4.1 Logs

Logs are timestamped records of events emitted by an application or
infrastructure component.

Useful API log fields may include: - Timestamp. - Log level. -
Environment and service name. - Request or correlation ID. - HTTP method
and route path. - Response status. - Duration. - Error classification. -
Relevant non-sensitive context.

Example conceptual event:

``` json
{
  "level": "error",
  "service": "api",
  "requestId": "req-123",
  "method": "POST",
  "path": "/organizations",
  "statusCode": 500,
  "errorCode": "INTERNAL_ERROR"
}
```

This is an illustrative event shape, not a required final logging
schema.

Logs help explain individual events and provide diagnostic detail. They
should be structured where possible so they can be searched and filtered
reliably.

### 4.2 Metrics

Metrics are numerical measurements collected over time.

Useful service metrics include: - Request rate. - Error rate. - Request
duration. - CPU and memory usage. - Process restarts. - Database
connection pool usage. - Database query duration. - Queue depth and
processing failures.

Metrics are useful for identifying trends and alerting on abnormal
conditions.

Common metric types include:

  -----------------------------------------------------------------------
  Type                    Meaning                 Example
  ----------------------- ----------------------- -----------------------
  Counter                 Cumulative count that   Total HTTP requests
                          increases               

  Gauge                   Value that can increase Active database
                          or decrease             connections

  Histogram               Distribution of         Request duration
                          observed values         
  -----------------------------------------------------------------------

For latency, percentiles such as p50, p95, and p99 are often more
informative than an average alone. An average can hide a small group of
very slow requests.

### 4.3 Distributed traces

A trace represents the path of a request or operation through multiple
components.

A trace contains spans. Each span represents an operation and may
record: - Start and end time. - Component or service name. - Operation
name. - Parent-child relationship. - Status and selected attributes.

For example, one API request may involve:

``` text
HTTP Request
  ├── Authentication Middleware
  ├── Organization Service
  │     └── PostgreSQL Query
  └── HTTP Response
```

A distributed trace helps identify where time is spent and which
dependency caused a delay or failure.

Tracing is especially useful when a request crosses multiple services. A
small single-service application may not need a complex tracing setup
immediately.

## 5. Correlation and Context

Logs, metrics, and traces become more useful when they can be connected.

A request or trace identifier can help an engineer move from: - An alert
showing elevated errors. - To a time window and affected endpoint. - To
a specific trace. - To the related structured logs. - To the dependency
or operation that failed.

For this project, request ID propagation is a useful foundation. As
tracing is introduced, trace context can be propagated across
application and external service boundaries.

Do not use high-cardinality or sensitive values as metric labels. For
example, user IDs, organization IDs, email addresses, and raw URLs
containing identifiers can create excessive metric series or expose
private information. Put carefully selected identifiers in
access-controlled logs or traces when justified, not indiscriminately in
metric labels.

## 6. Service Health and Reliability Signals

A service should be observed through signals that reflect its
user-visible behavior and operational dependencies.

### 6.1 The four golden signals

A common starting point for service monitoring is:

1.  **Latency:** how long requests take.
2.  **Traffic:** how much demand the system receives.
3.  **Errors:** how often requests fail.
4.  **Saturation:** how close the system is to exhausting a resource.

For the project: - Latency can reveal slow API endpoints or database
queries. - Traffic can reveal usage patterns and sudden demand
changes. - Errors can reveal application defects or dependency
failures. - Saturation can reveal exhausted connection pools, CPU,
memory, or worker capacity.

### 6.2 Health checks

Health checks provide a simple signal to infrastructure.

-   Liveness indicates whether the process should continue running.
-   Readiness indicates whether it can currently handle requests.
-   Startup checks indicate whether initialization has completed.

Health checks are useful but limited. A successful `/healthz` response
does not prove that every business workflow works or that the database
is performing well.

## 7. SLI, SLO, and SLA

These concepts help connect technical measurements to service
expectations.

### 7.1 Service Level Indicator (SLI)

An SLI is a quantitative measure of a service characteristic.

Examples: - Percentage of valid API requests completed successfully. -
p95 request latency for a defined endpoint group. - Percentage of time
the service is available.

An SLI must have a clear definition, measurement window, and scope.

### 7.2 Service Level Objective (SLO)

An SLO is a target value for an SLI over a defined period.

Example:

A service may target 99.9% successful requests over a rolling 30-day
window, using an explicitly defined request population and exclusion
policy.

This is only an illustrative target. The project should not adopt a
numerical SLO without a realistic workload, service expectation, and
measurement definition.

### 7.3 Service Level Agreement (SLA)

An SLA is a formal commitment between a service provider and a customer,
often including consequences when the commitment is not met.

An internal SLO does not automatically create an SLA.

For a portfolio project, learning to define useful SLIs and SLOs is
valuable even if there is no external SLA.

## 8. Alerting and Incident Response

An alert should indicate a condition that needs attention or action.

Useful alerting principles: - Alert on user impact or meaningful risk,
not every unusual metric. - Define the condition, evaluation window,
severity, and intended response. - Avoid duplicate or noisy alerts. -
Include enough context to begin investigation. - Test alert delivery and
escalation paths. - Distinguish actionable alerts from dashboard
information.

Examples of potential alerts: - Sustained increase in server-side error
rate. - p95 latency above an agreed threshold. - Database connection
pool saturation. - Repeated database connection failures. - Background
job queue growing without successful processing.

An incident is an event that disrupts or threatens service operation. A
basic incident workflow includes: 1. Detect and acknowledge. 2. Assess
severity and impact. 3. Mitigate user impact. 4. Diagnose the cause. 5.
Restore normal operation. 6. Communicate status where appropriate. 7.
Record findings and follow-up actions.

The immediate goal during an incident is to reduce impact and restore
service. Root-cause analysis can continue after the system is stable.

## 9. Project-Specific Observability Priorities

The Multi-Tenant Project Management API should eventually observe the
following areas.

  -----------------------------------------------------------------------
  Area                                Signals and questions
  ----------------------------------- -----------------------------------
  HTTP API                            Request rate, latency, status
                                      distribution, error rate

  Authentication                      Login failures, session lookup
                                      failures, token rotation and
                                      revocation errors

  Tenant authorization                Forbidden and not-found patterns,
                                      suspicious access attempts, without
                                      exposing sensitive data

  PostgreSQL                          Connection usage, query latency,
                                      errors, locks, storage and
                                      availability

  Transactions                        Rollback frequency, constraint
                                      violations, transaction duration

  Invitations                         Pending volume, expiration,
                                      acceptance, email delivery and
                                      retry failures

  Outbox processing                   Queue depth, oldest pending event,
                                      retry count, permanent failures

  Background jobs                     Execution duration, failure rate,
                                      scheduling delay

  Runtime                             CPU, memory, restarts, event-loop
                                      delay where appropriate
  -----------------------------------------------------------------------

Security-related signals must be designed carefully. Logs should not
expose session tokens, passwords, invitation secrets, raw credentials,
or unnecessary personal data.

## 10. Logging Risks and Data Protection

Observability can create security and privacy risks if telemetry
collects too much information.

Avoid logging: - Passwords. - Raw session or bearer tokens. - API keys
and secrets. - Full database connection strings. - Invitation tokens. -
Sensitive request bodies. - Unnecessary personal or organization data.

Prefer: - Stable error codes. - Request and trace identifiers. - Route
templates rather than raw paths containing resource identifiers. -
Redacted or classified fields. - Access-controlled telemetry systems. -
Defined retention periods.

Telemetry should be useful for diagnosis while minimizing sensitive data
collection.

## 11. Observability Tooling

Tools are implementation choices, not the definition of observability.

Possible categories: - Structured logging libraries and log
aggregation. - Metrics instrumentation and time-series storage. -
Dashboards and alert managers. - Distributed tracing instrumentation and
trace backends. - Error tracking. - Infrastructure and database
monitoring.

OpenTelemetry is a vendor-neutral instrumentation framework for
generating and exporting telemetry such as traces, metrics, and logs
through supported components.

The project already uses Pino for application logging. It can be
extended with request correlation and structured context. Additional
metrics and tracing should be introduced when their operational value
justifies the complexity.

Do not select a large monitoring stack merely because it appears in
production architecture diagrams.

## 12. Entry and Exit Criteria

Observation is continuous rather than a one-time gate, so entry and exit
criteria describe operational readiness and review of an observation
period.

### Entry criteria

Before relying on operational observation: - The service has been
deployed to an environment. - Logs contain useful structured context. -
Sensitive data is excluded or redacted. - Health checks are defined. -
Critical service and dependency signals are identified. - Alerts have
clear conditions and intended responses. - Access and retention for
telemetry are understood.

### Review criteria

An observation review should: - Examine service health and user-visible
behavior. - Review error and latency trends. - Investigate significant
alerts and incidents. - Identify capacity or dependency risks. - Check
whether telemetry is sufficient and trustworthy. - Record findings and
proposed improvements.

A lack of alerts does not prove a healthy system if instrumentation is
missing or alerting is misconfigured.

## 13. Preparation Checklist for Future Stage 10 Execution

-   [ ] Define structured logging fields and redaction rules.
-   [ ] Ensure request IDs are consistently propagated.
-   [ ] Define service health and dependency checks.
-   [ ] Identify the first useful API, runtime, and database metrics.
-   [ ] Define metric names, units, and label cardinality carefully.
-   [ ] Decide whether and when distributed tracing is justified.
-   [ ] Define initial SLIs before proposing SLO targets.
-   [ ] Create actionable alerts for critical failure conditions.
-   [ ] Define basic incident handling and communication.
-   [ ] Define telemetry access, retention, and privacy controls.
-   [ ] Review operational signals regularly and record findings.

## 14. Key Principles

1.  Monitoring detects known conditions; observability helps investigate
    unknown behavior.
2.  Logs, metrics, and traces provide complementary views of a running
    system.
3.  Correlation makes telemetry substantially more useful.
4.  User-visible reliability matters more than collecting large
    quantities of telemetry.
5.  Latency, traffic, errors, and saturation provide a useful initial
    monitoring model.
6.  SLIs must be clearly defined before meaningful SLO targets can be
    set.
7.  Alerts should be actionable and tied to impact or risk.
8.  A healthy process does not necessarily mean a healthy service.
9.  Telemetry must not become a source of secret or personal-data
    leakage.
10. Observation provides evidence for Stage 11 --- Improve.

------------------------------------------------------------------------

**Document status:** Conceptual preparation. Stage 10 observation
activities will be implemented after the application is deployed to an
environment where operational behavior can be measured.
