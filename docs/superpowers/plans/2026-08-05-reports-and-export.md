# Reports & Export System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a complete Reports & Export System (Phase 6) enabling full dataset Excel (`.xlsx`) and official PDF (`.pdf`) export with location filtering, audit logging, and 100% Dark Mode semantic tokens.

**Architecture:** Add `getExportReportItems` query in `features/reports/queries.ts` for full dataset retrieval (up to 5,000 items) and server action `recordReportExportAudit` in `features/reports/actions.ts`. Refactor `features/reports/components/reports-list.tsx` to include Location filter and semantic CSS tokens. Implement ExcelJS and PDF export generators.

**Tech Stack:** Next.js 16 (App Router), React 19, Tailwind CSS v4, Lucide Icons, ExcelJS, jsPDF.

## Global Constraints

- Thai-first UI labels with precise operational phrasing.
- Strict Dark Mode compatibility using semantic CSS tokens (`bg-card`, `border-border`, `text-card-foreground`, `text-muted-foreground`, `bg-background`, `text-foreground`, `text-primary`).
- Maximum export query limit: **5,000 items**.
- Minimum font size `text-xs` (12px) or `text-[11px]` for secondary labels (no `text-[10px]`).
- Record audit log entry in `audit_logs` for every export operation.
- Verify build, lint, typecheck, and test status (`npm run typecheck`, `npm run lint`, `npm run build`, `npm test`).

---

### Task 1: Add Full Dataset Query & Export Audit Server Action

**Files:**
- Modify: `features/reports/queries.ts:200-334`
- Create: `features/reports/actions.ts`
- Create: `features/reports/queries.test.ts`

**Interfaces:**
- Consumes: `ItemListSearchParams` from `@/features/items/types`
- Produces: `getExportReportItems(searchParams: ItemListSearchParams)` query function & `recordReportExportAudit(format: 'excel' | 'pdf', filterSummary: string)` server action

- [ ] **Step 1: Write failing unit test for `getExportReportItems`**

Create `features/reports/queries.test.ts`:

```typescript
import test from 'node:test'
import assert from 'node:assert/strict'
import { getExportReportItems } from './queries'

test('getExportReportItems function exists and accepts search parameters', () => {
  assert.equal(typeof getExportReportItems, 'function')
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx --test features/reports/queries.test.ts`
Expected: FAIL with "getExportReportItems is not exported".

- [ ] **Step 3: Implement `getExportReportItems` and `recordReportExportAudit`**

Update `features/reports/queries.ts`:

```typescript
export async function getExportReportItems(params: ItemListSearchParams): Promise<{
  items: ReportItemRow[]
  totalCount: number
  totalQuantity: number
  totalValue: number
}> {
  const supabase = await createClient()
  const q = params.q ? normalizeForSearch(params.q) : null
  const itemType = params.type || null
  const status = params.status || null
  const categoryId = params.category_id || null
  const locationId = params.location_id || null

  const { data, error } = await supabase.rpc('get_report_items_page', {
    p_search: q,
    p_type: itemType,
    p_status: status,
    p_category_id: categoryId,
    p_location_id: locationId,
    p_page: 1,
    p_page_size: 5000,
    p_sort_by: params.sort_by || 'created_at',
    p_sort_dir: params.sort_dir || 'desc',
  })

  if (error || !data) {
    return { items: [], totalCount: 0, totalQuantity: 0, totalValue: 0 }
  }

  const res = data as {
    items?: unknown[]
    total_count?: number
    total_quantity?: number
    total_value?: number
  }

  const rawItems = res.items ?? []
  const items = rawItems.map((r) => toReportItemRow(r))

  return {
    items,
    totalCount: res.total_count ?? items.length,
    totalQuantity: res.total_quantity ?? items.reduce((acc, i) => acc + i.quantity, 0),
    totalValue: res.total_value ?? items.reduce((acc, i) => acc + (i.quantity * (i.unit_price ?? 0)), 0),
  }
}
```

Create `features/reports/actions.ts`:

```typescript
'use server'

import { getCurrentProfile } from '@/features/auth/queries'
import { writeAuditLog } from '@/lib/audit'
import { ActionResponse, successResponse, errorResponse } from '@/lib/actions-helper'

export async function recordReportExportAudit(
  format: 'excel' | 'pdf',
  filterSummary: string
): Promise<ActionResponse> {
  try {
    const profile = await getCurrentProfile()
    if (!profile || !profile.is_active) {
      return errorResponse('กรุณาเข้าสู่ระบบก่อนทำรายการ')
    }

    await writeAuditLog({
      action: 'EXPORT_REPORT',
      targetType: 'reports',
      targetId: `export-${format}-${Date.now()}`,
      details: {
        format,
        filterSummary,
        exportedBy: profile.full_name,
        userRole: profile.role,
      },
    })

    return successResponse('บันทึกประวัติการส่งออกสำเร็จ')
  } catch (error) {
    return errorResponse('ไม่สามารถบันทึกประวัติการส่งออกได้')
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx --test features/reports/queries.test.ts`
Expected: PASS

- [ ] **Step 5: Run TypeScript Check**

Run: `npm run typecheck`
Expected: PASS with 0 errors.

- [ ] **Step 6: Commit Task 1**

