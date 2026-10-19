# Design Specification: CAMMS Dashboard Impeccable UI/UX Redesign

**Status:** Proposed  
**Date:** 2026-10-19  
**Topic:** Redesign of CAMMS Executive & Operational Dashboard (`/dashboard`) into an Impeccable Command Center  
**Target Files:**
- `app/(dashboard)/dashboard/page.tsx`
- `components/dashboard/dashboard-metrics-grid.tsx`
- `components/dashboard/dashboard-action-queue.tsx` (new component replacing/extending low stock panel)
- `components/dashboard/dashboard-category-list.tsx`
- `components/dashboard/status-donut-chart.tsx`
- `components/dashboard/dashboard-realtime-boundary.tsx`
- `features/items/queries.ts` (helper queries for damaged queue if needed)
- `tests/component/dashboard-metrics-grid.test.tsx`
- `tests/component/dashboard-action-queue.test.tsx` (new test suite)
- `tests/component/status-donut-chart.test.tsx`

---

## 1. Executive Summary & Problem Statement

### 1.1 Context
ในระบบ **CAMMS (Center Asset & Material Management System)** หน้าแรกที่ผู้บริหารและเจ้าหน้าที่พัสดุ (Admin, Staff, Viewer) เข้าพบหลังจากเข้าสู่ระบบคือ **Dashboard (`/dashboard`)** 
เป้าหมายของหน้านี้คือเป็น **"ศูนย์บัญชาการภาพรวมและการปฏิบัติงาน (Executive & Operational Command Center)"** ที่ให้ข้อมูลสรุปสถานะพัสดุทั้งหมดในองค์กร และชี้เป้าหมายสิ่งที่ต้องดำเนินการในแต่ละวันอย่างรวดเร็ว

### 1.2 ปัญหาและข้อจำกัดของ Dashboard ปัจจุบัน (Current UX Friction)
1. **ตัวเลขสถิติทางเดียว ขาด Actionability (Passive Metrics):** การ์ด 4 ใบด้านบนแสดงเพียงจำนวนพัสดุ, ครุภัณฑ์, รายการชำรุด, และจำนวนสถานที่ แต่ผู้ใช้ไม่สามารถคลิกเพื่อเข้าไปจัดการต่อได้ทันที (ต้องเปิดเมนูไปหาเอง)
2. **ขาดมิติด้านมูลค่าทางการเงินและค่าเสื่อมราคา (Missing Financial & Depreciation Dimension):** ในการบริหารพัสดุภาครัฐ ข้อมูลที่สำคัญที่สุดสำหรับผู้บริหารคือ "มูลค่ารวมของทรัพย์สิน (Asset Valuation)" และ "มูลค่าตามบัญชีสุทธิปัจจุบัน (Net Book Value)" ปัจจุบันข้อมูลนี้คำนวณอยู่ในโมดูลรายงานและค่าเสื่อม แต่ไม่ได้ถูกดึงมาฉายบน Dashboard
3. **การ์ดสต็อกต่ำและรายการชำรุดยังไม่รวมศูนย์ (Fragmented Task Management):** มีเพียงรายการวัสดุใกล้หมดคลัง 5 รายการ แต่ไม่มีรายการพัสดุชำรุดที่ต้องส่งซ่อมเร่งด่วนในบริเวณเดียวกัน ทำให้เจ้าหน้าที่ไม่เห็นลำดับความสำคัญของงาน (Task Prioritization)
4. **กราฟและสัดส่วนยังเป็นแบบคงที่ (Static Visuals):** กราฟโดนัทและรายการหมวดหมู่ยังไม่รองรับการคลิกเพื่อ Deep-link ไปยังตารางทะเบียนพัสดุที่กรองตามสถานะนั้นๆ
5. **ความลึกทางสายตา (Visual Depth) และ Typography:** ตัวเลขสถิติยังขาดการจัดวางแบบ Tabular Numerics ที่คมชัด และใน Dark Mode การ์ดมีความแบนราบ ไม่สะท้อนระดับชั้นของข้อมูล (Elevation Hierarchy)

