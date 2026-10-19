import 'server-only'

import { isPostgresBackend } from '@/lib/backend'
import { getPostgresItemReferences, getPostgresItems, getPostgresItemBatch, getPostgresItemById, getPostgresSidebarData, getPostgresItemAuditLogs, getPostgresLowStockItems, getPostgresUrgentDamagedItems } from './postgres-queries'

import { cache } from 'react'
import { unstable_cache } from 'next/cache'
import { CACHE_TAGS } from '@/lib/cache-tags'
import { resolvePrivateItemImageUrl, resolvePrivateItemImageUrlsBatch } from '@/lib/supabase/storage'
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
  ItemDetailPageData,
  ItemEditPageData,
  ItemsExplorerPageData,
  DashboardLayoutData,
  UrgentDamagedItem,
} from './types'
export type { UrgentDamagedItem } from './types'
import { BATCH_SIZE, ITEMS_PAGE_SIZE } from './list-params'
import { decodeItemCursor, encodeItemCursor, escapePostgrestLiteral, normalizeItemListSearchParams, type ItemCursorKey } from './cursor'

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
      supabase.from('categories').select('id, name, color').eq('is_active', true).order('name'),
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

interface CachedSignedUrl {
  signedUrl: string
  expiresAt: number
}

const signedUrlCache = new Map<string, CachedSignedUrl>()
// Safe TTL: 45 minutes (75% of the 60-minute Supabase signed URL expiry window)
const SIGNED_URL_TTL_MS = 45 * 60 * 1000

function getCachedSignedUrl(rawUrl: string): string | null {
  const cached = signedUrlCache.get(rawUrl)
  if (cached && cached.expiresAt > Date.now()) {
    return cached.signedUrl
  }
  return null
}

function setCachedSignedUrl(rawUrl: string, signedUrl: string): void {
  if (signedUrlCache.size > 2000) {
    const oldestKey = signedUrlCache.keys().next().value
    if (oldestKey) signedUrlCache.delete(oldestKey)
  }
  signedUrlCache.set(rawUrl, {
    signedUrl,
    expiresAt: Date.now() + SIGNED_URL_TTL_MS,
  })
}

async function signItemImage<T extends { image_url?: string | null }>(
  supabase: Awaited<ReturnType<typeof getEffectiveClient>>,
  item: T
): Promise<T> {
  if (!item.image_url) return item

  const cached = getCachedSignedUrl(item.image_url)
  if (cached) {
    return { ...item, image_url: cached }
  }

  const imageUrl = await resolvePrivateItemImageUrl(
    item.image_url,
    (path, expiresIn) => supabase.storage.from('item-images').createSignedUrl(path, expiresIn)
  )

  if (imageUrl) {
    setCachedSignedUrl(item.image_url, imageUrl)
  }

  return { ...item, image_url: imageUrl }
}

async function signItemImagesBatch<T extends { image_url?: string | null }>(
  supabase: Awaited<ReturnType<typeof getEffectiveClient>>,
  items: T[]
): Promise<T[]> {
  if (items.length === 0) return items

  const missingIndices: number[] = []
  const missingUrls: (string | null | undefined)[] = []
  const resolvedUrls: (string | null)[] = new Array(items.length).fill(null)

  items.forEach((item, index) => {
    if (!item.image_url) return
    const cached = getCachedSignedUrl(item.image_url)
    if (cached) {
      resolvedUrls[index] = cached
    } else {
      missingIndices.push(index)
      missingUrls.push(item.image_url)
    }
  })

  if (missingUrls.length > 0) {
    const signedUrls = await resolvePrivateItemImageUrlsBatch(
      missingUrls,
      (paths, expiresIn) => supabase.storage.from('item-images').createSignedUrls(paths, expiresIn)
    )
    signedUrls.forEach((signedUrl, i) => {
      const originalIndex = missingIndices[i]
      const rawUrl = missingUrls[i]
      resolvedUrls[originalIndex] = signedUrl
      if (signedUrl && rawUrl) {
        setCachedSignedUrl(rawUrl, signedUrl)
      }
    })
  }

  return items.map((item, index) => ({
    ...item,
    image_url: resolvedUrls[index] ?? (item.image_url ? null : item.image_url),
  }))
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
  { tags: [CACHE_TAGS.SIDEBAR_DATA, CACHE_TAGS.ITEM_REFERENCES], revalidate: 300 }
)

