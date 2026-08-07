# Full-Spectrum System Optimization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Optimize CAMMS across Database Queries, Frontend Bundle Sizes, Server Auth Caching, and Perceived UI Interactions to achieve < 200ms warm page render latency and > 30% reduction in initial JS bundle size.

**Architecture:** Implement Database Performance Indexes (`00003_performance_indexes.sql`), trim Supabase query column projections, wrap profile queries in React `cache()`, introduce `next/dynamic` lazy loading for heavy client components (`AssetTagModal`, `StatusDonutChart`), add 250ms search debounce, and create route-level animated skeleton loaders.

**Tech Stack:** Next.js 16 (App Router), React 19 (`cache`, `useTransition`, `dynamic`), Supabase Postgres, Tailwind v4, Node test runner (`tsx --test`).

## Global Constraints

- **Next.js 16 & React 19:** Use Docs in `node_modules/next/dist/docs/`. Middleware is exported from `proxy.ts`.
- **Database:** Supabase Postgres. Schema migrations reside in `db/migrations/NNNNN_snake_case.sql`.
- **Testing:** Unit tests run via `npm test` (`tsx --test`). All tests must pass cleanly.
- **Paths:** Cross-module imports use `@/` alias (e.g., `@/lib/supabase/server`).

---

### Task 1: Database Performance Indexes Migration

**Files:**
- Create: `db/migrations/00003_performance_indexes.sql`
- Test: `tests/unit/database-indexes.test.ts`

**Interfaces:**
- Consumes: Existing table schemas (`items`, `categories`, `locations`) from `00001_initial_schema.sql`
- Produces: Composite index `idx_items_active_type_status`, foreign key indexes `idx_items_category_id`, `idx_items_location_id`, and case-insensitive search index `idx_items_name_lower`.

- [ ] **Step 1: Write the failing unit test**

```typescript
// tests/unit/database-indexes.test.ts
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

test('00003_performance_indexes.sql contains required composite and foreign key indexes', () => {
  const migrationPath = path.join(process.cwd(), 'db/migrations/00003_performance_indexes.sql')
  assert.ok(fs.existsSync(migrationPath), 'Migration file 00003_performance_indexes.sql must exist')

  const sqlContent = fs.readFileSync(migrationPath, 'utf8')
  assert.ok(sqlContent.includes('idx_items_active_type_status'), 'Missing idx_items_active_type_status index')
  assert.ok(sqlContent.includes('idx_items_category_id'), 'Missing idx_items_category_id index')
  assert.ok(sqlContent.includes('idx_items_location_id'), 'Missing idx_items_location_id index')
  assert.ok(sqlContent.includes('idx_items_name_lower'), 'Missing idx_items_name_lower index')
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/unit/database-indexes.test.ts`  
Expected: FAIL (Migration file does not exist yet)

- [ ] **Step 3: Create migration file**

```sql
-- db/migrations/00003_performance_indexes.sql
-- Composite Index for Dashboard and List Filtering
CREATE INDEX IF NOT EXISTS idx_items_active_type_status 
ON items (deleted_at, item_type, status) 
WHERE deleted_at IS NULL;

-- Foreign Key Indexes for Fast Relational Joins
CREATE INDEX IF NOT EXISTS idx_items_category_id ON items (category_id);
CREATE INDEX IF NOT EXISTS idx_items_location_id ON items (location_id);

-- Case-Insensitive Item Name Search Index
CREATE INDEX IF NOT EXISTS idx_items_name_lower ON items (lower(item_name));
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/unit/database-indexes.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add db/migrations/00003_performance_indexes.sql tests/unit/database-indexes.test.ts
git commit -m "perf(db): add performance database indexes for items filtering, joins, and search"
```

---

### Task 2: Query Projection Trimming & Profile Single-Flight Caching

**Files:**
- Modify: `features/items/queries.ts`
- Modify: `features/auth/queries.ts`
- Test: `tests/unit/queries-optimization.test.ts`

**Interfaces:**
- Consumes: `createClient()` from `@/lib/supabase/server`
- Produces: `getCurrentProfile()` wrapped with React `cache()` and `getItems()` returning explicit column projections.

- [ ] **Step 1: Write the failing unit test**

```typescript
// tests/unit/queries-optimization.test.ts
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

test('queries.ts imports React cache and uses explicit select projections', () => {
  const itemsQueriesPath = path.join(process.cwd(), 'features/items/queries.ts')
  const authQueriesPath = path.join(process.cwd(), 'features/auth/queries.ts')

  const itemsContent = fs.readFileSync(itemsQueriesPath, 'utf8')
  const authContent = fs.readFileSync(authQueriesPath, 'utf8')

  assert.ok(authContent.includes("cache("), 'auth/queries.ts must wrap profile query in React cache()')
  assert.ok(!itemsContent.includes(".select('*')"), 'items/queries.ts should avoid wildcard select(*) in main getItems query')
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/unit/queries-optimization.test.ts`  
Expected: FAIL

- [ ] **Step 3: Refactor `features/auth/queries.ts` and `features/items/queries.ts`**

In `features/auth/queries.ts`:
Wrap `getCurrentProfile` with React `cache()`:
```typescript
import { cache } from 'react'

export const getCurrentProfile = cache(async () => {
  // Existing profile fetching logic
})
```

