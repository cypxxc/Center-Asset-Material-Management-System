# CAMMS Dashboard Impeccable UI/UX Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the CAMMS Dashboard (`/dashboard`) into an impeccable Executive & Operational Command Center featuring a 4-card Bento metrics grid, unified operational action queue, interactive analytics with deep-linking, resilient realtime refresh storm protection, and strict zero-raw-row database aggregations.

**Architecture:** Utilize Next.js 16 App Router Server Components streaming via Suspense boundaries. Aggregations happen entirely at the database layer (`get_report_stats` RPC / SQL) cached with `unstable_cache`. Client components handle interactivity (live pulse badge, hover-active SVG donut chart, tab switching in the action queue) while maintaining zero layout shift (CLS = 0).

**Tech Stack:** Next.js 16.3.8, React 19, Tailwind CSS v4, Lucide Icons, Capriola (`tabular-nums`) & Sarabun typography, Supabase / Drizzle PostgreSQL.

**Spec:** [`docs/superpowers/specs/2026-10-19-dashboard-redesign-design.md`](file:///D:/Center-Asset-Material-Management-System-main/docs/superpowers/specs/2026-10-19-dashboard-redesign-design.md)

## Global Constraints

- Thai-first UI with Sarabun for Thai body/headings and Capriola (`tabular-nums tracking-tight`) for English identifiers, counts, and currency.
- Strict "No Color-Only Labels": all status badges and indicators must display an icon + label + semantic color.
- Strict "Zero Raw Row Streaming": Never pull all item records into Node.js memory to loop/sum; all aggregations must be computed at the database level.
- Realtime storm mitigation: Dashboard debounce must be 800-1000ms, maxWait 2500-3000ms, and scoped only to `['items', 'categories']`.
- Light/Dark mode elevation using semantic tokens (`bg-background: #f8fafc` / `#090d16`, `bg-card: #ffffff` / `#131b2e`).
- Preserve RBAC boundaries: New item action button visible only when user has write permissions (`canWrite(profile?.role)`).

## Review Focus

1. **Realtime burst / Excel bulk import:** Rapid `postgres_changes` must not trigger multiple concurrent page refreshes; adaptive debouncing must coalesce them into a single refresh.
2. **Zero inventory / empty state:** When database has 0 items or 0 damaged items, components must render elegant empty states without division-by-zero (`NaN%`) errors.
3. **Tab visibility change:** When user switches tabs away from CAMMS, realtime refresh must pause and not hammer the server; upon return, it syncs at most once.
4. **Interactive drill-down links:** Clicking donut slices, status legends, or category rows must navigate to `/items` with the exact query parameter (`?status=...` or `?category_id=...`).
5. **Dark mode contrast:** All text on colored badges (rose, emerald, amber, blue) must maintain $\ge$ 4.5:1 contrast against their card surface in both light and dark themes.

---

### Task 1: Realtime Storm Hardening & Urgent Damaged Items Query

**Files:**
- Modify: `hooks/use-realtime-refresh.ts`
- Modify: `components/dashboard/dashboard-realtime-boundary.tsx`
- Modify: `features/items/queries.ts`
- Modify: `features/items/postgres-queries.ts`
- Test: `tests/component/dashboard-realtime-boundary.test.tsx`
- Test: `tests/integration/damaged-items-query.test.ts`

**Interfaces:**
- Consumes: `useRealtimeRefresh(tables, options)`
- Produces: `getUrgentDamagedItems(limit: number): Promise<DamagedItemSummary[]>`

- [ ] **Step 1: Write test for `useRealtimeRefresh` options (debounce delay, maxWait, visibilitychange)**

```tsx
// tests/component/dashboard-realtime-boundary.test.tsx
import { render } from '@testing-library/react'
import { DashboardRealtimeBoundary } from '@/components/dashboard/dashboard-realtime-boundary'

test('subscribes only to items and categories on dashboard with relaxed debounce', () => {
  // Verifies tables prop passed is ['items', 'categories']
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx --test tests/component/dashboard-realtime-boundary.test.tsx`  
Expected: FAIL

- [ ] **Step 3: Update `hooks/use-realtime-refresh.ts` and `dashboard-realtime-boundary.tsx`**

Enhance `useRealtimeRefresh` to accept optional configuration: `{ debounceDelay?: number; maxWait?: number; pauseOnHidden?: boolean }`.  
Add `visibilitychange` listener when `pauseOnHidden: true` so updates pause when `document.hidden = true`.  
In `DashboardRealtimeBoundary`, pass `tables={['items', 'categories']}` with `debounceDelay: 1000` and `maxWait: 2500`.

- [ ] **Step 4: Implement `getUrgentDamagedItems(limit = 5)` in `features/items/queries.ts`**

Query `items` where `status IN ('damaged', 'waiting_repair')` order by `updated_at DESC` limit 5, returning id, item_name, asset_no, locationName, status, updated_at, image_url.

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx tsx --test tests/component/dashboard-realtime-boundary.test.tsx`  
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add hooks/use-realtime-refresh.ts components/dashboard/dashboard-realtime-boundary.tsx features/items/queries.ts features/items/postgres-queries.ts tests/component/dashboard-realtime-boundary.test.tsx
git commit -m "feat(dashboard): harden realtime refresh throttling and add urgent damaged items query"
```

---

### Task 2: Bento Metrics Grid & Live Pulse Header

**Files:**
- Modify: `app/(dashboard)/dashboard/page.tsx:35-50`
- Modify: `components/dashboard/dashboard-metrics-grid.tsx`
- Test: `tests/component/dashboard-metrics-grid.test.tsx`

**Interfaces:**
- Consumes: `getReportStats()` from `@/features/reports/queries`
- Produces: `DashboardMetricsGrid` rendering 4 Bento Cards (Valuation, Composition, Readiness, Urgent)

- [ ] **Step 1: Write test for `DashboardMetricsGrid` rendering 4 Bento cards**

```tsx
// tests/component/dashboard-metrics-grid.test.tsx
import { render, screen } from '@testing-library/react'
import { DashboardMetricsGrid } from '@/components/dashboard/dashboard-metrics-grid'

test('renders all 4 bento cards: valuation, composition, readiness, urgent', async () => {
  // Test mock stats render with tabular-nums and proper labels
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx --test tests/component/dashboard-metrics-grid.test.tsx`  
Expected: FAIL

- [ ] **Step 3: Redesign `components/dashboard/dashboard-metrics-grid.tsx`**

Implement 4 Bento cards:
1. **Valuation Card:** `totalValue` with `tabular-nums tracking-tight`, Net Book Value projection, and accumulated depreciation progress bar.
2. **Composition Card:** Total count, segmented dual-bar for Assets vs Materials, detailed counts.
3. **Readiness Card:** `readinessPercentage` with `CheckCircle2` icon and breakdown.
4. **Urgent Card:** `damagedCount + lowStockCount` with `AlertTriangle` icon in `text-rose-600 dark:text-rose-400` and quick link to `#action-queue`.

- [ ] **Step 4: Update `app/(dashboard)/dashboard/page.tsx` with Live Pulse Badge**

Add soft-pulse badge `[🟢 ซิงค์ข้อมูลสด]` next to header title.

- [ ] **Step 5: Run test to verify it passes**

Run: `npx tsx --test tests/component/dashboard-metrics-grid.test.tsx`  
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add app/\(dashboard\)/dashboard/page.tsx components/dashboard/dashboard-metrics-grid.tsx tests/component/dashboard-metrics-grid.test.tsx
git commit -m "feat(dashboard): redesign bento metrics grid with valuation, composition, readiness, and urgent cards"
```

---

### Task 3: Unified Operational Action Queue Component

**Files:**
- Create: `components/dashboard/dashboard-action-queue.tsx`
- Test: `tests/component/dashboard-action-queue.test.tsx`

**Interfaces:**
- Consumes: `getUrgentDamagedItems(5)` and `getLowStockItems(5)`
- Produces: `DashboardActionQueue` and `ActionQueueSkeleton`

- [ ] **Step 1: Write test for `DashboardActionQueue` tab switching and empty states**

```tsx
// tests/component/dashboard-action-queue.test.tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { DashboardActionQueue } from '@/components/dashboard/dashboard-action-queue'

test('switches between damaged queue and low stock monitor tabs', () => {
  // Verifies tab selection, item rendering, and quick action links
})

test('renders empty state when no urgent items exist', () => {
  // Verifies check circle empty state
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx --test tests/component/dashboard-action-queue.test.tsx`  
Expected: FAIL

- [ ] **Step 3: Implement `components/dashboard/dashboard-action-queue.tsx`**

Build client-tabbed operational queue:
- Tab 1: **พัสดุชำรุดรอส่งซ่อม (`damaged`)**: Thumbnail (40x40px), Asset Number (copyable), Location, date, and `[ดูข้อมูล]` button.
- Tab 2: **วัสดุใกล้หมดคลัง (`low-stock`)**: Item name, quantity gauge vs threshold, and `[จัดการ]` button.
- Zero state: Emerald `CheckCircle2` with "ไม่มีพัสดุชำรุดหรือวัสดุค้างในขณะนี้ ระบบทำงานได้เต็มประสิทธิภาพ".
- Export matching `ActionQueueSkeleton` with exact dimensions for zero CLS.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx --test tests/component/dashboard-action-queue.test.tsx`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add components/dashboard/dashboard-action-queue.tsx tests/component/dashboard-action-queue.test.tsx
git commit -m "feat(dashboard): create unified operational action queue component with damaged and low-stock tabs"
```

---

### Task 4: Interactive Status Donut & Category Distribution Enhancements

**Files:**
- Modify: `components/dashboard/status-donut-chart.tsx`
- Modify: `components/dashboard/dashboard-category-list.tsx`
- Test: `tests/component/status-donut-chart.test.tsx`

**Interfaces:**
- Consumes: `StatusItemData[]`, `stats.categoryCounts`
- Produces: Enhanced `StatusDonutChart` with center hover readout + deep-links to `/items?status=...`

- [ ] **Step 1: Write test for `StatusDonutChart` hover readout and deep-links**

```tsx
// tests/component/status-donut-chart.test.tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { StatusDonutChart } from '@/components/dashboard/status-donut-chart'

test('updates center label on hover and contains deep-link anchors', () => {
  // Verifies center stat display and link hrefs
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx --test tests/component/status-donut-chart.test.tsx`  
Expected: FAIL

- [ ] **Step 3: Enhance `components/dashboard/status-donut-chart.tsx`**

- Add Center Text inside the SVG circle showing hovered/active status name, quantity, and percentage.
- Wrap legend items with Next.js `Link` pointing to `/items?status=${item.key}`.

- [ ] **Step 4: Enhance `components/dashboard/dashboard-category-list.tsx`**

- Support category custom color indicators (`category.color`).
- Add hover `ChevronRight` action link to `/items?category_id=${id}` on each category row.

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx tsx --test tests/component/status-donut-chart.test.tsx`  
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add components/dashboard/status-donut-chart.tsx components/dashboard/dashboard-category-list.tsx tests/component/status-donut-chart.test.tsx
git commit -m "feat(dashboard): add interactive center readout and deep-links to status donut and category list"
```

---

### Task 5: Dashboard Page Layout Integration & Quality Verification

**Files:**
- Modify: `app/(dashboard)/dashboard/page.tsx`
- Test: Full quality gate suite (`npm run typecheck`, relevant component tests)

**Interfaces:**
- Assembles all redesigned components into the 60/40 responsive desktop grid with isolated Suspense boundaries.

- [ ] **Step 1: Integrate `DashboardActionQueue` into `app/(dashboard)/dashboard/page.tsx`**

Replace `DashboardLowStockPanel` with `DashboardActionQueue`.  
Adjust the grid container to `grid-cols-1 lg:grid-cols-12 gap-6`:
- Left column (Action Queue): `lg:col-span-7`
- Right column (Analytics & Distribution): `lg:col-span-5`

- [ ] **Step 2: Run typecheck**

Run: `npm run typecheck`  
Expected: No type errors across the project.

- [ ] **Step 3: Run full test suite for dashboard components**

Run: `npm test`  
Expected: PASS for all tests.

- [ ] **Step 4: Verify responsive layout and theme contrast**

Verify Light and Dark mode semantic tokens, responsive stacking at `< 640px` and `< 1024px`, and zero CLS.

- [ ] **Step 5: Commit**

```bash
git add app/\(dashboard\)/dashboard/page.tsx
git commit -m "feat(dashboard): assemble impeccable command center layout and pass all quality gates"
```
