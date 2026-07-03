# CAMMS Performance Analysis & Recommendations Report
**Date:** July 2, 2026

## 1. Next.js Production Bundle Analysis

Following a successful production build (`npm run build`), the CAMMS dashboard and items explorer pages show optimal static assets sizes. The compiled routes are categorized as follows:

- **○ (Static Pages):** `/login`, `/`, `_not-found` — compiled to fast pre-rendered HTML with minimal initial JS footprints.
- **ƒ (Dynamic Server Pages):** `/items`, `/dashboard`, `/reports`, `/settings` — server-side rendered (SSR) to dynamically fetch and display real-time inventory assets and supplies while enforcing Supabase Row Level Security (RLS).
- **ƒ Proxy (Middleware):** Custom edge middleware (`proxy.ts` -> `updateSession`) intercepting routes with low latency.

## 2. Core Web Vitals Optimization

### Largest Contentful Paint (LCP)
- **Status:** Fast. The header console layout uses standard fonts and CSS loading patterns.
- **Recommendations:**
  1. Optimize image loading inside `components/ui/zoomable-image.tsx` using `next/image` properties or explicit sizing attributes.
  2. Implement DNS prefetching to Supabase domains: `<link rel="dns-prefetch" href="https://qrlwduggtczovaebukdp.supabase.co" />`.

### Cumulative Layout Shift (CLS)
- **Status:** Under control. The dynamic main area is scaffolded with skeleton tables (`SkeletonTable`) and card placeholders (`SkeletonCard`).
- **Recommendations:**
  1. Ensure all skeleton loading placeholders match the exact height and structural layout of the populated tables to prevent shifts when data finishes loading.
  2. Use fixed width/height values for loading skeletons instead of auto-calculating viewport dimensions on the client.

## 3. Hydration & Client-Side Optimizations

### Sheet & Modal Unmounting
- **Issue:** Standard React overlays can cause unnecessary CPU work or infinite rendering cascades if they remain mounted while closed.
- **Fix Implemented:** Solved the rendering loop inside `ItemForm` onSuccess by encapsulating the callback inside a React mutable ref, preventing inline reference instantiation from triggering effect loops.
- **On-Demand Hydration:** Use dynamic imports (`next/dynamic`) with `{ ssr: false }` for large, complex interactive components (such as graphs, reports lists, and bulk imports) that are only shown post-interaction.

## 4. Production Caching & Revalidation Strategy

- **Sidebar Statistics:** The `getSidebarData()` query relies on Next.js standard caching layer. Revalidation is correctly triggered on mutation actions (`createItem`, `updateItem`, `softDeleteItem`) using `revalidatePath('/', 'layout')` to keep the visual counts fresh without continuous database hits.
- **Static Assets References:** Reference options (categories, locations, units) are cached for 1 hour (`revalidate: 3600`) using Next.js `unstable_cache`. Revalidation tag triggers are hookable to flush caches when settings are modified.
