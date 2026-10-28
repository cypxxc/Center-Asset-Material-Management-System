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
    <div className="w-full rounded-xl border border-border/70 bg-card/60 dark:bg-card/40 backdrop-blur-xs shadow-2xs divide-y lg:divide-y-0 lg:divide-x divide-border/60 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
      {/* 1. Valuation Summary */}
      <div className="p-4 sm:p-4.5 flex flex-col justify-between gap-2.5 transition-colors hover:bg-muted/20">
        <div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs sm:text-sm font-medium text-muted-foreground">มูลค่าสินทรัพย์รวม</span>
            <div className="w-7 h-7 shrink-0 rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 flex items-center justify-center">
              <Coins className="h-3.5 w-3.5" />
            </div>
          </div>
          <div className="mt-1">
            <h3 className="text-xl sm:text-2xl font-bold tabular-nums tracking-tight text-card-foreground">
              ฿{totalValue.toLocaleString('th-TH')}
            </h3>
          </div>
        </div>
        <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
          <p className="truncate">รวมครุภัณฑ์และพัสดุทั้งหมดในระบบ</p>
          <span className="text-[11px] font-mono text-muted-foreground/80 bg-muted/60 px-1.5 py-0.5 rounded border border-border/40 shrink-0">
            {stats.locationCount || 0} สถานที่
          </span>
        </div>
      </div>

      {/* 2. Total Items & Breakdown */}
      <div className="p-4 sm:p-4.5 flex flex-col justify-between gap-2.5 transition-colors hover:bg-muted/20">
        <div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs sm:text-sm font-medium text-muted-foreground">ครุภัณฑ์และพัสดุทั้งหมด</span>
            <div className="w-7 h-7 shrink-0 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center justify-center">
              <Package className="h-3.5 w-3.5" />
            </div>
          </div>
          <div className="mt-1">
            <h3 className="text-xl sm:text-2xl font-bold tabular-nums tracking-tight text-card-foreground">
              {stats.totalItems.toLocaleString('th-TH')} รายการ
            </h3>
          </div>
        </div>
        <div className="space-y-1">
          <div className="w-full h-1.5 bg-muted/80 rounded-full overflow-hidden flex shadow-2xs">
            <div
              className="bg-blue-500 h-full transition-all duration-500"
              style={{ width: `${assetRatio}%` }}
              title={`ครุภัณฑ์ ${assetRatio.toFixed(1)}%`}
            />
            <div
              className="bg-emerald-500 h-full transition-all duration-500"
              style={{ width: `${materialRatio}%` }}
              title={`พัสดุ ${materialRatio.toFixed(1)}%`}
            />
          </div>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <p className="truncate">
              ครุภัณฑ์ {assetCount.toLocaleString('th-TH')} | พัสดุ {materialCount.toLocaleString('th-TH')}
            </p>
            <span className="text-[11px] font-mono text-muted-foreground/80 shrink-0">
              {stats.totalQuantity.toLocaleString('th-TH')} ชิ้น
            </span>
          </div>
        </div>
      </div>

      {/* 3. Operational Readiness */}
      <div className="p-4 sm:p-4.5 flex flex-col justify-between gap-2.5 transition-colors hover:bg-muted/20">
        <div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs sm:text-sm font-medium text-muted-foreground">ความพร้อมใช้งานของพัสดุ</span>
            <div className="w-7 h-7 shrink-0 rounded-md bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20 flex items-center justify-center">
              <CheckCircle2 className="h-3.5 w-3.5" />
            </div>
          </div>
          <div className="mt-1">
            <h3 className="text-xl sm:text-2xl font-bold tabular-nums tracking-tight text-card-foreground">
              {readinessPercentage.toFixed(1)}%
            </h3>
          </div>
        </div>
        <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
          <p className="truncate">
            ใช้งานปกติ {activeCount.toLocaleString('th-TH')} | ชำรุด/ส่งซ่อม {damagedCount.toLocaleString('th-TH')}
          </p>
          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded-full border border-emerald-500/20 shrink-0">
            <span className="size-1.5 rounded-full bg-emerald-500" />
            พร้อมใช้
          </span>
        </div>
      </div>

      {/* 4. Urgent Action */}
      <div className="p-4 sm:p-4.5 flex flex-col justify-between gap-2.5 bg-rose-500/[0.02] dark:bg-rose-500/[0.04] transition-colors hover:bg-rose-500/[0.05]">
        <div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs sm:text-sm font-medium text-muted-foreground">รายการเร่งด่วน</span>
            <div className="w-7 h-7 shrink-0 rounded-md bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 flex items-center justify-center">
              <AlertTriangle className="h-3.5 w-3.5" />
            </div>
          </div>
          <div className="mt-1">
            <h3 className="text-xl sm:text-2xl font-bold tabular-nums tracking-tight text-rose-600 dark:text-rose-400">
              {urgentCount.toLocaleString('th-TH')} รายการ
            </h3>
          </div>
        </div>
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground truncate">
            {damagedCount.toLocaleString('th-TH')} รายการรอซ่อม • {lowStockCount.toLocaleString('th-TH')} สต็อกต่ำ
          </p>
          <div className="flex items-center justify-between pt-0.5">
            <span className="text-[11px] text-rose-600/80 dark:text-rose-400/80 font-medium">
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
