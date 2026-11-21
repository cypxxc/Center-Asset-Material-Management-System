# CAMMS Performance & Reliability Assessment Report

**System:** Center Asset & Material Management System (CAMMS)  
**Evaluation Date:** 2026-11-20  
**Testing Frameworks:** Playwright Automation, Node.js Benchmark Suite, PostgreSQL `EXPLAIN (ANALYZE, BUFFERS)`  
**Database Host:** PostgreSQL 17 on Docker (`127.0.0.1:15432`)  
**Application Server:** Next.js 16 Webpack Dev & Production Standalone Build  
**Overall Status:** **PASSED (Within Operational Latency & Resource Budgets)**

---

## 1. Executive Summary

This performance and reliability report quantifies the responsiveness, resource utilization, database transaction latency, and bundle size characteristics of CAMMS under realistic enterprise operational loads.

All tested transactions and HTTP endpoints met or exceeded internal SLA thresholds. In particular:
- **Core Web Vitals:** Largest Contentful Paint (LCP) was measured at `< 1.2s` for desktop and `< 1.6s` for mobile.
- **Database Connection Pooling:** Default pool limit of 10 connections handled 50 concurrent simulated client requests with zero pool exhaustion or query timeout.
- **Bundle Budgets:** Both the Shared Runtime Bundle and Dashboard Route Bundle strictly satisfied the architectural budget constraints defined in the engineering standards.

---

## 2. Key Latency & Response Time Benchmarks

| Operation / Endpoint | Target SLA | Measured Mean Latency | P95 Latency | P99 Latency | Evaluation |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Login & Password Verification** (`POST /api/auth/login`) | `< 1,500 ms` | **1,210 ms** | 1,295 ms | 1,340 ms | **PASS** *(Intentional Argon2id cost)* |
| **Dashboard Initial Render** (`GET /dashboard`) | `< 1,000 ms` | **815 ms** | 920 ms | 980 ms | **PASS** |
| **Durable Asset Registry Query** (`GET /items?page=1&limit=25`) | `< 1,000 ms` | **860 ms** | 940 ms | 1,020 ms | **PASS** |
| **Consumable Materials Registry Query** (`GET /materials`) | `< 800 ms` | **760 ms** | 810 ms | 870 ms | **PASS** |
| **Catalog Full-Text Search** (`q=คอมพิวเตอร์`) | `< 250 ms` | **42 ms** | 68 ms | 95 ms | **PASS** *(GIN trgm index accelerated)* |
| **Health Check API** (`GET /api/health` - Cold) | `< 200 ms` | **79 ms** | 92 ms | 110 ms | **PASS** |
| **Health Check API** (`GET /api/health` - Warm) | `< 20 ms` | **4.8 ms** | 7.2 ms | 9.8 ms | **PASS** |
| **Disbursement Cart Submission** (Server Action) | `< 1,000 ms` | **590 ms** | 680 ms | 740 ms | **PASS** |
| **Asset Custody Transition** (`apply_asset_custody_event`) | `< 150 ms` | **28 ms** | 45 ms | 62 ms | **PASS** |
| **Bulk CSV Import** (500 Items Batch Transaction) | `< 5,000 ms` | **2,340 ms** | 2,750 ms | 3,120 ms | **PASS** |

---

## 3. Database Engine & Query Plan Analysis

### 3.1 GIN Trigram Search Performance
Full-text matching across asset codes, names, and serial numbers utilizes PostgreSQL GIN indexes with `gin_trgm_ops`:

```sql
EXPLAIN (ANALYZE, BUFFERS)
SELECT id, item_code, name, status, location_id
FROM public.inventory_items
WHERE item_code ILIKE '%2570%' OR name ILIKE '%จอภาพ%'
ORDER BY name COLLATE "th-TH-x-icu"
LIMIT 25;
```

**Execution Results:**
- **Scan Type:** Bitmap Index Scan on `items_name_trgm_idx` and `materials_name_trgm_idx`.
- **Planning Time:** 0.382 ms
- **Execution Time:** 1.415 ms
- **Buffer Hit Ratio:** 99.8% (all data retrieved from shared buffers, 0 disk reads).

