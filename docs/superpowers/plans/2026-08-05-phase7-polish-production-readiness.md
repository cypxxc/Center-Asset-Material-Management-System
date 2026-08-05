# Phase 7 Polish & Production Readiness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor the Settings UI to 100% semantic CSS theme tokens, add route-level loading skeletons (`/items/loading.tsx`, `/settings/loading.tsx`, `/reports/loading.tsx`), and verify production deployment readiness.

**Architecture:** Convert all hardcoded colors in `app/(dashboard)/settings/page.tsx` and `features/settings/components/metadata-sections.tsx` to semantic tokens (`bg-card`, `border-border`, `text-card-foreground`, `text-muted-foreground`, `bg-muted`, `text-primary`). Build animated pulse loading skeleton components for Next.js App Router route transitions.

**Tech Stack:** Next.js 16 (App Router), React 19, Tailwind CSS v4, Lucide Icons.

## Global Constraints

- Thai-first UI labels with precise operational phrasing.
- Strict Dark Mode compatibility using semantic CSS tokens (`bg-card`, `border-border`, `text-card-foreground`, `text-muted-foreground`, `bg-background`, `text-foreground`, `text-primary`).
- Minimum font size `text-xs` (12px) or `text-[11px]` for secondary labels (no `text-[10px]` or `text-[9px]`).
- Verify build, lint, typecheck, and test status (`npm run typecheck`, `npm run lint`, `npm run build`, `npm test`, `npm run check`).

---

### Task 1: Settings UI Semantic Theme Refactoring

**Files:**
- Modify: `app/(dashboard)/settings/page.tsx:55-133`
- Modify: `features/settings/components/metadata-sections.tsx:1-751`

**Interfaces:**
- Consumes: `getSettingsData`, `getAllProfiles`, `canManageSettings`
- Produces: 100% semantic tokenized Settings page & Metadata sections

- [ ] **Step 1: Inspect lines 55-133 of `app/(dashboard)/settings/page.tsx` and `metadata-sections.tsx`**

Check tab bar styling, alert messages, forms, input fields, badges, and user management tables.

- [ ] **Step 2: Refactor `app/(dashboard)/settings/page.tsx`**

Update `app/(dashboard)/settings/page.tsx`:
- Alert message banner: `rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-xs font-semibold text-emerald-600`
- Error modal backdrop: `fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm`
- Error modal card: `w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-2xl text-card-foreground`
- Error title: `text-card-foreground`, subtitle `text-xs text-muted-foreground`
- Error button: `bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold py-2.5 rounded-xl`
- Tab Navigation container: `flex flex-wrap gap-2 border-b border-border pb-px`
- Active tab button: `border-b-2 border-primary text-primary font-bold bg-primary/5 rounded-t-lg px-4 py-2.5 text-xs`
- Inactive tab button: `border-b-2 border-transparent text-muted-foreground hover:text-card-foreground hover:bg-muted/40 rounded-t-lg px-4 py-2.5 text-xs font-semibold`

- [ ] **Step 3: Refactor `features/settings/components/metadata-sections.tsx`**

Update `features/settings/components/metadata-sections.tsx`:
- StatusBadge:
  - Active: `inline-flex rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-bold text-emerald-600 border border-emerald-500/20`
  - Inactive: `inline-flex rounded-full bg-muted px-2.5 py-1 text-xs font-bold text-muted-foreground border border-border`
- TextInput & Textarea: `h-9 w-full rounded-lg border border-input bg-card px-3 text-xs text-card-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary shadow-2xs`
- Form container boxes: `rounded-xl border border-border bg-card p-6 shadow-2xs text-card-foreground`
- Table containers: `rounded-xl border border-border bg-card overflow-hidden`
- Table header row: `bg-muted/50 border-b border-border text-card-foreground`
- Table data rows: `border-b border-border/60 text-card-foreground hover:bg-muted/40`
- Replace any `text-[10px]` or `text-[9px]` instances with `text-xs` or `text-[11px]`.

- [ ] **Step 4: Verify TypeScript & ESLint**

Run: `npm run typecheck` and `npm run lint`
Expected: PASS with 0 errors.

- [ ] **Step 5: Commit Task 1**

```bash
git add app/\(dashboard\)/settings/page.tsx features/settings/components/metadata-sections.tsx
git commit -m "refactor(settings): apply semantic tokens and dark mode styling to settings UI"
```