export async function getItems(params: ItemListSearchParams, pageSize: number = PAGE_SIZE): Promise<ItemListResult> {
  if (isPostgresBackend()) return getPostgresItems(params, pageSize)
  const supabase = await createClient()
  const page = parsePage(params.page)
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1
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
        category_id,
        unit_id,
        location_id
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

  const [references, { result: { data, count, error } }] = await Promise.all([
    getItemReferences(),
    measureQuery('items.getItems', () =>
      query
        .order(orderColumn, { ascending })
        .order('id', { ascending })
        .range(from, to)
    ),
  ])

  if (error) {
    throw new Error('Unable to load item data')
  }

  const catMap = new Map<string, ReferenceOption>()
  references.categories.forEach((c) => catMap.set(c.id, c))
  const unitMap = new Map<string, ReferenceOption>()
  references.units.forEach((u) => unitMap.set(u.id, u))
  const locMap = new Map<string, ReferenceOption>()
  references.locations.forEach((l) => locMap.set(l.id, l))

  type ItemFkRow = {
    id: string
    item_name: string
    item_type: ItemType
    quantity: number
    unit_price: number | null
    asset_no: string | null
    serial_no: string | null
    responsible_person: string | null
    status: ItemStatus
    updated_at: string
    brand: string | null
    model: string | null
    note: string | null
    image_url: string | null
    category_id: string | null
    unit_id: string | null
    location_id: string | null
  }

  const hydratedRows: ItemListRow[] = ((data ?? []) as unknown as ItemFkRow[]).map((row) => ({
    id: row.id,
    item_name: row.item_name,
    item_type: row.item_type,
    quantity: row.quantity,
    unit_price: row.unit_price,
    asset_no: row.asset_no,
    serial_no: row.serial_no,
    responsible_person: row.responsible_person,
    status: row.status,
    updated_at: row.updated_at,
    brand: row.brand,
    model: row.model,
    note: row.note,
    image_url: row.image_url,
    category: row.category_id ? catMap.get(row.category_id) ?? null : null,
    unit: row.unit_id ? unitMap.get(row.unit_id) ?? null : null,
    location: row.location_id ? locMap.get(row.location_id) ?? null : null,
  }))

  const total = count ?? 0
  const items = await signItemImagesBatch(supabase, hydratedRows)

  return {
    items,
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
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
        category_id, unit_id, location_id
      `,
      cursorValue ? undefined : { count: 'exact' },
    )
    .is('deleted_at', null)

  if (normalized.q) {
    const safeQ = normalized.q.replaceAll(',', ' ')
    const pattern = escapePostgrestLiteral(`%${safeQ}%`)
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

  const [references, { data, count, error }] = await Promise.all([
    getItemReferences(),
    query
      .order(normalized.sort_by, { ascending: normalized.sort_dir === 'asc' })
      .order('id', { ascending: normalized.sort_dir === 'asc' })
      .limit(BATCH_SIZE + 1),
  ])

  if (error) throw new Error('Unable to load item data')

  const catMap = new Map<string, ReferenceOption>()
  references.categories.forEach((c) => catMap.set(c.id, c))
  const unitMap = new Map<string, ReferenceOption>()
  references.units.forEach((u) => unitMap.set(u.id, u))
  const locMap = new Map<string, ReferenceOption>()
  references.locations.forEach((l) => locMap.set(l.id, l))

  type ItemFkRow = {
    id: string
    item_name: string
    item_type: ItemType
    quantity: number
    unit_price: number | null
    asset_no: string | null
    serial_no: string | null
    responsible_person: string | null
    status: ItemStatus
    updated_at: string
    brand: string | null
    model: string | null
    note: string | null
    image_url: string | null
    category_id: string | null
    unit_id: string | null
    location_id: string | null
  }

  const rows: ItemListRow[] = ((data ?? []) as unknown as ItemFkRow[]).map((row) => ({
    id: row.id,
    item_name: row.item_name,
    item_type: row.item_type,
    quantity: row.quantity,
    unit_price: row.unit_price,
    asset_no: row.asset_no,
    serial_no: row.serial_no,
    responsible_person: row.responsible_person,
    status: row.status,
    updated_at: row.updated_at,
    brand: row.brand,
    model: row.model,
    note: row.note,
    image_url: row.image_url,
    category: row.category_id ? catMap.get(row.category_id) ?? null : null,
    unit: row.unit_id ? unitMap.get(row.unit_id) ?? null : null,
    location: row.location_id ? locMap.get(row.location_id) ?? null : null,
  }))

  const hasMore = rows.length > BATCH_SIZE
  const page = rows.slice(0, BATCH_SIZE)
  const items = await signItemImagesBatch(supabase, page)
  const last = items.at(-1)
  return {
    items,
    total: cursorValue ? null : (count ?? 0),
    nextCursor: hasMore && last ? encodeItemCursor(normalized, last[normalized.sort_by] as ItemCursorKey, last.id) : null,
  }
}

export async function getItemById(id: string): Promise<ItemDetail | null> {
  if (isPostgresBackend()) return getPostgresItemById(id)
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
  const supabase = await createClient()

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
      category_id,
      unit_id,
      location_id
    `
    )
    .is('deleted_at', null)

  if (isUuid) {
    query = query.eq('id', id)
  } else {
    query = query.or(`asset_no.eq.${id},serial_no.eq.${id}`)
  }

  const [references, { result: { data, error } }] = await Promise.all([
    getItemReferences(),
    measureQuery('items.getItemById', () => query.maybeSingle()),
  ])

  if (error) {
    throw new Error('Unable to load item data')
  }

  if (!data) return null

  const raw = data as Record<string, unknown>
  const catMap = new Map<string, ReferenceOption>()
  references.categories.forEach((c) => catMap.set(c.id, c))
  const unitMap = new Map<string, ReferenceOption>()
  references.units.forEach((u) => unitMap.set(u.id, u))
  const locMap = new Map<string, ReferenceOption>()
  references.locations.forEach((l) => locMap.set(l.id, l))

  const detail: ItemDetail = {
    ...(raw as unknown as Omit<ItemDetail, 'category' | 'unit' | 'location'>),
    category: raw.category_id ? catMap.get(raw.category_id as string) ?? null : null,
    unit: raw.unit_id ? unitMap.get(raw.unit_id as string) ?? null : null,
    location: raw.location_id ? locMap.get(raw.location_id as string) ?? null : null,
  }

  return signItemImage(supabase, detail)
}

