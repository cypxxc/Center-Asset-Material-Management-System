import { getReportItemsList, getReportStats } from '@/features/reports/queries'
import { ReportsList } from '@/features/reports/components/reports-list'
import { ItemListSearchParams } from '@/features/items/types'
import { getItemReferences } from '@/features/items/queries'

interface ReportsPageProps {
  searchParams: Promise<ItemListSearchParams>
}

export default async function ReportsPage({ searchParams }: ReportsPageProps) {
  const [params, references, stats] = await Promise.all([
    searchParams,
    getItemReferences(),
    getReportStats()
  ])
  const reportData = await getReportItemsList(params)

  return (
    <ReportsList
      items={reportData.items}
      totalCount={reportData.totalCount}
      totalQuantity={reportData.totalQuantity}
      totalValue={reportData.totalValue}
      totalPages={reportData.totalPages}
      currentPage={reportData.page}
      auditedCount={reportData.auditedCount}
      overdueAuditItems={reportData.overdueAuditItems}
      searchParams={params}
      categories={references.categories}
      stats={stats}
    />
  )
}

