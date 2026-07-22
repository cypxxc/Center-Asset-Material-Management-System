# Release Gates Remediation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Registry-S release readiness deterministic across local checks, CI, browser verification, and Supabase database-state verification.

**Architecture:** Small TypeScript release utilities expose testable pure functions and thin executable entry points. Playwright uses a production server lifecycle, CI calls named gates, and database verification performs read-only catalog checks against the selected Supabase environment.

**Tech Stack:** Next.js 16.2.9, React 19.2.4, TypeScript 5, Node test runner through `tsx`, Playwright 1.61, Supabase/Postgres.

## Global Constraints

- Do not deploy, apply remote migrations, commit application changes, or push automatically.
- Keep `exec_admin_sql` service-role-only and enforce authorization inside every `SECURITY DEFINER` RPC.
- Do not raise the 450 KB initial-root JavaScript budget.
- Missing authenticated staging credentials must fail the release gate, not count as skipped coverage.
- Preserve Thai-first UI behavior and existing role boundaries.

---

### Task 1: Deterministic Playwright lifecycle and release prerequisites

**Files:**
- Create: `scripts/release-e2e.ts`
- Create: `scripts/release-e2e.test.ts`
- Modify: `playwright.config.ts`
- Modify: `package.json`

**Interfaces:**
- Produces: `validateReleaseE2EEnv(env: NodeJS.ProcessEnv): string[]` and a CLI that exits non-zero when required real-auth variables are absent.
- Produces npm commands `test:smoke`, `test:e2e`, and `test:e2e:release` with deterministic server teardown.

- [ ] Write tests asserting missing `CAMMS_E2E_REAL_AUTH=true`, admin ID, and password produce named prerequisite errors while complete input produces none.
- [ ] Run `node --import tsx --test scripts/release-e2e.test.ts`; expect failure because `release-e2e.ts` does not exist.
- [ ] Implement the validator and CLI runner using `spawn` with inherited stdio and propagated exit/signal handling.
- [ ] Change Playwright `webServer.command` to `npm run start`, set `reuseExistingServer: false`, and make browser scripts build before Playwright.
- [ ] Run the focused test; expect pass.
- [ ] Run `npm run test:e2e`; expect process exit 0 without timeout and one explicit skip when real auth is disabled.

### Task 2: CI release gates cannot silently omit lint or authenticated coverage

**Files:**
- Create: `scripts/ci-contract.test.ts`
- Modify: `.github/workflows/ci.yml`
- Modify: `package.json`

**Interfaces:**
- Consumes: `test:e2e:release` from Task 1.
- Produces: a standard CI gate with explicit lint and smoke, plus a manually triggered staging release job requiring environment secrets.

- [ ] Write a static contract test that parses workflow/package text and asserts `npm run lint`, `npm run test:smoke`, and `npm run test:e2e:release` are present in the intended jobs.
- [ ] Run the focused test; expect failure because lint and release E2E are not enforced.
- [ ] Update CI with a standard `quality` job and a `workflow_dispatch` authenticated staging job guarded by required secrets.
- [ ] Run the contract test; expect pass.

### Task 3: Migration tooling and read-only database readiness

**Files:**
- Create: `scripts/migration-utils.ts`
- Create: `scripts/migration-utils.test.ts`
- Create: `scripts/verify-database-readiness.ts`
- Modify: `scripts/apply-migrations.ts`
- Modify: `package.json`
- Modify: `db/migrations/00029_harden_profile_role_defaults.sql`
- Modify: `db/migrations/00030_revoke_anon_admin_sql.sql`
- Modify: `db/migrations/00031_lock_down_public_report_rpcs.sql`

**Interfaces:**
- Produces: `parseRequestedMigrations`, `validateMigrationOrder`, and `splitSqlStatements` as pure tested utilities.
- Produces: `npm run verify-db-release`, a read-only command returning non-zero for missing ledger rows, disabled RLS, or unsafe function ACLs.

- [ ] Write failing tests for empty lists, unknown files, out-of-order lists, and SQL splitting across dollar-quoted functions.
- [ ] Run focused tests; expect module-not-found failure.
- [ ] Implement pure utilities and refactor the migration runner to use service-role RPC directly without temporary Auth users.
- [ ] Add an idempotent `public.app_migrations` ledger and insert each migration identifier only at the end of its migration.
- [ ] Add the read-only readiness script with catalog queries that return booleans/counts only and never secrets.
- [ ] Run focused tests; expect pass.

### Task 4: Privileged RPC authorization hardening

**Files:**
- Create: `tests/integration/release-migrations.test.ts`
- Modify: `db/migrations/00031_lock_down_public_report_rpcs.sql`
- Modify: `features/admin/actions.ts`

**Interfaces:**
- Produces migration SQL where public report functions require an active profile, bulk import requires active staff/admin, restore requires active admin, and `PUBLIC`/`anon` grants are absent.

- [ ] Write static SQL tests asserting every privileged function has explicit revokes and an internal active-profile authorization predicate.
- [ ] Run focused tests; expect failure for report RPC predicates.
- [ ] Replace the affected functions in migration `00031` with internally authorized definitions and retain minimum grants.
- [ ] Correct stale server-action comments so they describe the post-trigger profile upsert flow accurately.
- [ ] Run focused and existing integration tests; expect pass.

### Task 5: Bundle budget headroom

**Files:**
- Modify only the root client boundary/import identified by `.next` import tracing.
- Modify or create a focused component/performance test matching that boundary.

**Interfaces:**
- Produces the same visible behavior with route-specific code deferred from initial root JavaScript.

- [ ] Record current `446.07 KB` initial-root result and inspect manifests/import chains to identify the largest avoidable root dependency.
- [ ] Write a static performance test asserting the identified heavy dependency is not statically imported from the root client boundary.
- [ ] Run the focused test; expect failure.
- [ ] Move the dependency behind an existing route boundary or `next/dynamic` import with a stable loading state.
- [ ] Run focused tests and `npm run build`; require meaningful headroom below 450 KB and no behavior change.

### Task 6: Documentation and full verification

**Files:**
- Modify: `DEPLOYMENT.md`
- Modify: `docs/deploy-readiness.md`
- Modify: `README.md`

**Interfaces:**
- Documents exact local, CI, staging, database verification, deploy, and rollback order.

- [ ] Update commands and explain that authenticated E2E and database readiness are required release gates.
- [ ] Document migration apply order, `verify-db-release`, health checks, `ADMIN_SQL_ENABLED=false`, and rollback decision points.
- [ ] Run `git diff --check` and confirm no whitespace errors.
- [ ] Run `npm run check`; require exit 0 with all tests, lint, TypeScript, build, and budget passing.
- [ ] Run `npm run audit:release`; require zero high/critical production vulnerabilities.
- [ ] Run `npm run test:smoke` and `npm run test:e2e`; require both processes terminate with exit 0.
- [ ] Run `npm run test:e2e:release`; require either a complete authenticated pass with staging credentials or an explicit non-zero prerequisite failure recorded as the only external blocker.
- [ ] Run `npm run verify-db-release`; require pass only against the intended migrated target database; otherwise report exact remote-state blockers without applying changes.

