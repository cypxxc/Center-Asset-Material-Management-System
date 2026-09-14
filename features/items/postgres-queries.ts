import 'server-only'

import { sql, type SQL } from 'drizzle-orm'
import { withUserDatabase } from '@/lib/postgres/request'
import { resolveLocalItemImageUrl } from '@/lib/postgres/storage'
import { getCurrentProfile } from '@/features/auth/queries'
import { normalizeForSearch } from '@/lib/unicode'
import type { ItemAuditLog, ItemDetail, ItemListResult, ItemListRow, ItemListSearchParams, ReferenceOption } from './types'
import type { LowStockDashboardItem } from './queries'

// Every fragment is static SQL or a bound value; URL parameters never become identifiers.
export const itemRelations = sql`left join public.categories c on c.id = i.category_id
  left join public.units u on u.id = i.unit_id
  left join public.locations l on l.id = i.location_id`

export const itemListColumns = sql`i.id, i.item_name, i.item_type, i.quantity, i.unit_price,
  i.asset_no, i.serial_no, i.responsible_person, i.status, i.updated_at,
  i.brand, i.model,
  case when c.id is null then null else json_build_object('id', c.id, 'name', c.name) end as category,
  case when u.id is null then null else json_build_object('id', u.id, 'name', u.name) end as unit,
  case when l.id is null then null else json_build_object('id', l.id, 'name', l.name) end as location`

export function itemFilters(params: ItemListSearchParams, validateEnums = false): SQL {
  const clauses = [sql`i.deleted_at is null`]
  const normalized = normalizeForSearch(params.q || '')
  const q = validateEnums ? normalized.replaceAll(',', ' ') : normalized
  if (q) {
    const pattern = `%${q}%`
    clauses.push(sql`(i.item_name ilike ${pattern} or i.asset_no ilike ${pattern}
      or i.serial_no ilike ${pattern} or i.brand ilike ${pattern}
      or i.model ilike ${pattern} or i.responsible_person ilike ${pattern})`)
  }
  if (params.type && (!validateEnums || ['material', 'asset'].includes(params.type))) {
    clauses.push(sql`i.item_type = ${params.type}`)
  }
  if (params.status && (!validateEnums || ['active', 'spare', 'damaged', 'waiting_repair', 'inactive', 'disposed'].includes(params.status))) {
    clauses.push(sql`i.status = ${params.status}`)
  }
  if (params.category_id) clauses.push(sql`i.category_id = ${params.category_id}::uuid`)
  if (params.location_id) clauses.push(sql`i.location_id = ${params.location_id}::uuid`)
  return sql.join(clauses, sql` and `)
}

export async function getPostgresItemReferences() {
  return withUserDatabase(async (tx) => {
    const categories = await tx.execute<ReferenceOption & Record<string, unknown>>(sql`select id, name from public.categories where is_active order by name`)
    const locations = await tx.execute<ReferenceOption & Record<string, unknown>>(sql`select id, name from public.locations where is_active order by name`)
    const units = await tx.execute<ReferenceOption & Record<string, unknown>>(sql`select id, name from public.units where is_active order by name`)
    return { categories: categories.rows, locations: locations.rows, units: units.rows }
  })
}

export async function getPostgresItems(params: ItemListSearchParams): Promise<ItemListResult> {
  const parsedPage = Number(params.page ?? '1')
  const page = Number.isFinite(parsedPage) && parsedPage > 0 ? Math.floor(parsedPage) : 1
  const pageSize = 10
  const columns: Record<string, SQL> = { item_name: sql`i.item_name`, item_type: sql`i.item_type`, quantity: sql`i.quantity`, status: sql`i.status` }
  const sortBy = params.sort_by ?? ''
  const order = Object.hasOwn(columns, sortBy) ? columns[sortBy] : sql`i.updated_at`
  const ascending = params.sort_dir === 'asc' || (params.sort_dir !== 'desc' && ['item_name', 'item_type'].includes(params.sort_by ?? ''))
  return withUserDatabase(async (tx) => {
    const where = itemFilters(params, true)
    const totals = await tx.execute<{ total: number }>(sql`select count(*)::int as total from public.items i where ${where}`)
    const rows = await tx.execute<ItemListRow & Record<string, unknown>>(sql`select ${itemListColumns}, i.note, i.image_url
      from public.items i ${itemRelations} where ${where}
      order by ${order} ${ascending ? sql`asc` : sql`desc`}, i.id limit ${pageSize} offset ${(page - 1) * pageSize}`)
    const total = totals.rows[0]?.total ?? 0
    return { items: rows.rows.map(item => ({ ...item, image_url: resolveLocalItemImageUrl(item.image_url ?? null) })), total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) }
  })
}

