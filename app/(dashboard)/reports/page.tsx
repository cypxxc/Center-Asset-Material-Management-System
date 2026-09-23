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
  const params = await searchParams
  const [profile, references, stats, reportData, depreciationReport] = await Promise.all([
    getCurrentProfile(),
    getItemReferences(),
    getReportStats(),
    getReportItemsList(params),
    getDepreciationReport(),
  ])

  if (!profile) redirect('/login')
  if (!profile.is_active) redirect('/login?error=inactive')

  return (
    <div className="h-full overflow-y-auto bg-background print:h-auto print:overflow-visible">
      <ReportsList
        preparedBy={profile.full_name}
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
      />
      <div className="px-4 pb-6 sm:px-6 lg:px-8">
        <DepreciationReport {...depreciationReport} />
      </div>
    </div>
  )
}
