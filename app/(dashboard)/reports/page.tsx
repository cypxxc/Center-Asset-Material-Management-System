import { getReportsOverview } from '@/features/reports/queries'
import { ReportsList } from '@/features/reports/components/reports-list'
import { ItemListSearchParams } from '@/features/items/types'
import { getCurrentProfile } from '@/features/auth/queries'
import { redirect } from 'next/navigation'
import { DepreciationReport } from '@/features/depreciation/components/depreciation-report'

interface ReportsPageProps {
  searchParams: Promise<ItemListSearchParams>
}

export default async function ReportsPage({ searchParams }: ReportsPageProps) {
  const params = await searchParams
  const profile = await getCurrentProfile()

  if (!profile) redirect('/login')
  if (!profile.is_active) redirect('/login?error=inactive')

  const overview = await getReportsOverview(params, profile.full_name)

  return (
    <div className="h-full overflow-y-auto bg-background print:h-auto print:overflow-visible">
      <ReportsList
        preparedBy={overview.preparedBy ?? undefined}
        items={overview.items}
        totalCount={overview.totalCount}
        totalQuantity={overview.totalQuantity}
        totalValue={overview.totalValue}
        totalPages={overview.totalPages}
        currentPage={overview.currentPage}
        searchParams={overview.searchParams}
        categories={overview.categories}
        locations={overview.locations}
        stats={overview.stats}
      />
      <div className="px-4 pb-6 sm:px-6 lg:px-8">
        <DepreciationReport {...overview.depreciationReport} />
      </div>
    </div>
  )
}
