import { normalizeForSearch } from '@/lib/unicode'
import type { ItemListSearchParams, ItemStatus, ItemType } from './types'

export const BATCH_SIZE = 25
export const ITEMS_PAGE_SIZE = 50
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

export interface ItemsFilterUpdates {
  q?: string
  type?: string
  status?: string
  category_id?: string
  location_id?: string
  page?: string
  sort_by?: string
  sort_dir?: string
}

export function buildItemsUrl(
  pathname: string,
  params: ItemsFilterUpdates
): string {
  const query = new URLSearchParams()
  const q = params.q?.trim()
  if (q) query.set('q', q)
  if (params.type) query.set('type', params.type)
  if (params.status) query.set('status', params.status)
  if (params.category_id) query.set('category_id', params.category_id)
  if (params.location_id) query.set('location_id', params.location_id)
  if (params.page && params.page !== '1' && Number(params.page) > 1) query.set('page', params.page)
  if (params.sort_by) query.set('sort_by', params.sort_by)
  if (params.sort_dir) query.set('sort_dir', params.sort_dir)

  const serialized = query.toString()
  return serialized ? `${pathname}?${serialized}` : pathname
}
