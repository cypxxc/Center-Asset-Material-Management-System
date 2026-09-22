import 'server-only'

import { isPostgresBackend } from '@/lib/backend'
import { getPostgresItemReferences, getPostgresItems, getPostgresItemBatch, getPostgresItemById, getPostgresSidebarData, getPostgresItemAuditLogs, getPostgresLowStockItems } from './postgres-queries'

import { cache } from 'react'
import { unstable_cache } from 'next/cache'
import { CACHE_TAGS } from '@/lib/cache-tags'
import { resolvePrivateItemImageUrl } from '@/lib/supabase/storage'
import { createClient, createServiceRoleClient } from '@/lib/supabase/server'
import { getCurrentProfile } from '@/features/auth/queries'
import { getDevelopmentSessionUser } from '@/features/auth/dev-auth'
import { normalizeForSearch } from '@/lib/unicode'
import { logger } from '@/lib/logging'
import { measureQuery } from '@/lib/performance'
import {
  ItemAuditLog,
  ItemDetail,
  ItemListResult,
  ItemBatchResult,
  ItemListRow,
  ItemListSearchParams,
  ItemStatus,
  ItemType,
  ReferenceOption,
} from './types'
import { BATCH_SIZE, decodeItemCursor, encodeItemCursor, escapePostgrestLiteral, normalizeItemListSearchParams, type ItemCursorKey } from './cursor'

async function getEffectiveClient() {
  const devSessionUser = await getDevelopmentSessionUser()
  if (devSessionUser) {
    return createServiceRoleClient()
  }
  return createClient()
}

const PAGE_SIZE = 10

/**
 * Fetches item reference options (categories, locations, units) concurrently via Promise.all
 * using explicit column projections (`id, name`) to minimize network payload size,
 * and caches the result using Next.js unstable_cache.
 */
const getCachedItemReferences = unstable_cache(
  async (): Promise<{
    categories: ReferenceOption[]
    locations: ReferenceOption[]
    units: ReferenceOption[]
  }> => {
    const supabase = createServiceRoleClient()

    const [categories, locations, units] = await Promise.all([
      supabase.from('categories').select('id, name').eq('is_active', true).order('name'),
      supabase.from('locations').select('id, name').eq('is_active', true).order('name'),
      supabase.from('units').select('id, name').eq('is_active', true).order('name'),
    ])

    if (categories.error || locations.error || units.error) {
      logger.error({
        operation: 'getItemReferences',
        feature: 'items',
        details: {
          categories: categories.error?.message,
          locations: locations.error?.message,
          units: units.error?.message,
        }
      })
      return {
        categories: (categories.data ?? []) as ReferenceOption[],
        locations: (locations.data ?? []) as ReferenceOption[],
        units: (units.data ?? []) as ReferenceOption[],
      }
    }

    return {
      categories: (categories.data ?? []) as ReferenceOption[],
      locations: (locations.data ?? []) as ReferenceOption[],
      units: (units.data ?? []) as ReferenceOption[],
    }
  },
  [CACHE_TAGS.ITEM_REFERENCES],
  { tags: [CACHE_TAGS.ITEM_REFERENCES], revalidate: 3600 }
)

function parsePage(value: string | undefined) {
  const page = Number(value ?? '1')
  return Number.isFinite(page) && page > 0 ? Math.floor(page) : 1
}

function isItemType(value: string | undefined): value is ItemType {
  return value === 'material' || value === 'asset'
}

function isItemStatus(value: string | undefined): value is ItemStatus {
  return (
    value === 'active' ||
    value === 'spare' ||
    value === 'damaged' ||
    value === 'waiting_repair' ||
    value === 'inactive' ||
    value === 'disposed'
  )
}

function firstRelation<T>(value: T | T[] | null): T | null {
  if (Array.isArray(value)) return value[0] ?? null
  return value
}

