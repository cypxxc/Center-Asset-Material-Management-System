# Restrict Staff Permissions Implementation Plan

> **For Antigravity:** REQUIRED WORKFLOW: Use `.agent/workflows/execute-plan.md` to execute this plan in single-flow mode.

**Goal:** Restrict delete, trash, and settings management capabilities to only the `admin` role across the UI, Next.js Server Actions, and Supabase RLS policies.

**Architecture:** We will modify `lib/permissions.ts` to update role helpers, update Next.js Server Actions to reject `staff` requests for settings/deletions, adjust unit tests, and create a SQL migration file to align RLS policies at the database layer.

**Tech Stack:** Next.js 16, Supabase PostgreSQL, TypeScript, node:test

---

### Task 1: Update UI Permission Helpers

**Files:**
- Modify: `lib/permissions.ts`

**Step 1: Write the changes to lib/permissions.ts**

Update `canDelete`, `canManageSettings`, and `canManageTrash` in `lib/permissions.ts` to restrict access to `'admin'` only.

```typescript
export function canDelete(role?: string | null): boolean {
  return role === 'admin';
}

export function canManageSettings(role?: string | null): boolean {
  return role === 'admin';
}

export function canManageTrash(role?: string | null): boolean {
  return role === 'admin';
}
```

**Step 2: Commit Task 1**
```bash
git add lib/permissions.ts
git commit -m "feat(auth): restrict UI permission helpers to admin only"
```

---

### Task 2: Update Permission Unit Tests

**Files:**
- Modify: `tests/unit/permissions.test.ts`

**Step 1: Update the unit tests**

Modify assertions in `tests/unit/permissions.test.ts` to expect `false` for `staff` role in delete, settings management, and trash management.

```typescript
test('permissions helper determine correct delete rights', () => {
  assert.equal(canDelete('admin'), true);
  assert.equal(canDelete('staff'), false);
  assert.equal(canDelete('viewer'), false);
});

test('permissions helper determine correct settings management rights', () => {
  assert.equal(canManageSettings('admin'), true);
  assert.equal(canManageSettings('staff'), false);
  assert.equal(canManageSettings('viewer'), false);
});

test('permissions helper determine correct trash management rights', () => {
  assert.equal(canManageTrash('admin'), true);
  assert.equal(canManageTrash('staff'), false);
  assert.equal(canManageTrash('viewer'), false);
});
```

**Step 2: Run tests to verify failures/passes**

Run the test suite:
`npm test -- tests/unit/permissions.test.ts`

**Step 3: Commit Task 2**
```bash
git add tests/unit/permissions.test.ts
git commit -m "test(auth): update permissions unit tests to reflect admin-only rights"
```

---

### Task 3: Restrict Server Actions in Items Module

**Files:**
- Modify: `features/items/actions.ts`

**Step 1: Edit permission checks in features/items/actions.ts**

* Update `requireDeletePermission()` to only allow `'admin'`:
```typescript
async function requireDeletePermission() {
  const profile = await getCurrentProfile()

  if (!profile || !profile.is_active) {
    return { error: 'กรุณาเข้าสู่ระบบก่อนทำรายการ', profile: null }
  }

  if (profile.role !== 'admin') {
    return { error: 'เฉพาะผู้ดูแลระบบเท่านั้นที่มีสิทธิ์ทำรายการนี้', profile: null }
  }

  return { error: null, profile }
}
```

* Update `softDeleteItem(id: string)` check to only allow `'admin'`:
```typescript
  if (!profile || profile.role !== 'admin') {
    return { message: 'เฉพาะผู้ดูแลระบบเท่านั้นที่ลบรายการได้' }
  }
```

* Update `bulkDeleteItems(ids: string[])` check to only allow `'admin'`:
```typescript
  if (!profile || profile.role !== 'admin') {
    logger.warn({ operation: 'bulkDeleteItems', feature: 'items', details: 'Unauthorized bulk delete attempt' })
    return errorResponse('เฉพาะผู้ดูแลระบบเท่านั้นที่ลบรายการได้')
  }
```

* Update `restoreItem(id: string)` to require delete permission instead of editor:
```typescript
export async function restoreItem(id: string): Promise<ActionResponse> {
  const auth = await requireDeletePermission()
  if (auth.error || !auth.profile) {
    logger.warn({ operation: 'restoreItem', feature: 'items', details: 'Unauthorized restore attempt' })
    return errorResponse(auth.error ?? 'Unauthorized')
  }
```

