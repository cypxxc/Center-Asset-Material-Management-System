# Design Specification: Dashboard UI Redesign (Modern Compact Approach)

**Date:** 2026-08-04  
**Target:** `app/(dashboard)/dashboard/page.tsx`  
**Status:** Approved  

---

## 1. Overview & Objective

The Dashboard (`/dashboard`) is the primary landing control surface for Registry-S. Following an audit against [`PRODUCT.md`](../../PRODUCT.md) and UI/UX standards, this redesign modernizes the layout while adhering to brand principles (*calm, official, precise, Explorer-style information density*).

### Key Goals:
1. **Remove Anti-Patterns:** Replace the oversized marketing-style gradient hero banner with a modern, compact, professional welcome control strip.
2. **Full Dark Mode & Semantic Design Tokens:** Eliminate hardcoded Tailwind colors (`bg-white`, `text-slate-800`, `border-slate-100`, etc.) in favor of semantic CSS variables (`bg-card`, `text-card-foreground`, `border-border`, `text-muted-foreground`) defined in [`globals.css`](../../app/globals.css).
3. **Accessibility & Contrast:** Elevate sub-10px typography (`text-[8px]`, `text-[9px]`) to accessible sizes (`text-xs` / `11px-12px`). Provide explicit aria labels for screen readers.
4. **Refined Visualizations & Interactions:** Improve Donut chart clarity with tooltips/legends, clean up category progress bars by removing distracting background gridlines, and enhance the Low Stock alert cards.

---

## 2. Detailed Component Architecture & Changes

### 2.1 Header / Welcome Control Strip
- **Container:** Compact `bg-card border border-border rounded-xl p-5 shadow-xs` with a subtle gradient accent (`from-primary/5 via-accent/10 to-transparent`).
- **Typography:**
  - System badge: `bg-primary/10 text-primary px-2.5 py-0.5 rounded-full text-[11px] font-medium`
  - Title: `text-xl font-bold text-card-foreground`
  - Subtitle: `text-xs text-muted-foreground max-w-2xl`
- **Actions:**
  - Primary: `Link` to `/items/new` (for write-permitted roles) with `bg-primary text-primary-foreground text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-primary/90 transition-colors shadow-2xs`
  - Secondary: `Link` to `/items` with `bg-secondary text-secondary-foreground text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-secondary/80 border border-border transition-colors`

### 2.2 Metrics Bento Grid (4 Cards)
- **Container:** `grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4`
- **Card Styling:** `bg-card text-card-foreground p-5 rounded-xl border border-border shadow-2xs hover:shadow-xs transition-all flex items-center justify-between`
- **Metric Item Specifications:**
  1. **Total Assets (ครุภัณฑ์ทั้งหมด):** Icon container `bg-blue-500/10 text-blue-600 dark:text-blue-400 p-3 rounded-lg`. Status indicator text `text-emerald-600 dark:text-emerald-400`.
  2. **Total Quantity (วัสดุและอุปกรณ์รวม):** Icon container `bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 p-3 rounded-lg`.
  3. **Damaged / In Repair (ชำรุด/รอซ่อมบำรุง):** Icon container `bg-rose-500/10 text-rose-600 dark:text-rose-400 p-3 rounded-lg`. Quantity text `text-rose-600 dark:text-rose-400`.
  4. **Locations (สถานที่ตั้งเก็บรักษา):** Icon container `bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 p-3 rounded-lg`.

### 2.3 Main Charts & Section Cards

#### A. Status Breakdown (SVG Donut Chart)
- **Card:** `bg-card text-card-foreground p-5 rounded-xl border border-border shadow-2xs flex flex-col justify-between`
- **Chart Element:** `<svg viewBox="0 0 120 120" role="img" aria-label="กราฟสัดส่วนสภาพการใช้งานพัสดุ">`
- **Donut Slices:** Use standard status colors (Active: Emerald, Spare: Blue, Damaged/Repair: Rose, Other/Disposed: Slate/Muted) with smooth hover stroke transitions.
- **Center Label:** Total quantity with `text-xl font-bold text-card-foreground`, subtitle `text-[10px] text-muted-foreground uppercase font-semibold`.
- **Legend:** 2x2 grid with `text-xs text-muted-foreground font-medium`, bullet dots aligned.

#### B. Category Breakdown (Progress Bars)
- **Card:** `bg-card text-card-foreground p-5 rounded-xl border border-border shadow-2xs flex flex-col justify-between`
- **Layout:** Remove behind-the-scenes gridlines (`0%` to `100%`). Clean vertical stack with custom progress bar tracks `bg-muted rounded-full h-2.5 overflow-hidden`.
- **Bar Fill:** `bg-primary rounded-full transition-all duration-500`.
- **Text:** Category name `text-xs font-medium text-card-foreground`, count and percentage `text-xs text-muted-foreground font-mono`.

#### C. Low Stock Alerts Panel
- **Card:** `bg-card text-card-foreground p-5 rounded-xl border border-border shadow-2xs flex flex-col justify-between`
- **Item Row:** `bg-muted/40 hover:bg-muted/70 border border-border/50 p-2.5 rounded-lg transition-colors flex items-center justify-between`
- **Badge:** `bg-amber-500/15 text-amber-700 dark:text-amber-300 text-[10px] font-semibold px-2 py-0.5 rounded-full`

---

## 3. Dark Mode & Accessibility Verification

- **Theme Compliance:** All color utilities must consume `--card`, `--card-foreground`, `--border`, `--muted`, `--muted-foreground`, `--primary`, `--primary-foreground`, `--secondary`, `--secondary-foreground`.
- **WCAG AA:** Minimum contrast ratio 4.5:1 for body text, min font size `11px`/`text-xs`.
- **Screen Reader:** All SVG elements and low-stock list containers annotated with proper `aria-label` or `aria-hidden`.

---

## 4. Testing & Validation Plan

1. **TypeScript Typecheck:** `npm run typecheck`
2. **ESLint Validation:** `npm run lint`
3. **Build Check:** `npm run build`
4. **Visual Inspection:** Verify Light and Dark mode rendering.
