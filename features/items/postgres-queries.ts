import 'server-only'

import { sql, type SQL } from 'drizzle-orm'
import { withUserDatabase } from '@/lib/postgres/request'
import { resolveLocalItemImageUrl } from '@/lib/postgres/storage'
import { getCurrentProfile } from '@/features/auth/queries'
import { AuthorizationError } from '@/lib/errors'
import { normalizeForSearch } from '@/lib/unicode'
import { ITEM_STATUS_LABELS, type ItemAuditLog, type ItemBatchResult, type ItemDetail, type ItemListResult, type ItemListRow, type ItemListSearchParams, type ReferenceOption, type UrgentDamagedItem } from './types'
import type { LowStockDashboardItem } from './queries'
import { BATCH_SIZE, encodeItemCursor, type ItemCursorKey, type NormalizedItemListSearchParams } from './cursor'

// Every fragment is static SQL or a bound value; URL parameters never become identifiers.
export const itemRelations = sql`left join public.categories c on c.id = i.category_id
  left join public.units u on u.id = i.unit_id
  left join public.locations l on l.id = i.location_id`

export const itemListColumns = sql`i.id, i.item_name, i.item_type, i.qualification_status, i.quantity, i.unit_price,
  i.asset_no, i.serial_no, i.responsible_person, i.status, i.updated_at,
  i.brand, i.model, i.note, i.is_central,
  EXISTS (
    SELECT 1 FROM public.disbursement_items di
    JOIN public.disbursements d ON d.id = di.disbursement_id
    WHERE di.item_id = i.id
      AND d.status IN ('active_borrow', 'partially_returned')
      AND di.status NOT IN ('returned', 'reversed')
  ) as is_borrowed,
  i.gfmis_number, i.budget_source, i.acquired_date::text as acquired_date,
  case when c.id is null then null else json_build_object('id', c.id, 'name', c.name, 'color', c.color) end as category,
  case when u.id is null then null else json_build_object('id', u.id, 'name', u.name) end as unit,
  case when l.id is null then null else json_build_object('id', l.id, 'name', l.name) end as location`

const itemBatchColumns = sql`i.id, i.item_name, i.item_type, i.qualification_status, i.quantity, i.unit_price,
  i.asset_no, i.serial_no, i.responsible_person, i.status, i.updated_at::text as updated_at,
  i.brand, i.model, i.note, i.is_central,
  EXISTS (
    SELECT 1 FROM public.disbursement_items di
    JOIN public.disbursements d ON d.id = di.disbursement_id
    WHERE di.item_id = i.id
      AND d.status IN ('active_borrow', 'partially_returned')
      AND di.status NOT IN ('returned', 'reversed')
  ) as is_borrowed,
  i.gfmis_number, i.budget_source, i.acquired_date::text as acquired_date,
  case when c.id is null then null else json_build_object('id', c.id, 'name', c.name, 'color', c.color) end as category,
  case when u.id is null then null else json_build_object('id', u.id, 'name', u.name) end as unit,
  case when l.id is null then null else json_build_object('id', l.id, 'name', l.name) end as location`

