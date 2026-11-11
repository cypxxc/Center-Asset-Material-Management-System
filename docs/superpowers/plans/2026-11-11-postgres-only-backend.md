# PostgreSQL Only Backend Implementation Plan

> **For agentic workers:** Execute this plan task by task. Keep the PostgreSQL + Drizzle architecture as the only supported backend and do not apply migrations to a live database.

**Goal:** Remove Supabase as an application backend and make CAMMS PostgreSQL + Drizzle only.

**Architecture:** Convert application entry points to call existing PostgreSQL query/action implementations directly, then remove dual-backend infrastructure and Supabase-only deployment paths. Keep PostgreSQL sessions, request-scoped database roles, local private storage, event refresh, and Drizzle migrations.

**Tech Stack:** Next.js 16, React 19, TypeScript, PostgreSQL, Drizzle ORM, local private file storage.

**Spec:** `docs/superpowers/specs/2026-11-11-postgres-only-backend-design.md`

## Global Constraints

- Do not connect to or modify any live database; do not execute migrations.
- Admin and Viewer are the only assignable roles; promote existing Staff rows in the PostgreSQL migration.
- Viewer submits material requests as `pending_approval`; Admin alone issues stock and manages return/reversal actions.
- Keep user-scoped PostgreSQL access; no privileged runtime client for ordinary requests.
- Keep PostgreSQL Drizzle schema/migrations and local private image storage.

## Review Focus

- Unauthenticated and inactive users still cannot access protected routes — test PostgreSQL middleware/guards.
- Viewer cannot directly issue stock, change pending requests, return items, or reverse documents — test action and database policy boundaries.
- PostgreSQL operations never require Supabase variables — test env validation and startup without Supabase keys.
- Private image upload/read/delete behavior remains scoped — test storage actions and file route.
- Cache refresh, audit writes, health checks, and import/export remain functional — run targeted PostgreSQL tests.

## Files and responsibilities

- `proxy.ts`, `lib/backend.ts`, `features/auth/**`, `lib/postgres/**`: sole PostgreSQL auth/session path.
- `features/{admin,depreciation,disbursements,items,reports,settings}/queries.ts` and `actions.ts`: stable application interfaces backed only by PostgreSQL modules.
- `lib/audit.ts`, `lib/health.ts`, `lib/self-healing/**`, `lib/logging.ts`, `lib/config.ts`: PostgreSQL-only operational services.
- `lib/supabase/**`, `db/migrations/**`, `scripts/apply-migrations.ts`, Supabase-only scripts/tests: removed after callers are migrated.
- `.env.example`, `package.json`, lockfile, `AGENT_SETUP.md`, `README.md`, `docs/context/**`: PostgreSQL-only setup and commands.
- `db/postgres/migrations/0015_remove_staff_role.sql`, `0016_viewer_disbursement_requests.sql`: role conversion and request/issue policies; remain unapplied.

## Tasks

### Task 1: PostgreSQL-only auth and backend selection

**Files:** `proxy.ts`, `lib/backend.ts`, `features/auth/queries.ts`, `features/auth/actions.ts`, `features/auth/guards.ts`, `lib/postgres/middleware.ts`, `tests/integration/middleware-*.test.ts`, auth tests.

- [ ] Remove the Supabase middleware branch; always use `updatePostgresSession`.
- [ ] Remove `DATA_BACKEND` branching from auth/profile/session operations; call PostgreSQL implementations directly.
- [ ] Preserve login, logout, profile/password updates, sidebar order, redirects, and role checks.
- [ ] Update PostgreSQL auth tests for admin/viewer roles and session expiration/outage behavior.
- [ ] Run focused auth/middleware tests and TypeScript typecheck.

### Task 2: PostgreSQL-only domain queries and mutations

**Files:** `features/admin/{actions,queries}.ts`, `features/depreciation/queries.ts`, `features/disbursements/{actions,queries}.ts`, `features/items/{actions,queries,import-export-actions}.ts`, `features/reports/queries.ts`, `features/settings/{actions,queries}.ts`, their PostgreSQL modules and focused tests.