---

### Task 2: Create Route-Level Loading Skeleton UIs

**Files:**
- Modify: `app/(dashboard)/loading.tsx`
- Create: `app/(dashboard)/items/loading.tsx`
- Create: `app/(dashboard)/settings/loading.tsx`
- Create: `app/(dashboard)/reports/loading.tsx`

**Interfaces:**
- Consumes: Next.js App Router Suspense boundaries
- Produces: Route-specific loading skeleton components with animated pulse blocks

- [ ] **Step 1: Refactor base `app/(dashboard)/loading.tsx`**

Update `app/(dashboard)/loading.tsx`:
- Container: `h-full w-full flex items-center justify-center bg-background text-foreground`
- Text: `text-xs text-muted-foreground font-semibold`

- [ ] **Step 2: Create `app/(dashboard)/items/loading.tsx`**

Create `app/(dashboard)/items/loading.tsx`:
```tsx
export default function ItemsLoading() {
  return (
    <div className="flex h-full flex-col overflow-hidden bg-background p-6 space-y-6 animate-pulse">
      <div className="flex items-center justify-between border-b border-border pb-4">
        <div className="space-y-2">
          <div className="h-6 w-48 rounded-md bg-muted" />
          <div className="h-4 w-72 rounded-md bg-muted/60" />
        </div>
        <div className="flex gap-2">
          <div className="h-9 w-24 rounded-lg bg-muted" />
          <div className="h-9 w-24 rounded-lg bg-muted" />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-48 rounded-xl border border-border bg-card p-4 space-y-3">
            <div className="h-24 w-full rounded-lg bg-muted" />
            <div className="h-4 w-3/4 rounded bg-muted" />
            <div className="h-3 w-1/2 rounded bg-muted/60" />
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Create `app/(dashboard)/settings/loading.tsx`**

Create `app/(dashboard)/settings/loading.tsx`:
```tsx
export default function SettingsLoading() {
  return (
    <div className="space-y-6 p-6 bg-background animate-pulse">
      <div className="space-y-2">
        <div className="h-7 w-64 rounded-md bg-muted" />
        <div className="h-4 w-96 rounded-md bg-muted/60" />
      </div>
      <div className="flex gap-2 border-b border-border pb-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-9 w-28 rounded-lg bg-muted" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className="h-64 rounded-xl border border-border bg-card p-6 bg-muted/40" />
        <div className="h-64 rounded-xl border border-border bg-card p-6 bg-muted/40" />
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Create `app/(dashboard)/reports/loading.tsx`**

Create `app/(dashboard)/reports/loading.tsx`:
```tsx
export default function ReportsLoading() {
  return (
    <div className="space-y-6 p-6 bg-background animate-pulse">
      <div className="space-y-2">
        <div className="h-7 w-64 rounded-md bg-muted" />
        <div className="h-4 w-80 rounded-md bg-muted/60" />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-24 rounded-xl border border-border bg-card p-4 bg-muted/40" />
        ))}
      </div>
      <div className="h-96 rounded-xl border border-border bg-card bg-muted/20" />
    </div>
  )
}
```

- [ ] **Step 5: Verify TypeScript, ESLint, and Production Build**

Run:
`npm run typecheck`
`npm run lint`
`npm run build`

Expected: PASS with 0 errors across all commands.

- [ ] **Step 6: Commit Task 2**

```bash
git add app/\(dashboard\)/loading.tsx app/\(dashboard\)/items/loading.tsx app/\(dashboard\)/settings/loading.tsx app/\(dashboard\)/reports/loading.tsx
git commit -m "feat(ui): add route-level loading skeletons for items, settings, and reports"
```

---

### Task 3: Production Readiness Verification & Final Check

**Files:**
- Audit: System codebase and environment configuration

- [ ] **Step 1: Run Environment Verification**

Run: `npm run verify-env`
Expected: PASS with "All required environment variables are set and validated".

- [ ] **Step 2: Run Complete Test Suite**

Run: `npm test`
Expected: PASS (224/224 tests passing).

- [ ] **Step 3: Run Full System Verification (`npm run check`)**

Run: `npm run check`
Expected: PASS (verify-env -> test -> lint -> build all succeeded).

- [ ] **Step 4: Commit Task 3**

```bash
git commit --allow-empty -m "chore(release): verify production deployment readiness"
```