function normalizeItemListRow(row: Omit<ItemListRow, 'category' | 'unit' | 'location'> & {
  category: ReferenceOption | ReferenceOption[] | null
  unit: ReferenceOption | ReferenceOption[] | null
  location: ReferenceOption | ReferenceOption[] | null
}): ItemListRow {
  return {
    ...row,
    category: firstRelation(row.category),
    unit: firstRelation(row.unit),
    location: firstRelation(row.location),
  }
}

function normalizeItemDetail(row: Omit<ItemDetail, 'category' | 'unit' | 'location'> & {
  category: ReferenceOption | ReferenceOption[] | null
  unit: ReferenceOption | ReferenceOption[] | null
  location: ReferenceOption | ReferenceOption[] | null
}): ItemDetail {
  return {
    ...row,
    category: firstRelation(row.category),
    unit: firstRelation(row.unit),
    location: firstRelation(row.location),
  }
}

async function signItemImage<T extends { image_url?: string | null }>(
  supabase: Awaited<ReturnType<typeof getEffectiveClient>>,
  item: T
): Promise<T> {
  if (!item.image_url) return item

  const imageUrl = await resolvePrivateItemImageUrl(
    item.image_url,
    (path, expiresIn) => supabase.storage.from('item-images').createSignedUrl(path, expiresIn)
  )

  return { ...item, image_url: imageUrl }
}

/**
 * Returns active item reference options (categories, locations, units) with trimmed `id, name` projections.
 */
export async function getItemReferences(): Promise<{
  categories: ReferenceOption[]
  locations: ReferenceOption[]
  units: ReferenceOption[]
}> {
  if (isPostgresBackend()) return getPostgresItemReferences()
  return getCachedItemReferences()
}

const getCachedSidebarData = unstable_cache(
  async () => {
    const supabase = createServiceRoleClient()
    const {
      result: { data, error },
    } = await measureQuery('items.getSidebarData', () => supabase.rpc('get_sidebar_stats'))

    if (error || !data) {
      return {
        categories: [],
        locations: [],
        counts: {
          total_assets: 0,
          total_supplies: 0,
          archive_count: 0,
          trash_count: 0,
        },
      }
    }

    return data as {
      categories: { id: string; name: string; count: number }[]
      locations: { id: string; name: string; count: number }[]
      counts: {
        total_assets: number
        total_supplies: number
        archive_count: number
        trash_count: number
      }
    }
  },
  [CACHE_TAGS.SIDEBAR_DATA],
  { tags: [CACHE_TAGS.SIDEBAR_DATA], revalidate: 300 }
)

export async function getItems(params: ItemListSearchParams): Promise<ItemListResult> {
  if (isPostgresBackend()) return getPostgresItems(params)
  const supabase = await createClient()
  const page = parsePage(params.page)
  const from = (page - 1) * PAGE_SIZE
  const to = from + PAGE_SIZE - 1
  const q = normalizeForSearch(params.q || '')

  let query = supabase
    .from('items')
    .select(
      `
        id,
        item_name,
        item_type,
        quantity,
        unit_price,
        asset_no,
        serial_no,
        responsible_person,
        status,
        updated_at,
        brand,
        model,
        note,
        image_url,
        category:categories(id, name),
        unit:units(id, name),
        location:locations(id, name)
      `,
      { count: 'exact' }
    )

    .is('deleted_at', null)

  if (q) {
    const safe = q.replaceAll(',', ' ')
    query = query.or(
      `item_name.ilike.%${safe}%,asset_no.ilike.%${safe}%,serial_no.ilike.%${safe}%,brand.ilike.%${safe}%,model.ilike.%${safe}%,responsible_person.ilike.%${safe}%`
    )
  }

  if (isItemType(params.type)) {
    query = query.eq('item_type', params.type)
  }

  if (isItemStatus(params.status)) {
    query = query.eq('status', params.status)
  }

  if (params.category_id) {
    query = query.eq('category_id', params.category_id)
  }

  if (params.location_id) {
    query = query.eq('location_id', params.location_id)
  }

  let orderColumn = 'updated_at'
  let ascending = false

  if (params.sort_by) {
    if (params.sort_by === 'item_name') {
      orderColumn = 'item_name'
    } else if (params.sort_by === 'item_type') {
      orderColumn = 'item_type'
    } else if (params.sort_by === 'quantity') {
      orderColumn = 'quantity'
    } else if (params.sort_by === 'status') {
      orderColumn = 'status'
    }
  }

  if (params.sort_dir === 'asc') {
    ascending = true
  } else if (params.sort_dir === 'desc') {
    ascending = false
  } else {
    if (params.sort_by === 'item_name' || params.sort_by === 'item_type') {
      ascending = true
    } else {
      ascending = false
    }
  }

  const {
    result: { data, count, error },
  } = await measureQuery('items.getItems', () =>
    query.order(orderColumn, { ascending }).range(from, to)
  )

  if (error) {
    throw new Error('Unable to load item data')
  }

  const total = count ?? 0

  const items = await Promise.all(
    ((data ?? []) as Parameters<typeof normalizeItemListRow>[0][])
      .map(normalizeItemListRow)
      .map((item) => signItemImage(supabase, item))
  )

  return {
    items,
    total,
    page,
    pageSize: PAGE_SIZE,
    totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
  }
}