- [ ] Replace each public feature function's backend switch with a direct PostgreSQL implementation call.
- [ ] Preserve each exported function signature consumed by pages/components; remove Supabase SDK query chains and fallback branches.
- [ ] Keep validation, audit, cache invalidation, exports/imports, and transactional guarantees.
- [ ] Ensure Viewer submits material requests as pending and Admin alone confirms/issues, returns, reverses, and rejects.
- [ ] Update tests to cover PostgreSQL behavior and two-role constraints; remove tests that only assert Supabase query syntax.
- [ ] Run focused domain tests and typecheck.

### Task 3: PostgreSQL-only storage, events, audit, health, and recovery

**Files:** `lib/supabase/{storage,image,client,server,middleware}.ts`, `components/ui/zoomable-image.tsx`, `features/items/components/item-form.tsx`, `app/api/{files,events,revalidate}/**`, `hooks/use-realtime-refresh.ts`, `lib/{audit,health,logging,config,performance,retry}.ts`, `lib/self-healing/**`, `tests/unit/{storage,private-item-image,health,audit}.test.ts`, relevant integration tests.

- [ ] Move PostgreSQL private storage helpers into a vendor-neutral module and update all image callers.
- [ ] Keep `/api/files` as the private local-file endpoint; remove Supabase image transformation and storage URLs.
- [ ] Keep PostgreSQL event refresh and remove Supabase realtime/revalidation branches.
- [ ] Make audit, health, logging, and self-healing use PostgreSQL implementations directly.
- [ ] Delete obsolete Supabase client/storage/middleware/image modules after references are removed.
- [ ] Run focused storage, event, audit, and health tests.

### Task 4: PostgreSQL-only operational tooling and configuration

**Files:** `scripts/apply-migrations.ts`, `scripts/backup*.ts`, `scripts/verify-database-readiness.ts`, `scripts/verify-env.ts`, `scripts/mcp-server.ts`, associated tests, `.env.example`, `package.json`, package lock, deployment/config files.

- [ ] Remove the service-role SQL migration runner and any scripts that connect to Supabase.
- [ ] Route backup, readiness, MCP, benchmark, and deployment commands to PostgreSQL tools only; remove redundant Supabase-only commands/tests.
- [ ] Make PostgreSQL environment requirements unconditional and remove Supabase variable parsing/validation.
- [ ] Remove `@supabase/ssr` and `@supabase/supabase-js` dependencies and update lockfile without changing unrelated dependency versions.
- [ ] Verify PostgreSQL setup, backup, MCP, and environment tests without contacting any external database.

### Task 5: Remove Supabase-only migrations and update project docs

**Files:** `db/migrations/**`, PostgreSQL migration journal, `AGENT_SETUP.md`, `README.md`, `docs/context/**`, `docs/postgres/README.md`, active docs and tests containing Supabase setup instructions.

- [ ] Remove the Supabase-only migration tree and security migration tests; retain all PostgreSQL Drizzle migrations.
- [ ] Verify PostgreSQL Drizzle journal tags and filenames are ordered and include the Staff-to-Admin and Viewer request migrations.
- [ ] Rewrite onboarding, env setup, commands, architecture, and deployment docs for PostgreSQL + Drizzle only.
- [ ] Remove active Supabase setup guidance; label retained historical design notes as historical or remove them where they imply supported operation.
- [ ] Search tracked source/docs/config for Supabase SDK/config/runtime references; only permitted historical mentions are explicitly labeled.

### Task 6: Full verification and final review

**Files:** remaining tests/configuration discovered during implementation.

- [ ] Run `npm run typecheck`, `npm run lint`, focused PostgreSQL tests, `npm test`, and `npm run build`.
- [ ] Run repository search for `supabase`, `SUPABASE_`, `@supabase/`, `DATA_BACKEND`, and `isPostgresBackend`; inspect every remaining match.
- [ ] Run `git diff --check` and review for removed PostgreSQL behavior, leaked secrets, unintended data operations, and unrelated changes.
- [ ] Do not run migrations, seed scripts, or live-database verification.

## Delivery

Leave a reviewable local diff. Report commands and results, any remaining historical references, and confirm that migrations were not applied. Repository metadata is read-only in the current workspace, so do not attempt to commit unless that permission changes.
