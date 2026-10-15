import { Suspense } from 'react'
import { getReportItemsList, getReportStats } from '@/features/reports/queries'
import { ReportsList } from '@/features/reports/components/reports-list'
import { ItemListSearchParams } from '@/features/items/types'
import { getItemReferences } from '@/features/items/queries'

import { getCurrentProfile } from '@/features/auth/queries'
import { redirect } from 'next/navigation'
import { getDepreciationReport } from '@/features/depreciation/queries'
import { DepreciationReport } from '@/features/depreciation/components/depreciation-report'
import { ReportsDeferredSkeleton } from './loading'

interface ReportsPageProps {
  searchParams: Promise<ItemListSearchParams>
}

interface DeferredReportSectionProps {
  reportDataPromise: ReturnType<typeof getReportItemsList>
  depreciationPromise: ReturnType<typeof getDepreciationReport>
  preparedBy: string
  params: ItemListSearchParams
  references: Awaited<ReturnType<typeof getItemReferences>>
  stats: Awaited<ReturnType<typeof getReportStats>>
}

async function DeferredReportSection({
  reportDataPromise,
  depreciationPromise,
  preparedBy,
  params,
  references,
  stats,
}: DeferredReportSectionProps) {
  const [reportData, depreciationReport] = await Promise.all([
    reportDataPromise,
    depreciationPromise,
  ])

  return (
    <>
      <ReportsList
        preparedBy={preparedBy}
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
        view="table-and-filters"
      />
      <div className="px-4 pb-6 sm:px-6 lg:px-8">
        <DepreciationReport {...depreciationReport} />
      </div>
    </>
  )
}

export default async function ReportsPage({ searchParams }: ReportsPageProps) {
  const params = await searchParams
  const depreciationPromise = getDepreciationReport()
  const reportDataPromise = getReportItemsList(params)
  const profilePromise = getCurrentProfile()
  const referencesPromise = getItemReferences()
  const statsPromise = getReportStats()

  const [profile, references, stats] = await Promise.all([
    profilePromise,
    referencesPromise,
    statsPromise,
  ])

  if (!profile) redirect('/login')
  if (!profile.is_active) redirect('/login?error=inactive')

  return (
    <div className="h-full overflow-y-auto bg-background print:h-auto print:overflow-visible">
      {/* Priority Boundary: Top Page Header & KPI Summary Cards (LCP ~20ms) */}
      <ReportsList
        preparedBy={profile.full_name}
        items={[]}
        totalCount={stats.totalItems}
        totalQuantity={stats.totalQuantity}
        totalValue={stats.totalValue ?? 0}
        totalPages={1}
        currentPage={1}
        searchParams={params}
        categories={references.categories}
        locations={references.locations}
        stats={stats}
        view="header-and-kpis"
      />

      {/* Deferred Boundary: Heavy paginated items and depreciation calculations */}
      <Suspense
        fallback={
          <div className="px-4 pb-6 sm:px-6 lg:px-8">
            <ReportsDeferredSkeleton />
          </div>
        }
      >
        <DeferredReportSection
          reportDataPromise={reportDataPromise}
          depreciationPromise={depreciationPromise}
          preparedBy={profile.full_name}
          params={params}
          references={references}
          stats={stats}
        />
      </Suspense>
    </div>
  )
}
