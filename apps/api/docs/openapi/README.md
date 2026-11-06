# OpenAPI Documentation

This directory contains the OpenAPI specification for the Multi-Tenant Project Management API.

It defines the API contract independently of the application implementation. The specification describes available endpoints, request parameters, request bodies, response structures, authentication requirements, and reusable schemas.

The goal of this directory is to maintain API documentation that is:

- Consistent with the actual API implementation.
- Modular and easy to maintain.
- Reusable across multiple endpoints.
- Understandable to current and future developers.
- Compatible with API documentation tools such as Scalar.

## 1. Architecture Overview

The OpenAPI specification follows a modular structure.

Instead of maintaining the entire API definition in a single YAML file, the specification is divided into smaller files based on their responsibilities.

```text
docs/
└── openapi/
    ├── openapi.yaml
    ├── openapi-bundled.yaml
    │
    ├── paths/
    │   ├── auth.yaml
    │   ├── health.yaml
    │   └── organizations.yaml
    │
    └── components/
        ├── security-schemes.yaml
        │
        └── schemas/
            ├── auth.yaml
            ├── error.yaml
            ├── health.yaml
            ├── organizations.yaml
            ├── pagination.yaml
            └── success.yaml
```

### File Responsibilities

| File or Directory                  | Responsibility                                                                                   |
| ---------------------------------- | ------------------------------------------------------------------------------------------------ |
| `openapi.yaml`                     | Root specification and entry point. Defines API metadata, tags, paths, and component references. |
| `paths/`                           | Contains endpoint definitions grouped by API domain or feature.                                  |
| `components/`                      | Contains reusable OpenAPI components.                                                            |
| `components/security-schemes.yaml` | Defines authentication mechanisms and security schemes.                                          |
| `components/schemas/`              | Contains reusable request, response, and data schemas.                                           |
| `openapi-bundled.yaml`             | Generated standalone specification containing resolved external references.                      |

### 1.1 Root Specification

`openapi.yaml` is the entry point of the entire specification.

It is responsible for:

- OpenAPI version.
- API title, description, and version.
- Server definitions.
- Tags and tag groups.
- Path registration.
- Reusable component registration.
- Security scheme registration.

The root file connects the modular files using OpenAPI `$ref` references.

Example:

```yaml
paths:
  /healthz:
    $ref: "./paths/health.yaml#/check"

  /api/v1/auth/register:
    $ref: "./paths/auth.yaml#/register"

  /api/v1/organizations:
    $ref: "./paths/organizations.yaml#/create"
```

The root file should remain relatively small. Detailed endpoint definitions and schemas belong in their respective files.

### 1.2 Paths

The `paths/` directory contains API endpoint definitions.

Each file groups related endpoints according to their domain.

For example:

- `health.yaml`: Health check endpoints.
- `auth.yaml`: Registration, login, logout, and authentication-related endpoints.
- `organizations.yaml`: Organization-related endpoints.

Each endpoint definition is exposed through a named YAML key.

Example:

```yaml
# paths/organizations.yaml

create:
  post:
    tags:
      - Organizations
    summary: Create an organization
    operationId: createOrganization
    # Additional operation configuration
```

The root specification references the endpoint using its YAML key:

```yaml
/api/v1/organizations:
  $ref: "./paths/organizations.yaml#/create"
```

The fragment after `#` identifies the target key inside the referenced file.

### 1.3 Components and Schemas

The `components/` directory contains reusable OpenAPI definitions.

Schemas describe the structure and constraints of API data.

Examples include:

- Request schemas.
- Response schemas.
- Error response schemas.
- Pagination structures.
- Domain entities.

Schemas are grouped by responsibility:

| File                 | Responsibility                                      |
| -------------------- | --------------------------------------------------- |
| `auth.yaml`          | Authentication request and response schemas.        |
| `error.yaml`         | Standardized error response structure.              |
| `health.yaml`        | Health check response schema.                       |
| `organizations.yaml` | Organization request, entity, and response schemas. |
| `pagination.yaml`    | Reusable pagination-related schemas.                |
| `success.yaml`       | Reusable success response structures.               |

