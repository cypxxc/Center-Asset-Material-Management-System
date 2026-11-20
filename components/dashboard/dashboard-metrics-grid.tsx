import { Coins, Package, CheckCircle2, AlertTriangle } from 'lucide-react'
import { getReportStats } from '@/features/reports/queries'
import { getLowStockItems, type LowStockDashboardItem } from '@/features/items/queries'
import type { ReportStats } from '@/features/reports/types'
import { TruncatedTextTooltip } from '@/components/ui/truncated-text-tooltip'

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
 const activeCount = (stats.statusCounts.active?.count || 0) + (stats.statusCounts.spare?.count || 0)
 const damagedCount = (stats.statusCounts.damaged?.count || 0) + (stats.statusCounts.waiting_repair?.count || 0)
 const lowStockCount = lowStockItems.length
 const urgentCount = damagedCount + lowStockCount
 const readinessPercentage = stats.totalItems > 0 ? (activeCount / stats.totalItems) * 100 : 100
 const assetRatio = stats.totalItems > 0 ? (assetCount / stats.totalItems) * 100 : 0
 const materialRatio = stats.totalItems > 0 ? (materialCount / stats.totalItems) * 100 : 0

 return (
 <div className="w-full grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
 {/* 1. Valuation Summary */}
 <div className="group relative rounded-xl border border-border bg-card p-5 shadow-2xs hover:border-border/90 transition-colors flex flex-col justify-between">
 <div>
 <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
 <h2 className="flex items-center gap-1.5 font-semibold text-foreground/85 text-xs">
 <Coins className="size-3.5 text-muted-foreground transition-colors" />
 มูลค่าสินทรัพย์รวม
 </h2>
 <span className="text-[11px] font-mono font-medium text-muted-foreground/90 bg-muted/80 px-2 py-0.5 rounded-md border border-border/60">
 {stats.locationCount || 0} สถานที่
 </span>
 </div>
 <div className="mt-3">
 <p className="text-3xl font-bold font-mono tabular-nums tracking-tight text-foreground leading-none">
 ฿{totalValue.toLocaleString('th-TH')}
 </p>
 </div>
 </div>
 <TruncatedTextTooltip
 text="รวมครุภัณฑ์และวัสดุทั้งหมดในระบบ"
 as="p"
 className="mt-4 pt-3 border-t border-border/50 text-xs text-muted-foreground truncate"
 />
 </div>

 {/* 2. Total Items & Breakdown */}
 <div className="group relative rounded-xl border border-border bg-card p-5 shadow-2xs hover:border-border/90 transition-colors flex flex-col justify-between">
 <div>
 <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
 <h2 className="flex items-center gap-1.5 font-semibold text-foreground/85 text-xs">
 <Package className="size-3.5 text-muted-foreground transition-colors" />
 ครุภัณฑ์และวัสดุทั้งหมด
 </h2>
 <span className="text-[11px] font-mono font-medium text-muted-foreground/90 bg-muted/80 px-2 py-0.5 rounded-md border border-border/60">
 {stats.totalQuantity.toLocaleString('th-TH')} ชิ้น
 </span>
 </div>
 <div className="mt-3">
 <p className="text-3xl font-bold font-mono tabular-nums tracking-tight text-foreground leading-none">
 {stats.totalItems.toLocaleString('th-TH')} รายการ
 </p>
 </div>
 </div>
 <div className="mt-4 pt-3 border-t border-border/50 space-y-1.5">
 <div
 role="progressbar"
 aria-label="สัดส่วนครุภัณฑ์และวัสดุ"
 aria-valuenow={Math.round(assetRatio)}
 aria-valuemin={0}
 aria-valuemax={100}
 className="w-full h-1.5 bg-muted rounded-full overflow-hidden flex"
 >
 <div
 className="bg-blue-600 dark:bg-blue-500 h-full transition-all duration-500"
 style={{ width: `${assetRatio}%` }}
 title={`ครุภัณฑ์ ${assetRatio.toFixed(1)}%`}
 />
 <div
 className="bg-violet-600 dark:bg-violet-500 h-full transition-all duration-500"
 style={{ width: `${materialRatio}%` }}
 title={`วัสดุ ${materialRatio.toFixed(1)}%`}
 />
 </div>
 <TruncatedTextTooltip
 text={`ครุภัณฑ์ ${assetCount.toLocaleString('th-TH')} | วัสดุ ${materialCount.toLocaleString('th-TH')}`}
 as="p"
 className="text-xs text-muted-foreground truncate"
 />
 </div>
 </div>

 {/* 3. Operational Readiness */}
 <div className="group relative rounded-xl border border-border bg-card p-5 shadow-2xs hover:border-border/90 transition-colors flex flex-col justify-between">
 <div>
 <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
 <h2 className="flex items-center gap-1.5 font-semibold text-foreground/85 text-xs">
 <CheckCircle2 className="size-3.5 text-emerald-500" />
 ความพร้อมใช้งานของวัสดุ
 </h2>
 <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
 <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
 พร้อมใช้
 </span>
 </div>
 <div className="mt-3">
 <p className="text-3xl font-bold font-mono tabular-nums tracking-tight text-foreground leading-none">
 {readinessPercentage.toFixed(1)}%
 </p>
 </div>
 </div>
 <TruncatedTextTooltip
 text={`ใช้งานปกติ ${activeCount.toLocaleString('th-TH')} | ชำรุด/ส่งซ่อม ${damagedCount.toLocaleString('th-TH')}`}
 as="p"
 className="mt-4 pt-3 border-t border-border/50 text-xs text-muted-foreground truncate"
 />
 </div>

 {/* 4. Urgent Action */}
 <div className="group relative rounded-xl border border-border bg-card p-5 shadow-2xs hover:border-border/90 transition-colors flex flex-col justify-between">
 <div>
 <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
 <h2 className="flex items-center gap-1.5 font-semibold text-foreground/85 text-xs">
 <AlertTriangle className="size-3.5 text-rose-500" />
 รายการเร่งด่วน
 </h2>
 <span className="text-[11px] text-rose-700 dark:text-rose-400 font-semibold bg-rose-500/10 px-2 py-0.5 rounded-full border border-rose-500/20">
 ต้องดำเนินการ
 </span>
 </div>
 <div className="mt-3">
 <p className="text-3xl font-bold font-mono tabular-nums tracking-tight text-rose-600 dark:text-rose-500 leading-none">
 {urgentCount.toLocaleString('th-TH')} รายการ
 </p>
 </div>
 </div>
 <div className="mt-4 pt-3 border-t border-border/50 flex items-center justify-between gap-2">
 <TruncatedTextTooltip
 text={`${damagedCount.toLocaleString('th-TH')} รายการรอซ่อม • ${lowStockCount.toLocaleString('th-TH')} สต็อกต่ำ`}
 as="p"
 className="text-xs text-muted-foreground truncate"
 />
 <a
 href="#action-queue"
 aria-label="ตรวจสอบรายการเร่งด่วนทันที ไปยังคิวงาน"
 className="text-xs font-semibold text-rose-600 dark:text-rose-400 hover:underline flex items-center gap-1 shrink-0"
 >
 <span>ตรวจสอบทันที</span>
 <span aria-hidden="true"> ➔</span>
 </a>
 </div>
 </div>
 </div>
 )
}

export { MetricsGridSkeleton } from './dashboard-skeletons'
