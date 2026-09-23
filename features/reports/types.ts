import type { ItemListRow, ReferenceOption, ItemListSearchParams } from '@/features/items/types'
import type { getDepreciationReport } from '@/features/depreciation/queries'

export interface ReportCountBucket {
  count: number
  qty: number
}

export interface ReportStats {
  totalItems: number
  totalQuantity: number
  typeCounts: Record<string, ReportCountBucket>
  statusCounts: Record<string, ReportCountBucket>
  categoryCounts: Record<string, ReportCountBucket>
  locationCount: number
}

export interface ReportItemRow extends ItemListRow {
  brand: string | null
  model: string | null
  unit_price: number | null
}

export interface ReportListResult {
  items: ReportItemRow[]
  totalCount: number
  totalQuantity: number
  totalValue: number
  totalPages: number
  page: number
}

export interface ReportsOverview {
  preparedBy: string | null
  items: ReportItemRow[]
  totalCount: number
  totalQuantity: number
  totalValue: number
  totalPages: number
  currentPage: number
  searchParams: ItemListSearchParams
  categories: ReferenceOption[]
  locations: ReferenceOption[]
  stats: ReportStats
  depreciationReport: Awaited<ReturnType<typeof getDepreciationReport>>
}
