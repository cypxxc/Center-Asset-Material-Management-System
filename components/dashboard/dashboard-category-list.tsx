import dynamic from 'next/dynamic'
import { getReportStats } from '@/features/reports/queries'
import type { ReportCountBucket } from '@/features/reports/queries'
import type { StatusItemData } from '@/components/dashboard/status-donut-chart'

const StatusDonutChart = dynamic(
  () => import('@/components/dashboard/status-donut-chart').then((mod) => mod.StatusDonutChart),
  { loading: () => <div className="h-64 animate-pulse bg-muted rounded-xl" /> }
)

export async function DashboardCategoryList() {
  const stats = await getReportStats()

  const totalQty = stats.totalQuantity || 1
  const activeQty = stats.statusCounts.active?.qty || 0
  const spareQty = stats.statusCounts.spare?.qty || 0
  const damagedQty = (stats.statusCounts.damaged?.qty || 0) + (stats.statusCounts.waiting_repair?.qty || 0)
  const otherQty = (stats.statusCounts.inactive?.qty || 0) + (stats.statusCounts.disposed?.qty || 0)

  const activePct = (activeQty / totalQty) * 100
  const sparePct = (spareQty / totalQty) * 100
  const damagedPct = (damagedQty / totalQty) * 100
  const otherPct = (otherQty / totalQty) * 100

  const statusData: StatusItemData[] = [
    { key: 'active', label: 'ใช้งานปกติ', qty: activeQty, pct: activePct, color: '#10b981' },
    { key: 'spare', label: 'สำรองในคลัง', qty: spareQty, pct: sparePct, color: '#3b82f6' },
    { key: 'damaged', label: 'ชำรุด/ส่งซ่อม', qty: damagedQty, pct: damagedPct, color: '#f43f5e' },
    { key: 'other', label: 'อื่นๆ/จำหน่าย', qty: otherQty, pct: otherPct, color: '#94a3b8' },
  ]
  const categoryEntries = Object.entries(stats.categoryCounts) as [string, ReportCountBucket][]

  return (
    <>
      {/* Status Breakdown SVG Donut chart */}
      <div className="bg-card text-card-foreground p-5 rounded-xl border border-border shadow-2xs flex flex-col justify-between">
        <div>
          <h3 className="font-bold text-card-foreground text-sm mb-1">สัดส่วนตามสภาพการใช้งาน (Status)</h3>
          <p className="text-xs text-muted-foreground mb-4">ปริมาณจำนวนพัสดุแบ่งแยกตามสถานะการครอบครองและการใช้งาน</p>
        </div>
        
        <StatusDonutChart totalQuantity={stats.totalQuantity} statusData={statusData} />
      </div>

      {/* Category breakdown progress list */}
      <div className="bg-card text-card-foreground p-5 rounded-xl border border-border shadow-2xs flex flex-col justify-between">
        <div>
          <h3 className="font-bold text-card-foreground text-sm mb-1">สถิติตามประเภทสิ่งของ (Category)</h3>
          <p className="text-xs text-muted-foreground mb-4">จำแนกปริมาณพัสดุและครุภัณฑ์แยกตามหมวดหมู่หลักในปัจจุบัน</p>
        </div>
        
        <div className="flex-1 flex flex-col justify-center min-h-[180px]">
          <div className="space-y-3 max-h-[220px] overflow-y-auto pr-1">
            {categoryEntries.map(([cat, counts]) => {
              const count = counts.count
              const qty = counts.qty
              const pct = Math.round((qty / totalQty) * 100) || 0
              return (
                <div key={cat} className="group space-y-1">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-xs font-medium text-card-foreground truncate max-w-[150px]">{cat}</span>
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
    </>
  )
}

export function CategoryListSkeleton() {
  return (
    <>
      <div className="bg-card text-card-foreground p-5 rounded-xl border border-border shadow-2xs flex flex-col justify-between animate-pulse" data-testid="category-list-skeleton">
        <div>
          <div className="h-4 w-48 bg-muted rounded mb-2" />
          <div className="h-3 w-64 bg-muted rounded mb-4" />
        </div>
        <div className="h-52 bg-muted rounded-lg w-full mt-4" />
      </div>

      <div className="bg-card text-card-foreground p-5 rounded-xl border border-border shadow-2xs flex flex-col justify-between animate-pulse">
        <div>
          <div className="h-4 w-48 bg-muted rounded mb-2" />
          <div className="h-3 w-64 bg-muted rounded mb-4" />
        </div>
        <div className="space-y-3 mt-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="space-y-1">
              <div className="flex justify-between">
                <div className="h-3 w-24 bg-muted rounded" />
                <div className="h-3 w-16 bg-muted rounded" />
              </div>
              <div className="h-2.5 w-full bg-muted rounded-full" />
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
