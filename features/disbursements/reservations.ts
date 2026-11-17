import 'server-only'
import { sql } from 'drizzle-orm'
import type { PostgresTransaction } from '@/lib/postgres/db'
import { assertMaterialQuantity } from './material-availability'

export async function assertMaterialAvailable(_tx: PostgresTransaction, item: { id: string; item_name?: string; quantity: number; unit_name?: string | null }, requested: number) {
  assertMaterialQuantity(item.item_name || 'วัสดุ', requested, Math.max(0, Number(item.quantity)), item.unit_name || 'หน่วย')
}

// All disbursement/custody writers acquire this lock before reading availability.
// Advisory locks let request-only users serialize reservations without UPDATE access to inventory.
export async function lockDisbursementItems(tx: PostgresTransaction, itemIds: string[]) {
  for (const id of [...new Set(itemIds.map((value) => value.toLowerCase()))].sort()) {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${`camms-disbursement:${id}`}, 0))`)
  }
}

export async function assertItemUnreserved(tx: PostgresTransaction, itemId: string, excludeDocumentId?: string) {
  const result = await tx.execute<{ count: number }>(sql`
    SELECT count(*)::int AS count
    FROM public.disbursement_items di
    JOIN public.disbursements d ON d.id = di.disbursement_id
    WHERE di.item_id = ${itemId}
      AND d.status IN ('pending_approval', 'active_borrow', 'partially_returned')
      AND di.status NOT IN ('returned', 'reversed')
      ${excludeDocumentId ? sql`AND d.id <> ${excludeDocumentId}` : sql``}
  `)
  if (result.rows[0].count > 0) throw new Error('รายการนี้มีคำขอรออนุมัติหรือกำลังยืม ไม่สามารถทำรายการซ้ำได้')
}
