import { Suspense } from 'react'
import { getCurrentProfile } from '@/features/auth/queries'
import { redirect } from 'next/navigation'
import { PageHeader } from '@/components/ui/page-header'
import { PageContainer } from '@/components/ui/page-container'
import dynamic from 'next/dynamic'
import {
  MetricsGridSkeleton,
  CategoryListSkeleton,
  ActionQueueSkeleton,
} from '@/components/dashboard/dashboard-skeletons'
import { DashboardRealtimeBoundary } from '@/components/dashboard/dashboard-realtime-boundary'

export const metadata = { title: 'ภาพรวมระบบ' }

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

  return (
    <PageContainer
      maxWidth="full"
      className="p-4 sm:p-5 lg:px-6 lg:py-6"
      contentClassName="space-y-5 sm:space-y-6"
    >
      <DashboardRealtimeBoundary tables={['items', 'categories']} />
      <PageHeader
        title={
          <div className="flex items-center gap-2.5">
            <span>ภาพรวมระบบ</span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">
              <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
              ระบบออนไลน์
            </span>
          </div>
        }
        subtitle={`สวัสดีคุณ ${profile.full_name || 'ผู้ใช้งาน'} • ศูนย์ควบคุมทะเบียนครุภัณฑ์ พัสดุ และรายการที่ต้องดำเนินการ`}
        className="gap-3.5"
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
