import 'server-only'
import { sql } from 'drizzle-orm'
import { withUserDatabase } from '@/lib/postgres/request'
import type { MaterialLedgerData } from '@/features/items/material-fields'

export type MaterialRecord = MaterialLedgerData & {
  id: string; item_name: string; quantity: number; unit_price: number | null; metadata_version: number; stock_version: number;
  category_id: string | null; unit_id: string | null; location_id: string | null;
  category_name: string | null; unit_name: string | null; location_name: string | null;
  note: string | null; status: string; is_central: boolean; [key: string]: unknown;
}
const relations = sql`left join public.categories c on c.id=m.category_id left join public.units u on u.id=m.unit_id left join public.locations l on l.id=m.location_id`
export async function getMaterials(q = '', page = 1) {
  const safePage = Number.isSafeInteger(page) && page > 0 ? page : 1
  const where = sql`m.deleted_at is null ${q ? sql`and (m.item_name ilike ${'%' + q + '%'} or m.specification ilike ${'%' + q + '%'} or m.commodity_code ilike ${'%' + q + '%'} or m.fiscal_year::text ilike ${'%' + q + '%'})` : sql``}`
  return withUserDatabase(async tx => {
    const count = await tx.execute<{ total: number }>(sql`select count(*)::int total from public.materials m where ${where}`)
    const rows = await tx.execute<MaterialRecord>(sql`select m.*,true as is_central, c.name category_name, u.name unit_name, l.name location_name from public.materials m ${relations} where ${where} order by m.item_name,m.id limit 50 offset ${(safePage-1)*50}`)
    return { items: rows.rows, total: count.rows[0].total, page: safePage }
  })
}
export async function getMaterial(id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null
  return withUserDatabase(async tx => (await tx.execute<MaterialRecord>(sql`select m.*,true as is_central,c.name category_name,u.name unit_name,l.name location_name from public.materials m ${relations} where m.id=${id}::uuid and m.deleted_at is null`)).rows[0] ?? null)
}

export async function getMaterialLedgerForIds(ids: string[]) {
  if (!ids.length) return []
  return withUserDatabase(async tx => (await tx.execute<MaterialRecord>(sql`
    select * from public.materials where deleted_at is null
    and id in (${sql.join(ids.map(id => sql`${id}::uuid`), sql`, `)})
  `)).rows)
}