In `features/items/queries.ts`:
Replace wildcard `.select('*')` with explicit column list:
`.select('id, item_name, serial_no, asset_no, quantity, status, item_type, category_id, location_id, image_url, created_at, updated_at')`

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/unit/queries-optimization.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add features/auth/queries.ts features/items/queries.ts tests/unit/queries-optimization.test.ts
git commit -m "perf(queries): wrap getCurrentProfile in React cache and trim item query select projections"
```

---

### Task 3: Dynamic Component Code-Splitting for Heavy Client UI

**Files:**
- Modify: `app/(dashboard)/dashboard/page.tsx`
- Modify: `features/items/components/item-list-client.tsx`
- Test: `tests/unit/dynamic-imports.test.ts`

**Interfaces:**
- Consumes: `next/dynamic` from Next.js
- Produces: Lazy-loaded `StatusDonutChart` and `AssetTagModal` components with loading fallbacks.

- [ ] **Step 1: Write the failing unit test**

```typescript
// tests/unit/dynamic-imports.test.ts
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

test('dashboard and item-list-client use next/dynamic for heavy components', () => {
  const dashboardPath = path.join(process.cwd(), 'app/(dashboard)/dashboard/page.tsx')
  const itemListClientPath = path.join(process.cwd(), 'features/items/components/item-list-client.tsx')

  const dashboardContent = fs.readFileSync(dashboardPath, 'utf8')
  const itemListContent = fs.readFileSync(itemListClientPath, 'utf8')

  assert.ok(dashboardContent.includes("dynamic("), 'Dashboard page must use next/dynamic for chart')
  assert.ok(itemListContent.includes("dynamic("), 'Item list client must use next/dynamic for AssetTagModal')
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/unit/dynamic-imports.test.ts`  
Expected: FAIL

- [ ] **Step 3: Implement dynamic imports in `dashboard/page.tsx` and `item-list-client.tsx`**

In `app/(dashboard)/dashboard/page.tsx`:
```typescript
import dynamic from 'next/dynamic'

const StatusDonutChart = dynamic(
  () => import('@/components/dashboard/status-donut-chart').then(mod => mod.StatusDonutChart),
  { ssr: false, loading: () => <div className="h-64 animate-pulse bg-muted rounded-xl" /> }
)
```

In `features/items/components/item-list-client.tsx`:
```typescript
import dynamic from 'next/dynamic'

const AssetTagModal = dynamic(
  () => import('@/components/ui/asset-tag-modal').then(mod => mod.AssetTagModal),
  { ssr: false }
)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/unit/dynamic-imports.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/\(dashboard\)/dashboard/page.tsx features/items/components/item-list-client.tsx tests/unit/dynamic-imports.test.ts
git commit -m "perf(ui): lazy load StatusDonutChart and AssetTagModal with next/dynamic code splitting"
```

---

### Task 4: Search Input Debounce & Route Skeleton Loaders

**Files:**
- Create: `app/(dashboard)/dashboard/loading.tsx`
- Create: `app/(dashboard)/items/loading.tsx`
- Modify: `features/items/components/item-list-client.tsx`
- Test: `tests/unit/skeleton-loading.test.ts`

**Interfaces:**
- Consumes: Tailwind `animate-pulse` utilities
- Produces: Instant skeleton fallback components for `/dashboard` and `/items` routes.

- [ ] **Step 1: Write the failing unit test**

```typescript
// tests/unit/skeleton-loading.test.ts
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

test('loading.tsx skeleton files exist for dashboard and items routes', () => {
  const dashboardLoading = path.join(process.cwd(), 'app/(dashboard)/dashboard/loading.tsx')
  const itemsLoading = path.join(process.cwd(), 'app/(dashboard)/items/loading.tsx')

  assert.ok(fs.existsSync(dashboardLoading), 'Dashboard loading.tsx skeleton must exist')
  assert.ok(fs.existsSync(itemsLoading), 'Items loading.tsx skeleton must exist')
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/unit/skeleton-loading.test.ts`  
Expected: FAIL

- [ ] **Step 3: Create loading skeleton components**

Create `app/(dashboard)/dashboard/loading.tsx`:
```tsx
import { PageContainer } from '@/components/ui/page-container'

export default function DashboardLoading() {
  return (
    <PageContainer title="แดชบอร์ด" description="กำลังโหลดข้อมูลสรุประบบทะเบียนสิ่งของ...">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="h-28 rounded-xl bg-muted/60 animate-pulse" />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 h-80 rounded-xl bg-muted/60 animate-pulse" />
        <div className="h-80 rounded-xl bg-muted/60 animate-pulse" />
      </div>
    </PageContainer>
  )
}
```

Create `app/(dashboard)/items/loading.tsx`:
```tsx
import { PageContainer } from '@/components/ui/page-container'

export default function ItemsLoading() {
  return (
    <PageContainer title="ทะเบียนสิ่งของ" description="กำลังโหลดรายการสิ่งของสำนักงาน...">
      <div className="h-12 w-full max-w-md rounded-lg bg-muted/60 animate-pulse mb-6" />
      <div className="rounded-xl border bg-card p-4 space-y-4">
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} className="h-16 w-full rounded-lg bg-muted/40 animate-pulse" />
        ))}
      </div>
    </PageContainer>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/unit/skeleton-loading.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/\(dashboard\)/dashboard/loading.tsx app/\(dashboard\)/items/loading.tsx tests/unit/skeleton-loading.test.ts
git commit -m "feat(ux): add route-level animated skeleton loading states for dashboard and items"
```

---

### Task 5: Final End-to-End Build & Latency Verification

**Files:**
- Test: Full build and test suite execution

**Interfaces:**
- Consumes: Complete project codebase
- Produces: Verified production build artifact and passing 270+ test suite.

- [ ] **Step 1: Run full unit test suite**

Run: `npm test`  
Expected: PASS (All test suites pass cleanly)

- [ ] **Step 2: Run production build check**

Run: `npm run build`  
Expected: PASS (Build completes with 0 errors and reduced bundle sizes)

- [ ] **Step 3: Commit final plan verification log**

```bash
git add .
git commit -m "chore(perf): complete full-spectrum optimization verification"
```
