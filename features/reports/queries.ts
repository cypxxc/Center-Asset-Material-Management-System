import 'server-only'
import { cache } from 'react'
import { getPostgresReportStats, getPostgresReportItemsList, getPostgresExportReportItems } from './postgres-queries'
import type { ItemListSearchParams } from '@/features/items/types'
import type { ReportItemRow, ReportListResult, ReportStats } from './types'

export const getReportStats = cache(async (): Promise<ReportStats> => getPostgresReportStats())

export async function getReportItemsList(params: ItemListSearchParams, noPagination = false): Promise<ReportListResult> {
  return getPostgresReportItemsList(params, noPagination)
}

export async function getExportReportItems(params: ItemListSearchParams): Promise<{
  items: ReportItemRow[]; totalCount: number; totalQuantity: number; totalValue: number
}> {
  return getPostgresExportReportItems(params)
}
