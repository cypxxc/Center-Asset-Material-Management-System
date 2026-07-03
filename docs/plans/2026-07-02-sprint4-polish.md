# Sprint 4 — Enterprise Polish & Quality Excellence Implementation Plan

> **For Antigravity:** REQUIRED WORKFLOW: Use `.agent/workflows/execute-plan.md` to execute this plan in single-flow mode.

**Goal:** Polish, refactor, and audit the application to ensure consistency, accessibility, performance, and enterprise-grade code quality without changing business logic, routing, schema, or permissions.

**Architecture:** Audit the front-end codebase layout-by-layout and component-by-component to replace custom layout wrappers with `PageContainer`/`PageHeader`, standardize typography sizes/weights, align spacing (padding/gaps) to design tokens, replace raw HTML buttons with the `Button` primitive, clean up hardcoded slate/blue colors with theme-based CSS variables, improve Lucide icon sizes, integrate standardized logging, and ensure complete WCAG AA compliance.

**Tech Stack:** Next.js 16 (React 19), Tailwind CSS v4, Radix UI (shadcn), Lucide icons, Zod v4, Supabase.

---

### Task 1: Global Layout and Wrapper Audit

**Files:**
- Modify: `app/(dashboard)/layout.tsx`
- Modify: `app/(dashboard)/dashboard/page.tsx`
- Modify: `app/(dashboard)/profile/page.tsx`
- Modify: `features/reports/components/reports-list.tsx`

**Step 1: Apply `PageContainer` and `PageHeader`**
- Replace hardcoded background colors/paddings with the shared layout wrappers.
- In `app/(dashboard)/layout.tsx`: Replace `bg-[#f0f4f8]` with `bg-background` to use the CSS variable token.
- In `app/(dashboard)/profile/page.tsx`: Import and wrap the form inside `PageContainer` and `PageHeader` with the title and description, and clean up the form's local header.
- In `features/reports/components/reports-list.tsx`: Replace the outer `div` wrapper with `PageContainer className="print:bg-white print:p-0"` and use `PageHeader` for the main header block.
- In `app/(dashboard)/dashboard/page.tsx`: Replace the custom wrapper with `PageContainer` and structure the welcome banner to use semantic colors.

**Step 2: Verification**
- Run: `npm run lint` and `npm run build`
- Expected: Zero lint errors, successful production build.

---

### Task 2: Typography and Spacing Token Normalization

**Files:**
- Modify: `app/(dashboard)/dashboard/page.tsx`
- Modify: `app/(dashboard)/items/items-explorer-client.tsx`
- Modify: `features/reports/components/reports-list.tsx`
- Modify: `features/auth/components/profile-form.tsx`
- Modify: `features/settings/components/metadata-sections.tsx`

**Step 1: Typography Alignment**
- Standardize titles and descriptions:
  - Titles: `text-2xl font-bold` (or `text-xl` for inner page sections).
  - Section titles: `text-lg font-semibold`.
  - Card titles: `text-base font-semibold`.
  - Descriptions/subtitles: `text-sm text-muted-foreground`.
  - Table headers: `text-xs font-semibold uppercase tracking-wide`.
- Remove inconsistent usage of `font-black` (replace with `font-bold` or `font-semibold`) and random font weights.

**Step 2: Spacing Normalization**
- Search for and normalize arbitrary padding and gaps:
  - Replace `p-5`, `p-7`, `p-8` with `p-6` (or appropriate tailwind sizing).
  - Replace `gap-5`, `gap-7` with `gap-4` or `gap-6`.
  - Replace `space-y-5`, `space-y-7` with `space-y-4` or `space-y-6`.

**Step 3: Verification**
- Run: `npm run lint` and `npm test`
- Expected: All checks pass.

---

### Task 3: Color Audit & Semantic Color Tokens

**Files:**
- Modify: `app/(dashboard)/dashboard/page.tsx`
- Modify: `app/(dashboard)/items/items-explorer-client.tsx`
- Modify: `features/reports/components/reports-list.tsx`
- Modify: `components/layout/sidebar.tsx`
- Modify: `components/layout/header.tsx`

