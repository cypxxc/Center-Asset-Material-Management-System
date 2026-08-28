# Release Gate Remediation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every local release gate pass without raising the approved Dashboard JavaScript budgets.

**Architecture:** Remove the retired Header guide feature and make the audit integration contract accurately represent the depreciation-enabled item payload. Keep Dashboard data rendering on the server, but load the realtime subscriber through a small client-only boundary so the Supabase realtime dependency is absent from the initial Dashboard client entries.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript strict mode, Supabase SSR/realtime, Node test runner, ESLint.

**Spec:** `docs/superpowers/specs/2026-08-28-release-gate-remediation-design.md`

## Global Constraints

- Preserve the 160 KB raw and 50 KB gzip Dashboard route budgets.
- Do not change database schema, migrations, RLS, roles, or item CRUD behavior.
- Keep Dashboard stat cards, category content, low-stock content, and their server-side Suspense rendering unchanged.
- Realtime failures must not prevent the Dashboard from rendering.
- Use `@/` aliases for cross-module imports and preserve Thai-first product copy.

---

## File Structure

- Delete `components/layout/header-guide-dialog.tsx`: retired guide UI with no remaining supported entry point.
- Create `components/dashboard/dashboard-realtime-boundary.tsx`: client-only loader that defers the realtime bridge after initial Dashboard render.
- Modify `app/(dashboard)/dashboard/page.tsx`: replace the direct realtime bridge import with the deferred boundary.
- Modify `hooks/use-realtime-refresh.ts`: request one refresh immediately after the deferred subscription effect activates, while keeping existing debounce and cleanup behavior.
- Modify `tests/integration/create-item.test.ts`: include depreciation defaults in the shared creation-audit contract.
- Modify `tests/unit/bundle-budget.test.ts`: remove the retired-guide assertion and assert that Header no longer references the guide.

## Task 1: Align Item-Creation Audit Contract

**Files:**

- Modify: `tests/integration/create-item.test.ts:167-205`
- Test: `tests/integration/create-item.test.ts`

**Interfaces:**

- Consumes: audit `new_data.values` emitted by `createItem` and `createItemInline`.
- Produces: a shared expected payload that includes all persisted depreciation properties.

- [ ] **Step 1: Extend the shared expected audit values with the depreciation defaults**

Add these properties immediately after `image_url` in `expectedParsedValues`:

```ts
  depreciation_enabled: false,
  depreciation_cost: null,
  depreciation_useful_life_years: null,
  depreciation_start_basis: null,
  depreciation_start_date: null,
```

- [ ] **Step 2: Run the focused integration test**

Run:

```powershell
node --import tsx --test tests/integration/create-item.test.ts
```

Expected: all creation-audit assertions pass, including `createItem inserts attribution...` and `each action independently creates...`.

- [ ] **Step 3: Commit the independently passing contract repair**

```powershell
git add tests/integration/create-item.test.ts
git commit -m "test: cover depreciation defaults in creation audit"
```

## Task 2: Remove the Retired Header Guide Contract

**Files:**

- Delete: `components/layout/header-guide-dialog.tsx`
- Modify: `tests/unit/bundle-budget.test.ts:29-33`
- Test: `tests/unit/bundle-budget.test.ts`

**Interfaces:**

- Consumes: `components/layout/header.tsx` as the Header source boundary.
- Produces: a regression contract proving the retired guide is no longer referenced by Header.

- [ ] **Step 1: Replace the obsolete guide expectation with an absence assertion**

Replace the second test with:

```ts
test('header has no reference to the retired user guide', () => {
  const headerSource = readFileSync('components/layout/header.tsx', 'utf8')
  assert.doesNotMatch(headerSource, /header-guide-dialog|HeaderGuideDialog|CAMMS User Guide/)
})
```

- [ ] **Step 2: Delete the unreachable guide component**

Remove `components/layout/header-guide-dialog.tsx`. Do not alter Header because it already has no import, state, trigger, or rendered guide component.

