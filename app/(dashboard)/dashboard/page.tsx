import { Suspense } from 'react'
import { getCurrentProfile } from '@/features/auth/queries'
import { redirect } from 'next/navigation'
import { PageContainer } from '@/components/ui/page-container'
import { AcquisitionChartSkeleton, DashboardAcquisitionChart } from '@/components/dashboard/dashboard-acquisition-chart'
import { DashboardRealtimeBoundary } from '@/components/dashboard/dashboard-realtime-boundary'
import { AdminDashboardWorkQueue, AdminWorkQueueSkeleton } from '@/components/dashboard/dashboard-admin-work-queue'
import { DashboardDisbursementChart } from '@/components/dashboard/dashboard-disbursement-chart'

export const metadata = { title: 'Dashboard' }

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

      {/* 1. Quick Action — รออนุมัติ */}
      {profile.role === 'admin' && (
        <Suspense fallback={<AdminWorkQueueSkeleton />}>
          <AdminDashboardWorkQueue />
        </Suspense>
      )}

      {/* 2. กราฟทะเบียนครุภัณฑ์ | กราฟทะเบียนวัสดุ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 sm:gap-6 items-start">
        <Suspense fallback={<AcquisitionChartSkeleton />}>
          <DashboardAcquisitionChart />
        </Suspense>
        <Suspense fallback={<AcquisitionChartSkeleton title="ทะเบียนวัสดุ" />}>
          <DashboardAcquisitionChart itemType="material" />
        </Suspense>
      </div>

      {/* 3. กราฟยอดรวมการยืมและเบิกสำเร็จ */}
      <Suspense fallback={<AcquisitionChartSkeleton title="ยอดรวมการยืมและเบิกที่สำเร็จ" />}>
        <DashboardDisbursementChart />
      </Suspense>
    </PageContainer>
  )
}
