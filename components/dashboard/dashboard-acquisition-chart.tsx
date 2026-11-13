import dynamic from 'next/dynamic'
import { getAcquisitionSummary } from '@/features/reports/acquisition-queries'

const DashboardAcquisitionChartClient = dynamic(
  () => import('./dashboard-acquisition-chart-client').then((m) => m.DashboardAcquisitionChartClient),
  { ssr: true }
)

export async function DashboardAcquisitionChart() {
  const summary = await getAcquisitionSummary()
  return <DashboardAcquisitionChartClient summary={summary} />
}

export function AcquisitionChartSkeleton() {
  return (
    <div role="status" aria-label="กำลังโหลดกราฟทะเบียนทรัพย์สิน" className="w-full min-w-0 space-y-3 rounded-xl border border-border bg-card p-4 sm:px-5">
      <div className="h-5 w-56 max-w-full rounded bg-muted motion-safe:animate-pulse" />
      <div className="h-8 w-40 rounded bg-muted motion-safe:animate-pulse" />
      <div className="h-44 rounded-md bg-muted/50 motion-safe:animate-pulse" />
      <div className="h-4 w-48 rounded bg-muted motion-safe:animate-pulse" />
    </div>
  )
}