export async function getItemBatch(params: ItemListSearchParams, cursor?: string): Promise<ItemBatchResult> {
  const normalized = normalizeItemListSearchParams(params)
  const cursorValue = cursor ? decodeItemCursor(cursor, normalized) : null
  if (isPostgresBackend()) return getPostgresItemBatch(normalized, cursorValue)

  const supabase = await getEffectiveClient()
  let query = supabase
    .from('items')
    .select(
      `
        id, item_name, item_type, quantity, unit_price, asset_no, serial_no,
        responsible_person, status, updated_at, brand, model, note, image_url,
        category:categories(id, name), unit:units(id, name), location:locations(id, name)
      `,
      cursorValue ? undefined : { count: 'exact' },
    )
    .is('deleted_at', null)

  if (normalized.q) {
    const pattern = escapePostgrestLiteral(`%${normalized.q}%`)
    query = query.or([
      'item_name', 'asset_no', 'serial_no', 'brand', 'model', 'responsible_person',
    ].map((column) => `${column}.ilike.${pattern}`).join(','))
  }
  if (normalized.type) query = query.eq('item_type', normalized.type)
  if (normalized.status) query = query.eq('status', normalized.status)
  if (normalized.category_id) query = query.eq('category_id', normalized.category_id)
  if (normalized.location_id) query = query.eq('location_id', normalized.location_id)

  if (cursorValue) {
    const column = normalized.sort_by
    const comparator = normalized.sort_dir === 'asc' ? 'gt' : 'lt'
    const key = typeof cursorValue.key === 'number' ? String(cursorValue.key) : escapePostgrestLiteral(cursorValue.key)
    const id = escapePostgrestLiteral(cursorValue.id)
    query = query.or(`${column}.${comparator}.${key},and(${column}.eq.${key},id.${comparator}.${id})`)
  }

  const { data, count, error } = await query
    .order(normalized.sort_by, { ascending: normalized.sort_dir === 'asc' })
    .order('id', { ascending: normalized.sort_dir === 'asc' })
    .limit(BATCH_SIZE + 1)

  if (error) throw new Error('Unable to load item data')
  const rows = ((data ?? []) as Parameters<typeof normalizeItemListRow>[0][]).map(normalizeItemListRow)
  const hasMore = rows.length > BATCH_SIZE
  const page = rows.slice(0, BATCH_SIZE)
  const items = await Promise.all(page.map((item) => signItemImage(supabase, item)))
  const last = items.at(-1)
  return {
    items,
    total: cursorValue ? null : (count ?? 0),
    nextCursor: hasMore && last ? encodeItemCursor(normalized, last[normalized.sort_by] as ItemCursorKey, last.id) : null,
  }
}

