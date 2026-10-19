# Streaming & Loading Skeletons Optimization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Eliminate render-blocking waterfalls across dashboard layouts and pages, and implement granular loading skeletons (`loading.tsx`) across all 7 un-skeletoned dashboard routes to enable instant static shell delivery and progressive streaming rendering.

**Architecture:**
1. **Layout Waterfall Elimination:** In `app/(dashboard)/layout.tsx`, parallelize `getCurrentProfile()` and `getDashboardLayoutData()` using `Promise.all` so the layout shell queries start concurrently instead of in a two-roundtrip waterfall.
2. **Page Waterfall Elimination:** In `app/(dashboard)/settings/page.tsx`, `app/(dashboard)/locations/page.tsx`, and `app/(dashboard)/items/[id]/page.tsx`, parallelize independent initial promises (`params`, `searchParams`, `getCurrentProfile()`, data queries) to reduce Time-To-First-Byte (TTFB).
3. **Missing Loading Skeletons:** Create tailored Next.js App Router `loading.tsx` skeletons for 7 routes: `items/[id]`, `items/[id]/edit`, `locations`, `profile`, `admin/audit-logs`, `admin/users`, and `admin/db-panel`. Each skeleton mirrors the exact dimensions of the target page to eliminate Cumulative Layout Shift (CLS).
4. **Automated Verification:** Add integration tests verifying concurrent dispatch and asserting that all 7 new loading components render valid DOM nodes in tests.

**Tech Stack:** Next.js 16 (App Router, Server Components, Streaming), React 19, TypeScript, Tailwind CSS, node:test runner.

## Global Constraints
- Preserve existing RLS, authentication checks, and permissions (`canWrite`, `canDelete`, `canManageSettings`, `requireAdmin`).
- Preserve existing regression contracts (specifically `tests/integration/reports-parallel.test.ts` and `tests/unit/performance.test.ts`).
- All new `loading.tsx` files must be valid React Server Components without runtime client dependencies unless needed.
- All tests must pass cleanly (`npm test`, `npm run typecheck`, `npm run lint`).

---

### Task 1: Eliminate Layout Waterfall in `app/(dashboard)/layout.tsx`

**Files:**
- Modify: `app/(dashboard)/layout.tsx`
- Test: `tests/integration/layout-parallel.test.ts`

**Interfaces:**
- Consumes: `getCurrentProfile()`, `getDashboardLayoutData()`
- Produces: Parallelized execution of layout data and profile retrieval.

- [x] **Step 1: Write integration test for concurrent layout data reads**

Create `tests/integration/layout-parallel.test.ts` verifying that `DashboardLayout` initiates `getCurrentProfile()` and `getDashboardLayoutData()` concurrently without blocking one behind the other.

- [x] **Step 2: Run test to verify failure**

Run: `node --import tsx --test tests/integration/layout-parallel.test.ts`

- [x] **Step 3: Update `app/(dashboard)/layout.tsx` to run reads concurrently**

In `app/(dashboard)/layout.tsx`:
Replace:
```tsx
const profile = await getCurrentProfile()
...
const { sidebarData, references } = await getDashboardLayoutData()
```
With:
```tsx
const [profile, layoutData] = await Promise.all([
  getCurrentProfile(),
  getDashboardLayoutData(),
])

if (!profile) {
  return (
    <ToastProvider>
      <div className="min-h-screen w-screen overflow-y-auto bg-slate-50 text-slate-900">
        {children}
      </div>
    </ToastProvider>
  )
}

if (!profile.is_active) {
  redirect('/login?error=inactive')
}

const { sidebarData, references } = layoutData
```

- [x] **Step 4: Run test to verify it passes**

Run: `node --import tsx --test tests/integration/layout-parallel.test.ts`
Expected: PASS

- [x] **Step 5: Commit**

```bash
git add app/\(dashboard\)/layout.tsx tests/integration/layout-parallel.test.ts
git commit -m "perf(layout): parallelize profile and layout data fetching to eliminate waterfall"
```

---

### Task 2: Parallelize Page-Level Waterfalls in Settings, Locations, and Item Detail

**Files:**
- Modify: `app/(dashboard)/settings/page.tsx`
- Modify: `app/(dashboard)/locations/page.tsx`
- Modify: `app/(dashboard)/items/[id]/page.tsx`
- Test: `tests/integration/page-waterfalls.test.ts`

**Interfaces:**
- Consumes: `getCurrentProfile()`, `searchParams`, `params`, `getLocationsOverview()`, `getItemDetailPageData()`
- Produces: Faster TTFB by initiating independent async promises concurrently.

- [x] **Step 1: Write integration test for page concurrency**

Create `tests/integration/page-waterfalls.test.ts` asserting that:
1. `SettingsPage` starts `getCurrentProfile()` and `searchParams` concurrently.
2. `LocationsPage` starts `getCurrentProfile()` and `getLocationsOverview()` concurrently.
3. `ItemDetailPage` starts `params` and `getCurrentProfile()` concurrently.

- [x] **Step 2: Run test to verify failure**