- [ ] **Step 3: Run the focused guide regression test before a production build exists**

Run:

```powershell
node --import tsx --test --test-name-pattern "retired user guide" tests/unit/bundle-budget.test.ts
```

Expected: the Header regression test passes; the budget test is skipped when `.next/static` is absent or is evaluated only after Task 4 builds.

- [ ] **Step 4: Commit the retired feature cleanup**

```powershell
git add tests/unit/bundle-budget.test.ts
git rm components/layout/header-guide-dialog.tsx
git commit -m "chore: remove retired header guide"
```

## Task 3: Defer Dashboard Realtime Subscription

**Files:**

- Create: `components/dashboard/dashboard-realtime-boundary.tsx`
- Modify: `app/(dashboard)/dashboard/page.tsx:1-36`
- Modify: `hooks/use-realtime-refresh.ts:8-37`
- Test: `tests/unit/dashboard-performance.test.ts` (create if no existing focused dashboard performance test covers this boundary)

**Interfaces:**

- Consumes: `RealtimeRefreshBridge` from `@/components/realtime-refresh-bridge` and `router.refresh()` from `next/navigation`.
- Produces: `DashboardRealtimeBoundary({ tables }: { tables: RealtimeTable[] }): JSX.Element`, rendered by the server Dashboard page without importing the realtime bridge into the initial client entry.
- Produces: `useRealtimeRefresh(tables, enabled)` that triggers one `router.refresh()` after its effect starts, then retains the 150 ms debounced refresh behavior for database events.

- [ ] **Step 1: Write the static boundary regression test**

Create or add a test that reads the two source files and validates this contract:

```ts
const pageSource = readFileSync('app/(dashboard)/dashboard/page.tsx', 'utf8')
const boundarySource = readFileSync('components/dashboard/dashboard-realtime-boundary.tsx', 'utf8')

assert.match(pageSource, /import \{ DashboardRealtimeBoundary \} from '@\/components\/dashboard\/dashboard-realtime-boundary'/)
assert.doesNotMatch(pageSource, /import \{ RealtimeRefreshBridge \} from '@\/components\/realtime-refresh-bridge'/)
assert.match(boundarySource, /dynamic\(\s*\(\) => import\('@\/components\/realtime-refresh-bridge'\)/)
assert.match(boundarySource, /ssr:\s*false/)
```

- [ ] **Step 2: Run the new regression test and confirm it fails**

Run:

```powershell
node --import tsx --test tests/unit/dashboard-performance.test.ts
```

Expected: FAIL because the boundary does not exist and the page still imports `RealtimeRefreshBridge` directly.

- [ ] **Step 3: Add the client-only dynamic boundary**

Create `components/dashboard/dashboard-realtime-boundary.tsx`:

```tsx
'use client'

import dynamic from 'next/dynamic'
import type { ComponentProps } from 'react'
import type { RealtimeRefreshBridge } from '@/components/realtime-refresh-bridge'

const DeferredRealtimeRefreshBridge = dynamic(
  () => import('@/components/realtime-refresh-bridge').then((module) => module.RealtimeRefreshBridge),
  { ssr: false },
)

type RealtimeTables = ComponentProps<typeof RealtimeRefreshBridge>['tables']

export function DashboardRealtimeBoundary({ tables }: { tables: RealtimeTables }) {
  return <DeferredRealtimeRefreshBridge tables={tables} />
}
```

The `ssr: false` option belongs in this client component; do not use it in the server `page.tsx`.

- [ ] **Step 4: Switch the server Dashboard page to the boundary**

In `app/(dashboard)/dashboard/page.tsx`, replace:

```ts
import { RealtimeRefreshBridge } from '@/components/realtime-refresh-bridge'
```

with:

```ts
import { DashboardRealtimeBoundary } from '@/components/dashboard/dashboard-realtime-boundary'
```

and replace the rendered bridge with:

```tsx
<DashboardRealtimeBoundary tables={['items', 'categories', 'locations', 'units']} />
```