export async function getItemById(id: string): Promise<ItemDetail | null> {
  if (isPostgresBackend()) return getPostgresItemById(id)
  const supabase = await createClient()
  const {
    result: { data, error },
  } = await measureQuery('items.getItemById', () =>
    supabase
      .from('items')
      .select(
        `
        id,
        item_name,
        item_type,
        quantity,
        unit_price,
        asset_no,
        serial_no,
        brand,
        model,
        responsible_person,
        status,
        note,
        image_url,
        depreciation_enabled,
        depreciation_method,
        depreciation_cost,
        depreciation_useful_life_years,
        depreciation_start_basis,
        depreciation_start_date,
        depreciation_residual_value,
        created_at,
        updated_at,
        category:categories(id, name),
        unit:units(id, name),
        location:locations(id, name)
      `
      )
      .eq('id', id)
      .is('deleted_at', null)
      .maybeSingle()
  )

  if (error) {
    throw new Error('Unable to load item data')
  }

  return data
    ? signItemImage(supabase, normalizeItemDetail(data as Parameters<typeof normalizeItemDetail>[0]))
    : null
}

export const getSidebarData = cache(async function getSidebarData() {
  if (isPostgresBackend()) return getPostgresSidebarData()
  return getCachedSidebarData()
})

export async function getItemAuditLogs(itemId: string): Promise<ItemAuditLog[]> {
  if (isPostgresBackend()) return getPostgresItemAuditLogs(itemId)
  const profile = await getCurrentProfile()
  if (!profile || profile.role !== 'admin') {
    return []
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('audit_logs')
    .select(`
      id,
      action,
      created_at,
      profiles:user_id(full_name),
      old_data,
      new_data
    `)
    .eq('target_table', 'items')
    .eq('target_id', itemId)
    .order('created_at', { ascending: false })

  if (error) {
    logger.error({ operation: 'getItemAuditLogs', feature: 'items', details: { itemId } }, error)
    return []
  }

  interface AuditLogQueryResult {
    id: string
    action: string
    created_at: string
    profiles: { full_name: string | null } | { full_name: string | null }[] | null
    old_data: unknown
    new_data: unknown
  }

  return ((data || []) as unknown as AuditLogQueryResult[]).map((log) => {
    const profileObj = Array.isArray(log.profiles) ? log.profiles[0] : log.profiles
    return {
      id: log.id,
      action: log.action,
      created_at: log.created_at,
      user_name: profileObj?.full_name || 'ระบบอัตโนมัติ',
      old_data: log.old_data as Record<string, unknown> | null,
      new_data: log.new_data as Record<string, unknown> | null,
    }
  })
}

export interface LowStockDashboardItem {
  id: string
  item_name: string
  quantity: number
  locationName: string
}

export const getLowStockItems = cache(async function getLowStockItems(
  limit = 5
): Promise<LowStockDashboardItem[]> {
  if (isPostgresBackend()) return getPostgresLowStockItems(limit)
  const supabase = await createClient()
  const {
    result: { data, error },
  } = await measureQuery('items.getLowStockItems', () =>
    supabase
      .from('items')
      .select('id, item_name, quantity, location:locations(name)')
      .eq('item_type', 'material')
      .lte('quantity', 5)
      .is('deleted_at', null)
      .order('quantity', { ascending: true })
      .limit(limit)
  )

  if (error || !data) {
    if (error) {
      logger.error({ operation: 'getLowStockItems', feature: 'items' }, error)
    }
    return []
  }

  type RawItem = {
    id: string
    item_name: string
    quantity: number
    location: { name: string } | { name: string }[] | null
  }

  return (data as unknown as RawItem[]).map((item) => {
    const locObj = item.location
    const locationName = Array.isArray(locObj) ? locObj[0]?.name : locObj?.name
    return {
      id: item.id,
      item_name: item.item_name,
      quantity: item.quantity,
      locationName: locationName || 'ไม่มีระบุสถานที่',
    }
  })
})