### 1.3 เป้าหมายหลักของการ Redesign สู่ระดับ "Impeccable"
- **Actionable Bento Command Center:** ปรับเปลี่ยนการ์ดสถิติให้เป็น Bento Grid 4 มิติหลัก (มูลค่าทรัพย์สิน, สัดส่วนครุภัณฑ์/วัสดุ, สุขภาพความพร้อมใช้งาน %, และรายการเร่งด่วนที่คลิกเปิดงานได้ทันที)
- **Unified Action Queue (คิวงานปฏิบัติการด่วน):** รวมพัสดุชำรุดรอส่งซ่อมและวัสดุใกล้หมดคลังไว้ในแท็บปฏิบัติการเดียว พร้อมปุ่มคำสั่งด่วน 1 คลิก
- **Interactive Analytics & Deep-linking:** กราฟโดนัทและหมวดหมู่พัสดุสามารถ Interactive เมื่อ Hover แสดงสถิติละเอียด และเมื่อคลิกจะนำทางตรงไปยัง `/items` พร้อม Filter ทันที
- **Live Sync Presence:** แสดง Indicator แสดงการเชื่อมต่อข้อมูลสดแบบ Real-time ให้ผู้ใช้งานมั่นใจในความถูกต้องของข้อมูล
- **Flawless Thai-first Typography & Semantic Contrast:** รองรับการแสดงผลฟอนต์ `Sarabun` โดยไม่มีปัญหาวรรณยุกต์ซ้อนหรือถูกตัดขอบ และใช้ `Capriola tabular-nums` สำหรับตัวเลขการเงิน

---

## 2. Architecture & Data Flow

### 2.1 Component Hierarchy

```
app/(dashboard)/dashboard/page.tsx (Server Component)
├── PageContainer
│   ├── DashboardRealtimeBoundary (Client Component - Supabase Realtime Listener)
│   ├── PageHeader (Title, Subtitle, Live Pulse Badge, Action Buttons)
│   │
│   ├── Suspense [fallback: <MetricsGridSkeleton />]
│   │   └── DashboardMetricsGrid (Server Component - Fetches getReportStats + getDepreciationTotals)
│   │       ├── ValuationBentoCard
│   │       ├── CompositionBentoCard
│   │       ├── ReadinessBentoCard
│   │       └── UrgentQueueBentoCard
│   │
│   └── DashboardOperationalGrid (2 Columns: 60% Left / 40% Right)
│       ├── Suspense [fallback: <ActionQueueSkeleton />]
│       │   └── DashboardActionQueue (Server Component / Client Tabs)
│       │       ├── Tab: พัสดุชำรุดรอส่งซ่อม (Damaged & Waiting Repair Items)
│       │       └── Tab: วัสดุใกล้หมดคลัง (Low Stock Threshold Items)
│       │
│       └── Suspense [fallback: <AnalyticsSkeleton />]
│           └── DashboardAnalyticsPanel (Server Component)
│               ├── StatusDonutCard (Client Component - Interactive SVG with Center Stat)
│               └── CategoryDistributionCard (Custom Color Dots + Deep-link)
```

### 2.2 Data Fetching & Streaming Strategy
* **Parallel Independent Fetching:** หน้า `page.tsx` แยก Suspense Boundaries ออกเป็น 3 ระดับ เพื่อให้ส่วนที่โหลดเสร็จก่อนแสดงผลทันทีแบบ Streaming (TTFB เร็วขึ้น):
  1. `DashboardMetricsGrid` ดึงข้อมูลผ่าน `getReportStats()` (RPC Database Aggregation + Server Cache)
  2. `DashboardActionQueue` ดึงรายการชำรุดล่าสุด (`getUrgentDamagedItems(5)`) และวัสดุสต็อกต่ำ (`getLowStockItems(5)`)
  3. `DashboardAnalyticsPanel` ใช้ข้อมูลสถิติสถานะและหมวดหมู่พร้อมสี Custom Category Colors
* **Zero Cumulative Layout Shift (CLS = 0):** Skeletons ทุกชิ้นมีขนาดความสูง Min-height และ Padding เท่ากับ Component จริง 100%

### 2.3 Performance & Architectural Risk Mitigations (Critical Hardening)

