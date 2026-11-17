import dynamic from 'next/dynamic'
import { getCompletedDisbursementSummary } from '@/features/reports/completed-disbursement-queries'

const ChartClient = dynamic(() => import('./dashboard-disbursement-chart-client').then(module => module.DashboardDisbursementChartClient))

export async function DashboardDisbursementChart() {
  const summary = await getCompletedDisbursementSummary()
  return <ChartClient summary={summary} />
}
