# Dashboard UI Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the Dashboard UI (`app/(dashboard)/dashboard/page.tsx`) to adopt a modern, compact, dark-mode-ready interface aligned with the brand design spec and accessibility guidelines.

**Architecture:** Refactor `app/(dashboard)/dashboard/page.tsx` server component to use semantic Tailwind classes (`bg-card`, `border-border`, `text-card-foreground`, `text-muted-foreground`), replace the marketing-style hero banner with a compact control strip, and optimize typography contrast and SVG chart accessible labels.

**Tech Stack:** Next.js 16 (App Router), React 19, Tailwind CSS v4, Lucide Icons, Supabase Server Client.

## Global Constraints

- Thai-first UI labels with precise operational phrasing.
- Strict dark mode compatibility using semantic CSS tokens (`bg-card`, `border-border`, etc.).
- Minimum font size `text-xs` for readable content (no `text-[8px]` or `text-[9px]`).
- Preserve existing data fetching logic (`getReportStats`, `getCurrentProfile`, `createClient` low stock query).
- Verify build and lint status before completion (`npm run typecheck` & `npm run lint`).

---

### Task 1: Refactor Welcome Control Strip & Metrics Bento Grid

**Files:**
- Modify: `app/(dashboard)/dashboard/page.tsx:83-170`

**Interfaces:**
- Consumes: `profile`, `userCanWrite`, `stats`, `totalAssets`, `activeCount`
- Produces: Compact Welcome Control Strip & Semantic 4-Card Metrics Grid

- [ ] **Step 1: Inspect existing page.tsx structure**

Verify lines 80-170 in `app/(dashboard)/dashboard/page.tsx`.

- [ ] **Step 2: Update Header and 4 Bento Metric Cards with Semantic Styling**