export function itemFilters(params: ItemListSearchParams | NormalizedItemListSearchParams, validateEnums = false, normalizedSearch?: string): SQL {
  const clauses = [sql`i.deleted_at is null`]
  const normalized = normalizedSearch ?? normalizeForSearch(params.q || '')
  const q = validateEnums ? normalized.replaceAll(',', ' ') : normalized
  if (q) {
    const pattern = `%${q}%`
    const searchConditions: SQL[] = [
      sql`i.item_name ilike ${pattern}`,
      sql`i.asset_no ilike ${pattern}`,
      sql`i.serial_no ilike ${pattern}`,
      sql`i.brand ilike ${pattern}`,
      sql`i.model ilike ${pattern}`,
      sql`i.responsible_person ilike ${pattern}`,
      sql`i.gfmis_number ilike ${pattern}`,
      sql`i.budget_source ilike ${pattern}`,
      sql`i.note ilike ${pattern}`,
      sql`i.acquired_date::text ilike ${pattern}`,
      sql`i.unit_price::text ilike ${pattern}`,
      sql`i.status ilike ${pattern}`,
      sql`exists (select 1 from public.categories c where c.id = i.category_id and c.name ilike ${pattern})`,
      sql`exists (select 1 from public.units u where u.id = i.unit_id and u.name ilike ${pattern})`,
      sql`exists (select 1 from public.locations l where l.id = i.location_id and (l.name ilike ${pattern} or l.building ilike ${pattern} or l.floor ilike ${pattern} or l.room ilike ${pattern} or l.department ilike ${pattern}))`,
    ]

    // Thai status label and synonym mapping
    const matchingStatuses: string[] = []
    const lowerQ = q.toLowerCase()
    const STATUS_SYNONYMS: Record<string, string[]> = {
      active: ['ใช้งานอยู่', 'พร้อมใช้งาน', 'ปกติ', 'ใช้งาน'],
      spare: ['สำรอง'],
      damaged: ['ชำรุด'],
      waiting_repair: ['รอซ่อม', 'ส่งซ่อม'],
      inactive: ['ไม่ใช้งาน', 'เลิกใช้งาน'],
      disposed: ['จำหน่ายแล้ว', 'แทงจำหน่าย', 'จำหน่าย'],
    }
    for (const [statusKey, synonyms] of Object.entries(STATUS_SYNONYMS)) {
      if (synonyms.some((s) => s.toLowerCase().includes(lowerQ) || lowerQ.includes(s.toLowerCase()))) {
        matchingStatuses.push(statusKey)
      }
    }
    for (const [statusKey, label] of Object.entries(ITEM_STATUS_LABELS)) {
      if (label.toLowerCase().includes(lowerQ) || lowerQ.includes(label.toLowerCase())) {
        if (!matchingStatuses.includes(statusKey)) {
          matchingStatuses.push(statusKey)
        }
      }
    }
    if (matchingStatuses.length > 0) {
      searchConditions.push(sql`i.status in (${sql.join(matchingStatuses.map((s) => sql`${s}`), sql`, `)})`)
    }

    // Number matching without commas (e.g., "1,500" -> 1500)
    const cleanNum = q.replaceAll(',', '').replaceAll(' ', '').trim()
    if (cleanNum && /^\d+(\.\d+)?$/.test(cleanNum) && cleanNum !== q) {
      searchConditions.push(sql`i.unit_price::text ilike ${'%' + cleanNum + '%'}`)
    }

    // Thai Buddhist Era year (พ.ศ.) e.g. 2568 -> 2025
    const yearNum = Number(cleanNum)
    if (Number.isInteger(yearNum) && yearNum >= 2400 && yearNum <= 2700) {
      const adYear = String(yearNum - 543)
      searchConditions.push(sql`i.acquired_date::text ilike ${'%' + adYear + '%'}`)
    }

    clauses.push(sql`(${sql.join(searchConditions, sql` or `)})`)
  }
  if (params.type && (!validateEnums || ['material', 'asset'].includes(params.type))) {
    clauses.push(sql`i.item_type = ${params.type}`)
  }
  if (params.qualification && (!validateEnums || ['qualified', 'below_threshold', 'unclassified'].includes(params.qualification))) {
    clauses.push(params.qualification === 'unclassified' ? sql`i.qualification_status is null` : sql`i.qualification_status = ${params.qualification}`)
  }
  if (params.status && (!validateEnums || ['active', 'spare', 'damaged', 'waiting_repair', 'inactive', 'disposed'].includes(params.status))) {
    clauses.push(sql`i.status = ${params.status}`)
  }
  if (params.category_id) clauses.push(sql`i.category_id = ${params.category_id}::uuid`)
  if (params.location_id) clauses.push(sql`i.location_id = ${params.location_id}::uuid`)
  if (params.is_central === 'true' || params.is_central === '1' || params.is_central === true) clauses.push(sql`i.is_central = true`)
  return sql.join(clauses, sql` and `)
}

export async function getPostgresItemReferences() {
  return withUserDatabase(async (tx) => {
    const categories = await tx.execute<ReferenceOption & Record<string, unknown>>(sql`select id, name, color, icon from public.categories where is_active order by name`)
    const locations = await tx.execute<ReferenceOption & Record<string, unknown>>(sql`select id, name from public.locations where is_active order by name`)
    const units = await tx.execute<ReferenceOption & Record<string, unknown>>(sql`select id, name from public.units where is_active order by name`)
    return { categories: categories.rows, locations: locations.rows, units: units.rows }
  })
}

