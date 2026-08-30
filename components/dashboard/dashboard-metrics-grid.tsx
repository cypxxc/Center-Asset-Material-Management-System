import { 
  Package, 
  ClipboardList, 
  AlertTriangle, 
  Layers, 
  CheckCircle, 
  Hammer, 
  FolderOpen,
  MapPin
} from 'lucide-react'
import { getReportStats } from '@/features/reports/queries'

export async function DashboardMetricsGrid() {
  const stats = await getReportStats()

  const activeCount = stats.statusCounts.active?.count || 0
  const totalAssets = stats.typeCounts.asset?.count || 0
  const damagedCount = (stats.statusCounts.damaged?.count || 0) + (stats.statusCounts.waiting_repair?.count || 0)

  return (
    <div className="grid w-full grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Metric 1 */}
      <div className="bg-card text-card-foreground p-5 rounded-xl border border-border shadow-2xs flex items-center justify-between hover:shadow-xs transition-all">
        <div className="space-y-1">
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">ครุภัณฑ์ทั้งหมด (Assets)</p>
          <h3 className="text-2xl font-bold text-card-foreground">{totalAssets} รายการ</h3>
          <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400 flex items-center gap-1 mt-1">
            <CheckCircle className="w-3 h-3" /> ใช้งานอยู่ปกติ {activeCount} รายการ
          </p>
        </div>
        <div className="w-12 h-12 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
          <Package className="h-6 w-6" />
        </div>
      </div>

      {/* Metric 2 */}
      <div className="bg-card text-card-foreground p-5 rounded-xl border border-border shadow-2xs flex items-center justify-between hover:shadow-xs transition-all">
        <div className="space-y-1">
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">วัสดุและอุปกรณ์รวม</p>
          <h3 className="text-2xl font-bold text-card-foreground">{stats.totalQuantity} ชิ้น</h3>
          <p className="text-xs font-medium text-muted-foreground flex items-center gap-1 mt-1">
            <FolderOpen className="w-3 h-3 text-muted-foreground" /> จากสิ่งของทั้งหมด {stats.totalItems} รายการ
          </p>
        </div>
        <div className="w-12 h-12 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
          <ClipboardList className="h-6 w-6" />
        </div>
      </div>

      {/* Metric 3 */}
      <div className="bg-card text-card-foreground p-5 rounded-xl border border-border shadow-2xs flex items-center justify-between hover:shadow-xs transition-all">
        <div className="space-y-1">
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">ชำรุด/รอซ่อมบำรุง</p>
          <h3 className="text-2xl font-bold text-rose-600 dark:text-rose-400">{damagedCount} รายการ</h3>
          <p className="text-xs font-medium text-rose-600 dark:text-rose-400 flex items-center gap-1 mt-1">
            <Hammer className="w-3 h-3" /> รอการดำเนินการแก้ไขส่งซ่อม
          </p>
        </div>
        <div className="w-12 h-12 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center">
          <AlertTriangle className="h-6 w-6" />
        </div>
      </div>

      {/* Metric 4 */}
      <div className="bg-card text-card-foreground p-5 rounded-xl border border-border shadow-2xs flex items-center justify-between hover:shadow-xs transition-all">
        <div className="space-y-1">
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">สถานที่ตั้งเก็บรักษา</p>
          <h3 className="text-2xl font-bold text-card-foreground">{stats.locationCount} โซน</h3>
          <p className="text-xs font-medium text-muted-foreground flex items-center gap-1 mt-1">
            <MapPin className="w-3 h-3 text-muted-foreground" /> มีห้องเก็บและอาคารที่รองรับ
          </p>
        </div>
        <div className="w-12 h-12 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
          <Layers className="h-6 w-6" />
        </div>
      </div>
    </div>
  )
}

export function MetricsGridSkeleton() {
  return (
    <div className="grid w-full grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" data-testid="metrics-grid-skeleton">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="bg-card p-5 rounded-xl border border-border shadow-2xs flex items-center justify-between animate-pulse">
          <div className="space-y-2 flex-1">
            <div className="h-3 w-28 bg-muted rounded" />
            <div className="h-7 w-20 bg-muted rounded" />
            <div className="h-3 w-36 bg-muted rounded" />
          </div>
          <div className="w-12 h-12 rounded-xl bg-muted shrink-0" />
        </div>
      ))}
    </div>
  )
}