Replace the existing gradient hero banner and bento card containers with:
```tsx
{/* Welcome Control Strip */}
<div className="bg-card text-card-foreground border border-border rounded-xl p-5 shadow-xs bg-gradient-to-r from-primary/5 via-accent/10 to-transparent">
  <div className="space-y-1.5">
    <div className="flex items-center gap-2">
      <span className="bg-primary/10 text-primary px-2.5 py-0.5 rounded-full text-[11px] font-semibold tracking-wide">
        Console Dashboard
      </span>
    </div>
    <h2 className="text-xl font-bold tracking-tight">
      สวัสดีคุณ {profile?.full_name || 'ผู้ใช้งาน'}, ยินดีต้อนรับสู่แผงควบคุมระบบ CAMMS
    </h2>
    <p className="text-xs text-muted-foreground max-w-2xl leading-relaxed">
      ระบบตรวจสอบสถานะ คลังวัสดุ และแผนกซ่อมบำรุงในปัจจุบันของทรัพย์สินทั้งหมดของสำนักงาน 
      คุณสามารถตรวจสอบประเภทครุภัณฑ์ ปรับปรุงวัสดุ หรือพิมพ์รายงานสรุปผลได้ทันที
    </p>
    <div className="flex items-center gap-2.5 pt-2">
      {userCanWrite && (
        <Link 
          href="/items/new" 
          className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold px-3.5 py-2 rounded-lg flex items-center gap-1.5 transition-colors shadow-2xs"
        >
          <PlusCircle className="w-4 h-4" />
          ขึ้นทะเบียนสิ่งของใหม่
        </Link>
      )}
      <Link 
        href="/items" 
        className="bg-secondary hover:bg-secondary/80 text-secondary-foreground border border-border text-xs font-semibold px-3.5 py-2 rounded-lg transition-colors"
      >
        ดูรายการทะเบียนทั้งหมด
      </Link>
    </div>
  </div>
</div>

{/* Metrics Bento Grid */}
<div className="grid w-full grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
  {/* Metric 1: Total Assets */}
  <div className="bg-card text-card-foreground p-5 rounded-xl border border-border shadow-2xs flex items-center justify-between hover:shadow-xs transition-all">
    <div className="space-y-1">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">ครุภัณฑ์ทั้งหมด (Assets)</p>
      <h3 className="text-2xl font-bold">{totalAssets} <span className="text-sm font-normal text-muted-foreground">รายการ</span></h3>
      <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1 mt-1">
        <CheckCircle className="w-3.5 h-3.5" /> ใช้งานอยู่ปกติ {activeCount} รายการ
      </p>
    </div>
    <div className="w-11 h-11 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
      <Package className="h-5 w-5" />
    </div>
  </div>

  {/* Metric 2: Total Quantity */}
  <div className="bg-card text-card-foreground p-5 rounded-xl border border-border shadow-2xs flex items-center justify-between hover:shadow-xs transition-all">
    <div className="space-y-1">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">วัสดุและอุปกรณ์รวม</p>
      <h3 className="text-2xl font-bold">{stats.totalQuantity} <span className="text-sm font-normal text-muted-foreground">ชิ้น</span></h3>
      <p className="text-xs text-muted-foreground font-medium flex items-center gap-1 mt-1">
        <FolderOpen className="w-3.5 h-3.5 text-muted-foreground/70" /> จากสิ่งของทั้งหมด {stats.totalItems} รายการ
      </p>
    </div>
    <div className="w-11 h-11 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
      <ClipboardList className="h-5 w-5" />
    </div>
  </div>

  {/* Metric 3: Damaged / Repair */}
  <div className="bg-card text-card-foreground p-5 rounded-xl border border-border shadow-2xs flex items-center justify-between hover:shadow-xs transition-all">
    <div className="space-y-1">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">ชำรุด/รอซ่อมบำรุง</p>
      <h3 className="text-2xl font-bold text-rose-600 dark:text-rose-400">{damagedCount} <span className="text-sm font-normal text-muted-foreground">รายการ</span></h3>
      <p className="text-xs text-rose-600 dark:text-rose-400 font-medium flex items-center gap-1 mt-1">
        <Hammer className="w-3.5 h-3.5" /> รอการดำเนินการแก้ไขส่งซ่อม
      </p>
    </div>
    <div className="w-11 h-11 rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center">
      <AlertTriangle className="h-5 w-5" />
    </div>
  </div>

  {/* Metric 4: Locations */}
  <div className="bg-card text-card-foreground p-5 rounded-xl border border-border shadow-2xs flex items-center justify-between hover:shadow-xs transition-all">
    <div className="space-y-1">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">สถานที่ตั้งเก็บรักษา</p>
      <h3 className="text-2xl font-bold">{stats.locationCount} <span className="text-sm font-normal text-muted-foreground">โซน</span></h3>
      <p className="text-xs text-muted-foreground font-medium flex items-center gap-1 mt-1">
        <MapPin className="w-3.5 h-3.5 text-muted-foreground/70" /> มีห้องเก็บและอาคารที่รองรับ
      </p>
    </div>
    <div className="w-11 h-11 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
      <Layers className="h-5 w-5" />
    </div>
  </div>
</div>
```

- [ ] **Step 3: Test build/typecheck**

Run: `npm run typecheck`
Expected: PASS with 0 errors.

- [ ] **Step 4: Commit**

```bash
git add app/\(dashboard\)/dashboard/page.tsx
git commit -m "refactor(dashboard): modernize header control strip and metrics bento grid"
```

---

### Task 2: Refactor Donut Chart, Category Bars, and Low Stock Panel

**Files:**
- Modify: `app/(dashboard)/dashboard/page.tsx:173-348`

**Interfaces:**
- Consumes: `stats`, `formattedLowStock`, `categoryEntries`, `activePct`, `sparePct`, `damagedPct`, `otherPct`
- Produces: Refactored Data Visualizations & Accessible Low Stock Panel

- [ ] **Step 1: Inspect remaining panels in page.tsx**

Inspect lines 173 to 348 in `app/(dashboard)/dashboard/page.tsx`.

- [ ] **Step 2: Update SVG Donut Chart, Category Progress Bars, and Low Stock Panel**

