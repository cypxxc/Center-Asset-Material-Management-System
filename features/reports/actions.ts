'use server'

import { getReportItemsList } from './queries'
import { ItemListSearchParams } from '@/features/items/types'

/**
 * Server action to fetch the full filtered list of report items for Excel export.
 * Bypasses client-side pagination to export all matching records.
 */
export async function getReportItemsForExport(params: ItemListSearchParams) {
  const result = await getReportItemsList(params, true)
  return result.items
}
