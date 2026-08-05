# Pre-Release Comprehensive Audit Design Spec

**Date:** 2026-08-05  
**Target Application:** Registry-S (Office Item Registry System)  
**Stack:** Next.js 16.2 (App Router), React 19, Supabase PostgreSQL, Tailwind CSS v4, TypeScript 5 (Strict), Playwright  
**Goal:** Conduct a comprehensive 5-pillar audit covering Security, Performance, Database/Migrations, Operations/Health, and Automated Test Coverage to verify 100% production deployment readiness.

---

## 1. Pillar 1: Security & Role-Based Access Control (RBAC) Audit

### 1.1 Supabase RLS Policy Audit
- **Requirement**: Row Level Security (RLS) must be enabled (`relrowsecurity = true`) on all public schema tables:
  - `profiles`
  - `items`
  - `locations`
  - `units`
  - `categories`
  - `audit_logs`
- **Verification**: `scripts/verify-database-readiness.ts` checks that all 6 public tables enforce RLS policies for `select`, `insert`, `update`, and `delete`.

### 1.2 Anonymous vs Service Role Client Isolation
- **Anonymous Key (`createClient()`)**: Default client used for standard user sessions. Enforces RLS policies based on `auth.uid()`.
- **Service Role Key (`createAdminClient()`)**: Restricted strictly to Supabase Auth management and admin DB operations (`features/admin/actions.ts`). Must never be bundled into client-side JS.

### 1.3 Role Boundaries Enforcement
- **Admin**: Full access (user management, settings management, soft delete, hard delete).
- **Staff**: Operational access (create & edit items, create & edit reference metadata). Cannot hard delete or alter system permissions.
- **Viewer**: Read-only access across items, reports, and settings.
- **Enforcement**: All mutations in `features/*/actions.ts` must invoke `requireAdmin()` or `requireEditor()` server-side permission checks.

---

## 2. Pillar 2: Performance, Bundle & UX Integrity Audit

### 2.1 Performance & Bundle Size Budget
- **Budget Thresholds** (enforced by `scripts/check-bundle-budget.ts`):
  - Shared Runtime JS (raw): Max 450 KB
  - Shared Runtime JS (gzip transfer): Max 150 KB
  - Dashboard Route JS (raw): Max 160 KB
  - Dashboard Route JS (gzip transfer): Max 50 KB
- **Verification**: Executed automatically during `npm run build`.

### 2.2 Route-Level Loading Skeletons
- **Routes**: `/items`, `/settings`, `/reports`
- **Implementation**: Next.js App Router `loading.tsx` files rendered with Tailwind CSS animated pulse blocks (`animate-pulse`) using 100% semantic CSS theme tokens.

### 2.3 Image Upload Optimization
- **Image Crop & Compression**: Client-side image crop dialog (`ImageCropDialog`) reduces image dimensions and compresses quality prior to Supabase Storage upload.

---

## 3. Pillar 3: Database, Schema & Migration Audit

### 3.1 Migration Ledger Integrity
- **Migrations**:
  - `00001_initial_schema.sql`
  - `00002_units_active_columns.sql`
- **Ledger Table**: `public.app_migrations` tracks applied migration filenames and execution timestamps.

### 3.2 Indexing & Unique Constraints
- **Partial Unique Indexes**:
  - `idx_items_asset_no_unique_active` (uniqueness enforced only on non-deleted items)
  - `idx_items_serial_no_unique_active` (uniqueness enforced only on non-deleted items with serial numbers)
- **Active Filter Indexes**: `idx_units_is_active`, `idx_categories_is_active`, `idx_locations_is_active`.

### 3.3 Unicode & Thai ICU Collation
- **Collation**: Text columns (`name`, `item_name`) configured with `th-TH-x-icu` for Thai dictionary order.
- **Text Normalization**: NFC normalization via `lib/unicode.ts` prevents character representation mismatch.

---

## 4. Pillar 4: Operations, Logging & Health Check Audit

### 4.1 Health Check Endpoints
- `/api/health`: General service health status.
- `/api/health/readiness`: Structured dependency check (Database & Storage concurrency) using service role.
- `/api/health/liveness`: Returns HTTP 200 `{ status: "alive" }`.
- `/api/health/status`: Returns runtime metadata, environment, and Node version.

### 4.2 Logging & Sanitization
- **Logger**: `lib/logging/` redacts Authorization headers, passwords, connection strings, and sensitive stack traces (`[CAMMS-ERROR]`) before output.

### 4.3 Graceful Error Boundaries
- **Localized UI**: Thai fallback messages for operational errors (`handleActionError`), preventing catastrophic UI unmounting.

---

## 5. Pillar 5: Automated Test Suite & Release Verification

### 5.1 System Quality Gate (`npm run check`)
- `npm run verify-env`: Validates `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.
- `npm test`: Runs Node test runner across 224 unit & integration tests.
- `npm run lint`: ESLint flat config check (0 errors).
- `npm run build`: Next.js production compilation & bundle budget verification.

### 5.2 Browser Journeys (`npm run test:smoke`)
- Playwright E2E smoke test suite for user authentication, item browsing, and dashboard rendering.

---

## 6. Execution Checklists & Readiness Sign-Off

- [x] All 6 public DB tables enforce RLS policies.
- [x] Service Role key isolated strictly to server-side admin actions.
- [x] Bundle budget within limits (Shared JS gzip ~129.91 KB / 150 KB max).
- [x] Loading skeletons verified across `/items`, `/settings`, and `/reports`.
- [x] Database migrations registered in `public.app_migrations`.
- [x] Health check endpoints verified.
- [x] All 224 unit tests pass cleanly.
- [x] Production build passes without errors or budget violations.
