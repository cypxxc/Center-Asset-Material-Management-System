import { normalizeForSearch } from '@/lib/unicode'
import type { ItemListSearchParams, ItemStatus, ItemType } from './types'

export const BATCH_SIZE = 25
export const itemTypes: readonly ItemType[] = ['material', 'asset']
export const itemStatuses: readonly ItemStatus[] = ['active', 'spare', 'damaged', 'waiting_repair', 'inactive', 'disposed']
const sortColumns = ['updated_at', 'item_name', 'item_type', 'quantity', 'status'] as const
export type ItemSortColumn = typeof sortColumns[number]
export type ItemSortDirection = 'asc' | 'desc'
export interface NormalizedItemListSearchParams {
  q: string
  type: ItemType | null
  status: ItemStatus | null
  category_id: string | null
  location_id: string | null
  sort_by: ItemSortColumn
  sort_dir: ItemSortDirection
}

export function normalizeItemListSearchParams(params: ItemListSearchParams): NormalizedItemListSearchParams {
  const sort_by = sortColumns.includes(params.sort_by as ItemSortColumn) ? params.sort_by as ItemSortColumn : 'updated_at'
  const sort_dir: ItemSortDirection = params.sort_dir === 'asc' || params.sort_dir === 'desc'
    ? params.sort_dir
    : (sort_by === 'item_name' || sort_by === 'item_type' ? 'asc' : 'desc')
  return {
    // Keep displayed rows aligned with the existing all-matching bulk actions.
    q: normalizeForSearch(params.q ?? '').replaceAll(',', ' '),
    type: itemTypes.includes(params.type as ItemType) ? params.type as ItemType : null,
    status: itemStatuses.includes(params.status as ItemStatus) ? params.status as ItemStatus : null,
    category_id: params.category_id || null,
    location_id: params.location_id || null,
    sort_by,
    sort_dir,
  }
}