export async function getPublicPassportItem(id: string): Promise<ItemDetail | null> {
  if (isPostgresBackend()) return getPostgresItemById(id)
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return null
  const { createAdminClient } = await import('@/lib/supabase/server')
  const adminClient = await createAdminClient()
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
  let adminQuery = adminClient
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
      category_id,
      unit_id,
      location_id
    `
    )
    .is('deleted_at', null)

  if (isUuid) {
    adminQuery = adminQuery.eq('id', id)
  } else {
    adminQuery = adminQuery.or(`asset_no.eq.${id},serial_no.eq.${id}`)
  }

  const [references, { data: adminData, error: adminError }] = await Promise.all([
    getItemReferences(),
    adminQuery.maybeSingle(),
  ])
  if (adminError || !adminData) return null

  const raw = adminData as Record<string, unknown>
  const catMap = new Map<string, ReferenceOption>()
  references.categories.forEach((c) => catMap.set(c.id, c))
  const unitMap = new Map<string, ReferenceOption>()
  references.units.forEach((u) => unitMap.set(u.id, u))
  const locMap = new Map<string, ReferenceOption>()
  references.locations.forEach((l) => locMap.set(l.id, l))

  const detail: ItemDetail = {
    ...(raw as unknown as Omit<ItemDetail, 'category' | 'unit' | 'location'>),
    category: raw.category_id ? catMap.get(raw.category_id as string) ?? null : null,
    unit: raw.unit_id ? unitMap.get(raw.unit_id as string) ?? null : null,
    location: raw.location_id ? locMap.get(raw.location_id as string) ?? null : null,
  }

  return signItemImage(adminClient, detail)
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

export async function getItemDetailPageData(id: string): Promise<ItemDetailPageData> {
  const profile = await getCurrentProfile()
  let itemResult: ItemDetail | null = null
  let auditLogResults: ItemAuditLog[] = []

  try {
    const [item, logs] = await Promise.all([
      getItemById(id),
      getItemAuditLogs(id),
    ])
    itemResult = item
    auditLogResults = logs
  } catch (err) {
    if (!profile && process.env.SUPABASE_SERVICE_ROLE_KEY) {
      itemResult = await getPublicPassportItem(id)
    } else {
      throw err
    }
  }

  if (!profile && !itemResult && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    itemResult = await getPublicPassportItem(id)
  }

  return {
    item: (itemResult as ItemDetail | null) ?? null,
    auditLogs: (auditLogResults as ItemAuditLog[]) ?? [],
  }
}

export async function getItemEditPageData(id: string): Promise<ItemEditPageData> {
  const [item, references] = await Promise.all([
    getItemById(id),
    getItemReferences(),
  ])

  return {
    item: (item as ItemDetail | null) ?? null,
    references,
  }
}

export async function getItemsExplorerPageData(
  params: ItemListSearchParams
): Promise<ItemsExplorerPageData> {
  const [references, result] = await Promise.all([
    getItemReferences(),
    getItems(params, ITEMS_PAGE_SIZE),
  ])

  return {
    items: result.items,
    total: result.total,
    page: result.page,
    pageSize: result.pageSize,
    totalPages: result.totalPages,
    references,
  }
}

export const getDashboardLayoutData = cache(async function getDashboardLayoutData(): Promise<DashboardLayoutData> {
  const [sidebarData, references] = await Promise.all([
    getSidebarData(),
    getItemReferences(),
  ])

  return {
    sidebarData,
    references,
  }
})

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

export const getUrgentDamagedItems = cache(async function getUrgentDamagedItems(
  limit = 5
): Promise<UrgentDamagedItem[]> {
  if (isPostgresBackend()) return getPostgresUrgentDamagedItems(limit)
  const supabase = await createClient()
  const safeLimit = Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : 5

  const {
    result: { data, error },
  } = await measureQuery('items.getUrgentDamagedItems', () =>
    supabase
      .from('items')
      .select('id, item_name, asset_no, status, updated_at, image_url, location:locations(name)')
      .in('status', ['damaged', 'waiting_repair'])
      .is('deleted_at', null)
      .order('updated_at', { ascending: false })
      .limit(safeLimit)
  )

  if (error || !data) {
    if (error) {
      logger.error({ operation: 'getUrgentDamagedItems', feature: 'items' }, error)
    }
    return []
  }

  type RawItem = {
    id: string
    item_name: string
    asset_no: string | null
    status: string
    updated_at: string
    image_url: string | null
    location: { name: string } | { name: string }[] | null
  }

  const items: UrgentDamagedItem[] = (data as unknown as RawItem[]).map((item) => {
    const locObj = item.location
    const locationName = Array.isArray(locObj) ? locObj[0]?.name : locObj?.name
    return {
      id: item.id,
      item_name: item.item_name,
      asset_no: item.asset_no,
      locationName: locationName || 'ไม่มีระบุสถานที่',
      status: item.status,
      updated_at: item.updated_at,
      image_url: item.image_url,
    }
  })

  return signItemImagesBatch(supabase, items)
})

