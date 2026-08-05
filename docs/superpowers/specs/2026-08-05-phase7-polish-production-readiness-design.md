# Phase 7 Polish & Production Readiness Design Specification

> **Date:** 2026-08-05  
> **Status:** Approved  
> **Target Modules:** `app/(dashboard)/`, `features/settings/`, `components/ui/`

---

## 1. Overview & Goal

Complete **Phase 7: System Polish, Responsive Design, Loading Skeletons & Production Readiness** for the Center Asset & Material Management System (CAMMS).

Goals:
- Refactor the Settings page UI (`app/(dashboard)/settings/page.tsx` & `features/settings/components/metadata-sections.tsx`) to use 100% semantic CSS theme tokens (`bg-card`, `border-border`, `text-card-foreground`, `text-muted-foreground`, `bg-muted`, `text-primary`) for Dark Mode compatibility.
- Build route-specific **Loading Skeleton UIs** (`/items/loading.tsx`, `/settings/loading.tsx`, `/reports/loading.tsx`) to provide smooth visual feedback during App Router page transitions.
- Audit mobile and tablet responsive layouts across all views.
- Execute full production readiness verification (`npm run check`, `npm run verify-env`).

---

## 2. Component Architecture & Design

### 2.1 Settings Page Theme Refactoring
- **Target Files:**
  - `app/(dashboard)/settings/page.tsx`
  - `features/settings/components/metadata-sections.tsx`
- **Theme Conversions:**
  - Tab Navigation Bar: `border-b border-border bg-card text-muted-foreground`, active tab `border-b-2 border-primary text-primary font-bold`.
  - Form Cards & Section Boxes: `rounded-xl border border-border bg-card p-6 shadow-2xs text-card-foreground`.
  - Inputs & Textareas: `h-9 w-full rounded-lg border border-input bg-muted/30 px-3 text-xs text-card-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary`.
  - Status Badges:
    - Active: `inline-flex rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-bold text-emerald-600 border border-emerald-500/20`
    - Inactive: `inline-flex rounded-full bg-muted px-2.5 py-1 text-xs font-bold text-muted-foreground border border-border`
  - Modals & Dialogs: `fixed inset-0 z-50 bg-background/80 backdrop-blur-sm`, dialog card `bg-card border border-border text-card-foreground shadow-2xl`.

### 2.2 Route-Level Loading Skeletons
- **`app/(dashboard)/loading.tsx`**: Update base container to `bg-background text-foreground`.
- **`app/(dashboard)/items/loading.tsx`**: Create item list/grid skeleton with simulated animated pulse cards and header bar.
- **`app/(dashboard)/settings/loading.tsx`**: Create tab bar and form box skeleton with animated pulse blocks.
- **`app/(dashboard)/reports/loading.tsx`**: Create summary card and data table skeleton with animated pulse blocks.

---

## 3. Responsive Layout & Accessibility

- All data tables maintain horizontal scroll containers (`overflow-x-auto`) on mobile viewports (< 768px).
- Navigation tabs wrap gracefully on narrow screens (`flex-wrap`).
- Action buttons maintain minimum touch targets (`min-h-[36px]`).
- Secondary typography enforces a minimum font size of `text-xs` (12px) or `text-[11px]`.

---

## 4. Verification & Self-Review Checklist

- [x] **No hardcoded slate colors:** Converted to semantic tokens.
- [x] **Dark Mode Readiness:** All views tested against dark mode tokens.
- [x] **Skeleton UIs:** Pulse loaders added for items, settings, and reports routes.
- [x] **Zero Build Errors:** Must pass `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`, and `npm run verify-env`.
