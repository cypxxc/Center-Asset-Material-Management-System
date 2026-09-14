import 'server-only'

import { sql, type SQL } from 'drizzle-orm'
import { withUserDatabase } from '@/lib/postgres/request'
import { itemFilters, itemListColumns, itemRelations } from '@/features/items/postgres-queries'
import type { ItemListSearchParams } from '@/features/items/types'
import type { ReportListResult, ReportStats } from './types'

export async function getPostgresReportStats(): Promise<ReportStats> {
  return withUserDatabase(async (tx) => {
    const rows = await tx.execute<{ stats: ReportStats }>(sql`with live_items as materialized (
      select i.item_type, i.quantity, i.status, i.category_id from public.items i where i.deleted_at is null
    ) select json_build_object(
      'totalItems', (select count(*) from live_items),
      'totalQuantity', (select coalesce(sum(quantity), 0) from live_items),
      'typeCounts', coalesce((select json_object_agg(item_type, json_build_object('count', cnt, 'qty', qty))
        from (select item_type, count(*) as cnt, coalesce(sum(quantity), 0) as qty from live_items group by item_type) t), '{}'::json),
      'statusCounts', coalesce((select json_object_agg(status, json_build_object('count', cnt, 'qty', qty))
        from (select status, count(*) as cnt, coalesce(sum(quantity), 0) as qty from live_items group by status) t), '{}'::json),
      'categoryCounts', coalesce((select json_object_agg(t.name, json_build_object('count', t.cnt, 'qty', t.qty))
        from (select coalesce(c.name, 'ทั่วไป') as name, count(*) as cnt, coalesce(sum(i.quantity), 0) as qty
          from live_items i left join public.categories c on c.id = i.category_id
          group by coalesce(c.name, 'ทั่วไป')) t), '{}'::json),
      'locationCount', (select count(*) from public.locations)
    ) as stats`)
    const stats = rows.rows[0].stats
    return { ...stats, typeCounts: { asset: stats.typeCounts.asset ?? { count: 0, qty: 0 }, material: stats.typeCounts.material ?? { count: 0, qty: 0 } } }
  })
}

export async function getPostgresReportItemsList(
  params: ItemListSearchParams,
  noPagination = false,
  exportLimit?: number,
): Promise<ReportListResult> {
  const page = noPagination ? 1 : Math.max(1, parseInt(params.page || '1') || 1)
  const pageSize = exportLimit ?? 15
  const sortColumns: Record<string, SQL> = {
    item_name: sql`i.item_name collate "th-TH-x-icu"`,
    category: sql`c.name collate "th-TH-x-icu"`,
    quantity: sql`i.quantity`, unit_price: sql`i.unit_price`,
    total_price: sql`coalesce(i.unit_price, 0) * i.quantity`,
    status: sql`i.status`, updated_at: sql`i.updated_at`, created_at: sql`i.created_at`,
  }
  const sortBy = params.sort_by ?? 'updated_at'
  const order = Object.hasOwn(sortColumns, sortBy) ? sortColumns[sortBy] : sql`i.updated_at`
  const ascending = params.sort_dir === 'asc' || (noPagination && !exportLimit && !params.sort_dir && params.sort_by === 'item_name')
  const pagination = !noPagination || exportLimit
    ? sql`limit ${pageSize} offset ${(page - 1) * pageSize}` : sql``

  return withUserDatabase(async (tx) => {
    // Totals and the page share one statement/snapshot, including when the requested page is empty.
    const rows = await tx.execute<{ result: ReportListResult }>(sql`with filtered as materialized (
      select ${itemListColumns}, row_number() over (order by ${order} ${ascending ? sql`asc` : sql`desc`}, i.updated_at desc, i.id) as position
      from public.items i ${itemRelations} where ${itemFilters(params)}
    ), paged as (
      select id, item_name, item_type, quantity, unit_price, asset_no, serial_no,
        responsible_person, status, updated_at, brand, model, category, unit, location
      from filtered order by position ${pagination}
    ) select json_build_object(
      'items', coalesce((select json_agg(row_to_json(paged)) from paged), '[]'::json),
      'totalCount', count(*)::int,
      'totalQuantity', coalesce(sum(quantity), 0),
      'totalValue', coalesce(sum(coalesce(unit_price, 0) * quantity), 0),
      'totalPages', ${noPagination ? sql`1` : sql`greatest(1, ceil(count(*)::numeric / ${pageSize})::int)`},
      'page', ${page}::integer
    ) as result from filtered`)
    return rows.rows[0].result
  })
}

export async function getPostgresExportReportItems(params: ItemListSearchParams) {
  const { items, totalCount, totalQuantity, totalValue } = await getPostgresReportItemsList(
    { ...params, page: '1', sort_by: params.sort_by || 'created_at', sort_dir: params.sort_dir || 'desc' }, true, 5000,
  )
  return { items, totalCount, totalQuantity, totalValue }
}
