import { Suspense } from 'react'
import Link from 'next/link'
import { PlusCircle } from 'lucide-react'
import { getCurrentProfile } from '@/features/auth/queries'
import { redirect } from 'next/navigation'
import { PageHeader } from '@/components/ui/page-header'
import { PageContainer } from '@/components/ui/page-container'
import { canWrite } from '@/lib/permissions'
import dynamic from 'next/dynamic'
import { MetricsGridSkeleton } from '@/components/dashboard/dashboard-metrics-grid'
import { CategoryListSkeleton } from '@/components/dashboard/dashboard-category-list'
import { LowStockSkeleton } from '@/components/dashboard/dashboard-low-stock-panel'
import { DashboardRealtimeBoundary } from '@/components/dashboard/dashboard-realtime-boundary'
import { NewItemDialogTrigger } from '@/features/items/components/new-item-dialog-provider'
import { getReportStats } from '@/features/reports/queries'
import { getLowStockItems } from '@/features/items/queries'

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
  // Start independent RLS-protected reads together; child components reuse React cache.
  const [profile] = await Promise.all([
    getCurrentProfile(),
    getReportStats(),
    getLowStockItems(),
  ])

  if (!profile) {
    redirect('/login')
  }

  const userCanWrite = canWrite(profile?.role)

  return (
    <PageContainer maxWidth="full">
      <DashboardRealtimeBoundary tables={['items', 'categories', 'locations', 'units']} />
      <PageHeader
        title="ภาพรวมพัสดุ"
        subtitle={`สวัสดีคุณ ${profile.full_name || 'ผู้ใช้งาน'} ตรวจสอบทะเบียนและรายการที่ต้องดำเนินการได้ที่นี่`}
        actions={<>
          <Link href="/items" className="rounded-lg border border-border bg-card px-4 py-2.5 text-sm font-medium hover:bg-muted">ดูทะเบียนทั้งหมด</Link>
          {userCanWrite && <NewItemDialogTrigger className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"><PlusCircle className="size-4" />ขึ้นทะเบียนใหม่</NewItemDialogTrigger>}
        </>}
      />

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