* Update `bulkRestoreItems(ids: string[])` to require delete permission instead of editor:
```typescript
export async function bulkRestoreItems(ids: string[]): Promise<ActionResponse> {
  const auth = await requireDeletePermission()
  if (auth.error || !auth.profile) {
    logger.warn({ operation: 'bulkRestoreItems', feature: 'items', details: 'Unauthorized bulk restore attempt' })
    return errorResponse(auth.error ?? 'Unauthorized')
  }
```

**Step 2: Commit Task 3**
```bash
git add features/items/actions.ts
git commit -m "feat(auth): restrict item deletion and restoration server actions to admin only"
```

---

### Task 4: Restrict Settings Management Actions

**Files:**
- Modify: `features/settings/actions.ts`

**Step 1: Edit requireSettingsManager in features/settings/actions.ts**

Update `requireSettingsManager` to enforce `profile.role === 'admin'`:
```typescript
async function requireSettingsManager() {
  const profile = await getCurrentProfile()

  if (!profile || !profile.is_active) {
    redirect('/settings?error=กรุณาเข้าสู่ระบบก่อนจัดการตั้งค่า')
  }

  if (profile.role !== 'admin') {
    redirect('/settings?error=เฉพาะผู้ดูแลระบบเท่านั้นที่สามารถจัดการตั้งค่าได้')
  }
}
```

**Step 2: Commit Task 4**
```bash
git add features/settings/actions.ts
git commit -m "feat(auth): restrict settings manager server actions to admin only"
```

---

### Task 5: Database Migration for RLS Policies

**Files:**
- Create: `db/migrations/00022_restrict_staff_permissions.sql`

**Step 1: Write SQL migration file**

Create a new file `db/migrations/00022_restrict_staff_permissions.sql` to update RLS policies:
```sql
-- Migration 00022: Restrict staff permissions on metadata and hard deletes
-- db/migrations/00022_restrict_staff_permissions.sql

-- 1. Drop the metadata policies that allowed staff
DROP POLICY IF EXISTS categories_staff_manage ON public.categories;
DROP POLICY IF EXISTS locations_staff_manage ON public.locations;
DROP POLICY IF EXISTS units_staff_manage ON public.units;
DROP POLICY IF EXISTS items_hard_delete ON public.items;

-- 2. Re-create settings metadata policies to allow ONLY admin
CREATE POLICY categories_admin_manage ON public.categories FOR ALL TO authenticated
  USING (private.current_app_role() = 'admin')
  WITH CHECK (private.current_app_role() = 'admin');

CREATE POLICY locations_admin_manage ON public.locations FOR ALL TO authenticated
  USING (private.current_app_role() = 'admin')
  WITH CHECK (private.current_app_role() = 'admin');

CREATE POLICY units_admin_manage ON public.units FOR ALL TO authenticated
  USING (private.current_app_role() = 'admin')
  WITH CHECK (private.current_app_role() = 'admin');

-- 3. Re-create items hard delete policy to allow ONLY admin
CREATE POLICY items_hard_delete ON public.items FOR DELETE TO authenticated
  USING (private.current_app_role() = 'admin' AND deleted_at IS NOT NULL);
```

**Step 2: Commit Task 5**
```bash
git add db/migrations/00022_restrict_staff_permissions.sql
git commit -m "db(auth): create RLS migration to restrict metadata and hard delete permissions to admin only"
```

---

### Task 6: Apply Migration and Verify Entire System

**Files:**
- Modify: `docs/plans/task.md` (to update progress)

**Step 1: Apply database migrations**
Run: `npm run verify-env` (to verify Supabase variables)
Run: `tsx scripts/apply-migrations.ts`

**Step 2: Run all tests**
Run: `npm test`
Expected: 144+ tests pass.

**Step 3: Run linter**
Run: `npm run lint`

**Step 4: Run production build**
Run: `npm run build`

**Step 5: Update docs/plans/task.md and Commit**
Update the checklist in `docs/plans/task.md`.
```bash
git add docs/plans/task.md
git commit -m "docs(auth): complete restrict staff permissions task"
```