#### 2.3.1 ความเสี่ยง Realtime Refresh Storm & Event Flooding
* **ปัญหาเดิม:** เมื่อมีการแก้ไขข้อมูลแบบชุด (Bulk edit), นำเข้าไฟล์ Excel หรือยิง Mutation ถี่ๆ Postgres จะปล่อย `postgres_changes` ออกมานับสิบหรือร้อย Event ในเวลาเสี้ยววินาที หากใช้ Debounce สั้นเกินไป (150ms / maxWait 500ms) หน้าจอจะสั่ง `router.refresh()` ซ้ำๆ ติดต่อกัน ทำให้เกิด Server Load พุ่งสูง และหน้าเว็บกระตุก
* **มาตรการแก้ไขใน Redesign:**
  1. **Dashboard Adaptive Debouncing:** สำหรับหน้า Dashboard ซึ่งเป็นหน้าสรุปผลภาพรวม (Summary View) ให้ปรับพารามิเตอร์ Refresh ใน Boundary ให้เป็นจังหวะที่ผ่อนคลายขึ้น:
     - `debounceDelay`: ขยายจาก 150ms เป็น **800ms - 1,000ms**
     - `maxWait`: ขยายจาก 500ms เป็น **2,500ms - 3,000ms** ป้องกันการยิงคำขอถี่ยิบเมื่อมี Event ทะลัก
  2. **Page Visibility Awareness (ตัดการทำงานเมื่อพับหน้าจอ):**
     - ผูก Event Listener `visibilitychange` เมื่อแท็บเบราว์เซอร์ถูกซ่อน (`document.hidden = true`) ให้หยุดการสั่ง `router.refresh()` ชั่วคราว
     - เมื่อผู้ใช้สลับกลับมาดูแท็บ (`document.hidden = false`) ให้สั่ง Refresh รวบยอดเพียงครั้งเดียว หากมี Event ค้างอยู่
  3. **Scoped Table Subscriptions:**
     - หน้า Dashboard จะ Subscribe เฉพาะตารางที่ส่งผลต่อตัวเลขสถิติโดยตรง ได้แก่ `items` และ `categories`
     - **ตัดตาราง `audit_logs` และ `units` ออกจากการ Subscribe บน Dashboard** เพื่อลดทราฟฟิก Realtime ที่ไม่จำเป็น
  4. **Smooth Syncing Feedback (ลดการกะพริบ):**
     - ขณะที่ `router.refresh()` กำลังดึงข้อมูลเบื้องหลัง ให้ `Live Status Indicator` เปลี่ยนสถานะเป็น `[🟡 กำลังซิงค์ข้อมูลล่าสุด...]` (Soft Pulse) แทนการกระตุกของหน้าจอ

#### 2.3.2 ความเสี่ยง Database Aggregation & In-Memory Memory Leaks
* **ปัญหาเดิม:** การคำนวณมูลค่าคงเหลือสุทธิและค่าเสื่อมราคา หากดึงแถวข้อมูลทั้งหมด (`SELECT * FROM items WHERE item_type = 'asset'`) มาคำนวณวนลูปในหน่วยความจำ Node.js (In-Memory JavaScript `reduce`) จะกลายเป็นจุดคอขวดขั้นวิกฤตเมื่อจำนวนพัสดุเพิ่มเป็น 5,000 - 50,000 รายการ ก่อให้เกิด Memory Leak และโหลดหน้าจอช้ามาก
* **มาตรการแก้ไขใน Redesign:**
  1. **Strict Database-Level Aggregation (Zero Raw Row Streaming):**
     - **ห้าม** ดึง Raw items มาคำนวณผลรวมบน Server Component เด็ดขาด
     - มูลค่ารวมของสินทรัพย์ (`total_value`) ให้ดึงผ่านฟังก์ชัน Aggregation ระดับฐานข้อมูล (`get_report_stats` RPC บน Supabase หรือ SQL `SUM(unit_price * quantity)` บน Standalone Postgres) ซึ่งรวมผลในระดับฐานข้อมูลและส่งกลับมาเพียงตัวเลขเดียว
     - สำหรับมูลค่าตามบัญชี (Net Book Value): ใช้การคำนวณสูตรประมาณการทางบัญชีระดับ SQL Query หรืออิงตาม RPC Summary ที่คำนวณจาก Database Engine โดยตรง
  2. **Tiered Caching with Tagged Invalidation:**
     - ห่อหุ้ม `getReportStats()` ด้วย `unstable_cache` พร้อมกำหนด Cache Tag: `CACHE_TAGS.reports` และ `CACHE_TAGS.items`
     - กำหนดค่าความปลอดภัย `revalidate: 60` วินาที (Stale-While-Revalidate) เพื่อป้องกัน Cache Stampede
     - ทุก Server Action ที่มีการเปลี่ยนแปลงพัสดุ (Create, Update, Delete, Batch Ops) จะเรียก `revalidatePath('/', 'layout')` เพื่อเคลียร์ Tag ทันที
  3. **Suspense Boundary Isolation for Financial Metrics:**
     - บรรจุการ์ดมูลค่าสินทรัพย์ (`ValuationBentoCard`) ไว้ใน Suspense Boundary เฉพาะ เพื่อให้แน่ใจว่าแม้การคำนวณมูลค่ารวมจะใช้เวลาประมวลผล สถิติส่วนอื่น (เช่น พัสดุทั้งหมด, สถานะความพร้อมใช้งาน, คิวงานชำรุด) จะยังคงสตรีมมิ่งขึ้นมาแสดงผลได้ทันทีโดยไม่ถูกบล็อก

