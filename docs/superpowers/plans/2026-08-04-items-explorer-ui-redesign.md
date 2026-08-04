# Items & Material Explorer UI Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign `app/(dashboard)/items/items-explorer-client.tsx` to adopt semantic CSS tokens (`bg-card`, `border-border`, `text-card-foreground`, `text-muted-foreground`), full Dark Mode compatibility, enhanced WCAG AA font sizes, larger selection checkboxes, and a refined Inspector panel with collapsed mini previews.

**Architecture:** Refactor `app/(dashboard)/items/items-explorer-client.tsx` client component into semantic theme tokens, ensuring 100% theme consistency across List view, Grid view, Inspector panel, and Floating Bulk actions bar.

**Tech Stack:** Next.js 16 (App Router), React 19, Tailwind CSS v4, Lucide Icons, ExcelJS.

## Global Constraints

- Thai-first UI labels with precise operational phrasing.
- Strict Dark Mode compatibility using semantic CSS tokens (`bg-card`, `border-border`, `text-card-foreground`, `text-muted-foreground`, `bg-background`, `text-foreground`).
- Minimum font size `text-xs` (12px) or `text-[11px]` for secondary details (no `text-[10px]`).
- Expand selection checkbox size to `w-4 h-4`.
- Verify build, lint, and typecheck status (`npm run typecheck`, `npm run lint`, `npm run build`).

---

### Task 1: Refactor Explorer Shell, Header, List View, and Grid View

**Files:**
- Modify: `app/(dashboard)/items/items-explorer-client.tsx:348-935`

**Interfaces:**
- Consumes: `items`, `total`, `page`, `totalPages`, `params`, `locations`, `categories`, `units`
- Produces: Semantic-tokenized Explorer Shell, Filter Header, List Table (`ItemsList`), and Grid (`ItemsGrid`)

- [ ] **Step 1: Inspect lines 348-935 of `items-explorer-client.tsx`**

Verify header elements, filter selects, view mode toggles, data table rows, and grid cards.

- [ ] **Step 2: Refactor Explorer Shell & Header Area**

Update top container and header bar:
- Shell container: `relative flex h-full flex-col overflow-hidden bg-background text-foreground font-sans`
- Header container: `shrink-0 border-b border-border bg-card px-6 py-5 md:px-8`
- Title: `text-lg md:text-xl font-bold tracking-tight text-card-foreground leading-tight`
- View mode toggle container: `rounded-lg border border-border bg-muted p-0.5`
- Active toggle button: `bg-card text-primary shadow-2xs`
- Inactive toggle button: `text-muted-foreground hover:text-card-foreground`
- Filter selects (`category_id`, `status`): `h-9 rounded-lg border border-input bg-card px-3 text-xs font-semibold text-card-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer shadow-2xs`

- [ ] **Step 3: Refactor List View (`ItemsList`) & Table Rows**

Update table container, header, and rows:
- Table container: `min-h-0 flex-1 overflow-auto bg-muted/20`
- Table header row: `bg-muted/50 border-b border-border`
- Selected table row: `border-b border-primary/30 bg-primary/10 text-card-foreground`
- Unselected table row: `border-b border-border/60 text-card-foreground hover:bg-muted/40`
- Icon container cell: `bg-muted text-muted-foreground`
- Item name text: `font-extrabold text-card-foreground`
- Asset / Serial No. text: `mt-0.5 font-mono text-xs text-muted-foreground`
- Quantity text: `text-center font-extrabold text-card-foreground`
- Location text: `font-semibold text-muted-foreground`
- Checkboxes (`w-4 h-4`): `rounded border-input text-primary focus:ring-ring cursor-pointer`

- [ ] **Step 4: Refactor Grid View (`ItemsGrid`) & Footer Bar**

