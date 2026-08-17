# Slide-Over Detail Drawer (Inspector Sheet) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the fixed-column Inspector in `app/(dashboard)/items/items-explorer-client.tsx` into a **Slide-Over Detail Drawer (Modal Sheet / Overlay)** so that the main table always occupies 100% full width without horizontal squishing.

**Architecture:** Update `items-explorer-client.tsx` so the `<main>` table is full-width (`w-full`), and `<Inspector>` is rendered as a fixed overlay drawer (`fixed inset-y-0 right-0 z-50 w-full max-w-[460px]`) with a subtle backdrop (`fixed inset-0 z-50 bg-black/30 backdrop-blur-xs`), smooth transition animations, close button, and `Escape` key listener.

**Tech Stack:** Next.js 16, React 19, Tailwind CSS v4, Lucide Icons, Node.js `node:test`.

---

### Task 1: Refactor Inspector into Slide-Over Overlay Sheet

**Files:**
- Modify: `app/(dashboard)/items/items-explorer-client.tsx`
- Test: `tests/component/items-explorer.test.tsx` (or new test file)

- [ ] **Step 1: Update `items-explorer-client.tsx` layout and Inspector component**
  - Set `isInspectorOpen` state (or `activeInspectorItem`).
  - Make `<main>` container `w-full flex-1 min-w-0 overflow-hidden`.
  - Update `Inspector` component:
    - Render fixed backdrop when open: `fixed inset-0 z-50 bg-black/30 backdrop-blur-xs transition-opacity duration-200`.
    - Render fixed drawer sheet: `fixed inset-y-0 right-0 z-50 w-full max-w-[460px] bg-card border-l border-border shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-right duration-250`.
    - Add `Escape` key handler to dismiss drawer.
    - Add clear close button (`X`) at top right of drawer.
    - Provide full item details, image preview, quick action buttons, and audit trail.

- [ ] **Step 2: Update / Add component test**
  - Verify table renders full width.
  - Verify clicking an item opens the slide-over drawer with item metadata.
  - Verify clicking close button closes the drawer.

- [ ] **Step 3: Run component test**
  - `npx tsx --test tests/component/items-explorer.test.tsx`

---

### Task 2: Full Verification & Integration

- [ ] **Step 1: Run full test suite**
  - `npm test`
- [ ] **Step 2: Run strict TypeScript check**
  - `npm run typecheck`
- [ ] **Step 3: Run ESLint**
  - `npm run lint`
- [ ] **Step 4: Commit and push**
  - Commit changes to `main` and push to GitHub.