---

## 3. Visual Design System & Design Tokens

### 3.1 Thai Typography Rhythm & Numerics
* **Headings:** `Sarabun` Bold (`text-lg`, `text-xl`, `text-2xl`), `leading-snug` เพื่อให้สระบน/ล่างของภาษาไทยไม่ชนกัน
* **Data Numerics:** `Capriola` + `tabular-nums tracking-tight` สำหรับตัวเลขจำนวน, ยอดเงินบาท, และเปอร์เซ็นต์ ช่วยให้ตัวเลขมีความเป็นระเบียบในแนวตั้ง
* **Micro-labels & Meta:** `text-xs font-medium text-muted-foreground` พร้อมไอคอน Lucide ขนาด `h-3.5 w-3.5` คู่กันเสมอ

### 3.2 Semantic Color Tokens (Light / Dark Mode Elevation)

| Element | Light Mode (`:root`) | Dark Mode (`.dark`) | Token Rationale |
|---|---|---|---|
| **Page Background** | `#f8fafc` (`slate-50`) | `#090d16` (Deep Navy-Slate) | ให้ความรู้สึกลึก มีมิติ ไม่มืดสนิทจนแบน |
| **Bento Card Surface** | `#ffffff` (`card`) | `#131b2e` (`card`) | ยกชั้นความสูง (Layer 1 Elevation) |
| **Card Borders** | `#e2e8f0` (`slate-200`) | `#1e293b` (`slate-800`) | ขอบบางคม 1px เพิ่มความประณีต |
| **Interactive Hover** | `hover:border-slate-300` | `hover:border-slate-700` | การตอบสนองที่นุ่มนวล |
| **Valuation Metric** | `text-blue-600` / `bg-blue-500/10` | `text-blue-400` / `bg-blue-500/15` | สีหลักสำหรับสินทรัพย์และมูลค่า |
| **Readiness Metric** | `text-emerald-600` / `bg-emerald-500/10` | `text-emerald-400` / `bg-emerald-500/15` | สุขภาพของระบบและความพร้อมใช้ |
| **Urgent Metric** | `text-rose-600` / `bg-rose-500/10` | `text-rose-400` / `bg-rose-500/15` | จุดเตือนอันตรายและงานเร่งด่วน |
| **Low Stock Warning**| `text-amber-600` / `bg-amber-500/10` | `text-amber-400` / `bg-amber-500/15` | เตือนสต็อกต่ำกว่าเกณฑ์ควบคุม |

### 3.3 Rule of No Color-Only Labels
ทุกการ์ดและป้ายสถานะจะต้องมี **ไอคอน + ข้อความกำกับ** ควบคู่กับสีเสมอ เพื่อให้รองรับมาตรฐานการเข้าถึง WCAG 2.2 Level AA/AAA:
- 🟢 **พร้อมใช้งาน:** `<CheckCircle className="size-3.5 text-emerald-500" />` + ข้อความ "พร้อมใช้งาน"
- 🔴 **ชำรุด/ส่งซ่อม:** `<AlertTriangle className="size-3.5 text-rose-500" />` + ข้อความ "ชำรุดรอซ่อม"
- 🟡 **สต็อกต่ำ:** `<Package className="size-3.5 text-amber-500" />` + ข้อความ "ต่ำกว่าเกณฑ์"

---

## 4. Component-by-Component Blueprint

