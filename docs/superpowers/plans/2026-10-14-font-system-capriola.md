# Font System Modernization: Capriola & Sarabun Integration Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Modernize the entire typography and font loading architecture across CAMMS by pairing **Capriola** (sans-serif for Latin/numerics/headings) with **Sarabun** (Thai-first standard font) via `next/font/google`, removing legacy render-blocking external Google Fonts `@import`, replacing lingering Material Symbols with `lucide-react`, and enhancing PDF report font-readiness synchronization.

**Architecture:**
- Utilize Next.js 16 native `next/font/google` for build-time font optimization, zero layout shift (CLS), and 100% self-hosted offline/intranet capability without runtime network dependencies.
- Define CSS custom properties `--font-capriola` and `--font-sarabun` injected at root layout.
- Update Tailwind v4 `@theme inline` with unified `--font-sans` combining `var(--font-capriola)` and `var(--font-sarabun)` with robust fallback stacks.
- Replace orphaned Material Symbols references in `items-explorer-client.tsx` and `settings/page.tsx` with standard `lucide-react` icons.
- Enhance `features/reports/pdf-generator.ts` with font stack coordination and `document.fonts.ready` synchronization.

**Tech Stack:** Next.js 16, React 19, Tailwind CSS v4, `next/font/google`, `lucide-react`, TypeScript 5.

---

### Task 1: Root Layout & Global CSS Typography Setup

**Files:**
- Modify: `app/layout.tsx`
- Modify: `app/globals.css`
- Test: `tests/component/page-wrappers.test.tsx` / `npm test`

- [x] **Step 1: Configure `next/font/google` in `app/layout.tsx`**
  - Import `Capriola` and `Sarabun` from `next/font/google`.
  - Configure `capriola` with `weight: '400'`, `subsets: ['latin']`, `variable: '--font-capriola'`, `display: 'swap'`.
  - Configure `sarabun` with `weight: ['300', '400', '500', '600', '700']`, `subsets: ['thai', 'latin']`, `variable: '--font-sarabun'`, `display: 'swap'`.
  - Inject `${capriola.variable} ${sarabun.variable}` into `<html className="...">`.

- [x] **Step 2: Update Tailwind v4 theme in `app/globals.css`**
  - Remove line 1 `@import url("https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined...");`.
  - In `@theme inline`:
    - Set `--font-sans: var(--font-capriola), var(--font-sarabun), "Capriola", "Sarabun", "Leelawadee UI", "Thonburi", system-ui, sans-serif;`
    - Set `--font-heading: var(--font-capriola), var(--font-sarabun), "Capriola", "Sarabun", "Leelawadee UI", "Thonburi", system-ui, sans-serif;`
  - In `@layer base body`:
    - Use `font-family: var(--font-sans);` directly to eliminate duplicate font stack declaration.

---

### Task 2: Replace Material Symbols with Lucide Icons

**Files:**
- Modify: `app/(dashboard)/items/items-explorer-client.tsx`
- Modify: `app/(dashboard)/settings/page.tsx`
- Test: `tests/component/items-explorer-inspector.test.tsx`

- [x] **Step 1: Replace Material Symbols in `items-explorer-client.tsx`**
  - Import `AlertCircle` from `lucide-react`.
  - Replace `<span className="material-symbols-outlined text-[28px]">error</span>` with `<AlertCircle className="size-7" />`.

- [x] **Step 2: Replace Material Symbols in `app/(dashboard)/settings/page.tsx`**
  - Import `AlertCircle` from `lucide-react`.
  - Replace `<span className="material-symbols-outlined text-[28px]">error</span>` with `<AlertCircle className="size-7" />`.

---

### Task 3: Update PDF Generator Typography & Readiness

**Files:**
- Modify: `features/reports/pdf-generator.ts`
- Test: `tests/integration/reports.test.ts`

- [x] **Step 1: Update Font Family Stack in `features/reports/pdf-generator.ts`**
  - Include `'Capriola', 'Sarabun', 'TH Sarabun New', 'Leelawadee UI', system-ui, sans-serif` in print CSS.
  - Guard `window.print()` with `document.fonts.ready` check before timeout to avoid printing before font rendering settles.

---

### Task 4: Update Documentation (.md)

**Files:**
- Modify: `docs/context/PRODUCT.md`
- Modify: `docs/context/README.md`

- [x] **Step 1: Document typography architecture in `docs/context/PRODUCT.md` and `docs/context/README.md`**
  - Note the pairing of Capriola (headings/Latin/numerics) with Sarabun (Thai typography).
  - Note zero external runtime font requests (100% self-hosted build-time fonts via `next/font`).

---

### Task 5: Quality Gate & Verification

- [x] **Step 1: Run unit and integration tests**
  - Run `npm test` and verify all tests pass (0 failures).
- [x] **Step 2: Run linter and typecheck**
  - Run `npm run lint` and `npm run typecheck` (0 errors).
- [x] **Step 3: Run production build and bundle budget check**
  - Run `npm run build` and verify bundle budget limits remain within thresholds.
