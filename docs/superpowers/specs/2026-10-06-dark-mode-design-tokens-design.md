# Design Specification: Dark Mode Clean Architecture & Design Tokens

**Status:** Approved  
**Date:** 2026-10-06  
**Topic:** Clean Architecture for Dark Mode & Semantic Design Tokens  
**Target:** CAMMS (Center Asset & Material Management System)

---

## 1. Problem Statement & Goals

### 1.1 Context
CAMMS previously had fragmented styling:
- Dark mode CSS variables in `app/globals.css` used generic oklch grayscale values that lacked depth layering (e.g. background and card surfaces had insufficient distinction).
- Several key UI components (such as `Sidebar`, `SearchInput`, `AssetTagModal`, and form elements) contained hardcoded Slate utility classes (`bg-slate-50`, `bg-white`, `border-slate-200`, `text-slate-900`) rather than semantic tokens.
- Shadows in dark mode did not account for dark backgrounds, leading to either invisible elevation or muddy black halos.

### 1.2 Goals
1. Establish a **Clean Design Tokens Architecture** where elements avoid hardcoded color utility classes and instead utilize semantic tokens mapped from CSS custom properties.
2. Define a strict **Palette & Contrast Strategy**:
   - Surface/Background:
     - Light: Base `#F8FAFC`, Card/Surface `#FFFFFF`
     - Dark: Base `#0F172A` (Slate 900, avoiding pure black `#000000`), Card/Surface `#1E293B` (Slate 800) for distinct depth layers.
   - Text Hierarchy complying with **WCAG AA** (> 4.5:1 contrast):
     - Light: Primary `#0F172A`, Secondary `#64748B`
     - Dark: Primary `#F8FAFC`, Secondary `#94A3B8`
   - Borders & Elevation:
     - Dark borders set to `#334155` (Slate 700) with reduced luminance.
     - Diminish heavy box-shadows in dark mode, favoring subtle borders and elevation contrast for depth.
3. Support both `.dark` class and `[data-theme="dark"]` attribute selectors on the root document.

---

## 2. Token Architecture & Theme Definition

### 2.1 CSS Variables Specification (`app/globals.css`)

```css
:root {
  /* Surfaces */
  --background: #f8fafc;
  --foreground: #0f172a;
  --card: #ffffff;
  --card-foreground: #0f172a;
  --popover: #ffffff;
  --popover-foreground: #0f172a;

  /* Brand / Action */
  --primary: #2563eb;
  --primary-foreground: #ffffff;

  /* Secondary & Muted Surfaces */
  --secondary: #f1f5f9;
  --secondary-foreground: #1e293b;
  --muted: #f1f5f9;
  --muted-foreground: #64748b;
  --accent: #eff6ff;
  --accent-foreground: #1d4ed8;

  /* Borders & Inputs */
  --border: #e2e8f0;
  --input: #cbd5e1;
  --ring: #2563eb;

  /* Sidebar Tokens */
  --sidebar: #ffffff;
  --sidebar-foreground: #334155;
  --sidebar-primary: #2563eb;
  --sidebar-primary-foreground: #ffffff;
  --sidebar-accent: #eff6ff;
  --sidebar-accent-foreground: #1d4ed8;
  --sidebar-border: #e2e8f0;
  --sidebar-ring: #93c5fd;

  /* Feedback Colors */
  --destructive: #ef4444;
  --destructive-foreground: #ffffff;
}

.dark, [data-theme="dark"] {
  /* Surfaces (Depth Layering: #0F172A Base -> #1E293B Surface) */
  --background: #0f172a;
  --foreground: #f8fafc;
  --card: #1e293b;
  --card-foreground: #f8fafc;
  --popover: #1e293b;
  --popover-foreground: #f8fafc;

  /* Brand / Action */
  --primary: #3b82f6;
  --primary-foreground: #ffffff;

  /* Secondary & Muted Surfaces */
  --secondary: #334155;
  --secondary-foreground: #f8fafc;
  --muted: #1e293b;
  --muted-foreground: #94a3b8;
  --accent: #1e293b;
  --accent-foreground: #60a5fa;

  /* Subtle Low-Luminance Borders */
  --border: #334155;
  --input: #334155;
  --ring: #3b82f6;

  /* Sidebar Tokens */
  --sidebar: #0f172a;
  --sidebar-foreground: #f8fafc;
  --sidebar-primary: #3b82f6;
  --sidebar-primary-foreground: #ffffff;
  --sidebar-accent: #1e293b;
  --sidebar-accent-foreground: #60a5fa;
  --sidebar-border: #334155;
  --sidebar-ring: #3b82f6;

  /* Feedback Colors */
  --destructive: #f87171;
  --destructive-foreground: #0f172a;
}
```

