# Items Registry Header Area Redesign Implementation Plan

> **For Antigravity:** REQUIRED WORKFLOW: Use `.agent/workflows/execute-plan.md` to execute this plan in single-flow mode.

**Goal:** Restructure the header area layout of the items registry page to eliminate clutter, redundant elements, and duplicate search boxes, and implement an Excel export button.

**Architecture:** Remove the global search form from the top navigation bar. Clean up the standalone explorer path bar and replace it with a unified header inside the main section of the items registry, presenting breadcrumbs and title on the top row, and filters + export on the bottom row. Add a server action to query all matching items for Excel exporting using `exceljs`.

**Tech Stack:** Next.js (App Router), React, Tailwind CSS, ExcelJS, Supabase (PostgreSQL)

---

### Task 1: Create Server Action for Non-Paginated Data Export

**Files:**
- Modify: `features/items/actions.ts`

**Step 1: Implement Server Action**
Add a server action `getItemsForExport` that calls `getReportItemsList` to fetch all matching records without pagination limits.

```typescript
import { getReportItemsList } from '@/features/reports/queries'
import { ItemListSearchParams } from './types'

export async function getItemsForExport(params: ItemListSearchParams) {
  return getReportItemsList(params)
}
```

**Step 2: Commit**
```bash
git add features/items/actions.ts
git commit -m "feat: add getItemsForExport server action"
```

### Task 2: Refactor Navbar (Remove Search & Add Breadcrumbs)

**Files:**
- Modify: `components/layout/header.tsx`

**Step 1: Remove Search Input Form & Add Breadcrumbs**
Delete the search form block and update the left section of the navbar to render dynamic breadcrumbs using `usePathname()` and `useSearchParams()`.

**Step 2: Commit**
```bash
git add components/layout/header.tsx
git commit -m "style: remove search bar and add dynamic breadcrumbs to navbar"
```

### Task 3: Restructure Page Header and Action Bar

**Files:**
- Modify: `app/(dashboard)/items/items-explorer-client.tsx`

**Step 1: Import ExcelJS, Download icon, and getItemsForExport**
Ensure `exceljs` is imported. Import `Download` from `lucide-react`. Import `getItemsForExport` from `@/features/items/actions`.

**Step 2: Remove old Breadcrumb/Explorer Path bar and Title block**
Identify and remove the old path bar wrapper (lines 178-237) and the old page title wrapper (lines 242-247).

**Step 3: Implement new 2-Row Header Layout (without duplicate breadcrumbs)**
Insert a new header component at the top of the main container:
- **Row 1**: Dynamic Main Title on the left ("รายการทะเบียนวัสดุ" for `material`, "รายการทะเบียนครุภัณฑ์" for `asset`, etc.). View Mode Toggle on the right.
- **Row 2**: Search box, Category filter dropdown, and Status filter dropdown on the left. Remove the Type filter dropdown completely. Export Button on the right.

**Step 4: Implement Export to Excel Functionality**
Implement `exportToExcel` function within the component:
- Call `getItemsForExport(params)` to fetch all items matching the current filters.
- Generate Excel spreadsheet using `exceljs` and download it to the browser.

**Step 5: Verify Layout and Run Build**
Run `npm run build` or local verification to verify no TypeScript or syntax errors.

**Step 6: Commit**
```bash
git add app/(dashboard)/items/items-explorer-client.tsx
git commit -m "feat: restructure items registry header layout and implement excel export"
```
