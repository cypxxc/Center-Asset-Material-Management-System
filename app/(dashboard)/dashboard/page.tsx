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
import { getReportStats, getRecentAuditLogs } from '@/features/reports/queries'
import { getCurrentProfile } from '@/features/auth/queries'
import { createClient } from '@/lib/supabase/server'
import { PageContainer } from '@/components/ui/page-container'
import { canWrite } from '@/lib/permissions'

export default async function DashboardPage() {
  const supabase = await createClient()
  const [stats, logs, profile, lowStockResult] = await Promise.all([
    getReportStats(),
    getRecentAuditLogs(),
    getCurrentProfile(),
    supabase
      .from('items')
      .select('id, item_name, quantity, location:locations(name)')
      .eq('item_type', 'material')
      .lte('quantity', 5)
      .is('deleted_at', null)
      .not('status', 'in', '("inactive","disposed")')
      .order('quantity', { ascending: true })
      .limit(5),
  ])

  const userCanWrite = canWrite(profile?.role)

  const lowStockItems = lowStockResult.data
  const formattedLowStock = (lowStockItems ?? []).map(item => {
    const locObj = item.location as { name: string } | { name: string }[] | null
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

  return (
    <PageContainer maxWidth="full">
        
        {/* Welcome Banner */}
        <div className="bg-gradient-to-r from-blue-700 to-indigo-800 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden">
          <div className="absolute right-0 top-0 -translate-y-6 translate-x-6 w-48 h-48 bg-white/10 rounded-full blur-2xl"></div>
          <div className="absolute right-12 bottom-0 translate-y-12 w-32 h-32 bg-indigo-500/20 rounded-full blur-xl"></div>
          
          <div className="relative z-10 space-y-2">
            <div className="flex items-center gap-2">
              <span className="bg-white/15 px-2.5 py-0.5 rounded-full text-[10px] uppercase font-bold tracking-wider">
                Console Dashboard
              </span>
            </div>
            <h2 className="text-2xl font-bold">สวัสดีคุณ {profile?.full_name || 'ผู้ใช้งาน'}, ยินดีต้อนรับสู่แผงควบคุมระบบ CAMMS</h2>
            <p className="text-xs text-blue-100 max-w-2xl leading-relaxed">
              ระบบตรวจสอบสถานะ คลังวัสดุ และแผนกซ่อมบำรุงในปัจจุบันของทรัพย์สินทั้งหมดของสำนักงาน 
              คุณสามารถตรวจสอบประเภทครุภัณฑ์ ปรับปรุงวัสดุ หรือพิมพ์รายงานสรุปผลได้ทันที
            </p>
            <div className="flex items-center gap-3 pt-3">
              {userCanWrite && (
                <Link href="/items/new" className="bg-white hover:bg-blue-50 text-blue-800 text-xs font-bold px-3.5 py-2 rounded-lg flex items-center gap-1.5 transition-all shadow-md transform hover:-translate-y-0.5">
                  <PlusCircle className="w-4 h-4 text-blue-600" />
                  ขึ้นทะเบียนสิ่งของใหม่
                </Link>
              )}
              <Link href="/items" className="bg-blue-600/50 hover:bg-blue-600 border border-blue-400/40 hover:border-blue-300 text-white text-xs font-bold px-3.5 py-2 rounded-lg transition-all">
                ดูรายการทะเบียนทั้งหมด
              </Link>
            </div>
          </div>
        </div>

        {/* Metrics Bento Grid */}
        <div className="grid w-full grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Metric 1 */}
          <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">ครุภัณฑ์ทั้งหมด (Assets)</p>
              <h3 className="text-2xl font-bold text-slate-800">{totalAssets} รายการ</h3>
              <p className="text-[10px] text-green-500 font-semibold flex items-center gap-0.5 mt-1">
                <CheckCircle className="w-3 h-3" /> ใช้งานอยู่ปกติ {activeCount} รายการ
              </p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Package className="h-6 w-6" />
            </div>
          </div>

          {/* Metric 2 */}
          <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">วัสดุและอุปกรณ์รวม</p>
              <h3 className="text-2xl font-bold text-slate-800">{stats.totalQuantity} ชิ้น</h3>
              <p className="text-[10px] text-slate-500 font-semibold flex items-center gap-0.5 mt-1">
                <FolderOpen className="w-3 h-3 text-slate-400" /> จากสิ่งของทั้งหมด {stats.totalItems} รายการ
              </p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <ClipboardList className="h-6 w-6" />
            </div>
          </div>

          {/* Metric 3 */}
          <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">ชำรุด/รอซ่อมบำรุง</p>
              <h3 className="text-2xl font-bold text-rose-600">{damagedCount} รายการ</h3>
              <p className="text-[10px] text-rose-500 font-semibold flex items-center gap-0.5 mt-1">
                <Hammer className="w-3 h-3" /> รอการดำเนินการแก้ไขส่งซ่อม
              </p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
              <AlertTriangle className="h-6 w-6" />
            </div>
          </div>

          {/* Metric 4 */}
          <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">สถานที่ตั้งเก็บรักษา</p>
              <h3 className="text-2xl font-bold text-slate-800">{stats.locationCount} โซน</h3>
              <p className="text-[10px] text-slate-500 font-semibold flex items-center gap-0.5 mt-1">
                <MapPin className="w-3 h-3 text-slate-400" /> มีห้องเก็บและอาคารที่รองรับ
              </p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Layers className="h-6 w-6" />
            </div>
          </div>
        </div>

        {/* Main Charts and Status Section */}
        <div className="grid w-full grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Status Breakdown SVG Donut chart */}
          <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm flex flex-col justify-between">
            <div>
              <h3 className="font-bold text-slate-800 text-sm mb-1">สัดส่วนตามสภาพการใช้งาน (Status)</h3>
              <p className="text-xs text-slate-400 mb-4">ปริมาณจำนวนพัสดุแบ่งแยกตามสถานะการครอบครองและการใช้งาน</p>
            </div>
            
            {/* SVG Donut Chart */}
            <div className="relative py-4 flex items-center justify-center">
              <svg viewBox="0 0 120 120" className="w-36 h-36">
                {/* Background Track */}
                <circle cx="60" cy="60" r="50" fill="transparent" stroke="#f1f5f9" strokeWidth="12" />
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
                <span className="text-xl font-black text-slate-800">{stats.totalQuantity}</span>
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-none">ชิ้นงานรวม</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 mt-4 text-[10px] font-bold text-slate-600">
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
          <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm flex flex-col justify-between">
            <div>
              <h3 className="font-bold text-slate-800 text-sm mb-1">สถิติตามประเภทสิ่งของ (Category)</h3>
              <p className="text-xs text-slate-400 mb-4">จำแนกปริมาณพัสดุและครุภัณฑ์แยกตามหมวดหมู่หลักในปัจจุบัน</p>
            </div>
            
            <div className="relative flex-1 flex flex-col justify-center min-h-[180px]">
              {/* Background Chart Gridlines */}
              <div className="absolute inset-0 flex justify-between pointer-events-none text-[8px] text-slate-300 font-mono">
                <div className="border-l border-dashed border-slate-100 h-full pl-1">0%</div>
                <div className="border-l border-dashed border-slate-100 h-full pl-1">25%</div>
                <div className="border-l border-dashed border-slate-100 h-full pl-1">50%</div>
                <div className="border-l border-dashed border-slate-100 h-full pl-1">75%</div>
                <div className="border-l border-dashed border-slate-100 h-full pl-1">100%</div>
              </div>

              <div className="relative z-10 space-y-3 max-h-[220px] overflow-y-auto pr-1">
                {Object.entries(stats.categoryCounts).map(([cat, counts]) => {
                  const count = counts.count
                  const qty = counts.qty
                  const pct = Math.round((qty / totalQty) * 100) || 0
                  return (
                    <div key={cat} className="group space-y-1">
                      <div className="flex justify-between items-center text-xs text-slate-700 font-semibold">
                        <span className="truncate max-w-[150px]">{cat}</span>
                        <span className="text-slate-400 font-mono text-[10px]">{count} รายการ ({qty} ชิ้น | {pct}%)</span>
                      </div>
                      <div className="w-full h-3 bg-slate-100/70 rounded-full overflow-hidden shadow-inner relative">
                        <div
                          className="bg-indigo-600 h-full rounded-full transition-all duration-700 group-hover:bg-indigo-500 shadow-sm"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
                {Object.keys(stats.categoryCounts).length === 0 && (
                  <p className="text-xs text-slate-400 text-center py-6">ไม่มีข้อมูลหมวดหมู่ในปัจจุบัน</p>
                )}
              </div>
            </div>
          </div>

          {/* Low stock alerts panel */}
          <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm flex flex-col justify-between">
            <div>
              <h3 className="font-bold text-slate-800 text-sm mb-1">พัสดุและวัสดุใกล้หมดคลัง (Low Stock)</h3>
              <p className="text-xs text-slate-400 mb-4">รายการวัสดุและอุปกรณ์สิ้นเปลืองที่เหลือจำนวนต่ำกว่าเกณฑ์ควบคุม (≤ 5 ชิ้น)</p>
            </div>
            
            <div className="space-y-2.5 overflow-y-auto max-h-[220px] pr-1">
              {formattedLowStock.map((item) => (
                <div key={item.id} className="flex items-center justify-between p-2 bg-amber-50/50 hover:bg-amber-50 border border-amber-100/50 rounded-xl transition-all">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center text-amber-700">
                      <Package className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-800 truncate max-w-[150px]">{item.item_name}</p>
                      <p className="text-[9px] text-slate-500 font-semibold">{item.locationName}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-black text-amber-700">{item.quantity} ชิ้น</p>
                    <span className="inline-block text-[8px] font-bold bg-amber-200/50 text-amber-800 px-1.5 py-0.2 rounded-full mt-0.5">ต่ำกว่าเกณฑ์</span>
                  </div>
                </div>
              ))}

              {(!lowStockItems || lowStockItems.length === 0) && (
                <div className="flex flex-col items-center justify-center py-8 text-slate-400 space-y-2">
                  <CheckCircle className="w-8 h-8 text-emerald-500" />
                  <p className="text-xs text-slate-500">ระดับสินค้าพัสดุทั้งหมดในคลังอยู่ในเกณฑ์ปกติ</p>
                </div>
              )}
            </div>
          </div>

        </div>

        {/* Recent Activity Log */}
        <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm">
          <div className="flex items-center justify-between mb-4 border-b border-slate-50 pb-3">
            <div>
              <h3 className="font-bold text-slate-800 text-sm">ประวัติการซ่อมบำรุงและขึ้นทะเบียนทรัพย์สิน (Activity Log)</h3>
              <p className="text-xs text-slate-400">ประวัติการเคลื่อนไหวและการตรวจสอบสภาพครุภัณฑ์ล่าสุดของระบบ</p>
            </div>
            <span className="text-xs text-blue-600 font-bold bg-blue-50 px-2.5 py-1 rounded-md border border-blue-100/50">บันทึกสด</span>
          </div>

          <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
            {logs.map((log) => (
              <div key={log.id} className="flex items-start justify-between p-3 rounded-xl hover:bg-slate-50 border border-transparent hover:border-slate-100/60 transition-all text-xs">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center font-bold font-sans mt-0.5 border border-slate-200">
                    {log.user.charAt(0)}
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-bold text-slate-800">{log.user}</span>
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-100/30">
                        {log.action}
                      </span>
                      <span className="text-slate-400 font-medium">•</span>
                      <span className="text-slate-800 font-bold">{log.itemName}</span>
                    </div>
                    <p className="text-slate-500 text-[11px] mt-1 bg-slate-50 p-2 rounded-lg border border-slate-100">
                      {log.details}
                    </p>
                  </div>
                </div>
                <span className="text-[10px] text-slate-400 font-mono mt-1 whitespace-nowrap pl-4" suppressHydrationWarning>
                  {new Date(log.timestamp).toLocaleDateString('th-TH', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            ))}

            {logs.length === 0 && (
              <div className="py-12 text-center text-xs text-slate-400">
                <p>ไม่พบประวัติกิจกรรมการขึ้นทะเบียนหรือปรับปรุงข้อมูลล่าสุด</p>
                <p className="text-[10px] opacity-75 mt-0.5">(แสดงเฉพาะบทบาทผู้ดูแลระบบ หรือเมื่อมีการปรับปรุงพัสดุในฐานข้อมูล)</p>
              </div>
            )}
          </div>
        </div>

    </PageContainer>
  )
}