### 4.1 Header & Live Sync Presence (`DashboardHeader`)
* **Welcome Message:** แสดงทักทายพร้อมชื่อผู้ใช้จริง และ Badge สิทธิ์การใช้งาน (เช่น `🛡️ ผู้ดูแลระบบ` หรือ `👤 เจ้าหน้าที่พัสดุ`)
* **Live Status Indicator:** 
  ```tsx
  <div className="flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
    <span className="relative flex h-2 w-2">
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
      <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
    </span>
    <span>ซิงค์ข้อมูลสด (Realtime Active)</span>
  </div>
  ```
* **Header Actions:**
  * ปุ่มหลัก: `[+ ขึ้นทะเบียนใหม่]` (เฉพาะผู้มีสิทธิ์ เขียนได้) นำไปสู่ New Item Dialog / Sheet
  * ปุ่มรอง: `[ดูทะเบียนพัสดุทั้งหมด]` ลิงก์ตรงไปหน้า `/items`

---

### 4.2 Bento Metrics Grid (`DashboardMetricsGrid`)
แบ่งเป็น 4 การ์ดใน Grid (`grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4`):

#### Card 1: สินทรัพย์และมูลค่ารวม (Asset Valuation Card)
* **Header:** ไอคอนเหรียญ/กระเป๋าเงินสีฟ้า + หัวข้อ "มูลค่าสินทรัพย์รวม"
* **Main Value:** `฿{formatMoney(totalValue)}` ขนาด `text-2xl font-bold tabular-nums`
* **Sub-metric & Progress:**
  * มูลค่าตามบัญชีสุทธิปัจจุบัน: `฿{formatMoney(netBookValue)}`
  * Mini Progress Bar แสดงสัดส่วนค่าเสื่อมราคาสะสม (เช่น "หักค่าเสื่อมสะสมแล้ว 28%")

#### Card 2: สัดส่วนครุภัณฑ์และวัสดุ (Inventory Composition Card)
* **Header:** ไอคอนกล่องพัสดุสีเขียว + หัวข้อ "พัสดุและวัสดุทั้งหมด"
* **Main Value:** `{totalItems.toLocaleString()} รายการ`
* **Sub-metric & Progress:**
  * แถบ Segmented Dual-bar: สีฟ้า (ครุภัณฑ์) เทียบกับ สีเขียว (วัสดุ)
  * ข้อความแจกแจง: `ครุภัณฑ์ {assetCount} | วัสดุ {materialCount}`

#### Card 3: ดัชนีความพร้อมใช้งาน (Operational Readiness Card)
* **Header:** ไอคอนโล่/เครื่องหมายถูกสีเขียวมรกต + หัวข้อ "ความพร้อมใช้งานของพัสดุ"
* **Main Value:** `{readinessPercentage.toFixed(1)}%`
* **Sub-metric:**
  * ข้อความ: `ใช้งานปกติ {activeCount} รายการ | จำหน่าย/ตัดบัญชี {disposedCount} รายการ`
  * ข้อความช่วยประเมิน: "พัสดุส่วนใหญ่อยู่ในสภาพพร้อมใช้งาน"

#### Card 4: รายการเร่งด่วนที่ต้องดำเนินการ (Urgent Action Card)
* **Header:** ไอคอนสามเหลี่ยมเตือนภัยสี Rose + หัวข้อ "รายการเร่งด่วน"
* **Main Value:** `{urgentCount} รายการ` (สี `text-rose-600 dark:text-rose-400`)
* **Sub-metric & Quick Link:**
  * แจกแจง: `{damagedCount} รายการรอซ่อม • {lowStockCount} รายการสต็อกต่ำ`
  * ปุ่มลัดล่างการ์ด: `[ตรวจสอบทันที ➔]` เลื่อนหน้าจอลงไปยัง Action Queue อัตโนมัติ

---

### 4.3 Operational Action Queue (`DashboardActionQueue`)
แทนที่กล่อง Low Stock เดิม ด้วย **กระดานคิวงาน 2 แท็บ (Interactive Operational Tabs)**:

#### แท็บที่ 1: พัสดุชำรุดและรอซ่อม (Damaged & Repair Queue)
* **ข้อมูลที่แสดงในแต่ละรายการ:**
  * Thumbnail ภาพพัสดุขนาด `40×40px` (หรือ Fallback Icon หมวดหมู่)
  * ชื่อพัสดุ และ หมายเลขครุภัณฑ์ (Asset Number) ที่คลิกคัดลอกได้
  * สถานที่จัดเก็บ (Location) และ วันที่ถูกรายงานชำรุด
  * Badge สถานะ: `ชำรุด` (สีแดง) หรือ `รอส่งซ่อม` (สีส้ม)