export async function getPostgresItemById(id: string): Promise<ItemDetail | null> {
  return withUserDatabase(async (tx) => {
    const rows = await tx.execute<ItemDetail & Record<string, unknown>>(sql`select ${itemListColumns}, i.note, i.image_url,
      i.depreciation_enabled, i.depreciation_method, i.depreciation_cost, i.depreciation_useful_life_years,
      i.depreciation_start_basis, i.depreciation_start_date, i.depreciation_residual_value, i.created_at
      from public.items i ${itemRelations} where i.id = ${id}::uuid and i.deleted_at is null limit 1`)
    const item = rows.rows[0]
    return item ? { ...item, image_url: resolveLocalItemImageUrl(item.image_url) } : null
  })
}

export async function getPostgresSidebarData() {
  return withUserDatabase(async (tx) => {
    type Bucket = { id: string; name: string; count: number }
    const categories = await tx.execute<Bucket>(sql`select c.id, c.name, count(i.id)::int as count
      from public.categories c left join public.items i on i.category_id = c.id and i.deleted_at is null and i.item_type = 'asset'
      where c.is_active group by c.id, c.name order by c.name`)
    const locations = await tx.execute<Bucket>(sql`select l.id, l.name, count(i.id)::int as count
      from public.locations l left join public.items i on i.location_id = l.id and i.deleted_at is null
      where l.is_active group by l.id, l.name order by l.name`)
    const counts = await tx.execute<{ total_assets: number; total_supplies: number; archive_count: number; trash_count: number }>(sql`select
      count(*) filter (where item_type = 'asset' and deleted_at is null)::int as total_assets,
      count(*) filter (where item_type = 'material' and deleted_at is null)::int as total_supplies,
      0 as archive_count, count(*) filter (where deleted_at is not null)::int as trash_count from public.items`)
    return { categories: categories.rows, locations: locations.rows, counts: counts.rows[0] }
  })
}

export async function getPostgresItemAuditLogs(itemId: string): Promise<ItemAuditLog[]> {
  const profile = await getCurrentProfile()
  if (!profile?.is_active || profile.role !== 'admin') return []
  return withUserDatabase(async (tx) => {
    const rows = await tx.execute<ItemAuditLog & Record<string, unknown>>(sql`select a.id, a.action, a.created_at,
      coalesce(nullif(p.full_name, ''), 'ระบบอัตโนมัติ') as user_name, a.old_data, a.new_data
      from public.audit_logs a left join public.profiles p on p.id = a.user_id
      where a.target_table = 'items' and a.target_id = ${itemId} order by a.created_at desc`)
    return rows.rows
  })
}

export async function getPostgresLowStockItems(limit = 5): Promise<LowStockDashboardItem[]> {
  return withUserDatabase(async (tx) => {
    const rows = await tx.execute<LowStockDashboardItem & Record<string, unknown>>(sql`select i.id, i.item_name, i.quantity,
      coalesce(nullif(l.name, ''), 'ไม่มีระบุสถานที่') as "locationName"
      from public.items i left join public.locations l on l.id = i.location_id
      where i.item_type = 'material' and i.quantity <= 5 and i.deleted_at is null
      order by i.quantity asc, i.id limit ${Number.isFinite(limit) ? Math.max(0, Math.floor(limit)) : 5}`)
    return rows.rows
  })
}
