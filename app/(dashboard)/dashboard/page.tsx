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
import { ActionQueueSkeleton } from '@/components/dashboard/dashboard-action-queue'
import { DashboardRealtimeBoundary } from '@/components/dashboard/dashboard-realtime-boundary'
import { NewItemDialogTrigger } from '@/features/items/components/new-item-dialog-provider'

const DashboardMetricsGrid = dynamic(
  () => import('@/components/dashboard/dashboard-metrics-grid').then((mod) => mod.DashboardMetricsGrid)
)
const DashboardCategoryList = dynamic(
  () => import('@/components/dashboard/dashboard-category-list').then((mod) => mod.DashboardCategoryList)
)
const DashboardActionQueue = dynamic(
  () => import('@/components/dashboard/dashboard-action-queue').then((mod) => mod.DashboardActionQueue)
)

export default async function DashboardPage() {
  const profile = await getCurrentProfile()

  if (!profile) {
    redirect('/login')
  }

  const userCanWrite = canWrite(profile?.role)

  return (
    <PageContainer>
      <DashboardRealtimeBoundary tables={['items', 'categories']} />
      <PageHeader
        title="ภาพรวมพัสดุ"
        subtitle={`สวัสดีคุณ ${profile.full_name || 'ผู้ใช้งาน'} ตรวจสอบทะเบียนและรายการที่ต้องดำเนินการได้ที่นี่`}
        actions={
          <>
            <Link href="/items" className="rounded-lg border border-border bg-card px-4 py-2.5 text-sm font-medium hover:bg-muted">
              ดูทะเบียนทั้งหมด
            </Link>
            {userCanWrite && (
              <NewItemDialogTrigger className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90">
                <PlusCircle className="size-4" />
                ขึ้นทะเบียนใหม่
              </NewItemDialogTrigger>
            )}
          </>
        }
      />

      {/* Metrics Bento Grid */}
      <Suspense fallback={<MetricsGridSkeleton />}>
        <DashboardMetricsGrid />
      </Suspense>

      {/* Main Operational & Analytics Grid (60% / 40% Desktop Split) */}
      <div className="grid w-full grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-7">
          <Suspense fallback={<ActionQueueSkeleton />}>
            <DashboardActionQueue />
          </Suspense>
        </div>
        <div className="lg:col-span-5 flex flex-col gap-6">
          <Suspense fallback={<CategoryListSkeleton />}>
            <DashboardCategoryList />
          </Suspense>
        </div>
      </div>
    </PageContainer>
  )
}
