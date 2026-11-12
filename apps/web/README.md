# Web

Next.js client for Detent, acting as the backend-for-frontend of
[ADR-0010](../../docs/adr/0010-web-session-via-bff.md): the browser holds only an
HttpOnly session cookie; every API call is made by this server.

Layout and rules: [Architecture §4.1](../../docs/design/architecture.md).
Visual rules: [Detent design system](../../docs/ui/detent-design-system.md).

```bash
cp .env.example .env.local   # API_URL, APP_TIME_ZONE
pnpm dev                     # http://localhost:3001 (the API must be running)
pnpm test                    # unit tests
pnpm api:types               # regenerate src/lib/api/schema.d.ts from the API's OpenAPI bundle
```

Interface text lives in `messages/en.json`; components never hard-code strings.
