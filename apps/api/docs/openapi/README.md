# OpenAPI

The machine-readable contract for the HTTP API. The normative rules live in
`docs/design/api/` at the repository root; this spec must agree with them and
with the code (routes, Zod schemas, mappers). On conflict the design docs win and
the spec is fixed in the same change.

## Layout

```text
openapi.yaml                 entry point: info, servers, tags, path registrations
paths/<domain>.yaml          operations, keyed by path fragment (e.g. #/collection, #/item)
components/
  schemas/<domain>.yaml      request bodies, DTOs, response envelopes
  schemas/error.yaml         error envelope, ErrorCode enum, details shapes
  schemas/pagination.yaml    Pagination object (ADR-0004)
  responses.yaml             shared error responses (401, 404, 409, ...)
  parameters.yaml            shared query parameters (limit, cursor)
  security-schemes.yaml      BearerAuth
openapi-bundled.yaml         GENERATED — served by /docs; never edit by hand
```

`$ref` paths are relative to the file that contains them.

## Rules

- Document only what is implemented. A slice adds its endpoints, schemas and
  error codes to this spec in the same PR that adds the code.
- Request bodies are `additionalProperties: false` because the server rejects unknown fields.
- Every operation lists the error responses it can actually return; reuse
  `components/responses.yaml` instead of restating them.
- `ErrorCode` lists the codes reachable from documented endpoints; the full catalog
  is `docs/design/api/errors.md`.

## Commands

```bash
pnpm --filter api docs:lint     # validate the source spec (Redocly)
pnpm --filter api docs:bundle   # regenerate openapi-bundled.yaml (Scalar CLI, Node >= 24)
```

CI lints the spec and fails if the committed bundle is stale.