Example:

```yaml
# components/schemas/organizations.yaml

CreateOrganizationRequest:
  type: object
  required:
    - name
  properties:
    name:
      type: string
      minLength: 1
      maxLength: 100
```

A schema can be referenced from an endpoint:

```yaml
schema:
  $ref: "../components/schemas/organizations.yaml#/CreateOrganizationRequest"
```

When a schema is reused by multiple endpoints, define it once and reference it instead of duplicating its definition.

### 1.4 Security Schemes

Authentication mechanisms are defined in:

```text
components/security-schemes.yaml
```

The root specification registers these definitions under:

```yaml
components:
  securitySchemes:
    # Security scheme references
```

An endpoint can declare its authentication requirement using the OpenAPI `security` field.

Example:

```yaml
security:
  - BearerAuth: []
```

Public endpoints, such as registration and login, should not declare authentication requirements unless the implementation explicitly requires them.

---

## 2. Reference Conventions

This project uses OpenAPI `$ref` to connect modular YAML files.

There are two common reference patterns.

### External File Reference

References another YAML file:

```yaml
$ref: "./paths/auth.yaml#/register"
```

### Internal Component Reference

References a schema inside another file:

```yaml
$ref: "../components/schemas/auth.yaml#/RegisterRequest"
```

Reference paths are relative to the file containing the `$ref`, not necessarily the root `openapi.yaml`.

**Important:** YAML indentation matters. Incorrect indentation can change the document structure and produce invalid OpenAPI definitions.

Incorrect:

```yaml
/api/v1/organizations:
$ref: "./paths/organizations.yaml#/create"
```

Correct:

```yaml
/api/v1/organizations:
  $ref: "./paths/organizations.yaml#/create"
```

Always validate references after modifying the specification.

---

## 3. Development Workflow

### 3.1 Adding a New Endpoint

When adding a new API endpoint, follow this workflow:

1. Identify the relevant API domain.
2. Add the endpoint definition to the appropriate file under `paths/`.
3. Define new request or response schemas under `components/schemas/` when necessary.
4. Reference the endpoint from the root `openapi.yaml`.
5. Register any new reusable schemas under `components.schemas` if they need to be exposed as root components.
6. Add or update tags if necessary.
7. Generate the bundled specification.
8. Validate the generated specification.
9. Verify the endpoint in Scalar.

Example: adding a project endpoint.

```text
paths/
└── projects.yaml
```

Add the corresponding path reference to `openapi.yaml`:

```yaml
paths:
  /api/v1/projects:
    $ref: "./paths/projects.yaml#/create"
```

If the endpoint introduces new schemas, define them in:

```text
components/schemas/projects.yaml
```

Then reference them from the endpoint definition.

### 3.2 Adding a New Schema

Before creating a new schema, check whether an existing reusable schema already satisfies the requirement.

If the schema is specific to a domain, place it in that domain's schema file.

For example:

- Authentication schemas belong in `auth.yaml`.
- Organization schemas belong in `organizations.yaml`.
- Project schemas belong in `projects.yaml`.

For genuinely shared structures, use an appropriate common schema file.

Avoid creating duplicate definitions for the same response structure.

### 3.3 Updating Existing Endpoints

When changing an endpoint implementation, review its OpenAPI definition as part of the same change.

Check whether any of the following have changed:

- HTTP method or URL.
- Authentication requirements.
- Request parameters.
- Request body.
- Validation constraints.
- Response status codes.
- Response body structure.
- Error responses.

The OpenAPI contract and actual implementation should remain consistent.

---

## 4. Bundling

The modular specification uses external references.

Some tools require a single standalone OpenAPI document. For that reason, this project generates a bundled specification.

### Source of Truth

The modular YAML files are the source of truth:

```text
openapi.yaml
paths/
components/
```

The bundled file is generated:

