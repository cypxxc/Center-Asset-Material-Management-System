# 5-Pillar Pre-Release Audit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Execute a comprehensive 5-pillar pre-release audit to verify security, performance, database migrations, operations/health endpoints, and test coverage before deployment.

**Architecture:** Systematic verification across 5 domains: (1) Security & RLS, (2) Performance & Bundle Size, (3) Database Schema & Migrations, (4) Operations & Logging, and (5) Automated Test Gate (`npm run check`).

**Tech Stack:** Next.js 16.2, React 19, Supabase PostgreSQL, Tailwind CSS v4, TypeScript 5, Playwright.

## Global Constraints

- Thai-first UI labels with precise operational phrasing.
- Strict Dark Mode compatibility using 100% semantic CSS theme tokens.
- All unit and integration tests must pass cleanly (`npm test`).
- Full system verification must exit with code 0 (`npm run check`).

---

### Task 1: Security & RBAC Audit

**Files:**
- Audit: `db/migrations/00001_initial_schema.sql`
- Audit: `lib/supabase/server.ts`
- Audit: `features/*/actions.ts`
- Test: `scripts/verify-database-readiness.ts`

**Interfaces:**
- Consumes: Supabase database connection and migration status
- Produces: Verified security status across RLS policies, service role isolation, and server action permission guards

- [ ] **Step 1: Audit Supabase RLS Policies**

Run: `npx tsx scripts/verify-database-readiness.ts`
Expected: PASS with 6/6 public tables (`profiles`, `items`, `locations`, `units`, `categories`, `audit_logs`) enforcing RLS policies.

- [ ] **Step 2: Verify Anon vs Service Role Client Isolation**

Check `lib/supabase/server.ts` and ensure `createClient()` uses `NEXT_PUBLIC_SUPABASE_ANON_KEY` for standard RLS sessions while `createAdminClient()` uses `SUPABASE_SERVICE_ROLE_KEY` exclusively for server-side auth operations.

- [ ] **Step 3: Audit Permission Guards in Server Actions**

Verify `requireAdmin()` and `requireEditor()` helpers in `features/items/actions.ts`, `features/settings/actions.ts`, and `features/reports/actions.ts`.

- [ ] **Step 4: Commit Task 1**

```bash
git commit --allow-empty -m "audit(security): verify RLS policies, service role isolation, and RBAC permission guards"
```

---

### Task 2: Performance, Bundle & UX Integrity Audit

**Files:**
- Audit: `scripts/check-bundle-budget.ts`
- Audit: `app/(dashboard)/items/loading.tsx`
- Audit: `app/(dashboard)/settings/loading.tsx`
- Audit: `app/(dashboard)/reports/loading.tsx`
- Audit: `components/ui/image-crop-dialog.tsx`

**Interfaces:**
- Consumes: Next.js build manifests and route loading boundaries
- Produces: Verified bundle sizes within budget and UI loading feedback

- [ ] **Step 1: Run Bundle Budget Check**

Run: `npm run build`
Expected: PASS with Shared Runtime JS (gzip) under 150 KB limit.

- [ ] **Step 2: Verify Route Loading Skeleton Components**

Audit `app/(dashboard)/items/loading.tsx`, `app/(dashboard)/settings/loading.tsx`, and `app/(dashboard)/reports/loading.tsx` for proper `animate-pulse` and semantic theme tokens.

- [ ] **Step 3: Audit Client-Side Image Compression Utility**

Verify `components/ui/image-crop-dialog.tsx` compresses uploaded images before Supabase Storage submission.

- [ ] **Step 4: Commit Task 2**

```bash
git commit --allow-empty -m "audit(performance): verify bundle size budget, loading skeletons, and image compression"
```

---

### Task 3: Database, Schema & Migration Audit

**Files:**
- Audit: `db/migrations/00001_initial_schema.sql`
- Audit: `db/migrations/00002_units_active_columns.sql`
- Audit: `scripts/apply-migrations.ts`
- Audit: `lib/unicode.ts`

**Interfaces:**
- Consumes: SQL migration scripts and database schema
- Produces: Verified database migration ledger, indexes, and Thai ICU collation

- [ ] **Step 1: Verify Migration Ledger Logic**

Audit `scripts/apply-migrations.ts` to ensure migrations are tracked in `public.app_migrations`.

- [ ] **Step 2: Audit Partial Unique Indexes & Collation**

Verify unique partial indexes for `asset_no` and `serial_no` on active items, and verify `th-TH-x-icu` Thai collation support.

- [ ] **Step 3: Commit Task 3**

```bash
git commit --allow-empty -m "audit(database): verify migration ledger, partial indexes, and Thai ICU collation"
```

---

### Task 4: Operations, Logging & Health Check Audit

**Files:**
- Audit: `app/api/health/route.ts`
- Audit: `app/api/health/readiness/route.ts`
- Audit: `app/api/health/liveness/route.ts`
- Audit: `app/api/health/status/route.ts`
- Audit: `lib/logging/index.ts`

**Interfaces:**
- Consumes: System health APIs and logging subsystem
- Produces: Verified operational diagnostics and sanitized log outputs

- [ ] **Step 1: Test Health Endpoints Unit Suite**

Run: `npm test -- tests/unit/health.test.ts`
Expected: PASS with 7/7 health tests passing.

- [ ] **Step 2: Audit Log Sanitization Engine**

Verify `lib/logging/` redacts Authorization headers, passwords, and sensitive stack traces (`[CAMMS-ERROR]`).

- [ ] **Step 3: Commit Task 4**

```bash
git commit --allow-empty -m "audit(operations): verify health APIs and log sanitization engine"
```

---

### Task 5: Full Automated Quality Gate Verification

**Files:**
- Run: Full system gate (`npm run check`)

**Interfaces:**
- Consumes: Entire codebase, environment variables, tests, linter, and build tools
- Produces: Production deployment sign-off with 0 errors

- [ ] **Step 1: Run Full System Gate (`npm run check`)**

Run: `npm run check`
Expected: PASS (verify-env -> 224 tests -> lint -> build -> bundle-budget check all succeeded).

- [ ] **Step 2: Commit Task 5**

```bash
git commit --allow-empty -m "chore(release): complete 5-pillar pre-release audit and sign off deployment readiness"
```