**Step 1: Replace Hardcoded Tailwind Colors**
- Audit files for hardcoded Tailwind slate/emerald/blue colors.
- Replace them with semantic variables or CSS-variable-backed color utilities:
  - Use `text-primary`, `bg-primary`, `text-muted-foreground`, `bg-muted`, `border-border`, `text-destructive`, `bg-destructive`.
  - Replace hardcoded background colors like `bg-slate-50/50` or `bg-[#f1f5f9]` with the semantic equivalents like `bg-secondary` or standard theme classes.

**Step 2: Verification**
- Run: `npm run build`
- Expected: Code compiles successfully.

---

### Task 4: Button Primitive and Icon Consistency

**Files:**
- Modify: `app/(dashboard)/items/items-explorer-client.tsx`
- Modify: `app/(dashboard)/admin/db-panel/db-panel-client.tsx`
- Modify: `features/auth/components/profile-form.tsx`
- Modify: `features/items/components/item-form.tsx`
- Modify: `features/settings/components/metadata-sections.tsx`

**Step 1: Replace raw HTML buttons**
- Replace `<button>` elements with the standard `<Button>` component where appropriate (excluding Radix primitive triggers where raw buttons are required/unwrapped).
- Apply proper variants: `default`, `secondary`, `outline`, `ghost`, `destructive`, `link`.

**Step 2: Standardize Icon Sizes**
- Verify all Lucide icons use consistent sizes:
  - Standard action / list icons: `h-4 w-4` or `h-5 w-5`.
  - Clean up random variations like `h-4.5 w-4.5` or raw sizes.

**Step 3: Verification**
- Run: `npm run lint`
- Expected: No issues found.

---

### Task 5: Empty States & Loading Experience Polish

**Files:**
- Modify: `app/(dashboard)/items/items-explorer-client.tsx`
- Modify: `app/(dashboard)/locations/locations-client.tsx`
- Modify: `features/reports/components/reports-list.tsx`
- Modify: `features/settings/components/metadata-sections.tsx`

**Step 1: Unify Empty States**
- Replace custom inline empty states with the shared `EmptyState` component:
  - In `EmptyRows` inside `items-explorer-client.tsx`.
  - In `ItemsGrid` empty state.
  - In selected location items list inside `locations-client.tsx`.
  - In `ReportsList` table body empty row inside `reports-list.tsx`.
  - In `metadata-sections.tsx` where profiles/users list is empty.

**Step 2: Verify Skeleton Table / Card load**
- Ensure that the initial page loading experiences utilize `SkeletonTable` or `SkeletonCard` instead of empty layout shifts.

**Step 3: Verification**
- Run: `npm run build`
- Expected: All builds compile successfully.

---

### Task 6: Accessibility Deep Audit (WCAG AA Compliance)

**Files:**
- Modify: `app/(dashboard)/layout.tsx`
- Modify: `components/layout/header.tsx`
- Modify: `components/layout/sidebar.tsx`
- Modify: `components/ui/button.tsx`

**Step 1: Keyboard Navigation, Skip to Content, Focus Rings**
- Add a "Skip to Content" link at the top of the layout in `app/(dashboard)/layout.tsx` focusing on a `#main-content` target.
- Ensure that any interactive component with `outline-none` receives a replacement focus ring (e.g. `focus-visible:ring-2 focus-visible:ring-primary`).
- Add appropriate `aria-label`, `aria-describedby`, and keyboard role attributes to components that require them.

**Step 2: Verification**
- Run: `npm run build`
- Expected: Code compiles successfully.

---

### Task 7: Production Logging, Code Quality, and Cleanup

**Files:**
- Modify: `lib/logging/logger.ts`
- Modify: `features/items/actions.ts`
- Modify: `features/settings/actions.ts`
- Modify: `features/admin/actions.ts`

**Step 1: Standardize Logging**
- Add `audit` method to the `logger` object in `lib/logging/logger.ts` so it can be called as `logger.audit(...)`.
- Search for `console.log`, `console.warn`, and `console.error` inside features actions/queries.
- Replace them with `logger.info`, `logger.warn`, `logger.error`, or `logger.audit` as appropriate.
- Remove any dead code, unused imports, or obsolete comments.

**Step 2: Run Verification Suite**
- Run `npm test` to make sure all unit tests continue to pass.
- Run `npm run lint` to clean up ESLint warnings.
- Run `npm run build` for production deployment confidence.

**Step 3: Generate Sprint Deliverables**
- Document the Sprint 4 polish in the final Enterprise Quality and Coverage Reports.
