# Dark Mode Clean Architecture & Design Tokens Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a Clean Architecture Design Token system for CAMMS with WCAG AA compliance, zero hardcoded element colors, and dual `.dark` / `[data-theme="dark"]` support.

**Architecture:** Centralize all theme tokens as CSS custom properties in `app/globals.css` with explicit palette mapping (Dark canvas `#0F172A`, Dark elevated surface `#1E293B`, subtle borders `#334155`). Sync both class and attribute on `document.documentElement` via `ThemeProvider`. Refactor components to use semantic utility tokens (`bg-background`, `bg-card`, `text-foreground`, `text-muted-foreground`, `border-border`).

**Tech Stack:** Next.js 16, React 19, Tailwind CSS v4, Node.js test runner, Testing Library.

**Spec:** `docs/superpowers/specs/2026-10-06-dark-mode-design-tokens-design.md`

## Global Constraints

- Never hardcode color hexes or raw palette utility classes (`bg-white`, `bg-slate-50`, `text-slate-900`) directly on component elements.
- Dark canvas must be `#0F172A` (never pure black `#000000`).
- Dark elevated surface/card must be `#1E293B` to maintain depth layering.
- Text contrast must satisfy WCAG AA: Primary Light `#0F172A`, Secondary Light `#64748B`, Primary Dark `#F8FAFC`, Secondary Dark `#94A3B8`.
- Dark borders must be reduced luminance `#334155`.
- Both `.dark` and `[data-theme="dark"]` selectors must be supported on root.
- Bundle budget limits must not be exceeded.

## Review Focus

- Dark mode print output: ensure print styles preserve crisp white background (`print:bg-white`) despite dark theme on screen.
- Form controls in dark mode: verify text inputs, selects, and checkboxes maintain readable text and visible focus rings.
- Dynamic data donut/charts: verify SVG background track and chart labels resolve to semantic CSS variables rather than hardcoded light hexes.
- Flash of unstyled theme on page load: ensure the head hydration script synchronously applies both class and attribute.
- Component testing isolation: ensure tests rendering without `ThemeProvider` do not crash and use safe default fallbacks.

---

### Task 1: Refactor CSS Design Tokens in `app/globals.css`

**Files:**
- Modify: `app/globals.css:50-130`
- Create: `tests/unit/theme-tokens.test.ts`

**Interfaces:**
- Produces: CSS variables in `:root` and `.dark, [data-theme="dark"]` for `--background`, `--foreground`, `--card`, `--card-foreground`, `--muted`, `--muted-foreground`, `--border`, `--input`, `--ring`, `--sidebar*`.

- [ ] **Step 1: Write the failing test**

```typescript
// tests/unit/theme-tokens.test.ts
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

test('globals.css defines exact design token palettes for light and dark themes', () => {
  const css = readFileSync('app/globals.css', 'utf-8')

  // Light theme tokens
  assert.ok(css.includes('--background: #f8fafc;'))
  assert.ok(css.includes('--card: #ffffff;'))
  assert.ok(css.includes('--foreground: #0f172a;'))
  assert.ok(css.includes('--muted-foreground: #64748b;'))
  assert.ok(css.includes('--border: #e2e8f0;'))

  // Dark theme tokens supporting dual selectors
  assert.ok(css.includes('.dark, [data-theme="dark"]'))
  assert.ok(css.includes('--background: #0f172a;'))
  assert.ok(css.includes('--card: #1e293b;'))
  assert.ok(css.includes('--foreground: #f8fafc;'))
  assert.ok(css.includes('--muted-foreground: #94a3b8;'))
  assert.ok(css.includes('--border: #334155;'))
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx --test tests/unit/theme-tokens.test.ts`
Expected: FAIL (current `globals.css` does not include dual selector `.dark, [data-theme="dark"]` or exact hex tokens)

- [ ] **Step 3: Implement Design Tokens in `app/globals.css`**

Update `:root` and add `.dark, [data-theme="dark"]` with the exact specified hex palette and Tailwind v4 `@theme inline` mappings.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx --test tests/unit/theme-tokens.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/globals.css tests/unit/theme-tokens.test.ts
git commit -m "feat(theme): configure semantic design tokens in globals.css"
```

---

### Task 2: Dual Attribute and Class Synchronization in `ThemeProvider`

**Files:**
- Modify: `components/theme-provider.tsx`
- Modify: `app/layout.tsx`
- Modify: `tests/component/theme-provider.test.tsx`

**Interfaces:**
- Consumes: CSS tokens from Task 1
- Produces: Synchronization of both `document.documentElement.classList` (`dark`) and `document.documentElement.setAttribute('data-theme', 'dark' | 'light')`.

- [ ] **Step 1: Write test for data-theme attribute in `tests/component/theme-provider.test.tsx`**

Add assertion verifying that when theme is dark, `document.documentElement.getAttribute('data-theme') === 'dark'`.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx --test tests/component/theme-provider.test.tsx`
Expected: FAIL (attribute `data-theme` not yet set)

