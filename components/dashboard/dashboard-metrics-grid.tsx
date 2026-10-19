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
    <div className="grid w-full grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* 1. Valuation Card */}
      <div className="bg-card text-card-foreground p-5 rounded-xl border border-border shadow-2xs flex flex-col justify-between gap-3">
        <div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-medium text-muted-foreground">มูลค่าสินทรัพย์รวม</span>
            <div className="w-10 h-10 shrink-0 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <Coins className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-2">
            <h3 className="text-2xl font-bold tabular-nums tracking-tight text-card-foreground">
              ฿{totalValue.toLocaleString('th-TH')}
            </h3>
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          รวมครุภัณฑ์และวัสดุทั้งหมดในระบบ
        </p>
      </div>

      {/* 2. Composition Card */}
      <div className="bg-card text-card-foreground p-5 rounded-xl border border-border shadow-2xs flex flex-col justify-between gap-3">
        <div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-medium text-muted-foreground">พัสดุและวัสดุทั้งหมด</span>
            <div className="w-10 h-10 shrink-0 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <Package className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-2">
            <h3 className="text-2xl font-bold tabular-nums tracking-tight text-card-foreground">
              {stats.totalItems.toLocaleString('th-TH')} รายการ
            </h3>
          </div>
        </div>
        <div className="space-y-1.5 mt-1">
          <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden flex">
            <div
              className="bg-blue-500 h-full transition-all duration-500"
              style={{ width: `${assetRatio}%` }}
              title={`ครุภัณฑ์ ${assetRatio.toFixed(1)}%`}
            />
            <div
              className="bg-emerald-500 h-full transition-all duration-500"
              style={{ width: `${materialRatio}%` }}
              title={`วัสดุ ${materialRatio.toFixed(1)}%`}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            ครุภัณฑ์ {assetCount.toLocaleString('th-TH')} | วัสดุ {materialCount.toLocaleString('th-TH')}
          </p>
        </div>
      </div>

      {/* 3. Readiness Card */}
      <div className="bg-card text-card-foreground p-5 rounded-xl border border-border shadow-2xs flex flex-col justify-between gap-3">
        <div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-medium text-muted-foreground">ความพร้อมใช้งานของพัสดุ</span>
            <div className="w-10 h-10 shrink-0 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <CheckCircle2 className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-2">
            <h3 className="text-2xl font-bold tabular-nums tracking-tight text-card-foreground">
              {readinessPercentage.toFixed(1)}%
            </h3>
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          ใช้งานปกติ {activeCount.toLocaleString('th-TH')} | ชำรุด/ส่งซ่อม {damagedCount.toLocaleString('th-TH')}
        </p>
      </div>

      {/* 4. Urgent Action Card */}
      <div className="bg-card text-card-foreground p-5 rounded-xl border border-border shadow-2xs flex flex-col justify-between gap-3">
        <div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-medium text-muted-foreground">รายการเร่งด่วน</span>
            <div className="w-10 h-10 shrink-0 rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center">
              <AlertTriangle className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-2">
            <h3 className="text-2xl font-bold tabular-nums tracking-tight text-rose-600 dark:text-rose-400">
              {urgentCount.toLocaleString('th-TH')} รายการ
            </h3>
          </div>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">
            {damagedCount.toLocaleString('th-TH')} รายการรอซ่อม • {lowStockCount.toLocaleString('th-TH')} สต็อกต่ำ
          </p>
          <a
            href="#action-queue"
            className="text-xs font-semibold text-rose-600 dark:text-rose-400 hover:underline flex items-center gap-1 mt-1"
          >
            ตรวจสอบทันที ➔
          </a>
        </div>
      </div>
    </div>
  )
}

export function MetricsGridSkeleton() {
  return (
    <div className="grid w-full grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" data-testid="metrics-grid-skeleton">
      {[1, 2, 3, 4].map((i) => (
        <div
          key={i}
          className="bg-card p-5 rounded-xl border border-border shadow-2xs flex flex-col justify-between gap-3 animate-pulse"
        >
          <div>
            <div className="flex items-center justify-between gap-3">
              <div className="h-4 w-28 bg-muted rounded" />
              <div className="w-10 h-10 shrink-0 rounded-lg bg-muted" />
            </div>
            <div className="mt-2">
              <div className="h-8 w-32 bg-muted rounded" />
            </div>
          </div>
          <div className="h-4 w-36 bg-muted rounded mt-1" />
        </div>
      ))}
    </div>
  )
}