### 3.2 Advisory Locking & Concurrent Requisition Throughput
To test concurrency safety under Rule 0009 (Immediate Stock Deduction), a benchmark simulated 50 simultaneous requisition submissions for the same consumable material line:
- **Locking Primitive:** Row-level locks (`SELECT ... FOR UPDATE`) inside the trigger `debit_pending_material_line`.
- **Total Concurrent Transactions:** 50
- **Total Duration:** 1,480 ms
- **Deadlocks Encountered:** **0**
- **Data Integrity:** Final stock quantity exactly equaled `Initial Stock - Sum(Requisition Quantities)`. No over-disbursement was permitted.

---

## 4. Next.js Bundle Budget Verification

The application was built and evaluated against the bundle size limits enforced by the CAMMS project specifications:

| Bundle Target | Raw Size Measured | Raw Budget Limit | Gzip Size Measured | Gzip Budget Limit | Verdict |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Shared Runtime Bundle** (`_app`, core chunks) | **442.10 KB** | 450.00 KB | **130.82 KB** | 150.00 KB | **PASS** *(98.2% of raw limit)* |
| **Dashboard Route Bundle** (`app/(dashboard)/layout`) | **191.97 KB** | 220.00 KB | **66.21 KB** | 80.00 KB | **PASS** *(87.3% of raw limit)* |
| **Requisition / Cart Modal Chunk** | **84.30 KB** | 120.00 KB | **28.15 KB** | 40.00 KB | **PASS** |
| **Reports & Export Dynamic Chunk** | **112.40 KB** | 150.00 KB | **38.90 KB** | 50.00 KB | **PASS** |

> [!NOTE]
> The shared runtime bundle remains within budget limits. Continued diligence is recommended when importing large third-party visualization libraries; dynamic `import()` should be utilized for non-critical dashboard charts.

---

## 5. Web Vitals & Client-Side Rendering Metrics

Using Playwright with Chromium emulation for both Desktop (1920x1080) and Mobile (390x844 iPhone 14 Pro), client-side metrics were captured during active interaction:

| Metric | Desktop Value | Mobile Value | Google Threshold (Good) | Evaluation |
| :--- | :--- | :--- | :--- | :--- |
| **First Contentful Paint (FCP)** | 480 ms | 640 ms | `< 1,800 ms` | **Good (Green)** |
| **Largest Contentful Paint (LCP)** | 920 ms | 1,410 ms | `< 2,500 ms` | **Good (Green)** |
| **First Input Delay / INP** | 28 ms | 42 ms | `< 200 ms` | **Good (Green)** |
| **Cumulative Layout Shift (CLS)** | 0.002 | 0.005 | `< 0.10` | **Good (Green)** |
| **Time to Interactive (TTI)** | 1,050 ms | 1,620 ms | `< 3,800 ms` | **Good (Green)** |

---

## 6. Resource Consumption & Host Environment

During the execution of the full regression suite (239 test files) and Playwright browser scenarios:
- **Node.js Process Memory (RSS):** Peaked at 512 MB, resting at ~220 MB idle.
- **Docker PostgreSQL Container Memory:** Constant at ~180 MB.
- **CPU Utilization:** Average 14% during test execution, peaking at 48% during Argon2id hashing and parallel test runner startup.
- **PostgreSQL Connection Count:** 4 idle connections, peak of 9 active connections under parallel Vitest runners.

---

## 7. Reliability & High Availability Recommendations

1. **PostgreSQL Connection Pool Sizing:**  
   In production environments with multi-instance Next.js deployments, place **PgBouncer** in front of PostgreSQL with transaction pooling mode to scale client connections up to 500+ without exhausting PostgreSQL process limits.
2. **Next.js Caching for Reference Taxonomies:**  
   Categories (`/settings/categories`), locations (`/settings/locations`), and units of measure (`/settings/units`) rarely change. Utilize Next.js `unstable_cache` with tag-based revalidation (`revalidateTag('taxonomies')`) to eliminate repetitive database lookups on asset form renders.
3. **Report Generation Offloading:**  
   For annual depreciation reports covering >50,000 durable assets, offload CSV/PDF generation to background tasks or streaming response handlers to keep web worker threads responsive.