```bash
git add features/reports/queries.ts features/reports/actions.ts features/reports/queries.test.ts
git commit -m "feat(reports): add full dataset export query and audit action"
```

---

### Task 2: Refactor Reports Page UI with Semantic Tokens & Location Filter

**Files:**
- Modify: `app/(dashboard)/reports/page.tsx`
- Modify: `features/reports/components/reports-list.tsx`

**Interfaces:**
- Consumes: `locations` reference list from `getItemReferences()`
- Produces: Semantic tokenized Reports page with Location filter dropdown

- [ ] **Step 1: Inspect `app/(dashboard)/reports/page.tsx` and `reports-list.tsx`**

Check data fetching in `page.tsx` and prop types in `reports-list.tsx`.

- [ ] **Step 2: Update `page.tsx` to fetch `locations` and pass to `ReportsList`**

Update `app/(dashboard)/reports/page.tsx`:
- Import `getItemReferences` from `@/features/items/queries`.
- Fetch `getItemReferences()` concurrently.
- Pass `locations={locations}` to `<ReportsList ... />`.

- [ ] **Step 3: Refactor `reports-list.tsx` with Location Filter & Semantic Theme Tokens**

Update `features/reports/components/reports-list.tsx`:
- Add `locations: { id: string; name: string }[]` to `ReportsListProps`.
- Add `location_id` select to filter header:
  ```tsx
  <select
    value={searchParams.location_id ?? ''}
    onChange={(e) => handleFilterChange({ location_id: e.target.value, page: '1' })}
    className="h-9 rounded-lg border border-input bg-card px-3 text-xs font-semibold text-card-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer shadow-2xs"
  >
    <option value="">ทุกสถานที่ตั้ง</option>
    {locations.map((loc) => (
      <option key={loc.id} value={loc.id}>
        {loc.name}
      </option>
    ))}
  </select>
  ```
- Refactor all container and text colors to semantic tokens (`bg-card`, `border-border`, `text-card-foreground`, `text-muted-foreground`, `bg-muted`, `text-primary`).

- [ ] **Step 4: Verify TypeScript & ESLint**

Run: `npm run typecheck` and `npm run lint`
Expected: PASS with 0 errors.

- [ ] **Step 5: Commit Task 2**

```bash
git add app/\(dashboard\)/reports/page.tsx features/reports/components/reports-list.tsx
git commit -m "refactor(reports): apply semantic tokens and location filter to reports list UI"
```

---

### Task 3: Implement Full Dataset Excel & PDF Export Generators

**Files:**
- Modify: `features/reports/components/reports-list.tsx`
- Create: `lib/reports-pdf-generator.ts`

**Interfaces:**
- Consumes: `getExportReportItems` and `recordReportExportAudit`
- Produces: Full dataset Excel & PDF export handlers

- [ ] **Step 1: Implement PDF Generator (`lib/reports-pdf-generator.ts`)**

Create `lib/reports-pdf-generator.ts`:
- Export function `generateReportPdf(items: ReportItemRow[], filterSummary: string, totalQty: number, totalValue: number)`
- Generate clean HTML/Printable window or `jsPDF` document.
- Layout features:
  - Header: "รายงานทะเบียนทรัพย์สินและวัสดุสำนักงาน (CAMMS)"
  - Metadata block: Export date, active filter summary, generated by user.
  - Data table: Item Name, Type, Category, Location, Quantity, Unit Price, Total Price, Status.
  - Footer summary box: Total Items, Total Quantity, Total Valuation.
  - Approval signature block: "ลงชื่อ.......................................................... ผู้จัดทำรายงาน" and "ลงชื่อ.......................................................... ผู้เห็นชอบ/อนุมัติ".

- [ ] **Step 2: Update `exportToExcel` in `reports-list.tsx` for Full Dataset & Audit Logging**

Update `exportToExcel` handler in `reports-list.tsx`:
- Import `getExportReportItems` and `recordReportExportAudit`.
- Display loading spinner state during export.
- Fetch full dataset matching active filters via `getExportReportItems(searchParams)`.
- Format ExcelJS worksheet:
  - Title banner row: `รายงานทะเบียนครุภัณฑ์และวัสดุสำนักงาน (CAMMS)`
  - Filter summary row
  - Table headers with fill color `#FFE2E8F0` and bold font
  - Data rows with currency formatting for `unit_price` (`#,##0.00 ฿`)
  - Summary row for `totalQuantity` and `totalValue`
- Write buffer and trigger browser download `office-items-report-YYYY-MM-DD.xlsx`.
- Call `recordReportExportAudit('excel', filterSummary)`.

- [ ] **Step 3: Update PDF Export button handler in `reports-list.tsx`**

Update `exportToPdf` handler in `reports-list.tsx`:
- Fetch full dataset matching active filters via `getExportReportItems(searchParams)`.
- Call `generateReportPdf(...)`.
- Call `recordReportExportAudit('pdf', filterSummary)`.

- [ ] **Step 4: Verify TypeScript, ESLint, Unit Tests, and Production Build**

Run:
`npm run typecheck`
`npm run lint`
`npm test`
`npm run build`

Expected: PASS with 0 errors across all commands.

- [ ] **Step 5: Commit Task 3**

```bash
git add features/reports/components/reports-list.tsx lib/reports-pdf-generator.ts
git commit -m "feat(reports): implement full dataset excel and pdf export generators"
```
