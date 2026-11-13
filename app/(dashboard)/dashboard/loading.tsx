import { PageContainer } from '@/components/ui/page-container'
import { AcquisitionChartSkeleton } from '@/components/dashboard/dashboard-acquisition-chart'

export default function DashboardLoading() {
  return (
    <PageContainer
      maxWidth="full"
      className="p-4 sm:p-5 lg:px-6 lg:py-5"
      contentClassName="space-y-4 sm:space-y-5"
    >
      <AcquisitionChartSkeleton />
    </PageContainer>
  )
}