```text
openapi-bundled.yaml
```

**Do not manually edit `openapi-bundled.yaml`.**

Any manual changes will be overwritten the next time the bundle is generated.

### Generate the Bundle

From the repository root:

```bash
pnpm --filter api docs:bundle
```

This executes the Scalar CLI command configured in `apps/api/package.json`:

```bash
scalar document bundle ./docs/openapi/openapi.yaml \
  --output ./docs/openapi/openapi-bundled.yaml \
  --no-input
```

Run this command after modifying any source specification file.

---

## 5. Validation and Verification

Successful bundling does not necessarily guarantee that the specification accurately describes the application.

Review the following:

### Structural Validation

- YAML syntax is valid.
- OpenAPI document structure is valid.
- External references resolve correctly.
- Referenced component names exist.
- HTTP methods and response definitions are valid.

### Contract Consistency

- Endpoint paths match the Express routes.
- HTTP methods match the implementation.
- Request schemas match Zod validation rules.
- Response schemas match actual controller responses.
- Authentication requirements match the middleware configuration.
- Error responses match the application's error handling conventions.

### Scalar Verification

After generating the bundle:

1. Start the API server.
2. Open the Scalar API Reference endpoint configured by the application.
3. Verify that all expected tags and endpoints appear.
4. Inspect request and response schemas.
5. Check authentication configuration.
6. Look for missing references or validation errors.

A successful bundle should still be checked in the documentation UI.

---

## 6. Design and Maintenance Guidelines

Follow these conventions when maintaining the OpenAPI specification.

### Organization

- Group endpoints by domain.
- Keep endpoint definitions in `paths/`.
- Keep reusable schemas in `components/schemas/`.
- Keep authentication definitions in `components/security-schemes.yaml`.
- Keep the root specification focused on registration and global configuration.

### Naming

- Use descriptive and consistent file names.
- Use PascalCase for schema names, such as `CreateOrganizationRequest`.
- Use descriptive YAML keys for path fragments, such as `create`, `register`, and `login`.
- Use unique and descriptive `operationId` values.

### Reusability

- Reuse schemas when their structures and semantics are genuinely shared.
- Avoid unnecessary duplication.
- Do not create abstractions that make the specification harder to understand.

### Accuracy

- Document the behavior that the API actually implements.
- Do not document planned features as implemented endpoints.
- Keep examples consistent with the corresponding schemas.
- Document relevant error status codes and authentication requirements.
- Update the specification whenever the API contract changes.

### Version Control

When committing API contract changes, include all relevant source YAML files.

If the generated bundle is tracked by Git, regenerate it before committing so that it stays synchronized with the source files.

---

## 7. Important Notes

1. `openapi.yaml` is the entry point of the specification.
2. Modular YAML files are the authoritative source.
3. `openapi-bundled.yaml` is generated and must not be edited manually.
4. `$ref` paths are relative to the file containing the reference.
5. YAML indentation is significant.
6. Every newly created endpoint must be registered in the root specification.
7. New reusable schemas should be registered under root components when required.
8. OpenAPI documentation must stay consistent with Express routes, Zod validation, authentication middleware, and actual response structures.
9. Always regenerate and verify the bundle after modifying the specification.

---

## 8. Quick Reference

| Task                           | Location                           |
| ------------------------------ | ---------------------------------- |
| Update API metadata            | `openapi.yaml`                     |
| Add an endpoint                | `paths/*.yaml`                     |
| Register an endpoint           | `openapi.yaml`                     |
| Add a request schema           | `components/schemas/*.yaml`        |
| Add a response schema          | `components/schemas/*.yaml`        |
| Update authentication scheme   | `components/security-schemes.yaml` |
| Generate bundled specification | `pnpm --filter api docs:bundle`    |
| Verify API documentation       | Scalar API Reference               |

**The guiding principle:** maintain the modular OpenAPI files as the source of truth, keep the specification aligned with the actual API implementation, and regenerate the bundled document whenever the source changes.
