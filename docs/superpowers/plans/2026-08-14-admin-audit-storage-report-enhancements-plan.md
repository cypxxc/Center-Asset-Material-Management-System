# Admin, Audit, Storage, and Reports Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement dedicated User Management UI, Audit Log Explorer UI, automated Supabase Storage orphan cleanup on item mutations/hard deletion, and polished Excel/PDF report export.

**Architecture:** Create dedicated admin views (`/admin/users` and `/admin/audit-logs`) with full server-side validation, add storage deletion helpers to item action lifecycle hooks in `features/items/actions.ts`, and refine `exceljs`/`pdfmake` report generators in `lib/` with proper number formatting, column sizing, and summary calculations.

**Tech Stack:** Next.js 16 (App Router, Server Actions, Server Components), TypeScript, Supabase (PostgreSQL, Storage, RLS), Tailwind CSS v4, Lucide Icons, Node.js `node:test` (`tsx --test`), ExcelJS.

## Global Constraints

- Strict TypeScript checking (`npm run typecheck`) must pass with 0 errors.
- ESLint flat configuration (`npm run lint`) must pass.
- All existing and new tests (`npm test`) must pass cleanly.
- Production build (`npm run build`) must succeed.
- All admin actions must enforce `requireAdmin()` and verify active profile status.

---

### Task 1: Supabase Storage Cleanup Helper & Integration

**Files:**
- Create: `lib/supabase/storage.ts`
- Modify: `features/items/actions.ts:250-380`
- Test: `tests/unit/storage.test.ts`

**Interfaces:**
- Consumes: Supabase Storage client, `public.items.image_url`
- Produces: `deleteItemStorageImage(imageUrl: string | null): Promise<{ success: boolean; error?: string }>`

- [ ] **Step 1: Write failing unit test for `deleteItemStorageImage`**

Create `tests/unit/storage.test.ts`:
```typescript
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseStoragePathFromUrl } from '@/lib/supabase/storage'

test('parseStoragePathFromUrl extracts relative file path from public Supabase URL', () => {
  const url = 'https://xyz.supabase.co/storage/v1/object/public/item-images/items/sample-image-123.webp'
  const path = parseStoragePathFromUrl(url)
  assert.equal(path, 'items/sample-image-123.webp')
})

test('parseStoragePathFromUrl returns null for invalid or external URLs', () => {
  assert.equal(parseStoragePathFromUrl(null), null)
  assert.equal(parseStoragePathFromUrl(''), null)
  assert.equal(parseStoragePathFromUrl('https://images.unsplash.com/photo-123'), null)
})
```

- [ ] **Step 2: Run test to verify failure**

Run: `npx tsx --test tests/unit/storage.test.ts`  
Expected: FAIL (module not found)

- [ ] **Step 3: Implement `lib/supabase/storage.ts`**

Create `lib/supabase/storage.ts`:
```typescript
import { createAdminClient, createClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logging'

export function parseStoragePathFromUrl(imageUrl: string | null | undefined): string | null {
  if (!imageUrl || typeof imageUrl !== 'string') return null
  const bucketMarker = '/item-images/'
  const idx = imageUrl.indexOf(bucketMarker)
  if (idx === -1) return null
  const relativePath = imageUrl.substring(idx + bucketMarker.length).split('?')[0]
  return relativePath ? decodeURIComponent(relativePath) : null
}

export async function deleteItemStorageImage(imageUrl: string | null | undefined): Promise<{ success: boolean; error?: string }> {
  const filePath = parseStoragePathFromUrl(imageUrl)
  if (!filePath) return { success: true }

  try {
    const supabase = process.env.SUPABASE_SERVICE_ROLE_KEY ? await createAdminClient() : await createClient()
    const { error } = await supabase.storage.from('item-images').remove([filePath])
    if (error) {
      logger.warn({ operation: 'deleteItemStorageImage', feature: 'storage', details: error.message, filePath })
      return { success: false, error: error.message }
    }
    return { success: true }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    logger.warn({ operation: 'deleteItemStorageImage', feature: 'storage', details: message, filePath })
    return { success: false, error: message }
  }
}
```

- [ ] **Step 4: Integrate storage deletion into `features/items/actions.ts`**

Update `updateItem` and `hardDeleteItem` in `features/items/actions.ts` to call `deleteItemStorageImage` when images change or items are permanently deleted.

- [ ] **Step 5: Run tests and commit**

Run: `npx tsx --test tests/unit/storage.test.ts`  
Run: `npm test`  
Commit:
```bash
git add lib/supabase/storage.ts features/items/actions.ts tests/unit/storage.test.ts
git commit -m "feat(storage): add image storage cleanup helper and integrate with item mutations"
```

---

### Task 2: Dedicated User Management UI (`/admin/users`)

**Files:**
- Create: `features/admin/queries.ts`
- Modify: `features/admin/actions.ts`
- Create: `app/(dashboard)/admin/users/page.tsx`
- Create: `app/(dashboard)/admin/users/users-client.tsx`
- Test: `tests/integration/user-management.test.ts`

**Interfaces:**
- Consumes: `public.profiles`
- Produces: `getProfilesList()`, `updateUserProfileRoleAndStatus()`, UI at `/admin/users`

- [ ] **Step 1: Write integration test for User Management Queries & Actions**

Create `tests/integration/user-management.test.ts` to verify:
1. `getProfilesList` supports filtering by search term and role.
2. `updateUserProfileRoleAndStatus` rejects non-admin users.
3. Successful role and status update creates an audit log.

- [ ] **Step 2: Run test to verify failure**