- [ ] **Step 3: Implement data-theme synchronization**

In `components/theme-provider.tsx` (effect syncing DOM) and `app/layout.tsx` (inline head script):
- Set `data-theme="dark"` and `classList.add('dark')` when resolved theme is dark.
- Set `data-theme="light"` and `classList.remove('dark')` when resolved theme is light.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx --test tests/component/theme-provider.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add components/theme-provider.tsx app/layout.tsx tests/component/theme-provider.test.tsx
git commit -m "feat(theme): sync data-theme attribute alongside dark class"
```

---

### Task 3: Refactor Sidebar & Navigation to Semantic Tokens

**Files:**
- Modify: `components/layout/sidebar.tsx`
- Test: `tests/component/sidebar-tokens.test.tsx`

**Interfaces:**
- Consumes: `--sidebar`, `--sidebar-foreground`, `--sidebar-accent`, `--sidebar-border` from `app/globals.css`
- Produces: Completely semantic styling in Sidebar without hardcoded `slate` colors.

- [ ] **Step 1: Write test verifying semantic tokens in sidebar**

```typescript
// tests/component/sidebar-tokens.test.tsx
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

test('sidebar.tsx does not use hardcoded slate background classes', () => {
  const code = readFileSync('components/layout/sidebar.tsx', 'utf-8')
  assert.ok(!code.includes('hover:bg-slate-50'))
  assert.ok(!code.includes('bg-slate-50/70'))
  assert.ok(!code.includes('bg-slate-50/30'))
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx --test tests/component/sidebar-tokens.test.tsx`
Expected: FAIL

- [ ] **Step 3: Refactor Sidebar styling**

Replace:
- `hover:bg-slate-50 hover:text-foreground` -> `hover:bg-sidebar-accent hover:text-sidebar-accent-foreground`
- `bg-slate-50/70` / `bg-slate-50/30` -> `bg-sidebar/50`
- `border-slate-100` -> `border-sidebar-border`
- `text-slate-400` -> `text-muted-foreground`

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx --test tests/component/sidebar-tokens.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add components/layout/sidebar.tsx tests/component/sidebar-tokens.test.tsx
git commit -m "refactor(sidebar): replace hardcoded colors with semantic design tokens"
```

---

### Task 4: Refactor AssetTagModal & Modals to Semantic Tokens

**Files:**
- Modify: `components/ui/asset-tag-modal.tsx`
- Test: `tests/component/asset-tag-modal.test.tsx`

**Interfaces:**
- Consumes: `--card`, `--card-foreground`, `--border`, `--muted` tokens
- Produces: Dark-mode ready modal controls while preserving `print:bg-white` print sheets.

- [ ] **Step 1: Inspect existing test**

Run: `npx tsx --test tests/component/asset-tag-modal.test.tsx`
Expected: PASS

- [ ] **Step 2: Refactor UI wrapper colors in `components/ui/asset-tag-modal.tsx`**

Replace:
- Outer modal containers: `bg-white` -> `bg-card`, `text-slate-900` -> `text-card-foreground`, `border-slate-200` -> `border-border`
- Custom Grid settings box: `bg-white border-slate-200/90` -> `bg-card border-border`
- Preset selector buttons: `bg-white text-slate-700 border-slate-200 hover:bg-slate-100` -> `bg-card text-muted-foreground border-border hover:bg-muted`
- Preserve printable sticker sheet classes (`print:bg-white print:text-black`).

- [ ] **Step 3: Run component tests to verify no regressions**

Run: `npx tsx --test tests/component/asset-tag-modal.test.tsx`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add components/ui/asset-tag-modal.tsx
git commit -m "refactor(asset-tag-modal): use semantic tokens for modal controls"
```

---

### Task 5: System-wide Quality Gate & Bundle Budget Verification

**Files:**
- Verification only

- [ ] **Step 1: Run linter**

Run: `npm run lint`
Expected: 0 errors, 0 warnings

- [ ] **Step 2: Run typecheck**

Run: `npm run typecheck`
Expected: 0 errors

- [ ] **Step 3: Run full automated test suite**

Run: `npm test`
Expected: All suites PASS

- [ ] **Step 4: Run build & bundle budget check**

Run: `npm run build`
Expected: Build succeeds and all raw & gzip sizes are within budget.

- [ ] **Step 5: Final commit if any cleanup needed**

```bash
git status -s
```
