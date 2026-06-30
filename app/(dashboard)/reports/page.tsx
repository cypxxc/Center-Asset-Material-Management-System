import { getReportItemsList } from '@/features/reports/queries'
import { ReportsList } from '@/features/reports/components/reports-list'
import { ItemListSearchParams } from '@/features/items/types'
import { getItemReferences } from '@/features/items/queries'

interface ReportsPageProps {
  searchParams: Promise<ItemListSearchParams>
}

export default async function ReportsPage({ searchParams }: ReportsPageProps) {
  const [params, references] = await Promise.all([
    searchParams,
    getItemReferences()
  ])
  const items = await getReportItemsList(params)

  return <ReportsList items={items} searchParams={params} categories={references.categories} />
}

