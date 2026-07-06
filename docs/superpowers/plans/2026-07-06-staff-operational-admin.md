# Staff Operational Admin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let `staff` perform operational asset-management tasks like `admin`, while keeping DB/admin SQL and user permission management admin-only.

**Architecture:** Restore `staff` permissions across UI helpers, item Server Actions, settings metadata Server Actions, and Supabase RLS policies. Keep `features/admin/actions.ts`, `/admin/db-panel`, and `features/settings/actions.ts` `updateProfile` guarded by admin-only checks.

**Tech Stack:** Next.js 16 Server Actions, Supabase RLS migrations, TypeScript, node:test.

---

### Task 1: Update Permission Tests First

**Files:**
- Modify: `tests/unit/permissions.test.ts`
- Modify: `tests/integration/delete-item.test.ts`
- Modify: `tests/integration/restore-item.test.ts`
- Modify: `tests/integration/settings.test.ts`

- [ ] **Step 1: Change helper assertions**

Set `staff` expected values to `true` for `canDelete`, `canManageSettings`, and `canManageTrash`.

- [ ] **Step 2: Change item action tests**

Replace staff rejection tests with success tests for `softDeleteItem` and `restoreItem`.

- [ ] **Step 3: Change settings tests**

Add a `staff` success case for `createCategory`; keep viewer rejection.

- [ ] **Step 4: Verify red**

Run: `npm test -- tests/unit/permissions.test.ts tests/integration/delete-item.test.ts tests/integration/restore-item.test.ts tests/integration/settings.test.ts`

Expected: tests fail because production code still treats those operations as admin-only.

### Task 2: Restore Staff Operational Permissions

**Files:**
- Modify: `lib/permissions.ts`
- Modify: `features/items/actions.ts`
- Modify: `features/settings/actions.ts`
- Modify: `db/migrations/00022_restrict_staff_permissions.sql`
- Modify: `docs/plans/2026-07-06-restrict-staff-permissions-design.md`

- [ ] **Step 1: Update UI helpers**

Allow `admin` and `staff` in `canDelete`, `canManageSettings`, and `canManageTrash`.

- [ ] **Step 2: Update item actions**

Allow `admin` and `staff` in delete/restore/hard-delete paths by using the same operational role boundary as editor actions.

- [ ] **Step 3: Update settings metadata actions**

Allow `admin` and `staff` to manage categories, locations, and units. Keep `updateProfile` using `requireAdmin()`.

- [ ] **Step 4: Update RLS migration**

Set metadata manage and item hard-delete policies to `private.current_app_role() IN ('admin', 'staff')`.

### Task 3: Verify and Apply

**Files:**
- Modify: `docs/plans/task.md`

- [ ] **Step 1: Run focused tests**

Run the focused permission/action tests and confirm they pass.

- [ ] **Step 2: Apply migrations**

Run `npm run verify-env` and `npx tsx scripts/apply-migrations.ts`.

- [ ] **Step 3: Run full checks**

Run `npm test`, `npm run lint`, and `npm run build`.

- [ ] **Step 4: Update task tracker**

Update `docs/plans/task.md` to note the staff operational-admin adjustment.