* **Hover Action Button:**
  * ปุ่ม `[บันทึกส่งซ่อม]` หรือ `[เปิดดูรายละเอียด]` นำไปสู่หน้ารายละเอียดพัสดุ `/items/[id]`

#### แท็บที่ 2: วัสดุใกล้หมดคลัง (Low Stock Monitor)
* **ข้อมูลที่แสดงในแต่ละรายการ:**
  * ชื่อวัสดุสิ้นเปลือง พร้อมหน่วยนับ (เช่น 3 รีม, 2 กล่อง)
  * แถบ Gauge ระดับคงเหลือเทียบกับจุดสั่งซื้อขั้นต่ำ (Min Stock Bar)
  * ป้ายเตือน `ต่ำกว่าเกณฑ์` (Amber Badge)
* **Hover Action Button:**
  * ปุ่ม `[เติมสต็อก]` หรือ `[ไปที่รายการ]`

#### Empty State Pattern (เมื่อไม่มีรายการค้าง)
* เมื่อทั้ง 2 แท็บไม่มีรายการค้าง แสดงกล่องเรียบร้อย:
  * ไอคอน `<CheckCircle className="size-10 text-emerald-500" />`
  * ข้อความ "ระบบทำงานเรียบร้อย: ไม่มีพัสดุชำรุดค้างซ่อม และไม่มีวัสดุใกล้หมดคลัง"

---

### 4.4 Interactive Visual Analytics (`DashboardAnalyticsPanel`)

#### Card A: สัดส่วนตามสภาพการใช้งาน (`StatusDonutChart`)
* **SVG Donut Upgrade:**
  * ขนาดรัศมีลงตัว วงแหวนหนา 14px เพื่อการมองเห็นที่ชัดเจน
  * เมื่อนำเมาส์ชี้บน Segment ใด Segment หนึ่ง วงแหวนจะขยายขนาดเป็น 18px (Micro-zoom)
  * **Center Statistic Text:** ตรงกลางวงแหวนจะเปลี่ยนข้อความตาม Segment ที่ชี้:
    * บรรทัดบน: ชื่อสถานะ (เช่น "ใช้งานปกติ")
    * บรรทัดล่าง: จำนวน `{qty} ชิ้น ({pct}%)`
  * **Interactive Legend List:** รายการสถานะด้านล่างสามารถคลิกเพื่อลิงก์ไปยัง `/items?status={key}` ทันที

#### Card B: สถิติตามประเภทสิ่งของ (`CategoryDistributionList`)
* **Custom Color Integration:** ใช้สีประจำหมวดหมู่ (`category.color`) ที่ผู้ใช้ตั้งค่าไว้ในระบบ
* **Progress Bar:** แสดงเปอร์เซ็นต์ของจำนวนสิ่งของเทียบกับทั้งหมด
* **Action Arrow:** แต่ละแถวมีปุ่มไอคอนลูกศร `ChevronRight` ที่แสดงชัดเจนเมื่อ Hover เพื่อลิงก์ไปยัง `/items?category_id={id}`

---

## 5. Responsive Behavior & Micro-interactions

### 5.1 Responsive Breakpoints
* **Mobile (< 640px):**
  * Bento Metrics เรียงเป็น 1 คอลัมน์เดี่ยว
  * Action Queue และ Analytics Panel เรียงซ้อนกันเป็นแนวตั้ง 1 คอลัมน์
  * ตารางและลิสต์จำกัดความสูง `max-h-[300px]` พร้อม Scroll ภายใน
* **Tablet (640px - 1023px):**
  * Bento Metrics เรียงเป็น 2 คอลัมน์ (`grid-cols-2`)
  * Action Queue และ Analytics Panel เรียงซ้อนในแนวตั้ง
* **Desktop (≥ 1024px):**
  * Bento Metrics เรียงเป็น 4 คอลัมน์สมบูรณ์
  * Main Section แบ่งเป็น Layout 2 คอลัมน์: ฝั่งซ้าย Action Queue กว้าง 58-60% และ ฝั่งขวา Analytics กว้าง 40-42%

