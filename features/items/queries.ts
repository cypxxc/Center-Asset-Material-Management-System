import 'server-only'

import { cache } from 'react'
import { unstable_cache } from 'next/cache'
import { CACHE_TAGS } from '@/lib/cache-tags'
import { createClient, createServiceRoleClient } from '@/lib/supabase/server'
import { getCurrentProfile } from '@/features/auth/queries'
import { normalizeForSearch } from '@/lib/unicode'
import { logger } from '@/lib/logging'
import {
  ItemDetail,
  ItemListResult,
  ItemListRow,
  ItemListSearchParams,
  ItemStatus,
  ItemType,
  ReferenceOption,
} from './types'



const PAGE_SIZE = 10

const getCachedItemReferences = unstable_cache(
  async () => {
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

export function clearReferencesCache() {
  // no-op, cache is managed via Next.js revalidateTag
}

function parsePage(value: string | undefined) {
  const page = Number(value ?? '1')
  return Number.isFinite(page) && page > 0 ? Math.floor(page) : 1
}

function isItemType(value: string | undefined): value is ItemType {
  return value === 'material' || value === 'asset' || value === 'general'
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

export async function getItemReferences() {
  return getCachedItemReferences()
}


export async function getItems(params: ItemListSearchParams): Promise<ItemListResult> {
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

  if (params.status === 'archive') {
    query = query.in('status', ['inactive', 'disposed'])
  } else if (isItemStatus(params.status)) {
    query = query.eq('status', params.status)
  } else {
    // Hide inactive & disposed items from the main explorer by default
    query = query.not('status', 'in', '("inactive","disposed")')
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

  const { data, count, error } = await query.order(orderColumn, { ascending }).range(from, to)

  if (error) {
    throw new Error(error.message)
  }

  const total = count ?? 0

  return {
    items: ((data ?? []) as Parameters<typeof normalizeItemListRow>[0][]).map(normalizeItemListRow),
    total,
    page,
    pageSize: PAGE_SIZE,
    totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
  }
}

export async function getItemById(id: string): Promise<ItemDetail | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('items')
    .select(
      `
        id,
        item_name,
        item_type,
        quantity,
        asset_no,
        serial_no,
        brand,
        model,
        responsible_person,
        status,
        note,
        image_url,
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

  if (error) {
    throw new Error(error.message)
  }

  return data ? normalizeItemDetail(data as Parameters<typeof normalizeItemDetail>[0]) : null
}

export const getSidebarData = cache(async function getSidebarData() {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('get_sidebar_stats')

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
})


export async function getItemAuditLogs(itemId: string) {
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

// ============================================================
// Trash: Deleted Items Query
// ============================================================

export interface DeletedItemRow {
  id: string
  item_name: string
  item_type: ItemType
  quantity: number
  asset_no: string | null
  serial_no: string | null
  responsible_person: string | null
  status: ItemStatus
  deleted_at: string
  category: ReferenceOption | null
  unit: ReferenceOption | null
  location: ReferenceOption | null
}

export interface DeletedItemsResult {
  items: DeletedItemRow[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export async function getDeletedItems(params: ItemListSearchParams): Promise<DeletedItemsResult> {
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
        asset_no,
        serial_no,
        responsible_person,
        status,
        deleted_at,
        category:categories(id, name),
        unit:units(id, name),
        location:locations(id, name)
      `,
      { count: 'exact' }
    )
    .not('deleted_at', 'is', null)

  if (q) {
    const safe = q.replaceAll(',', ' ')
    query = query.or(
      `item_name.ilike.%${safe}%,asset_no.ilike.%${safe}%,serial_no.ilike.%${safe}%,responsible_person.ilike.%${safe}%`
    )
  }

  if (isItemType(params.type)) {
    query = query.eq('item_type', params.type)
  }

  let orderColumn = 'deleted_at'
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

  const { data, count, error } = await query.order(orderColumn, { ascending }).range(from, to)

  if (error) {
    throw new Error(error.message)
  }

  const total = count ?? 0

  return {
    items: ((data ?? []) as (Omit<DeletedItemRow, 'category' | 'unit' | 'location'> & {
      category: ReferenceOption | ReferenceOption[] | null
      unit: ReferenceOption | ReferenceOption[] | null
      location: ReferenceOption | ReferenceOption[] | null
    })[]).map((row) => ({
      ...row,
      deleted_at: row.deleted_at as string,
      category: firstRelation(row.category),
      unit: firstRelation(row.unit),
      location: firstRelation(row.location),
    })),
    total,
    page,
    pageSize: PAGE_SIZE,
    totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
  }
}
