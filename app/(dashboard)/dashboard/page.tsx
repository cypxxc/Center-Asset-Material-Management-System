import { Suspense } from 'react'
import Link from 'next/link'
import { PlusCircle } from 'lucide-react'
import { getCurrentProfile } from '@/features/auth/queries'
import { redirect } from 'next/navigation'
import { PageContainer } from '@/components/ui/page-container'
import { canWrite } from '@/lib/permissions'
import dynamic from 'next/dynamic'
import { MetricsGridSkeleton } from '@/components/dashboard/dashboard-metrics-grid'
import { CategoryListSkeleton } from '@/components/dashboard/dashboard-category-list'
import { LowStockSkeleton } from '@/components/dashboard/dashboard-low-stock-panel'

const DashboardMetricsGrid = dynamic(
  () => import('@/components/dashboard/dashboard-metrics-grid').then((mod) => mod.DashboardMetricsGrid)
)
const DashboardCategoryList = dynamic(
  () => import('@/components/dashboard/dashboard-category-list').then((mod) => mod.DashboardCategoryList)
)
const DashboardLowStockPanel = dynamic(
  () => import('@/components/dashboard/dashboard-low-stock-panel').then((mod) => mod.DashboardLowStockPanel)
)

export default async function DashboardPage() {
  const profile = await getCurrentProfile()

  if (!profile) {
    redirect('/login')
  }

  const userCanWrite = canWrite(profile?.role)

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
      <Suspense fallback={<MetricsGridSkeleton />}>
        <DashboardMetricsGrid />
      </Suspense>

      {/* Main Charts and Status Section */}
      <div className="grid w-full grid-cols-1 lg:grid-cols-3 gap-6">
        <Suspense fallback={<CategoryListSkeleton />}>
          <DashboardCategoryList />
        </Suspense>
        <Suspense fallback={<LowStockSkeleton />}>
          <DashboardLowStockPanel />
        </Suspense>
      </div>
    </PageContainer>
  )
}
