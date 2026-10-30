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
    <div className="w-full rounded-2xl border border-border/80 bg-card dark:bg-card/90 backdrop-blur-xs shadow-2xs divide-y lg:divide-y-0 lg:divide-x divide-border/60 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 overflow-hidden">
      {/* 1. Valuation Summary */}
      <div className="p-4 sm:p-5 flex flex-col justify-between gap-3 transition-colors hover:bg-muted/15">
        <div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs sm:text-sm font-medium text-muted-foreground">มูลค่าสินทรัพย์รวม</span>
            <div className="size-7 shrink-0 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 flex items-center justify-center">
              <Coins className="size-3.5" />
            </div>
          </div>
          <div className="mt-2">
            <h3 className="text-2xl sm:text-3xl font-extrabold tabular-nums tracking-tight text-foreground leading-none">
              ฿{totalValue.toLocaleString('th-TH')}
            </h3>
          </div>
        </div>
        <div className="flex items-center justify-between gap-2 pt-1 border-t border-border/30 text-xs text-muted-foreground">
          <p className="truncate">รวมครุภัณฑ์และพัสดุทั้งหมดในระบบ</p>
          <span className="text-[11px] font-mono font-medium text-muted-foreground/90 bg-muted/80 px-2 py-0.5 rounded-md border border-border/50 shrink-0">
            {stats.locationCount || 0} สถานที่
          </span>
        </div>
      </div>

      {/* 2. Total Items & Breakdown */}
      <div className="p-4 sm:p-5 flex flex-col justify-between gap-3 transition-colors hover:bg-muted/15">
        <div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs sm:text-sm font-medium text-muted-foreground">ครุภัณฑ์และพัสดุทั้งหมด</span>
            <div className="size-7 shrink-0 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center justify-center">
              <Package className="size-3.5" />
            </div>
          </div>
          <div className="mt-2">
            <h3 className="text-2xl sm:text-3xl font-extrabold tabular-nums tracking-tight text-foreground leading-none">
              {stats.totalItems.toLocaleString('th-TH')} รายการ
            </h3>
          </div>
        </div>
        <div className="space-y-1.5 pt-1 border-t border-border/30">
          <div className="w-full h-1.5 bg-muted/90 rounded-full overflow-hidden flex">
            <div
              className="bg-blue-600 dark:bg-blue-500 h-full transition-all duration-500"
              style={{ width: `${assetRatio}%` }}
              title={`ครุภัณฑ์ ${assetRatio.toFixed(1)}%`}
            />
            <div
              className="bg-emerald-600 dark:bg-emerald-500 h-full transition-all duration-500"
              style={{ width: `${materialRatio}%` }}
              title={`พัสดุ ${materialRatio.toFixed(1)}%`}
            />
          </div>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <p className="truncate">
              ครุภัณฑ์ {assetCount.toLocaleString('th-TH')} | พัสดุ {materialCount.toLocaleString('th-TH')}
            </p>
            <span className="text-[11px] font-mono font-medium text-muted-foreground/90 shrink-0">
              {stats.totalQuantity.toLocaleString('th-TH')} ชิ้น
            </span>
          </div>
        </div>
      </div>

      {/* 3. Operational Readiness */}
      <div className="p-4 sm:p-5 flex flex-col justify-between gap-3 transition-colors hover:bg-muted/15">
        <div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs sm:text-sm font-medium text-muted-foreground">ความพร้อมใช้งานของพัสดุ</span>
            <div className="size-7 shrink-0 rounded-lg bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20 flex items-center justify-center">
              <CheckCircle2 className="size-3.5" />
            </div>
          </div>
          <div className="mt-2">
            <h3 className="text-2xl sm:text-3xl font-extrabold tabular-nums tracking-tight text-foreground leading-none">
              {readinessPercentage.toFixed(1)}%
            </h3>
          </div>
        </div>
        <div className="flex items-center justify-between gap-2 pt-1 border-t border-border/30 text-xs text-muted-foreground">
          <p className="truncate">
            ใช้งานปกติ {activeCount.toLocaleString('th-TH')} | ชำรุด/ส่งซ่อม {damagedCount.toLocaleString('th-TH')}
          </p>
          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20 shrink-0">
            <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
            พร้อมใช้
          </span>
        </div>
      </div>

      {/* 4. Urgent Action */}
      <div className="p-4 sm:p-5 flex flex-col justify-between gap-3 bg-rose-500/[0.03] dark:bg-rose-500/[0.05] transition-colors hover:bg-rose-500/[0.07]">
        <div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs sm:text-sm font-medium text-muted-foreground">รายการเร่งด่วน</span>
            <div className="size-7 shrink-0 rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 flex items-center justify-center">
              <AlertTriangle className="size-3.5" />
            </div>
          </div>
          <div className="mt-2">
            <h3 className="text-2xl sm:text-3xl font-extrabold tabular-nums tracking-tight text-rose-600 dark:text-rose-400 leading-none">
              {urgentCount.toLocaleString('th-TH')} รายการ
            </h3>
          </div>
        </div>
        <div className="space-y-1 pt-1 border-t border-border/30">
          <p className="text-xs text-muted-foreground truncate">
            {damagedCount.toLocaleString('th-TH')} รายการรอซ่อม • {lowStockCount.toLocaleString('th-TH')} สต็อกต่ำ
          </p>
          <div className="flex items-center justify-between pt-0.5">
            <span className="text-[11px] text-rose-600/90 dark:text-rose-400/90 font-medium">
              ต้องดำเนินการ
            </span>
            <a
              href="#action-queue"
              className="text-xs font-semibold text-rose-600 dark:text-rose-400 hover:underline flex items-center gap-1 transition-transform hover:translate-x-0.5"
            >
              ตรวจสอบทันที ➔
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}

export { MetricsGridSkeleton } from './dashboard-skeletons'
