import 'server-only'
import { createHash } from 'node:crypto'
import { sql } from 'drizzle-orm'
import { getCurrentProfile } from '@/features/auth/queries'
import { withUserDatabase } from '@/lib/postgres/request'
import type { PostgresTransaction } from '@/lib/postgres/db'
import { lockDisbursementItems } from '@/features/disbursements/reservations'
import { materialReturnSchema, reconciliation, returnQuantities, stockCommandSchema, stockDelta } from './stock-rules'

async function stockAdmin() {
  const profile = await getCurrentProfile()
  if (!profile?.is_active || profile.role !== 'admin') throw new Error('เฉพาะผู้ดูแลระบบที่มีสิทธิ์รับเข้า ปรับยอด และรับคืนวัสดุ')
  return profile
}

function hash(value: unknown) { return createHash('sha256').update(JSON.stringify(value)).digest('hex') }

async function replay(tx: PostgresTransaction, actor: string, key: string, payloadHash: string) {
  await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`camms-stock-request:${actor}:${key}`},0))`)
  const prior = await tx.execute<{ id: string; payload_hash: string }>(sql`select id,payload_hash from public.material_stock_documents where created_by=${actor} and request_key=${key}::uuid`)
  if (!prior.rows[0]) return null
  if (prior.rows[0].payload_hash !== payloadHash) throw new Error('รหัสรายการนี้ถูกใช้กับข้อมูลอื่นแล้ว กรุณาเริ่มรายการใหม่')
  return { id: prior.rows[0].id }
}

async function appendMovement(tx: PostgresTransaction, data: { document: string; item: string; line?: string; delta: number; balance: number; type: string; actor: string }) {
  await tx.execute(sql`insert into public.stock_movements(item_id,disbursement_item_id,stock_document_id,delta,balance_after,movement_type,created_by)
    values(${data.item}::uuid,${data.line ?? null}::uuid,${data.document}::uuid,${data.delta},${data.balance},${data.type},${data.actor}::uuid)`)
}

async function auditStock(tx: PostgresTransaction, actor: string, id: string, action: string, details: unknown) {
  await tx.execute(sql`insert into public.audit_logs(user_id,action,target_table,target_id,new_data)
    values(${actor},${action},'material_stock_documents',${id},${JSON.stringify(details)}::jsonb)`)
}

export async function recordPostgresMaterialStock(raw: unknown) {
  const actor = await stockAdmin()
  const command = stockCommandSchema.parse(raw)
  const payloadHash = hash({ ...command, expected_stock_version: command.kind === 'count' ? command.expected_stock_version : undefined })
  return withUserDatabase(async tx => {
    const previous = await replay(tx, actor.id, command.request_key, payloadHash)
    if (previous) return previous
    await lockDisbursementItems(tx, [command.item_id])
    const rows = await tx.execute<{ quantity: number; stock_version: string }>(sql`select quantity,stock_version from public.materials where id=${command.item_id} and deleted_at is null for update`)
    const item = rows.rows[0]
    if (!item) throw new Error('ไม่พบวัสดุในทะเบียน')
    if (command.kind === 'count' && Number(item.stock_version) !== command.expected_stock_version) throw new Error('ยอดคงเหลือเปลี่ยนระหว่างตรวจนับ กรุณาโหลดและตรวจนับใหม่')
    let opening: string | null = null
    const delta = command.kind === 'opening' ? 0 : stockDelta(command.kind, item.quantity, command.quantity)
    if (command.kind === 'opening') {
      const existing = await tx.execute(sql`select id from public.material_stock_documents where item_id=${command.item_id} and kind='opening'`)
      if (existing.rows.length) throw new Error('วัสดุนี้มีเอกสารยอดตั้งต้นแล้ว')
      const ledger = await tx.execute<{ total: string }>(sql`select coalesce(sum(delta),0)::text as total from public.stock_movements where item_id=${command.item_id}`)
      opening = (BigInt(item.quantity) - BigInt(ledger.rows[0].total)).toString()
    }
    const document = await tx.execute<{ id: string }>(sql`insert into public.material_stock_documents(item_id,kind,request_key,created_by,payload_hash,quantity,accepted_quantity,delta,reason,reference,opening_balance)
      values(${command.item_id},${command.kind},${command.request_key},${actor.id},${payloadHash},${command.kind === 'opening' ? item.quantity : command.quantity},0,${delta},${command.reason},${command.reference},${opening}::bigint) returning id`)
    const id = document.rows[0].id
    if (command.kind !== 'opening') {
      const updated = await tx.execute<{ quantity: number }>(sql`update public.materials set quantity=quantity+${delta},updated_by=${actor.id},updated_at=now() where id=${command.item_id} and quantity+${delta}>=0 returning quantity`)
      await appendMovement(tx, { document: id, item: command.item_id, delta, balance: updated.rows[0].quantity, type: command.kind === 'receipt' ? 'receipt' : 'adjust_audit', actor: actor.id })
    }
    await auditStock(tx, actor.id, id, 'MATERIAL_STOCK_DOCUMENT', { ...command, delta, opening_balance: opening })
    return { id }
  })
}

export async function returnPostgresMaterialStock(raw: unknown) {
  const actor = await stockAdmin()
  const command = materialReturnSchema.parse(raw)
  const payloadHash = hash(command)
  return withUserDatabase(async tx => {
    const previous = await replay(tx, actor.id, command.request_key, payloadHash)
    if (previous) return previous
    const ref = await tx.execute<{ disbursement_id: string }>(sql`select disbursement_id from public.disbursement_items where id=${command.line_id}`)
    if (!ref.rows[0]) throw new Error('ไม่พบรายการเบิกวัสดุ')
    // Header -> line -> canonical item lock is shared with approval/reversal.
    const header = await tx.execute<{ transaction_type: string; status: string }>(sql`select transaction_type,status from public.disbursements where id=${ref.rows[0].disbursement_id} for update`)
    const doc = header.rows[0]
    if (!doc || doc.transaction_type !== 'material_issue' || !['confirmed','partially_returned'].includes(doc.status)) throw new Error('รับคืนได้เฉพาะวัสดุที่อนุมัติจ่ายแล้ว')
    const lines = await tx.execute<{ item_id: string; issued_qty: number; returned_qty: number; status: string }>(sql`select item_id,issued_qty,returned_qty,status from public.disbursement_items where id=${command.line_id} for update`)
    const line = lines.rows[0]
    if (!line || !['issued','partially_returned'].includes(line.status)) throw new Error('รายการนี้ไม่อยู่ในสถานะรับคืนได้')
    const amounts = returnQuantities(line.issued_qty, line.returned_qty, command.quantity, command.accepted_quantity)
    await lockDisbursementItems(tx, [line.item_id])
    const items = await tx.execute<{ quantity: number }>(sql`select quantity from public.materials where id=${line.item_id} and deleted_at is null for update`)
    const item = items.rows[0]
    if (!item) throw new Error('ไม่พบวัสดุสำหรับรับคืน')
    stockDelta('receipt', item.quantity, amounts.restock)
    const inserted = await tx.execute<{ id: string }>(sql`insert into public.material_stock_documents(item_id,kind,request_key,created_by,payload_hash,quantity,accepted_quantity,delta,reason,reference,disbursement_item_id)
      values(${line.item_id},'return',${command.request_key},${actor.id},${payloadHash},${command.quantity},${command.accepted_quantity},${amounts.restock},${command.reason},${command.reference},${command.line_id}) returning id`)
    const id = inserted.rows[0].id
    const updated = await tx.execute<{ quantity: number }>(sql`update public.materials set quantity=quantity+${amounts.restock},updated_by=${actor.id},updated_at=now() where id=${line.item_id} returning quantity`)
    await appendMovement(tx, { document: id, item: line.item_id, line: command.line_id, delta: amounts.restock, balance: updated.rows[0].quantity, type: 'material_return', actor: actor.id })
    await tx.execute(sql`update public.disbursement_items set returned_qty=${amounts.returned},status=${amounts.returned === line.issued_qty ? 'returned' : 'partially_returned'} where id=${command.line_id}`)
    const remaining = await tx.execute<{ count: number }>(sql`select count(*)::int as count from public.disbursement_items where disbursement_id=${ref.rows[0].disbursement_id} and returned_qty<issued_qty`)
    await tx.execute(sql`update public.disbursements set status=${remaining.rows[0].count === 0 ? 'returned' : 'partially_returned'},updated_at=now() where id=${ref.rows[0].disbursement_id}`)
    await auditStock(tx, actor.id, id, 'RETURN_MATERIAL', { ...command, cumulative_returned: amounts.returned, stock_added: amounts.restock })
    return { id }
  })
}

export async function getPostgresMaterialStockLedger(itemId: string) {
  stockCommandSchema.shape.item_id.parse(itemId)
  return withUserDatabase(async tx => {
    const result = await tx.execute<{ quantity: number; stock_version: string; opening_balance: string | null; total: string }>(sql`
      select m.quantity,m.stock_version,
        (select sd.opening_balance::text from public.material_stock_documents sd where sd.item_id=m.id and sd.kind='opening') as opening_balance,
        (select coalesce(sum(sm.delta),0)::text from public.stock_movements sm where sm.item_id=m.id) as total
      from public.materials m where m.id=${itemId}::uuid and deleted_at is null`)
    const row = result.rows[0]
    if (!row) throw new Error('ไม่พบวัสดุ')
    const history = await tx.execute<{ id: string; kind: string; quantity: number; accepted_quantity: number; delta: number; reason: string; reference: string; created_at: string; actor_name: string | null }>(sql`
      select sd.id,sd.kind,sd.quantity,sd.accepted_quantity,sd.delta,sd.reason,sd.reference,sd.created_at,p.full_name as actor_name
      from public.material_stock_documents sd left join public.profiles p on p.id=sd.created_by where sd.item_id=${itemId}::uuid order by sd.created_at desc,sd.id desc limit 50`)
    return { quantity: row.quantity, stock_version: Number(row.stock_version), opening_balance: row.opening_balance, movements: row.total,
      reconciliation: row.opening_balance === null ? null : reconciliation(row.quantity, Number(row.opening_balance), Number(row.total)), history: history.rows }
  })
}
