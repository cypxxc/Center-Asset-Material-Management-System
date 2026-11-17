import 'server-only'
import { sql } from 'drizzle-orm'
import type { PostgresTransaction } from '@/lib/postgres/db'
import { lockDisbursementItems } from '@/features/disbursements/reservations'
import { inventoryTable } from './inventory-table'

export class ItemArchiveBlockedError extends Error {
  constructor() {
    super('รายการที่เลือกมีเอกสารร่างหรือคำขอรออนุมัติ หรือมีรายการยืมที่ยังไม่คืน กรุณาปิดคำขอหรือรับคืนให้เรียบร้อยก่อนลบ')
    this.name = 'ItemArchiveBlockedError'
  }
}

/** Caller authenticates an active admin and owns the transaction. History/FKs remain intact. */
export async function archivePostgresItems(tx: PostgresTransaction, ids: string[], actorId: string, type: 'asset' | 'material' = 'asset') {
  const uniqueIds = [...new Set(ids.map(id => id.toLowerCase()))].sort()
  await lockDisbursementItems(tx, uniqueIds)
  const selected = await tx.execute<{ id: string }>(sql`
    select id from ${inventoryTable(type)}
    where id in (${sql.join(uniqueIds.map(id => sql`${id}`), sql`, `)}) and deleted_at is null
    order by id for update
  `)
  if (!selected.rows.length) return []
  const match = sql`in (${sql.join(selected.rows.map(row => sql`${row.id}`), sql`, `)})`
  const blocked = await tx.execute(sql`
    select di.item_id from public.disbursement_items di
    join public.disbursements d on d.id = di.disbursement_id
    where di.item_id ${match} and (
      d.status in ('draft', 'pending_approval')
      or (d.transaction_type = 'asset_borrow' and d.status in ('active_borrow', 'partially_returned')
        and di.issued_qty > di.returned_qty and di.status <> 'reversed')
    ) limit 1
  `)
  if (blocked.rows.length) throw new ItemArchiveBlockedError()
  return (await tx.execute<{ id: string; image_url: string | null }>(sql`
    update ${inventoryTable(type)} set deleted_at = now(), deleted_by = ${actorId}, updated_by = ${actorId}, updated_at = now()
    where id ${match} and deleted_at is null returning id, image_url
  `)).rows
}