Run: `npx tsx --test tests/integration/user-management.test.ts`  
Expected: FAIL

- [ ] **Step 3: Implement `features/admin/queries.ts` and `features/admin/actions.ts`**

Add `getProfilesList` in `features/admin/queries.ts`:
```typescript
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/permissions'

export interface ProfileListItem {
  id: string
  full_name: string | null
  email: string | null
  role: 'admin' | 'staff' | 'viewer'
  is_active: boolean
  created_at: string
  updated_at: string | null
}

export async function getProfilesList(params: {
  q?: string
  role?: string
  is_active?: string
  page?: number
  pageSize?: number
}) {
  const supabase = process.env.SUPABASE_SERVICE_ROLE_KEY ? await createAdminClient() : await createClient()
  const page = params.page || 1
  const pageSize = params.pageSize || 50
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  let query = supabase
    .from('profiles')
    .select('id, full_name, email, role, is_active, created_at, updated_at', { count: 'exact' })
    .order('created_at', { ascending: false })

  if (params.q) {
    query = query.or(`full_name.ilike.%${params.q}%,email.ilike.%${params.q}%`)
  }
  if (params.role && params.role !== 'all') {
    query = query.eq('role', params.role)
  }
  if (params.is_active !== undefined && params.is_active !== 'all') {
    query = query.eq('is_active', params.is_active === 'true')
  }

  const { data, count, error } = await query.range(from, to)
  return { profiles: (data as ProfileListItem[]) || [], totalCount: count || 0 }
}
```

Add `updateUserProfileRoleAndStatus` in `features/admin/actions.ts`.

- [ ] **Step 4: Create User Management UI Pages**

Create `app/(dashboard)/admin/users/page.tsx` and `users-client.tsx` with search input, role filter, status switch, and confirmation modal.

- [ ] **Step 5: Run tests and commit**

Run: `npx tsx --test tests/integration/user-management.test.ts`  
Run: `npm run typecheck`  
Commit:
```bash
git add app/(dashboard)/admin/users features/admin/ tests/integration/user-management.test.ts
git commit -m "feat(admin): add dedicated user management UI and role update actions"
```

---

### Task 3: Dedicated Audit Log Explorer UI (`/admin/audit-logs`)

**Files:**
- Modify: `features/admin/queries.ts`
- Create: `app/(dashboard)/admin/audit-logs/page.tsx`
- Create: `app/(dashboard)/admin/audit-logs/audit-logs-client.tsx`
- Test: `tests/integration/audit-explorer.test.ts`

**Interfaces:**
- Consumes: `public.audit_logs`, `public.profiles`
- Produces: `getAuditLogsList()`, UI at `/admin/audit-logs`

- [ ] **Step 1: Write integration test for Audit Explorer**

Create `tests/integration/audit-explorer.test.ts` testing:
1. `getAuditLogsList` filters by `action` (`INSERT`, `UPDATE`, `DELETE`, `EXPORT_REPORT`).
2. `getAuditLogsList` matches search strings on `target_id` or `target_table`.

- [ ] **Step 2: Run test to verify failure**

Run: `npx tsx --test tests/integration/audit-explorer.test.ts`  
Expected: FAIL

- [ ] **Step 3: Implement `getAuditLogsList` in `features/admin/queries.ts`**

Add `getAuditLogsList` supporting pagination, search, action filter, and joining profile names.

- [ ] **Step 4: Create Audit Log Explorer UI**

Create `app/(dashboard)/admin/audit-logs/page.tsx` and `audit-logs-client.tsx` with color-coded badges and expandable JSON diff inspector.

- [ ] **Step 5: Run tests and commit**

Run: `npx tsx --test tests/integration/audit-explorer.test.ts`  
Run: `npm run typecheck`  
Commit:
```bash
git add app/(dashboard)/admin/audit-logs features/admin/ tests/integration/audit-explorer.test.ts
git commit -m "feat(audit): add dedicated audit log explorer with JSON diff inspector"
```

---

### Task 4: Excel & PDF Report Formatting Polish

**Files:**
- Create: `lib/reports-excel-generator.ts`
- Modify: `lib/reports-pdf-generator.ts`
- Modify: `features/reports/components/reports-list.tsx`
- Test: `tests/unit/reports-excel.test.ts`

**Interfaces:**
- Consumes: `ReportItemRow[]`
- Produces: Polished Excel workbook buffer and PDF with formatting, column auto-fit, and summary totals

- [ ] **Step 1: Write unit test for Excel generator helper**

Create `tests/unit/reports-excel.test.ts` asserting column definitions, number formatting masks, and header styling.

- [ ] **Step 2: Run test to verify failure**

Run: `npx tsx --test tests/unit/reports-excel.test.ts`  
Expected: FAIL

- [ ] **Step 3: Implement `lib/reports-excel-generator.ts`**

Create `lib/reports-excel-generator.ts` using `exceljs` with auto-fit widths, currency formats (`#,##0.00`), integer quantities, and summary row.

- [ ] **Step 4: Update `reports-list.tsx` and `lib/reports-pdf-generator.ts`**

Wire the enhanced Excel generator into `reports-list.tsx` and refine PDF table column widths.

- [ ] **Step 5: Run tests and commit**

Run: `npx tsx --test tests/unit/reports-excel.test.ts`  
Run: `npm test`  
Run: `npm run build`  
Commit:
```bash
git add lib/reports-excel-generator.ts lib/reports-pdf-generator.ts features/reports/ components/ tests/unit/reports-excel.test.ts
git commit -m "feat(reports): polish Excel and PDF report export with auto-fit styling and currency formats"
```
