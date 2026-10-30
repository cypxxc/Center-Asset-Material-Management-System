import { Coins, Package, CheckCircle2, AlertTriangle } from 'lucide-react'
import { getReportStats } from '@/features/reports/queries'
import { getLowStockItems, type LowStockDashboardItem } from '@/features/items/queries'
import type { ReportStats } from '@/features/reports/types'

export interface DashboardMetricsGridProps {
  stats?: ReportStats
  lowStockItems?: LowStockDashboardItem[]
}

export async function DashboardMetricsGrid(props: DashboardMetricsGridProps = {}) {
  const [stats, lowStockItems] = await Promise.all([
    props.stats ? Promise.resolve(props.stats) : getReportStats(),
    props.lowStockItems ? Promise.resolve(props.lowStockItems) : getLowStockItems(5),
  ])

  const totalValue = stats.totalValue || 0
  const assetCount = stats.typeCounts.asset?.count || 0
  const materialCount = stats.typeCounts.material?.count || 0
  const activeCount = stats.statusCounts.active?.count || 0
  const damagedCount = (stats.statusCounts.damaged?.count || 0) + (stats.statusCounts.waiting_repair?.count || 0)
  const lowStockCount = lowStockItems.length
  const urgentCount = damagedCount + lowStockCount
  const readinessPercentage = stats.totalItems > 0 ? (activeCount / stats.totalItems) * 100 : 100
  const assetRatio = stats.totalItems > 0 ? (assetCount / stats.totalItems) * 100 : 0
  const materialRatio = stats.totalItems > 0 ? (materialCount / stats.totalItems) * 100 : 0

  return (
    <div className="w-full grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* 1. Valuation Summary */}
      <div className="group relative rounded-2xl border border-border/80 bg-card p-5 shadow-2xs hover:shadow-xs hover:border-border transition-all duration-200 flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
            <span className="flex items-center gap-1.5 font-semibold text-foreground/85">
              <Coins className="size-3.5 text-muted-foreground/70 group-hover:text-primary transition-colors" />
              มูลค่าสินทรัพย์รวม
            </span>
            <span className="text-[11px] font-mono font-medium text-muted-foreground/90 bg-muted/80 px-2 py-0.5 rounded-md border border-border/60">
              {stats.locationCount || 0} สถานที่
            </span>
          </div>
          <div className="mt-3">
            <h3 className="text-3xl font-extrabold tabular-nums tracking-tight text-foreground leading-none">
              ฿{totalValue.toLocaleString('th-TH')}
            </h3>
          </div>
        </div>
        <p className="mt-4 pt-3 border-t border-border/40 text-xs text-muted-foreground truncate">
          รวมครุภัณฑ์และพัสดุทั้งหมดในระบบ
        </p>
      </div>

      {/* 2. Total Items & Breakdown */}
      <div className="group relative rounded-2xl border border-border/80 bg-card p-5 shadow-2xs hover:shadow-xs hover:border-border transition-all duration-200 flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
            <span className="flex items-center gap-1.5 font-semibold text-foreground/85">
              <Package className="size-3.5 text-muted-foreground/70 group-hover:text-primary transition-colors" />
              ครุภัณฑ์และพัสดุทั้งหมด
            </span>
            <span className="text-[11px] font-mono font-medium text-muted-foreground/90 bg-muted/80 px-2 py-0.5 rounded-md border border-border/60">
              {stats.totalQuantity.toLocaleString('th-TH')} ชิ้น
            </span>
          </div>
          <div className="mt-3">
            <h3 className="text-3xl font-extrabold tabular-nums tracking-tight text-foreground leading-none">
              {stats.totalItems.toLocaleString('th-TH')} รายการ
            </h3>
          </div>
        </div>
        <div className="mt-4 pt-3 border-t border-border/40 space-y-1.5">
          <div className="w-full h-1.5 bg-muted/90 rounded-full overflow-hidden flex">
            <div
              className="bg-primary h-full transition-all duration-500"
              style={{ width: `${assetRatio}%` }}
              title={`ครุภัณฑ์ ${assetRatio.toFixed(1)}%`}
            />
            <div
              className="bg-emerald-500 h-full transition-all duration-500"
              style={{ width: `${materialRatio}%` }}
              title={`พัสดุ ${materialRatio.toFixed(1)}%`}
            />
          </div>
          <p className="text-xs text-muted-foreground truncate">
            ครุภัณฑ์ {assetCount.toLocaleString('th-TH')} | พัสดุ {materialCount.toLocaleString('th-TH')}
          </p>
        </div>
      </div>

      {/* 3. Operational Readiness */}
      <div className="group relative rounded-2xl border border-border/80 bg-card p-5 shadow-2xs hover:shadow-xs hover:border-border transition-all duration-200 flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
            <span className="flex items-center gap-1.5 font-semibold text-foreground/85">
              <CheckCircle2 className="size-3.5 text-emerald-500" />
              ความพร้อมใช้งานของพัสดุ
            </span>
            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
              <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
              พร้อมใช้
            </span>
          </div>
          <div className="mt-3">
            <h3 className="text-3xl font-extrabold tabular-nums tracking-tight text-foreground leading-none">
              {readinessPercentage.toFixed(1)}%
            </h3>
          </div>
        </div>
        <p className="mt-4 pt-3 border-t border-border/40 text-xs text-muted-foreground truncate">
          ใช้งานปกติ {activeCount.toLocaleString('th-TH')} | ชำรุด/ส่งซ่อม {damagedCount.toLocaleString('th-TH')}
        </p>
      </div>

      {/* 4. Urgent Action */}
      <div className="group relative rounded-2xl border border-rose-500/30 bg-rose-500/[0.02] dark:bg-rose-500/[0.04] p-5 shadow-2xs hover:shadow-xs hover:border-rose-500/50 transition-all duration-200 flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
            <span className="flex items-center gap-1.5 font-semibold text-rose-600 dark:text-rose-400">
              <AlertTriangle className="size-3.5 text-rose-500" />
              รายการเร่งด่วน
            </span>
            <span className="text-[11px] text-rose-600 dark:text-rose-400 font-semibold bg-rose-500/10 px-2 py-0.5 rounded-full border border-rose-500/20">
              ต้องดำเนินการ
            </span>
          </div>
          <div className="mt-3">
            <h3 className="text-3xl font-extrabold tabular-nums tracking-tight text-rose-600 dark:text-rose-400 leading-none">
              {urgentCount.toLocaleString('th-TH')} รายการ
            </h3>
          </div>
        </div>
        <div className="mt-4 pt-3 border-t border-rose-500/20 flex items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground truncate">
            {damagedCount.toLocaleString('th-TH')} รายการรอซ่อม • {lowStockCount.toLocaleString('th-TH')} สต็อกต่ำ
          </p>
          <a
            href="#action-queue"
            className="text-xs font-semibold text-rose-600 dark:text-rose-400 hover:underline flex items-center gap-1 shrink-0"
          >
            ตรวจสอบทันที ➔
          </a>
        </div>
      </div>
    </div>
  )
}

export { MetricsGridSkeleton } from './dashboard-skeletons'
