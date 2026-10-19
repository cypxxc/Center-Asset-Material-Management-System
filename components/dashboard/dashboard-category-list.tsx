import dynamic from 'next/dynamic'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { getReportStats } from '@/features/reports/queries'
import { getItemReferences } from '@/features/items/queries'
import type { StatusItemData } from '@/components/dashboard/status-donut-chart'

const StatusDonutChart = dynamic(
  () => import('@/components/dashboard/status-donut-chart').then((mod) => mod.StatusDonutChart),
  {
    loading: () => (
      <div className="flex flex-col justify-between h-full animate-pulse">
        <div className="relative py-4 flex items-center justify-center">
          <div className="w-36 h-36 rounded-full border-[14px] border-muted" />
        </div>
        <div className="grid grid-cols-2 gap-2 mt-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-8 bg-muted/60 rounded-lg" />
          ))}
        </div>
      </div>
    ),
  }
)

export async function DashboardCategoryList() {
  const [stats, references] = await Promise.all([
    getReportStats(),
    getItemReferences(),
  ])

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

  const categoryMap = new Map<string, { id: string; color?: string | null }>()
  for (const cat of references.categories) {
    categoryMap.set(cat.name, { id: cat.id, color: cat.color })
  }

  const categoryEntries = Object.entries(stats.categoryCounts)

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
              const meta = categoryMap.get(cat)
              const catId = meta?.id
              const catColor = meta?.color || '#3b82f6'
              const href = catId ? `/items?category_id=${catId}` : '/items'

              return (
                <Link
                  key={cat}
                  href={href}
                  title={`ดูรายการพัสดุหมวดหมู่ ${cat}`}
                  className="group block space-y-1.5 p-1.5 -mx-1.5 rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex justify-between items-center text-xs">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: catColor }}
                        aria-hidden="true"
                      />
                      <span className="text-xs font-medium text-card-foreground truncate group-hover:text-primary transition-colors max-w-[150px]">
                        {cat}
                      </span>
                      <ChevronRight className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0 -ml-0.5" />
                    </div>
                    <span className="text-muted-foreground font-mono text-[11px] tabular-nums shrink-0">
                      {count} รายการ ({qty.toLocaleString()} ชิ้น | {pct}%)
                    </span>
                  </div>
                  <div className="w-full h-2 bg-muted rounded-full overflow-hidden shadow-inner relative">
                    <div
                      className="h-full rounded-full transition-all duration-500 group-hover:opacity-90"
                      style={{ width: `${pct}%`, backgroundColor: catColor }}
                    />
                  </div>
                </Link>
              )
            })}
            {categoryEntries.length === 0 && (
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
      <div
        className="bg-card text-card-foreground p-5 rounded-xl border border-border shadow-2xs flex flex-col justify-between animate-pulse"
        data-testid="category-list-skeleton"
      >
        <div>
          <div className="h-4 w-48 bg-muted rounded mb-2" />
          <div className="h-3 w-64 bg-muted rounded mb-4" />
        </div>
        <div className="relative py-4 flex items-center justify-center">
          <div className="w-36 h-36 rounded-full border-[14px] border-muted" />
        </div>
        <div className="grid grid-cols-2 gap-2 mt-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-8 bg-muted/60 rounded-lg" />
          ))}
        </div>
      </div>

      <div className="bg-card text-card-foreground p-5 rounded-xl border border-border shadow-2xs flex flex-col justify-between animate-pulse">
        <div>
          <div className="h-4 w-48 bg-muted rounded mb-2" />
          <div className="h-3 w-64 bg-muted rounded mb-4" />
        </div>
        <div className="flex-1 flex flex-col justify-center min-h-[180px]">
          <div className="space-y-3 max-h-[220px] overflow-y-auto pr-1">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="space-y-1.5 p-1.5">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-muted shrink-0" />
                    <div className="h-3 w-24 bg-muted rounded" />
                  </div>
                  <div className="h-3 w-24 bg-muted rounded" />
                </div>
                <div className="h-2 w-full bg-muted rounded-full" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  )
}