### 2.2 Tailwind v4 `@theme inline` Integration
Tailwind CSS v4 consumes these variables via `@theme inline`:
```css
@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-popover: var(--popover);
  --color-popover-foreground: var(--popover-foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-border: var(--border);
  --color-input: var(--input);
  --color-ring: var(--ring);
  --color-sidebar: var(--sidebar);
  --color-sidebar-foreground: var(--sidebar-foreground);
  --color-sidebar-primary: var(--sidebar-primary);
  --color-sidebar-primary-foreground: var(--sidebar-primary-foreground);
  --color-sidebar-accent: var(--sidebar-accent);
  --color-sidebar-accent-foreground: var(--sidebar-accent-foreground);
  --color-sidebar-border: var(--sidebar-border);
  --color-sidebar-ring: var(--sidebar-ring);
}
```

---

## 3. WCAG AA Contrast Compliance Analysis

| Context | Background | Text Color | Contrast Ratio | WCAG AA Threshold | Status |
|---|---|---|---|---|---|
| **Light Canvas** | `#F8FAFC` | `#0F172A` (Primary) | **17.8:1** | ≥ 4.5:1 | **PASS** |
| **Light Canvas** | `#F8FAFC` | `#64748B` (Muted) | **4.64:1** | ≥ 4.5:1 | **PASS** |
| **Light Card** | `#FFFFFF` | `#64748B` (Muted) | **4.87:1** | ≥ 4.5:1 | **PASS** |
| **Dark Canvas** | `#0F172A` | `#F8FAFC` (Primary) | **17.8:1** | ≥ 4.5:1 | **PASS** |
| **Dark Canvas** | `#0F172A` | `#94A3B8` (Muted) | **7.15:1** | ≥ 4.5:1 | **PASS** |
| **Dark Card** | `#1E293B` | `#F8FAFC` (Primary) | **12.0:1** | ≥ 4.5:1 | **PASS** |
| **Dark Card** | `#1E293B` | `#94A3B8` (Muted) | **4.84:1** | ≥ 4.5:1 | **PASS** |

---

## 4. Component Refactoring & Rules

### 4.1 Rule: No Hardcoded Color Primitives in Components
- **Banned**: `bg-white`, `bg-slate-50`, `bg-slate-100`, `text-slate-900`, `text-slate-700`, `text-slate-500`, `border-slate-200`, `border-slate-300` in layout/structure elements.
- **Required**:
  - `bg-background` for canvas
  - `bg-card` for cards, modals, dropdown menus
  - `bg-muted` for chips, skeleton loaders, disabled backgrounds
  - `text-foreground` for headings and body
  - `text-muted-foreground` for subtitles, timestamps, descriptions
  - `border-border` for dividers and outlines
  - `border-input` for form inputs

### 4.2 Target Components for Refactoring
1. **`components/layout/sidebar.tsx`**:
   - Change `hover:bg-slate-50` -> `hover:bg-sidebar-accent hover:text-sidebar-accent-foreground`
   - Change `border-slate-100` -> `border-sidebar-border`
   - Change `bg-slate-50/70` in footer -> `bg-sidebar/50`
   - Change `text-slate-500` -> `text-muted-foreground`
2. **`components/ui/search-input.tsx`**:
   - Retain semantic tokens `bg-muted/50 border-input text-foreground focus:bg-background focus:border-ring`.
3. **`components/ui/asset-tag-modal.tsx`**:
   - Refactor modal control panels and preset selector buttons to use `bg-card border-border text-card-foreground` instead of `bg-white border-slate-200`.
   - Preserve `print:bg-white print:text-black` strictly for print output media.
4. **`components/ui/data-table.tsx`**:
   - Verify all headers, rows, and cells use `bg-card`, `bg-muted`, `border-border`, and `hover:bg-muted/60`.
5. **`components/theme-provider.tsx`**:
   - Support both `.dark` class and `[data-theme="dark"]` attribute on `document.documentElement` simultaneously to maximize ecosystem interoperability.

---

## 5. Verification Plan

1. **Automated Unit & Component Tests**:
   - Test that `:root` and `.dark` variables match exact hex specifications.
   - Verify `ThemeProvider` applies `.dark` and sets `data-theme="dark"`.
   - Verify `ThemeToggle` correctly updates state and DOM.
2. **Lint & Type Checks**:
   - `npm run lint` must exit with 0 warnings/errors.
   - `npm run typecheck` must pass.
3. **Regression & Build Suite**:
   - `npm test` must pass all test suites.
   - `npm run build` must succeed within bundle budgets.