### 5.2 Micro-interactions & Motion
* **Hover Elevation:** Bento Cards ทุกใบมีคลาส `transition-all duration-200 hover:shadow-sm hover:border-slate-300 dark:hover:border-slate-700`
* **Realtime Number Transitions:** เมื่อมีการเปลี่ยนค่าตัวเลขจาก Realtime Update ใช้แอนิเมชัน Fade-in เล็กน้อยเพื่อไม่ให้กระตุกสายตา
* **Skeleton Shimmer:** โครงสร้าง Skeleton ทุกจุดใช้ `animate-pulse bg-muted/60` ปราศจาก Layout Shift

---

## 6. Implementation Phasing & Task Decomposition

```
┌────────────────────────────────────────────────────────────────────────┐
│                        Implementation Phases                           │
├────────────────────────────────────────────────────────────────────────┤
│ Phase 1: Query Enhancement & Data Grounding                            │
│ - สร้าง helper query getUrgentDamagedItems(limit)                      │
│ - รวมยอด netBookValue เข้าสู่ dashboard loader                        │
│                                                                        │
│ Phase 2: Bento Metrics Grid & Live Pulse Header                        │
│ - ปรับปรุง PageHeader เพิ่ม Realtime Pulse Badge                       │
│ - รีแฟกเตอร์ DashboardMetricsGrid เป็น 4 Bento Cards                   │
│                                                                        │
│ Phase 3: Action Queue Component                                        │
│ - สร้าง DashboardActionQueue รองรับแท็บ 'damaged' และ 'low-stock'     │
│ - ใส่ Empty state และ Quick Action links                               │
│                                                                        │
│ Phase 4: Analytics Panel & Donut Chart Interaction                     │
│ - เพิ่ม Center Summary และ Hover states ใน StatusDonutChart            │
│ - ปรับ Category list ให้รองรับ Category Custom Colors และ Deep-links   │
│                                                                        │
│ Phase 5: Testing & WCAG Accessibility Verification                     │
│ - เขียน Component tests ตรวจสอบการ Render ทั้ง 4 Cards                 │
│ - ตรวจสอบ Contrast ใน Light/Dark mode และการทำงานร่วมกับ Realtime     │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 7. Acceptance Criteria (Definition of Done)

1. [ ] **Executive Metrics:** Bento Grid แสดงครบ 4 มิติ (มูลค่ารวม/ค่าเสื่อม, สัดส่วนครุภัณฑ์/วัสดุ, สุขภาพระบบ %, และรายการเร่งด่วน)
2. [ ] **Tabular Numerics:** ตัวเลขทางการเงินและจำนวนใช้คลาส `tabular-nums` และฟอนต์ `Capriola` ร่วมกับข้อความภาษาไทย `Sarabun` อย่างถูกต้อง
3. [ ] **Operational Actionability:** มีแท็บรายการชำรุดและวัสดุใกล้หมดคลัง พร้อมปุ่มนำทางไปจัดการได้ในคลิกเดียว
4. [ ] **Interactive Visuals:** กราฟโดนัทมี Center Hover Stat และสามารถคลิก Slice/Legend เพื่อนำทางไปยังหน้ารายการพัสดุที่กรองไว้ได้
5. [ ] **Accessibility Compliance:** ทุกป้ายสถานะและตัวบ่งชี้มี Text + Icon เสมอ (ไม่มีป้ายสีล้วน) และอัตราส่วน Contrast ผ่านเกณฑ์ WCAG 2.2 AA
6. [ ] **Zero CLS & Streaming:** Skeleton Loader มีขนาดตรงกับ Component จริง และโหลดแบบ Streaming ผ่าน Suspense
7. [ ] **Dark Mode Elegance:** ธีมมืดใช้สีโทน Deep Navy-Slate (`#090d16` / `#131b2e`) ที่มีระดับชั้นความสูงชัดเจน ไม่มืดทึบแบนราบ
8. [ ] **Realtime Storm Protection:** Realtime Debounce บน Dashboard ปรับเป็น 800-1000ms พร้อมตรวจจับ `visibilitychange` ปิดการทำงานเมื่อพับหน้าจอ และ Subscribe เฉพาะตารางที่จำเป็น (`items`, `categories`)
9. [ ] **Zero In-Memory Raw Row Aggregation:** ข้อมูลมูลค่าและการแจกแจงทั้งหมดรวมผลระดับฐานข้อมูล (SQL/RPC) โดยไม่มีการโหลด Raw records มาวนลูปใน Node.jsเด็ดขาด
