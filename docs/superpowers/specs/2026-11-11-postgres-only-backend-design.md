# PostgreSQL Only Backend

Status: Design approved in chat on 2026-11-11. Awaiting review of this written spec.

## Goal

Make CAMMS use standalone PostgreSQL with Drizzle as its only application backend. Remove Supabase SDK usage, configuration, auth/storage clients, backend selection, Supabase migration tooling, Supabase-only migrations, and Supabase-specific tests and documentation. Preserve current PostgreSQL behavior and the already requested two-role model and disbursement permissions.

## Approved constraints

- PostgreSQL + Drizzle is the sole runtime backend.
- Keep the existing PostgreSQL schema and migration history needed by standalone installations.
- Do not connect to, migrate, or modify any live database during this code change.
- Keep application data and uploaded files in the configured PostgreSQL/local-storage deployment.
- Roles are Admin and Viewer. Existing Staff profiles are promoted to Admin by the PostgreSQL migration already prepared for that change.
- Admin can create and issue disbursements, manage returns/reversals, and administer users. Viewer can submit material requests, which enter `pending_approval`; only Admin can approve/issue them. Viewer cannot issue stock, return items, or reverse disbursements.

## Design

### Runtime and authentication

- Remove `DATA_BACKEND` selection and make PostgreSQL session middleware the only proxy path.
- Route all authentication, profile, role, and session operations through the existing PostgreSQL auth implementation and `private_auth` schema.
- Remove Supabase browser/server clients, auth middleware, service-role paths, configuration variables, and SDK dependencies.
- Keep user-scoped database access through the existing PostgreSQL request/auth roles; do not introduce a privileged runtime database client for ordinary requests.

### Domain data and mutations

- Keep existing PostgreSQL query/action modules as the implementation source for items, reports, settings, depreciation, administration, disbursements, audit, and health.
- Change public feature entry points to call PostgreSQL implementations directly and remove conditional Supabase branches.
- Keep mutation validation, role guards, audit logging, transaction boundaries, cache invalidation, exports, and import behavior.
- Use PostgreSQL-backed local file storage for private item images and remove Supabase Storage URL/upload logic.
- Keep event/realtime refresh implemented through the PostgreSQL event route and remove Supabase Realtime code.

### Database and migrations

- Keep `db/postgres/schema.ts` and `db/postgres/migrations/` as the schema source of truth.
- Remove Supabase-only `db/migrations/` SQL and the service-role RPC migration runner. Keep Drizzle migration execution and PostgreSQL operations tooling.
- Preserve migrations 0015 (staff-to-admin and registry permission transition) and 0016 (viewer material requests/admin issuance), and ensure they are registered in the Drizzle journal in the correct order.
- Do not run `db:migrate`, seed scripts, or any migration against a live database as part of implementation.

### Configuration, tooling, docs, and tests

- Remove Supabase variables from `.env.example`, environment validation, deployment config, and setup flows. PostgreSQL environment validation becomes unconditional.
- Remove Supabase-only backup, migration, verification, MCP, and test paths; retain PostgreSQL equivalents.
- Update project onboarding and context docs to describe PostgreSQL + Drizzle only.
- Remove Supabase mocks and tests. Convert tests that exercise shared behavior to PostgreSQL-focused coverage; retain existing PostgreSQL tests.
- Keep historical design notes only when they document past decisions and are clearly labeled historical; remove active instructions that describe Supabase as supported.

## Error handling and compatibility

- Existing PostgreSQL deployments remain the supported target. Schema changes are additive/forward migrations, except the explicit Staff-to-Admin role migration already requested.
- PostgreSQL-only deployments must not need Supabase environment variables at build, startup, test, backup, or deployment time.
- Missing PostgreSQL configuration should fail with variable names and actionable setup guidance, without printing secrets.

## Acceptance criteria

1. No production source imports `@supabase/*` or `lib/supabase/*`.
2. No backend switch remains; production paths always use PostgreSQL + Drizzle.
3. Supabase environment variables, SDK dependencies, client/middleware/storage modules, and Supabase migration tooling are removed.
4. Supabase-only database migrations are removed from the active repository; PostgreSQL Drizzle migrations remain ordered and runnable.
5. Viewer requests create `pending_approval` material requests without changing inventory. Only Admin can approve/issue, return, or reverse.
6. Admin and Viewer are the only assignable roles. Existing Staff rows are promoted through a PostgreSQL migration.
7. Relevant application tests, typecheck, lint, and production build pass; no database migrations are applied during verification.

## Risks and review points

- Supabase migration SQL may contain historical functions or schema behavior that must be represented by PostgreSQL migrations before those files are removed. Compare schemas and runtime calls before deletion.
- Existing docs and test fixtures contain many historical Supabase references; remove active guidance and executable code while retaining only clearly labeled historical context where it remains useful.
- Private image URLs, cache invalidation, background jobs, and production setup need PostgreSQL-only checks to avoid hidden Supabase assumptions.
- Staff promotion and viewer request migrations require deployment by the operator after code review; this task must not apply them to a live database.
