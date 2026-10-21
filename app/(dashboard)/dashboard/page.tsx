import { Suspense } from 'react'
import Link from 'next/link'
import { PlusCircle } from 'lucide-react'
import { getCurrentProfile } from '@/features/auth/queries'
import { redirect } from 'next/navigation'
import { PageHeader } from '@/components/ui/page-header'
import { PageContainer } from '@/components/ui/page-container'
import { canWrite } from '@/lib/permissions'
import dynamic from 'next/dynamic'
import {
  MetricsGridSkeleton,
  CategoryListSkeleton,
  ActionQueueSkeleton,
} from '@/components/dashboard/dashboard-skeletons'
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
    <PageContainer
      maxWidth="full"
      className="p-4 sm:p-5 lg:px-6 lg:py-6"
      contentClassName="space-y-5 sm:space-y-6"
    >
      <DashboardRealtimeBoundary tables={['items', 'categories']} />
      <PageHeader
        title="ภาพรวมพัสดุ"
        subtitle={`สวัสดีคุณ ${profile.full_name || 'ผู้ใช้งาน'} ตรวจสอบทะเบียนและรายการที่ต้องดำเนินการได้ที่นี่`}
        className="gap-3.5"
        actions={
          <div className="flex items-center gap-2">
            <Link
              href="/items"
              className="inline-flex items-center gap-1.5 rounded-lg border border-border/80 bg-card hover:bg-muted/80 text-card-foreground px-3.5 py-2 text-xs sm:text-sm font-medium shadow-2xs hover:border-border transition-all duration-150"
            >
              <span>ดูทะเบียนทั้งหมด</span>
            </Link>
            {userCanWrite && (
              <NewItemDialogTrigger className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-xs sm:text-sm font-medium text-primary-foreground hover:bg-primary/90 shadow-2xs hover:shadow-xs active:scale-[0.99] transition-all duration-150 cursor-pointer">
                <PlusCircle className="size-4" />
                <span>ขึ้นทะเบียนใหม่</span>
              </NewItemDialogTrigger>
            )}
          </div>
        }
      />

      {/* Metrics Bento Grid */}
      <Suspense fallback={<MetricsGridSkeleton />}>
        <DashboardMetricsGrid />
      </Suspense>

      {/* Main Operational & Analytics Section (60% / 40% Desktop Split) */}
      <div className="grid w-full grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-5 items-stretch">
        <div className="lg:col-span-7 flex flex-col h-full">
          <Suspense fallback={<ActionQueueSkeleton />}>
            <DashboardActionQueue />
          </Suspense>
        </div>
        <div className="lg:col-span-5 flex flex-col h-full">
          <Suspense fallback={<CategoryListSkeleton />}>
            <DashboardCategoryList />
          </Suspense>
        </div>
      </div>
    </PageContainer>
  )
}