Update grid cards and footer:
- Grid card selected: `border-primary/40 bg-primary/10 ring-2 ring-primary/20`
- Grid card unselected: `border-border bg-card hover:border-border/80 hover:shadow-2xs`
- Image fallback box: `bg-muted text-muted-foreground`
- Card title: `line-clamp-2 text-xs font-extrabold leading-snug text-card-foreground`
- Card asset/serial no.: `mt-1 truncate font-mono text-xs text-muted-foreground`
- Card badge: `rounded-md border border-border bg-muted px-1.5 py-0.5 text-xs font-semibold text-muted-foreground`
- Explorer footer: `border-t border-border bg-card px-4 text-xs text-muted-foreground`
- Total counter badge: `rounded-md border border-border bg-muted px-2.5 py-1 text-xs font-bold text-card-foreground`

- [ ] **Step 5: Verify TypeScript Compilation**

Run: `npm run typecheck`
Expected: PASS with 0 errors.

- [ ] **Step 6: Commit**

```bash
git add app/\(dashboard\)/items/items-explorer-client.tsx
git commit -m "refactor(items): apply semantic tokens and dark mode styling to explorer header, list, and grid"
```

---

### Task 2: Refactor Inspector Panel, Floating Bulk Action Bar, and Modals

**Files:**
- Modify: `app/(dashboard)/items/items-explorer-client.tsx:538-690,936-1159`

**Interfaces:**
- Consumes: `selectedItem`, `selectedItemIds`, `inspectorWidth`, `isInspectorCollapsed`
- Produces: Semantic Inspector panel with collapsed mini preview, Floating Bulk Action bar, and Modal dialogs

- [ ] **Step 1: Inspect lines 538-690 and 936-1159 of `items-explorer-client.tsx`**

Inspect Inspector panel component, collapsed state logic, floating action bar, and error modal.

- [ ] **Step 2: Refactor Inspector Panel (`Inspector`)**

Update inspector container, boxes, and empty state:
- Panel container: `relative hidden h-full shrink-0 flex-col border-l border-border bg-card shadow-2xs transition-[width] duration-200 lg:flex`
- Image header box: `bg-muted`
- Collapsed state preview (when `collapsed = true`):
  - In `InspectorControls`, when collapsed, display a centered mini type icon at top (`<div className="mt-14 flex flex-col items-center gap-2">{typeIcons[item.item_type]}</div>`).
- InspectorBox container: `rounded-xl border border-border bg-card p-3 shadow-2xs`
- InspectorBox label: `text-xs font-semibold uppercase tracking-wider text-primary`
- Inspector value boxes: `rounded-lg border border-border bg-muted/40 p-2.5 text-xs font-medium text-card-foreground`
- Reference box text: `font-mono text-xs font-bold text-card-foreground bg-muted/50 border border-border`

- [ ] **Step 3: Refactor Floating Bulk Action Bar & Modals**

Update floating bar and error modal styling:
- Floating Bulk Action Bar: `fixed bottom-14 left-1/2 z-40 -translate-x-1/2 flex items-center gap-3 rounded-2xl border border-border bg-card/95 backdrop-blur-md px-5 py-3 shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-300 text-card-foreground`
- Bulk select dropdowns: `h-8 rounded-lg border border-input bg-card px-2.5 text-xs font-semibold text-card-foreground focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer`
- Blocking error modal background: `fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm`
- Blocking error dialog card: `w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-2xl`
- Blocking error text: `text-card-foreground`, subtitle `text-xs text-muted-foreground`
- Blocking error button: `bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs py-2.5 rounded-xl transition-all shadow-md`

- [ ] **Step 4: Verify TypeScript, ESLint, and Production Build**

Run:
`npm run typecheck`
`npm run lint`
`npm run build`

Expected: PASS with 0 errors across all commands.

- [ ] **Step 5: Commit**

```bash
git add app/\(dashboard\)/items/items-explorer-client.tsx
git commit -m "refactor(items): apply semantic tokens to inspector panel, floating bulk actions, and modals"
```
