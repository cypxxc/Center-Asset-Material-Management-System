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
  const statusTotalQty = activeQty + spareQty + damagedQty + otherQty || totalQty

  const activePct = (activeQty / statusTotalQty) * 100
  const sparePct = (spareQty / statusTotalQty) * 100
  const damagedPct = (damagedQty / statusTotalQty) * 100
  const otherPct = (otherQty / statusTotalQty) * 100

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
    <div className="flex flex-col gap-4 sm:gap-5 h-full">
      {/* Status Breakdown Section */}
      <div className="overflow-hidden rounded-xl border border-border/70 bg-card/60 dark:bg-card/40 backdrop-blur-xs p-3.5 sm:p-4 shadow-2xs hover:border-border transition-colors flex flex-col justify-between">
        <div className="flex items-center justify-between pb-2.5 border-b border-border/40">
          <div>
            <h3 className="font-semibold text-card-foreground text-xs sm:text-sm tracking-tight">
              สัดส่วนตามสภาพการใช้งาน
            </h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              ปริมาณพัสดุแบ่งตามสถานะการครอบครอง
            </p>
          </div>
          <span className="text-[11px] font-mono font-medium text-muted-foreground/90 bg-muted/60 px-2 py-0.5 rounded border border-border/40 shrink-0">
            {statusTotalQty.toLocaleString()} ชิ้น
          </span>
        </div>

        <div className="pt-2">
          <StatusDonutChart totalQuantity={statusTotalQty} statusData={statusData} />
        </div>
      </div>

      {/* Category Breakdown Progress List */}
      <div className="overflow-hidden rounded-xl border border-border/70 bg-card/60 dark:bg-card/40 backdrop-blur-xs p-3.5 sm:p-4 shadow-2xs hover:border-border transition-colors flex flex-col justify-between flex-1">
        <div className="flex items-center justify-between pb-2.5 border-b border-border/40">
          <div>
            <h3 className="font-semibold text-card-foreground text-xs sm:text-sm tracking-tight">
              สถิติตามหมวดหมู่พัสดุ
            </h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              จำแนกปริมาณพัสดุแยกตามหมวดหมู่หลัก
            </p>
          </div>
          <span className="text-[11px] font-mono font-medium text-muted-foreground/90 bg-muted/60 px-2 py-0.5 rounded border border-border/40 shrink-0">
            {categoryEntries.length} หมวดหมู่
          </span>
        </div>

        <div className="flex-1 flex flex-col justify-center min-h-[140px] pt-2">
          <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
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
                  className="group block space-y-1 p-1 -mx-1 rounded-md hover:bg-muted/40 transition-colors"
                >
                  <div className="flex justify-between items-center text-xs">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span
                        className="w-2 h-2 rounded-full shrink-0 ring-1 ring-background"
                        style={{ backgroundColor: catColor }}
                        aria-hidden="true"
                      />
                      <span className="text-xs font-medium text-card-foreground truncate group-hover:text-primary transition-colors max-w-[170px]">
                        {cat}
                      </span>
                      <ChevronRight className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all shrink-0 -ml-0.5" />
                    </div>
                    <span className="text-muted-foreground font-mono text-[11px] tabular-nums shrink-0">
                      {count} รายการ ({qty.toLocaleString()} ชิ้น | {pct}%)
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-muted/80 rounded-full overflow-hidden shadow-inner relative">
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
    </div>
  )
}

export { CategoryListSkeleton } from './dashboard-skeletons'
