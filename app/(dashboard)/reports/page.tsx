import { getReportItemsList, getReportStats } from '@/features/reports/queries'
import { ReportsList } from '@/features/reports/components/reports-list'
import { ItemListSearchParams } from '@/features/items/types'
import { getItemReferences } from '@/features/items/queries'

import { getCurrentProfile } from '@/features/auth/queries'
import { redirect } from 'next/navigation'
import { getDepreciationReport } from '@/features/depreciation/queries'
import { DepreciationReport } from '@/features/depreciation/components/depreciation-report'

interface ReportsPageProps {
  searchParams: Promise<ItemListSearchParams>
}

export default async function ReportsPage({ searchParams }: ReportsPageProps) {
  const profile = await getCurrentProfile()
  if (!profile) {
    redirect('/login')
  }

  const params = await searchParams
  const [references, stats, reportData, depreciationReport] = await Promise.all([
    getItemReferences(),
    getReportStats(),
    getReportItemsList(params),
    getDepreciationReport(),
  ])

  return (
    <><ReportsList
      items={reportData.items}
      totalCount={reportData.totalCount}
      totalQuantity={reportData.totalQuantity}
      totalValue={reportData.totalValue}
      totalPages={reportData.totalPages}
      currentPage={reportData.page}
      searchParams={params}
      categories={references.categories}
      locations={references.locations}
      stats={stats}
    /><DepreciationReport {...depreciationReport} /></>
  )
}
