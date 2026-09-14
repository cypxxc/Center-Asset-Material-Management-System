import type { ItemListRow } from '@/features/items/types'

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