export async function getPostgresItems(params: ItemListSearchParams, pageSize = 10): Promise<ItemListResult> {
  const safePageSize = Number.isFinite(pageSize) ? Math.min(Math.max(Math.floor(pageSize), 1), 100) : 10
  const parsedPage = Number(params.page ?? '1')
  const page = Number.isFinite(parsedPage) && parsedPage > 0 ? Math.floor(parsedPage) : 1
  const columns: Record<string, SQL> = {
    item_name: sql`i.item_name collate "th-TH-x-icu"`,
    category: sql`c.name collate "th-TH-x-icu"`,
    item_type: sql`i.item_type`,
    quantity: sql`i.quantity`,
    status: sql`case i.status
      when 'active' then 'ใช้งานอยู่'
      when 'spare' then 'สำรอง'
      when 'waiting_repair' then 'รอซ่อม'
      when 'damaged' then 'ชำรุด'
      when 'inactive' then 'ไม่ใช้งาน'
      when 'disposed' then 'จำหน่ายแล้ว'
      else i.status
    end collate "th-TH-x-icu"`,
    acquired_date: sql`i.acquired_date`,
    budget_source: sql`i.budget_source collate "th-TH-x-icu"`,
    unit_price: sql`i.unit_price`,
    asset_no: sql`i.asset_no`,
    gfmis_number: sql`i.gfmis_number`,
    responsible_person: sql`i.responsible_person collate "th-TH-x-icu"`,
  }
  const sortBy = params.sort_by ?? ''
  const order = Object.hasOwn(columns, sortBy) ? columns[sortBy] : sql`i.updated_at`
  const ascending = params.sort_dir === 'asc' || (params.sort_dir !== 'desc' && ['item_name', 'category', 'item_type', 'acquired_date', 'budget_source', 'asset_no', 'gfmis_number', 'responsible_person'].includes(params.sort_by ?? ''))
  return withUserDatabase(async (tx) => {
    const where = itemFilters(params, true)
    const classificationWhere = itemFilters({ ...params, type: undefined }, true)
    const selectedType = params.type === 'asset' || params.type === 'material' ? params.type : null
    const selectedQualification = params.qualification === 'qualified' || params.qualification === 'below_threshold' ? params.qualification : null
    const selectedUnclassified = params.qualification === 'unclassified'
    const totals = await tx.execute<{ total: number; assets: number; materials: number; qualified: number; below_threshold: number; unclassified: number }>(sql`select
      count(*) filter (where ${selectedType ? sql`item_type = ${selectedType}` : sql`true`} and ${selectedQualification ? sql`qualification_status = ${selectedQualification}` : selectedUnclassified ? sql`qualification_status is null` : sql`true`})::int as total,
      count(*) filter (where item_type = 'asset')::int as assets,
      count(*) filter (where item_type = 'material')::int as materials,
      count(*) filter (where ${selectedType ? sql`item_type = ${selectedType} and ` : sql``} qualification_status = 'qualified')::int as qualified,
      count(*) filter (where ${selectedType ? sql`item_type = ${selectedType} and ` : sql``} qualification_status = 'below_threshold')::int as below_threshold,
      count(*) filter (where ${selectedType ? sql`item_type = ${selectedType} and ` : sql``} qualification_status is null)::int as unclassified
      from public.items i where ${classificationWhere}`)
    const rows = await tx.execute<ItemListRow & Record<string, unknown>>(sql`select ${itemListColumns}, i.note, i.image_url
      from public.items i ${itemRelations} where ${where}
      order by ${order} ${ascending ? sql`asc` : sql`desc`} nulls last, i.id ${ascending ? sql`asc` : sql`desc`} limit ${safePageSize} offset ${(page - 1) * safePageSize}`)
    const total = totals.rows[0]?.total ?? 0
    const assets = totals.rows[0]?.assets ?? 0
    const materials = totals.rows[0]?.materials ?? 0
    const qualified = totals.rows[0]?.qualified ?? 0
    const belowThreshold = totals.rows[0]?.below_threshold ?? 0
    const unclassified = totals.rows[0]?.unclassified ?? 0
    return {
      items: rows.rows.map(item => ({ ...item, image_url: resolveLocalItemImageUrl(item.image_url ?? null) })),
      total,
      classificationCounts: { all: assets + materials, assets, materials, qualified, belowThreshold, unclassified },
      page,
      pageSize: safePageSize,
      totalPages: Math.max(1, Math.ceil(total / safePageSize)),
    }
  })
}

