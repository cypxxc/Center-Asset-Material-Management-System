import 'server-only'
import { sql } from 'drizzle-orm'
import type { PostgresTransaction } from '@/lib/postgres/db'

export function inventoryTable(type: string) {
  if (type !== 'asset' && type !== 'material') throw new Error('Invalid inventory type')
  return sql`public.${sql.identifier(type === 'material' ? 'materials' : 'items')}`
}

export async function inventoryTableForId(tx: PostgresTransaction, id: string) {
  const result = await tx.execute<{ item_type: string }>(sql`select item_type from public.inventory_registry where id=${id}::uuid`)
  if (!result.rows[0]) throw new Error('ไม่พบรายการในทะเบียน')
  return inventoryTable(result.rows[0].item_type)
}
