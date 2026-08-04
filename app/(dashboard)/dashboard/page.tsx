import Link from 'next/link'
import { 
  Package, 
  ClipboardList, 
  AlertTriangle, 
  Layers, 
  CheckCircle, 
  Hammer, 
  PlusCircle, 
  FolderOpen,
  MapPin
} from 'lucide-react'
import { getReportStats } from '@/features/reports/queries'
import type { ReportCountBucket } from '@/features/reports/queries'
import { getCurrentProfile } from '@/features/auth/queries'
import { createClient } from '@/lib/supabase/server'
import { PageContainer } from '@/components/ui/page-container'
import { canWrite } from '@/lib/permissions'

type LowStockItem = {
  id: string
  item_name: string
  quantity: number
  location: { name: string } | { name: string }[] | null
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const [stats, profile, lowStockResult] = await Promise.all([
    getReportStats(),
    getCurrentProfile(),
    supabase
      .from('items')
      .select('id, item_name, quantity, location:locations(name)')
      .eq('item_type', 'material')
      .lte('quantity', 5)
      .is('deleted_at', null)
      .order('quantity', { ascending: true })
      .limit(5),
  ])

  const userCanWrite = canWrite(profile?.role)

  const lowStockItems = (lowStockResult.data ?? []) as LowStockItem[]
  const formattedLowStock = (lowStockItems ?? []).map(item => {
    const locObj = item.location
    const locationName = Array.isArray(locObj) 
      ? locObj[0]?.name 
      : locObj?.name
    return {
      id: item.id,
      item_name: item.item_name,
      quantity: item.quantity,
      locationName: locationName || 'ไม่มีระบุสถานที่'
    }
  })

  const activeCount = stats.statusCounts.active?.count || 0
  const totalAssets = stats.typeCounts.asset?.count || 0
  const damagedCount = (stats.statusCounts.damaged?.count || 0) + (stats.statusCounts.waiting_repair?.count || 0)

  const totalQty = stats.totalQuantity || 1
  const activeQty = stats.statusCounts.active?.qty || 0
  const spareQty = stats.statusCounts.spare?.qty || 0
  const damagedQty = (stats.statusCounts.damaged?.qty || 0) + (stats.statusCounts.waiting_repair?.qty || 0)
  const otherQty = (stats.statusCounts.inactive?.qty || 0) + (stats.statusCounts.disposed?.qty || 0)

  const activePct = (activeQty / totalQty) * 100
  const sparePct = (spareQty / totalQty) * 100
  const damagedPct = (damagedQty / totalQty) * 100
  const otherPct = (otherQty / totalQty) * 100

  const circ = 314.159
  const dash1 = (activePct / 100) * circ
  const dash2 = (sparePct / 100) * circ
  const dash3 = (damagedPct / 100) * circ
  const dash4 = (otherPct / 100) * circ
  const categoryEntries = Object.entries(stats.categoryCounts) as [string, ReportCountBucket][]

  return (
    <PageContainer maxWidth="full">
        
        {/* Welcome Control Strip */}
        <div className="bg-card border border-border text-card-foreground rounded-xl p-6 shadow-2xs space-y-3">
          <div className="flex items-center gap-2">
            <span className="bg-primary/10 text-primary px-2.5 py-0.5 rounded-full text-[11px] font-semibold">
              Console Dashboard
            </span>
          </div>
          <h2 className="text-xl font-bold text-card-foreground">
            สวัสดีคุณ {profile?.full_name || 'ผู้ใช้งาน'}, ยินดีต้อนรับสู่แผงควบคุมระบบ CAMMS
          </h2>
          <p className="text-xs text-muted-foreground max-w-2xl leading-relaxed">
            ระบบตรวจสอบสถานะ คลังวัสดุ และแผนกซ่อมบำรุงในปัจจุบันของทรัพย์สินทั้งหมดของสำนักงาน 
            คุณสามารถตรวจสอบประเภทครุภัณฑ์ ปรับปรุงวัสดุ หรือพิมพ์รายงานสรุปผลได้ทันที
          </p>
          <div className="flex items-center gap-3 pt-1">
            {userCanWrite && (
              <Link href="/items/new" className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold px-3.5 py-2 rounded-lg flex items-center gap-1.5 transition-all shadow-2xs">
                <PlusCircle className="w-4 h-4" />
                ขึ้นทะเบียนสิ่งของใหม่
              </Link>
            )}
            <Link href="/items" className="bg-secondary hover:bg-secondary/80 text-secondary-foreground border border-border text-xs font-semibold px-3.5 py-2 rounded-lg transition-all">
              ดูรายการทะเบียนทั้งหมด
            </Link>
          </div>
        </div>

        {/* Metrics Bento Grid */}
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

        {/* Main Charts and Status Section */}
        <div className="grid w-full grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Status Breakdown SVG Donut chart */}
          <div className="bg-card text-card-foreground p-5 rounded-xl border border-border shadow-2xs flex flex-col justify-between">
            <div>
              <h3 className="font-bold text-card-foreground text-sm mb-1">สัดส่วนตามสภาพการใช้งาน (Status)</h3>
              <p className="text-xs text-muted-foreground mb-4">ปริมาณจำนวนพัสดุแบ่งแยกตามสถานะการครอบครองและการใช้งาน</p>
            </div>
            
            {/* SVG Donut Chart */}
            <div className="relative py-4 flex items-center justify-center">
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
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none mt-2">
                <span className="text-xl font-black text-card-foreground">{stats.totalQuantity}</span>
                <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest leading-none">ชิ้นงานรวม</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 mt-4 text-xs font-medium text-muted-foreground">
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

          {/* Low stock alerts panel */}
          <div className="bg-card text-card-foreground p-5 rounded-xl border border-border shadow-2xs flex flex-col justify-between">
            <div>
              <h3 className="font-bold text-card-foreground text-sm mb-1">พัสดุและวัสดุใกล้หมดคลัง (Low Stock)</h3>
              <p className="text-xs text-muted-foreground mb-4">รายการวัสดุและอุปกรณ์สิ้นเปลืองที่เหลือจำนวนต่ำกว่าเกณฑ์ควบคุม (≤ 5 ชิ้น)</p>
            </div>
            
            <div className="space-y-2.5 overflow-y-auto max-h-[220px] pr-1" tabIndex={0} aria-label="รายการวัสดุคงเหลือต่ำ">
              {formattedLowStock.map((item) => (
                <div key={item.id} className="bg-amber-500/10 hover:bg-amber-500/15 border border-amber-500/20 p-2.5 rounded-lg transition-colors flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-md bg-amber-500/20 text-amber-700 dark:text-amber-300 flex items-center justify-center shrink-0">
                      <Package className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-card-foreground truncate max-w-[150px]">{item.item_name}</p>
                      <p className="text-[11px] text-muted-foreground">{item.locationName}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-bold text-amber-700 dark:text-amber-300">{item.quantity} ชิ้น</p>
                    <span className="bg-amber-500/20 text-amber-800 dark:text-amber-200 text-[10px] font-semibold px-1.5 py-0.5 rounded-full inline-block mt-0.5">ต่ำกว่าเกณฑ์</span>
                  </div>
                </div>
              ))}

              {(!lowStockItems || lowStockItems.length === 0) && (
                <div className="flex flex-col items-center justify-center py-8 text-muted-foreground space-y-2">
                  <CheckCircle className="w-8 h-8 text-emerald-500" />
                  <p className="text-xs text-muted-foreground">ระดับสินค้าพัสดุทั้งหมดในคลังอยู่ในเกณฑ์ปกติ</p>
                </div>
              )}
            </div>
          </div>

        </div>


    </PageContainer>
  )
}
