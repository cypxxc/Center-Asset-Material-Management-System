# Design Specification: Items & Material Explorer UI Redesign

**Date:** 2026-08-04  
**Target:** `app/(dashboard)/items/items-explorer-client.tsx`  
**Status:** Approved  

---

## 1. Overview & Objective

The Items & Material Explorer (`/items`) is the core catalog interface in Registry-S for searching, filtering, inspecting, and bulk-managing office assets and consumable materials. Following an audit against [`PRODUCT.md`](../../PRODUCT.md) and WCAG AA accessibility guidelines, this redesign converts hardcoded Tailwind colors to semantic CSS tokens (for 100% dark mode compatibility), improves typography hierarchy, enhances checkbox touch targets, and refines the interactive Inspector panel.

### Key Goals:
1. **100% Dark Mode & Semantic Design Tokens:** Eliminate all hardcoded Slate palette classes (`bg-white`, `bg-slate-50`, `bg-slate-100`, `text-slate-900`, `text-slate-600`, `border-slate-200`) across all 1159 lines of `items-explorer-client.tsx`, replacing them with semantic tokens (`bg-background`, `bg-card`, `border-border`, `text-card-foreground`, `text-muted-foreground`, etc.).
2. **Typography & WCAG AA Contrast:** Upgrade sub-10px text (`text-[10px]`) for asset numbers, serial numbers, labels, and inspector boxes to `text-xs` / `text-[11px]` to ensure optimal legibility.
3. **Touch Target & Selection Ergonomics:** Increase selection checkbox bounds from `w-3.5 h-3.5` to `w-4 h-4` with clear focus rings.
4. **Refined Bulk Action Bar & Collapsed Inspector:** Upgrade the floating bulk actions bar to use semantic glassmorphism (`bg-card/95 backdrop-blur-md border-border shadow-xl`). Enhance the collapsed Inspector (44px width) to display a mini type icon of the currently selected item.

---

## 2. Component Specifications & Semantic Token Mapping

### 2.1 Main Explorer Shell & Header Area
- **Shell Container:** `relative flex h-full flex-col overflow-hidden bg-background text-foreground font-sans`
- **Main Area:** `flex min-w-0 flex-1 flex-col bg-card`
- **Header:** `shrink-0 border-b border-border bg-card px-6 py-5 md:px-8`
- **View Mode Toggle Container:** `rounded-lg border border-border bg-muted p-0.5`
  - Active Button: `bg-card text-primary shadow-2xs`
  - Inactive Button: `text-muted-foreground hover:text-foreground`
- **Filters & Search Input:**
  - Category / Status selects: `h-9 rounded-lg border border-input bg-card px-3 text-xs font-semibold text-card-foreground focus:border-primary focus:ring-1 focus:ring-primary`

### 2.2 List View (`ItemsList`) & Grid View (`ItemsGrid`)
- **Table Container:** `min-h-0 flex-1 overflow-auto bg-muted/20`
- **Table Header:** `bg-muted/50 border-b border-border`
- **Table Row (`DataTableRow`):**
  - Selected Row: `border-b border-primary/30 bg-primary/10 text-card-foreground`
  - Normal Row: `border-b border-border/60 text-card-foreground hover:bg-muted/40`
- **Asset/Serial No. Text:** `font-mono text-xs text-muted-foreground`
- **Checkboxes:** `w-4 h-4 rounded border-input text-primary focus:ring-ring cursor-pointer`
- **Grid Card Container:**
  - Selected: `border-primary/40 bg-primary/10 ring-2 ring-primary/20`
  - Normal: `border-border bg-card hover:border-border/80 hover:shadow-2xs`

### 2.3 Inspector Panel (`Inspector`)
- **Container:** `relative hidden h-full shrink-0 flex-col border-l border-border bg-card shadow-2xs transition-[width] duration-200 lg:flex`
- **Image Header:** `bg-muted`
- **Inspector Box:** `rounded-xl border border-border bg-card p-3 shadow-2xs`
- **Label Text:** `text-xs font-semibold uppercase tracking-wider text-primary`
- **Value Boxes:** `rounded-lg border border-border bg-muted/30 p-2.5 text-xs text-card-foreground`
- **Collapsed Mini Preview:** When `collapsed = true`, display a centered mini icon container at the top showing `{typeIcons[item.item_type]}` to provide immediate visual context.

### 2.4 Floating Bulk Action Bar & Modals
- **Floating Bar:** `fixed bottom-14 left-1/2 z-40 -translate-x-1/2 flex items-center gap-3 rounded-2xl border border-border bg-card/95 backdrop-blur-md px-5 py-3 shadow-2xl text-card-foreground animate-in fade-in slide-in-from-bottom-4 duration-300`
- **Blocking Error Modal:** `bg-background/80 backdrop-blur-sm`, dialog card `border-border bg-card shadow-2xl`

---

## 3. Testing & Verification

1. **TypeScript Check:** `npm run typecheck`
2. **ESLint Verification:** `npm run lint`
3. **Production Build:** `npm run build`
4. **Theme Verification:** Validate correct color palette in both Light and Dark mode states.
