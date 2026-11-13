import { ITEM_STATUSES } from './status'
import { normalizeForSearch } from '@/lib/unicode'
import type { ItemListSearchParams, ItemStatus, ItemType, ItemQualificationFilter } from './types'

export const BATCH_SIZE = 25
export const ITEMS_PAGE_SIZE = 50
export const itemTypes: readonly ItemType[] = ['material', 'asset']
export const itemStatuses: readonly ItemStatus[] = ITEM_STATUSES
export const itemQualificationStatuses: readonly ItemQualificationFilter[] = ['qualified', 'below_threshold', 'unclassified']
const sortColumns = ['updated_at', 'item_name', 'category', 'item_type', 'quantity', 'status', 'acquired_date', 'budget_source', 'unit_price', 'asset_no', 'gfmis_number', 'responsible_person'] as const
export type ItemSortColumn = typeof sortColumns[number]
export type ItemSortDirection = 'asc' | 'desc'
export const ascSortColumns: readonly ItemSortColumn[] = [
  'item_name',
  'category',
  'item_type',
  'acquired_date',
  'budget_source',
  'asset_no',
  'gfmis_number',
  'responsible_person',
]
export interface NormalizedItemListSearchParams {
  q: string
  type: ItemType | null
  qualification: ItemQualificationFilter | null
  status: ItemStatus | null
  category_id: string | null
  location_id: string | null
  is_central: boolean | null
  sort_by: ItemSortColumn
  sort_dir: ItemSortDirection
}

export function normalizeItemListSearchParams(params: ItemListSearchParams): NormalizedItemListSearchParams {
  const sort_by = sortColumns.includes(params.sort_by as ItemSortColumn) ? params.sort_by as ItemSortColumn : 'updated_at'
  const sort_dir: ItemSortDirection = params.sort_dir === 'asc' || params.sort_dir === 'desc'
    ? params.sort_dir
    : (ascSortColumns.includes(sort_by) ? 'asc' : 'desc')
  return {
    // Keep displayed rows aligned with the existing all-matching bulk actions.
    q: normalizeForSearch(params.q ?? '').replaceAll(',', ' '),
    type: itemTypes.includes(params.type as ItemType) ? params.type as ItemType : null,
    qualification: itemQualificationStatuses.includes(params.qualification as ItemQualificationFilter) ? params.qualification as ItemQualificationFilter : null,
    status: itemStatuses.includes(params.status as ItemStatus) ? params.status as ItemStatus : null,
    category_id: params.category_id || null,
    location_id: params.location_id || null,
    is_central: params.is_central === 'true' || params.is_central === '1' ? true : null,
    sort_by,
    sort_dir,
  }
}

export interface ItemsFilterUpdates {
  q?: string
  type?: string
  qualification?: string
  status?: string
  category_id?: string
  location_id?: string
  is_central?: string
  page?: string
  sort_by?: string
  sort_dir?: string
}

export function resolveItemPageParams<T extends ItemListSearchParams>(pathname: string, params: T): T {
  return pathname === '/central-items' ? { ...params, is_central: 'true' } : params
}

export function buildItemsUrl(
  pathname: string,
  params: ItemsFilterUpdates
): string {
  const query = new URLSearchParams()
  const q = params.q?.trim()
  if (q) query.set('q', q)
  if (params.type) query.set('type', params.type)
  if (params.qualification) query.set('qualification', params.qualification)
  if (params.status) query.set('status', params.status)
  if (params.category_id) query.set('category_id', params.category_id)
  if (params.location_id) query.set('location_id', params.location_id)
  if (pathname !== '/central-items' && params.is_central) query.set('is_central', params.is_central)
  if (params.page && params.page !== '1' && Number(params.page) > 1) query.set('page', params.page)
  if (params.sort_by) query.set('sort_by', params.sort_by)
  if (params.sort_dir) query.set('sort_dir', params.sort_dir)

  const serialized = query.toString()
  return serialized ? `${pathname}?${serialized}` : pathname
}