Run: `node --import tsx --test tests/integration/page-waterfalls.test.ts`

- [x] **Step 3: Update pages to execute independent promises concurrently**

In `app/(dashboard)/settings/page.tsx`:
```tsx
const [currentProfile, params] = await Promise.all([
  getCurrentProfile(),
  searchParams,
])
if (!canManageSettings(currentProfile?.role)) {
  redirect('/dashboard')
}
const { activeTab, data } = await getSettingsPageData(params.tab)
```

In `app/(dashboard)/locations/page.tsx`:
```tsx
const [profile, { locations, items }] = await Promise.all([
  getCurrentProfile(),
  getLocationsOverview(),
])
if (!profile) redirect('/login')
if (!profile.is_active) redirect('/login?error=inactive')
```

In `app/(dashboard)/items/[id]/page.tsx`:
```tsx
const [{ id }, profile] = await Promise.all([
  params,
  getCurrentProfile(),
])
if (!profile) {
  redirect('/login')
}
const { item, auditLogs } = await getItemDetailPageData(id)
```

- [x] **Step 4: Run test to verify it passes**

Run: `node --import tsx --test tests/integration/page-waterfalls.test.ts`
Expected: PASS

- [x] **Step 5: Commit**

```bash
git add app/\(dashboard\)/settings/page.tsx app/\(dashboard\)/locations/page.tsx app/\(dashboard\)/items/\[id\]/page.tsx tests/integration/page-waterfalls.test.ts
git commit -m "perf(pages): eliminate sequential await waterfalls in settings, locations, and item detail"
```

---

### Task 3: Implement Missing Loading Skeletons for 7 Dashboard Routes

**Files:**
- Create: `app/(dashboard)/items/[id]/loading.tsx`
- Create: `app/(dashboard)/items/[id]/edit/loading.tsx`
- Create: `app/(dashboard)/locations/loading.tsx`
- Create: `app/(dashboard)/profile/loading.tsx`
- Create: `app/(dashboard)/admin/audit-logs/loading.tsx`
- Create: `app/(dashboard)/admin/users/loading.tsx`
- Create: `app/(dashboard)/admin/db-panel/loading.tsx`
- Test: `tests/integration/loading-skeletons.test.ts`

**Interfaces:**
- Each loading file exports `default function Loading(): JSX.Element`
- Matches real page structures with Tailwind `animate-pulse` placeholders to avoid layout shift.

- [x] **Step 1: Write integration tests for all 7 loading components**

Create `tests/integration/loading-skeletons.test.ts` importing each of the 7 loading components and asserting:
1. They render without throwing.
2. They render skeleton elements with appropriate aria-hidden or pulse classes.

- [x] **Step 2: Run test to verify failure (modules don't exist yet)**

Run: `node --import tsx --test tests/integration/loading-skeletons.test.ts`

- [x] **Step 3: Create the 7 loading skeleton components**

1. `app/(dashboard)/items/[id]/loading.tsx`: Back button, title skeleton, 2-column info grid, depreciation box, timeline skeleton.
2. `app/(dashboard)/items/[id]/edit/loading.tsx`: Back button, title skeleton, form fields grid skeleton, submit button placeholder.
3. `app/(dashboard)/locations/loading.tsx`: Header skeleton, location filter tabs, location card grid placeholders.
4. `app/(dashboard)/profile/loading.tsx`: Profile header skeleton, user details card skeleton, security settings skeleton.
5. `app/(dashboard)/admin/audit-logs/loading.tsx`: Header skeleton, filter bar skeleton, 10-row data table skeleton.
6. `app/(dashboard)/admin/users/loading.tsx`: Header skeleton, search bar, users table skeleton with avatar and role placeholders.
7. `app/(dashboard)/admin/db-panel/loading.tsx`: Header skeleton, database health metrics cards skeleton, maintenance tools grid.

- [x] **Step 4: Run test to verify it passes**

Run: `node --import tsx --test tests/integration/loading-skeletons.test.ts`
Expected: PASS

- [x] **Step 5: Commit**

```bash
git add app/\(dashboard\)/items/\[id\]/loading.tsx app/\(dashboard\)/items/\[id\]/edit/loading.tsx app/\(dashboard\)/locations/loading.tsx app/\(dashboard\)/profile/loading.tsx app/\(dashboard\)/admin/audit-logs/loading.tsx app/\(dashboard\)/admin/users/loading.tsx app/\(dashboard\)/admin/db-panel/loading.tsx tests/integration/loading-skeletons.test.ts
git commit -m "feat(ui): add tailored loading skeletons for all un-skeletoned dashboard routes"
```

---

### Task 4: Full Quality Gate Verification

**Files:**
- Verify entire repository test suites and linting.

- [x] **Step 1: Run typecheck**
Run: `npm run typecheck`
Expected: 0 errors

- [x] **Step 2: Run all unit and integration tests**
Run: `npm test`
Expected: All tests pass

- [x] **Step 3: Run lint**
Run: `npm run lint`
Expected: 0 errors

- [x] **Step 4: Final verification and summary**
Confirm all git diffs are clean, focused, and well-committed.
