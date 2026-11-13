import { Suspense } from 'react'
import { getCurrentProfile } from '@/features/auth/queries'
import { redirect } from 'next/navigation'
import { PageContainer } from '@/components/ui/page-container'
import { AcquisitionChartSkeleton, DashboardAcquisitionChart } from '@/components/dashboard/dashboard-acquisition-chart'
import { DashboardRealtimeBoundary } from '@/components/dashboard/dashboard-realtime-boundary'
import { AdminDashboardWorkQueue, AdminWorkQueueSkeleton } from '@/components/dashboard/dashboard-admin-work-queue'

export const metadata = { title: 'ภาพรวมระบบ' }

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
      <DashboardRealtimeBoundary tables={profile.role === 'admin' ? ['items', 'audit_logs'] : ['items']} />
      <Suspense fallback={<AcquisitionChartSkeleton />}>
        <DashboardAcquisitionChart />
      </Suspense>
      {profile.role === 'admin' && <Suspense fallback={<AdminWorkQueueSkeleton />}>
        <AdminDashboardWorkQueue />
      </Suspense>}
    </PageContainer>
  )
}