export async function getPostgresItemBatch(
  params: NormalizedItemListSearchParams,
  cursor: { key: ItemCursorKey; id: string } | null,
): Promise<ItemBatchResult> {
  const columns: Record<NormalizedItemListSearchParams['sort_by'], SQL> = {
    updated_at: sql`i.updated_at`,
    item_name: sql`i.item_name`,
    category: sql`coalesce(c.name, '') collate "th-TH-x-icu"`,
    item_type: sql`i.item_type`,
    quantity: sql`i.quantity`,
    status: sql`i.status`,
    acquired_date: sql`i.acquired_date`,
    budget_source: sql`i.budget_source`,
    unit_price: sql`i.unit_price`,
    asset_no: sql`i.asset_no`,
    gfmis_number: sql`i.gfmis_number`,
    responsible_person: sql`i.responsible_person`,
  }
  const order = columns[params.sort_by]
  const ascending = params.sort_dir === 'asc'
  const comparison = ascending ? sql`>` : sql`<`
  return withUserDatabase(async (tx) => {
    // Batch params are already normalized; trimming again would change comma-search semantics.
    const where = itemFilters(params, false, params.q)
    const cursorWhere = cursor
      ? cursor.key === null
        ? sql` and (${order} is null and i.id ${comparison} ${cursor.id}::uuid)`
        : sql` and (${order} ${comparison} ${cursor.key} or ${order} is null or (${order} = ${cursor.key} and i.id ${comparison} ${cursor.id}::uuid))`
      : sql``
    const totals = cursor ? null : await tx.execute<{ total: number }>(sql`select count(*)::int as total from public.items i where ${where}`)
    const rows = await tx.execute<ItemListRow & Record<string, unknown>>(sql`select ${itemBatchColumns}, i.note, i.image_url
      from public.items i ${itemRelations} where ${where}${cursorWhere}
      order by ${order} ${ascending ? sql`asc` : sql`desc`} nulls last, i.id ${ascending ? sql`asc` : sql`desc`} limit ${BATCH_SIZE + 1}`)
    const hasMore = rows.rows.length > BATCH_SIZE
    const items = rows.rows.slice(0, BATCH_SIZE).map((item) => ({ ...item, image_url: resolveLocalItemImageUrl(item.image_url ?? null) }))
    const last = items.at(-1)
    const cursorKey: ItemCursorKey | undefined = last
      ? params.sort_by === 'category'
        ? (last.category?.name ?? '')
        : (last[params.sort_by] as ItemCursorKey | undefined)
      : null
    return {
      items,
      total: totals?.rows[0]?.total ?? null,
      nextCursor: hasMore && last && cursorKey !== undefined ? encodeItemCursor(params, cursorKey, last.id) : null,
    }
  })
}

export async function getPostgresItemById(id: string): Promise<ItemDetail | null> {
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
  const whereClause = isUuid
    ? sql`i.id = ${id}::uuid and i.deleted_at is null`
    : sql`(i.asset_no = ${id} or i.serial_no = ${id}) and i.deleted_at is null`

  const query = sql`select ${itemListColumns}, i.note, i.image_url,
    i.depreciation_enabled, i.depreciation_method, i.depreciation_cost, i.depreciation_useful_life_years,
    i.depreciation_start_basis, i.depreciation_start_date, i.depreciation_residual_value, i.created_at
    from public.items i ${itemRelations} where ${whereClause} limit 1`

  try {
    return await withUserDatabase(async (tx) => {
      const rows = await tx.execute<ItemDetail & Record<string, unknown>>(query)
      const item = rows.rows[0]
      return item ? { ...item, image_url: resolveLocalItemImageUrl(item.image_url) } : null
    })
  } catch (err) {
    if (!(err instanceof AuthorizationError)) throw err
    const { getDatabase } = await import('@/lib/postgres/db')
    const rows = await getDatabase().execute<ItemDetail & Record<string, unknown>>(
      sql`select * from private.get_public_item(${id})`
    )
    const item = rows.rows[0]
    return item ? { ...item, image_url: resolveLocalItemImageUrl(item.image_url) } : null
  }
}

export async function getPostgresSidebarData() {
  return withUserDatabase(async (tx) => {
    type CategoryBucket = { id: string; name: string; icon?: string | null; count: number }
    type Bucket = { id: string; name: string; count: number }
    const categories = await tx.execute<CategoryBucket>(sql`select c.id, c.name, c.icon, count(i.id)::int as count
      from public.categories c left join public.items i on i.category_id = c.id and i.deleted_at is null and i.item_type = 'asset'
      where c.is_active group by c.id, c.name, c.icon order by c.name`)
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
      order by i.quantity asc, i.id limit ${(Number.isFinite(limit) && limit > 0) ? Math.min(Math.floor(limit), 100) : 5}`)
    return rows.rows
  })
}

export async function getPostgresUrgentDamagedItems(limit = 5): Promise<UrgentDamagedItem[]> {
  return withUserDatabase(async (tx) => {
    const parsedLimit = Number.isFinite(limit) && limit > 0 ? Math.min(Math.floor(limit), 100) : 5
    const rows = await tx.execute<UrgentDamagedItem & { updated_at: string | Date } & Record<string, unknown>>(sql`select i.id, i.item_name, i.asset_no,
      coalesce(nullif(l.name, ''), 'ไม่มีระบุสถานที่') as "locationName",
      i.status, i.updated_at, i.image_url
      from public.items i left join public.locations l on l.id = i.location_id
      where i.status in ('damaged', 'waiting_repair') and i.deleted_at is null
      order by i.updated_at desc limit ${parsedLimit}`)
    return rows.rows.map((row) => ({
      ...row,
      updated_at: (row.updated_at as unknown) instanceof Date ? (row.updated_at as Date).toISOString() : String(row.updated_at),
      image_url: resolveLocalItemImageUrl(row.image_url ?? null),
    }))
  })
}