Replace lines 173-345 with:
```tsx
{/* Main Charts and Status Section */}
<div className="grid w-full grid-cols-1 lg:grid-cols-3 gap-6">
  
  {/* Status Breakdown SVG Donut chart */}
  <div className="bg-card text-card-foreground p-5 rounded-xl border border-border shadow-2xs flex flex-col justify-between">
    <div>
      <h3 className="font-bold text-sm mb-0.5">สัดส่วนตามสภาพการใช้งาน (Status)</h3>
      <p className="text-xs text-muted-foreground mb-3">ปริมาณจำนวนพัสดุแบ่งแยกตามสถานะการครอบครองและการใช้งาน</p>
    </div>
    
    {/* SVG Donut Chart */}
    <div className="relative py-3 flex items-center justify-center">
      <svg viewBox="0 0 120 120" className="w-36 h-36" role="img" aria-label="กราฟแสดงสัดส่วนพัสดุตามสภาพการใช้งาน">
        {/* Background Track */}
        <circle cx="60" cy="60" r="50" fill="transparent" stroke="var(--muted, #f1f5f9)" strokeWidth="12" />
        {/* Active segment */}
        <circle
          cx="60"
          cy="60"
          r="50"
          fill="transparent"
          stroke="#10b981"
          strokeWidth="12"
          strokeDasharray={`${dash1} ${circ - dash1}`}
          strokeDashoffset={0}
          transform="rotate(-90 60 60)"
          className="transition-all duration-300 hover:stroke-[15] cursor-pointer"
        />
        {/* Spare segment */}
        <circle
          cx="60"
          cy="60"
          r="50"
          fill="transparent"
          stroke="#3b82f6"
          strokeWidth="12"
          strokeDasharray={`${dash2} ${circ - dash2}`}
          strokeDashoffset={-dash1}
          transform="rotate(-90 60 60)"
          className="transition-all duration-300 hover:stroke-[15] cursor-pointer"
        />
        {/* Damaged segment */}
        <circle
          cx="60"
          cy="60"
          r="50"
          fill="transparent"
          stroke="#f43f5e"
          strokeWidth="12"
          strokeDasharray={`${dash3} ${circ - dash3}`}
          strokeDashoffset={-(dash1 + dash2)}
          transform="rotate(-90 60 60)"
          className="transition-all duration-300 hover:stroke-[15] cursor-pointer"
        />
        {/* Other segment */}
        <circle
          cx="60"
          cy="60"
          r="50"
          fill="transparent"
          stroke="#94a3b8"
          strokeWidth="12"
          strokeDasharray={`${dash4} ${circ - dash4}`}
          strokeDashoffset={-(dash1 + dash2 + dash3)}
          transform="rotate(-90 60 60)"
          className="transition-all duration-300 hover:stroke-[15] cursor-pointer"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none mt-1">
        <span className="text-xl font-bold">{stats.totalQuantity}</span>
        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider leading-none">ชิ้นงานรวม</span>
      </div>
    </div>

    <div className="grid grid-cols-2 gap-2 mt-3 text-xs font-medium text-muted-foreground">
      <div className="flex items-center gap-1.5">
        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0"></span>
        <span className="truncate">ใช้งานปกติ ({Math.round(activePct)}%)</span>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="w-2.5 h-2.5 rounded-full bg-blue-500 shrink-0"></span>
        <span className="truncate">สำรองในคลัง ({Math.round(sparePct)}%)</span>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shrink-0"></span>
        <span className="truncate">ชำรุด/ส่งซ่อม ({Math.round(damagedPct)}%)</span>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="w-2.5 h-2.5 rounded-full bg-slate-400 shrink-0"></span>
        <span className="truncate">อื่นๆ/จำหน่าย ({Math.round(otherPct)}%)</span>
      </div>
    </div>
  </div>

  {/* Category breakdown progress list */}
  <div className="bg-card text-card-foreground p-5 rounded-xl border border-border shadow-2xs flex flex-col justify-between">
    <div>
      <h3 className="font-bold text-sm mb-0.5">สถิติตามประเภทสิ่งของ (Category)</h3>
      <p className="text-xs text-muted-foreground mb-4">จำแนกปริมาณพัสดุและครุภัณฑ์แยกตามหมวดหมู่หลักในปัจจุบัน</p>
    </div>
    
    <div className="relative flex-1 flex flex-col justify-center min-h-[180px]">
      <div className="space-y-3.5 max-h-[220px] overflow-y-auto pr-1">
        {categoryEntries.map(([cat, counts]) => {
          const count = counts.count
          const qty = counts.qty
          const pct = Math.round((qty / totalQty) * 100) || 0
          return (
            <div key={cat} className="group space-y-1">
              <div className="flex justify-between items-center text-xs font-medium">
                <span className="truncate max-w-[160px] text-card-foreground">{cat}</span>
                <span className="text-muted-foreground font-mono text-[11px]">{count} รายการ ({qty} ชิ้น | {pct}%)</span>
              </div>
              <div className="w-full h-2.5 bg-muted rounded-full overflow-hidden shadow-inner relative">
                <div
                  className="bg-primary h-full rounded-full transition-all duration-500 group-hover:bg-primary/90"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          )
        })}
        {Object.keys(stats.categoryCounts).length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-6">ไม่มีข้อมูลหมวดหมู่ในปัจจุบัน</p>
        )}
      </div>
    </div>
  </div>

  {/* Low stock alerts panel */}
  <div className="bg-card text-card-foreground p-5 rounded-xl border border-border shadow-2xs flex flex-col justify-between">
    <div>
      <h3 className="font-bold text-sm mb-0.5">พัสดุและวัสดุใกล้หมดคลัง (Low Stock)</h3>
      <p className="text-xs text-muted-foreground mb-4">รายการวัสดุและอุปกรณ์สิ้นเปลืองที่เหลือจำนวนต่ำกว่าเกณฑ์ควบคุม (≤ 5 ชิ้น)</p>
    </div>
    
    <div className="space-y-2.5 overflow-y-auto max-h-[220px] pr-1" tabIndex={0} aria-label="รายการวัสดุคงเหลือต่ำ">
      {formattedLowStock.map((item) => (
        <div key={item.id} className="flex items-center justify-between p-2.5 bg-amber-500/10 hover:bg-amber-500/15 border border-amber-500/20 rounded-lg transition-colors">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-md bg-amber-500/20 text-amber-700 dark:text-amber-300 flex items-center justify-center shrink-0">
              <Package className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs font-semibold text-card-foreground truncate max-w-[140px]">{item.item_name}</p>
              <p className="text-[11px] text-muted-foreground">{item.locationName}</p>
            </div>
          </div>
          <div className="text-right shrink-0">
            <p className="text-xs font-bold text-amber-700 dark:text-amber-300">{item.quantity} ชิ้น</p>
            <span className="inline-block text-[10px] font-semibold bg-amber-500/20 text-amber-800 dark:text-amber-200 px-1.5 py-0.5 rounded-full mt-0.5">ต่ำกว่าเกณฑ์</span>
          </div>
        </div>
      ))}

      {(!lowStockItems || lowStockItems.length === 0) && (
        <div className="flex flex-col items-center justify-center py-8 text-muted-foreground space-y-2">
          <CheckCircle className="w-8 h-8 text-emerald-500" />
          <p className="text-xs">ระดับสินค้าพัสดุทั้งหมดในคลังอยู่ในเกณฑ์ปกติ</p>
        </div>
      )}
    </div>
  </div>

</div>
```

- [ ] **Step 3: Verify TypeScript, ESLint, and Build**

Run:
`npm run typecheck`
`npm run lint`
`npm run build`

Expected: PASS with 0 errors across all commands.

- [ ] **Step 4: Commit**

```bash
git add app/\(dashboard\)/dashboard/page.tsx
git commit -m "refactor(dashboard): apply semantic tokens and accessible styling to charts and low stock panel"
```
