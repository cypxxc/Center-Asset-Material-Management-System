# Design Specification: CAMMS Full-Spectrum System Optimization

**Date:** 2026-08-07  
**Project:** Office Item Registry System (Center Asset & Material Management System - CAMMS)  
**Status:** Approved  
**Author:** Antigravity AI & Pair Developer  

---

## 1. Executive Summary & Goals

The primary goal of this optimization initiative is to improve the user experience (UX) and performance of the CAMMS web application across all layers: Database/Queries, Frontend Bundle, Server Auth Latency, and Perceived UI Interactions.

### Targets & Success Metrics
- **Server Response / Page Load Latency:** Warm render latency < 200 ms (reduced from 300–900 ms).
- **First Load JS Bundle Size:** Reduction of initial client bundle by > 30% via route-based and component-level code splitting.
- **Database Query Efficiency:** Zero redundant queries per request flight using React `cache()`, Next.js `unstable_cache`, and trimmed `SELECT` projections.
- **Perceived UX:** Instant skeleton UI feedback on route transitions and flicker-free input search debounce (250 ms).

---

## 2. System Architecture & Detailed Design Phases

### Phase 1: Database & Backend Query Optimization

#### 1.1 Database Indexes Migration (`00003_performance_indexes.sql`)
To optimize multi-column filtering and relational joins, the following indexes will be added:
- **Composite Filter Index:** `idx_items_active_type_status` on `items(deleted_at, item_type, status)` for dashboard metrics and items page filters.
- **Foreign Key Join Indexes:** `idx_items_category_id` on `items(category_id)` and `idx_items_location_id` on `items(location_id)`.
- **Search Optimization Index:** `idx_items_name_lower` on `items(lower(item_name))` for case-insensitive search acceleration.

#### 1.2 Query Projection & Payload Trimming
- Refactor `getItems()` in `features/items/queries.ts` to replace generic wildcard selects (`*`) with exact column projections (`id, item_name, asset_no, serial_no, quantity, status, item_type, category_id, location_id, image_url, created_at`).
- Refactor `getReportStats()` in `features/reports/queries.ts` to query minimal count payload aggregations.

#### 1.3 Concurrent Query Parallelization & Caching
- Enforce `Promise.all` across all multi-query Server Components (`app/(dashboard)/dashboard/page.tsx`, `app/(dashboard)/items/page.tsx`, `app/(dashboard)/settings/page.tsx`).
- Ensure reference data (`categories`, `locations`, `units`) uses `unstable_cache` with tag invalidation (`CACHE_TAGS.ITEM_REFERENCES`) triggered upon metadata updates in `features/settings/actions.ts`.

---

### Phase 2: Frontend & Bundle Size Optimization

#### 2.1 Dynamic Component Code-Splitting (`next/dynamic`)
The following heavy, interactive client components will be converted to `next/dynamic` lazy loading with fallback skeletons:
- `components/ui/asset-tag-modal.tsx` (Barcode Code128 engine + QR generation + printable layout).
- `components/dashboard/status-donut-chart.tsx` (Interactive SVG donut chart).
- Heavy modal forms and client dialogs.

#### 2.2 Image Loading & Formatting Strategy
- Wrap item thumbnail renderings in optimized image elements using WebP compression format, explicit aspect ratios (`sizes="(max-width: 768px) 100vw, 300px"`), and `loading="lazy"`.
- Implement low-quality image blur placeholders (`placeholder="blur"`) for list cards and item detail pages.

#### 2.3 Icon Import Tree-Shaking
- Clean up `lucide-react` imports across `components/` and `app/` to ensure tree-shakeable direct symbol imports.

---

### Phase 3: Auth & Middleware Efficiency

#### 3.1 Single-Flight Request Profile Caching
- Ensure `getCurrentProfile()` in `features/auth/queries.ts` is wrapped with React `cache()` so that multiple component calls (Layout, Navigation, Page, Action checks) within a single HTTP request flight execute only 1 Supabase lookup.

#### 3.2 Streamlined Middleware Routing
- Optimize `proxy.ts` / `lib/supabase/middleware.ts` to instantly bypass session and profile verification for public unauthenticated scan routes (`/items/[id]`) and static asset requests.

---

### Phase 4: Perceived UX & Micro-Interactions

#### 4.1 Search Input Debouncing & Non-blocking URL Sync
- Implement a 250 ms debounce on the item search input in `features/items/components/item-list-client.tsx` to prevent server query flooding on every keypress.
- Use `useTransition` when pushing search URL parameters to maintain UI responsiveness without triggering page flashes.

#### 4.2 Comprehensive Skeleton Loaders
- Create and refine `loading.tsx` components for `/dashboard`, `/items`, `/reports`, and `/settings` routes using animated Tailwind skeletons matching actual table and card layouts.

#### 4.3 Optimistic & Disabled Action States
- Enhance client buttons (`delete-item-button.tsx`, form submission triggers) with explicit loading spinner indicators and `disabled` states during active Server Actions.

---

## 3. Verification & Acceptance Criteria

1. **Build & Bundle Verification:**  
   `npm run build` passes with reduced First Load JS sizes and zero TypeScript or ESLint errors.
2. **Automated Unit Testing:**  
   `npm test` passes 100% of tests (268+ test cases).
3. **Health & Latency Check:**  
   GET `/api/health/status` returns healthy status with response latency under 200 ms.
4. **Manual Functional Verification:**  
   - Instant search input debouncing operates smoothly.
   - Asset tag modal loads lazily without blocking initial items page load.
   - Dashboard donut chart renders smoothly on view.

---

## 4. Implementation Plan Transition

Upon review and approval of this spec document by the user, the project will transition to creating a step-by-step implementation plan using the `writing-plans` skill.