- [ ] **Step 5: Refresh once when the deferred subscription starts**

Inside the existing `useEffect` in `hooks/use-realtime-refresh.ts`, call `router.refresh()` after the environment-variable guard and before `createClient()`:

```ts
    router.refresh()
    const supabase = createClient()
```

Keep the existing 150 ms event debounce, one channel per table list, and cleanup callback unchanged. This refresh reconciles SSR data after the delayed client boundary mounts.

- [ ] **Step 6: Run focused performance and hook tests**

Run:

```powershell
node --import tsx --test tests/unit/dashboard-performance.test.ts
```

Expected: the source-boundary assertions pass. If a hook-specific test exists, run it in the same command and verify it still covers channel cleanup and the 150 ms debounce.

- [ ] **Step 7: Commit the deferred subscription boundary**

```powershell
git add app/(dashboard)/dashboard/page.tsx components/dashboard/dashboard-realtime-boundary.tsx hooks/use-realtime-refresh.ts tests/unit/dashboard-performance.test.ts
git commit -m "perf: defer dashboard realtime subscription"
```

## Task 4: Verify the Actual Production Bundle and Release Gates

**Files:**

- Modify only if a manifest-led analysis identifies another nonessential Dashboard client dependency; otherwise no source change.
- Test: `tests/unit/bundle-budget.test.ts`, release commands in `package.json`.

**Interfaces:**

- Consumes: `.next/server/app/(dashboard)/dashboard/page_client-reference-manifest.js` and `scripts/bundle-budget.ts`.
- Produces: a production build whose `analyzeBundle` result has no Dashboard route budget violations.

- [ ] **Step 1: Build the optimized production bundle**

Run:

```powershell
npm run build
```

Expected: compilation and TypeScript pass; `Dashboard route JS` is at or below `160.00 KB` raw and `50.00 KB` gzip; the budget script prints `Performance budget check passed`.

- [ ] **Step 2: If a budget still fails, inspect the Dashboard entry files by byte size**

Run:

```powershell
npx tsx -e "import { analyzeBundle } from './scripts/bundle-budget'; const r=analyzeBundle('.next',{shared_runtime_raw_max:Infinity,shared_runtime_gzip_max:Infinity,dashboard_route_raw_max:Infinity,dashboard_route_gzip_max:Infinity}); console.log(r.dashboardEntryFiles)"
```

Map each listed file to the Dashboard client-reference manifest, choose the largest dependency not needed for first render, and create a separate client-only dynamic boundary for that exact dependency. Do not adjust `DEFAULT_BUDGETS`.

- [ ] **Step 3: Run the complete non-browser release checks**

Run:

```powershell
npm test
npm run lint
npm run build
```

Expected: all commands return exit code `0`.

- [ ] **Step 4: Run the browser smoke gate**

Run:

```powershell
npm run test:smoke
```

Expected: Playwright smoke tests pass against the production build.

- [ ] **Step 5: Commit all verified remediation code**

```powershell
git add app/(dashboard)/dashboard/page.tsx components/dashboard/dashboard-realtime-boundary.tsx hooks/use-realtime-refresh.ts tests/integration/create-item.test.ts tests/unit/bundle-budget.test.ts tests/unit/dashboard-performance.test.ts
git add -u components/layout/header-guide-dialog.tsx
git commit -m "fix: clear dashboard release gates"
```

## Plan Self-Review

- Spec coverage: Task 1 implements the audit contract; Task 2 removes the obsolete feature; Task 3 preserves realtime refresh while deferring client code; Task 4 verifies unchanged budgets and the complete release pipeline.
- Placeholder scan: no deferred implementation markers or unspecified test instructions remain. Task 4's conditional analysis has an exact inspection command and explicitly forbids raising budgets.
- Type consistency: `RealtimeTables` is inferred from the existing bridge prop, so the boundary accepts exactly the current table union. The page renders the boundary with the existing four-table tuple.
