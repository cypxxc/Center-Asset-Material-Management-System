import 'server-only'
import { sql } from 'drizzle-orm'
import { getCurrentProfile } from '@/features/auth/queries'
import { withUserDatabase } from '@/lib/postgres/request'
import { assignCustodySchema, custodyHistoryParamsSchema } from './custody-schema'
import { normalizeForSearch } from '@/lib/unicode'
import { assertCentralDisbursementItem, isCentralDisbursementItem } from './central-items'
import { createPostgresDisbursementDraft, confirmPostgresDisbursement } from './postgres-actions'
import { getDisbursementSelectableItems } from './queries'
import { syncCentralNote } from '@/features/items/central-note'
import { findPoolMismatch, type PoolAuditEvidence } from './pool-audit'
import { assertItemUnreserved, lockDisbursementItems } from './reservations'
import { inventoryTableForId } from '@/features/items/inventory-table'

async function requireAdmin() {
  const profile = await getCurrentProfile()
  if (!profile?.is_active || profile.role !== 'admin') throw new Error('เฉพาะผู้ดูแลระบบเท่านั้นที่มอบหมายผู้ถือครองได้')
  return profile
}

export interface CustodyHistoryRow extends Record<string, unknown> {
  id: string
  item_name: string
  asset_no: string | null
  from_responsible: string | null
  to_responsible: string | null
  actor_name: string | null
  created_at: string
}

export async function getCustodyHistory(rawInput: unknown = {}) {
  await requireAdmin()
  const params = custodyHistoryParamsSchema.parse(rawInput)
  const pageSize = 20
  const historySql = sql`
    SELECT a.id, coalesce(a.new_data->>'item_name', i.item_name, '-') AS item_name,
      coalesce(a.new_data->>'asset_no', i.asset_no) AS asset_no,
      a.old_data->>'responsible_person' AS from_responsible,
      a.new_data->>'responsible_person' AS to_responsible,
      p.full_name AS actor_name, a.created_at
    FROM public.audit_logs a
    LEFT JOIN public.items i ON i.id = a.target_id
    LEFT JOIN public.profiles p ON p.id = a.user_id
    WHERE a.action = 'ASSIGN_CUSTODY' AND a.target_table = 'items'
  `
  const pattern = `%${normalizeForSearch(params.q)}%`
  const filter = params.q ? sql`WHERE (h.item_name ILIKE ${pattern} OR h.asset_no ILIKE ${pattern}
    OR h.from_responsible ILIKE ${pattern} OR h.to_responsible ILIKE ${pattern} OR h.actor_name ILIKE ${pattern})` : sql``
  return withUserDatabase(async tx => {
    const count = await tx.execute<{ total: number }>(sql`SELECT count(*)::int AS total FROM (${historySql}) h ${filter}`)
    const total = count.rows[0]?.total ?? 0
    const totalPages = Math.max(1, Math.ceil(total / pageSize))
    const page = Math.min(params.page, totalPages)
    const result = await tx.execute<CustodyHistoryRow>(sql`
      SELECT h.*, h.created_at::text AS created_at FROM (${historySql}) h ${filter}
      ORDER BY h.created_at DESC, h.id DESC LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}
    `)
    return { rows: result.rows, total, page, pageSize, totalPages }
  })
}

export async function loadCustodyData() {
  await requireAdmin()
  const [items, data] = await Promise.all([
    getDisbursementSelectableItems(),
    withUserDatabase(async (tx) => {
      const users = await tx.execute<{ id: string; full_name: string }>(sql`
        SELECT id, full_name FROM public.profiles WHERE is_active = true ORDER BY full_name, id
      `)
      const history = await tx.execute<CustodyHistoryRow>(sql`
        SELECT a.id, coalesce(a.new_data->>'item_name', i.item_name, '-') AS item_name,
          coalesce(a.new_data->>'asset_no', i.asset_no) AS asset_no,
          a.old_data->>'responsible_person' AS from_responsible,
          a.new_data->>'responsible_person' AS to_responsible,
          p.full_name AS actor_name, a.created_at::text AS created_at
        FROM public.audit_logs a
        LEFT JOIN public.items i ON i.id = a.target_id
        LEFT JOIN public.profiles p ON p.id = a.user_id
        WHERE a.action = 'ASSIGN_CUSTODY' AND a.target_table = 'items'
        ORDER BY a.created_at DESC, a.id DESC LIMIT 100
      `)
      return { users: users.rows, history: history.rows }
    }),
  ])
  return { items: items.filter(isCentralDisbursementItem), ...data }
}

export async function inspectHistoricalPool() {
  await requireAdmin()
  return withUserDatabase(async (tx) => {
    const result = await tx.execute<PoolAuditEvidence & Record<string, unknown>>(sql`
      WITH events AS (
        SELECT c.item_id, c.id AS event_id, c.action AS event_type, c.item_condition,
          c.created_at AS event_at, d.document_no, d.id AS document_id
        FROM public.asset_custody_logs c
        JOIN public.disbursement_items di ON di.id = c.disbursement_item_id
        JOIN public.disbursements d ON d.id = di.disbursement_id
        UNION ALL
        SELECT a.target_id AS item_id, a.id AS event_id, 'assignment' AS event_type,
          'normal' AS item_condition, a.created_at AS event_at,
          NULL::text AS document_no, NULL::uuid AS document_id
        FROM public.audit_logs a WHERE a.action = 'ASSIGN_CUSTODY' AND a.target_table = 'items'
      ), latest AS (
        SELECT DISTINCT ON (item_id) * FROM events ORDER BY item_id, event_at DESC, event_id DESC
      )
      SELECT i.id, i.item_name, i.asset_no, coalesce(i.is_central, false) AS is_central, i.note,
        e.event_type, e.item_condition, e.event_at::text AS event_at, e.document_no, e.document_id,
        EXISTS (
          SELECT 1 FROM public.disbursement_items di JOIN public.disbursements d ON d.id = di.disbursement_id
          WHERE di.item_id = i.id AND d.status IN ('active_borrow', 'partially_returned')
            AND di.status NOT IN ('returned', 'reversed')
        ) AS active_borrow
      FROM public.items i JOIN latest e ON e.item_id = i.id
      WHERE i.deleted_at IS NULL AND i.item_type = 'asset'
      ORDER BY e.event_at DESC, i.id
    `)
    return {
      checked: result.rows.length,
      findings: result.rows.map(findPoolMismatch).filter((row) => row !== null),
      checked_at: new Date().toISOString(),
    }
  })
}

export async function assignPostgresCustody(rawInput: unknown) {
  const admin = await requireAdmin()
  const data = assignCustodySchema.parse(rawInput)
  return withUserDatabase(async (tx) => {
    const recipientResult = await tx.execute<{ id: string; full_name: string }>(sql`
      SELECT id, full_name FROM public.profiles WHERE id = ${data.recipient_id} AND is_active = true
    `)
    const recipient = recipientResult.rows[0]
    if (!recipient?.full_name?.trim()) throw new Error('ไม่พบผู้ถือครองที่ใช้งานอยู่')
    await lockDisbursementItems(tx, data.item_ids)
    let assigned = 0
    const materials: { item_id: string; requested_qty: number }[] = []
    for (const itemId of [...data.item_ids].sort()) {
      const result = await tx.execute<{
        id: string; item_type: string; item_name: string; asset_no: string | null;
        is_central: boolean; note: string | null; responsible_person: string | null; status: string | null
      }>(sql`SELECT id, item_type, item_name, asset_no, is_central, note, responsible_person, status
        FROM ${await inventoryTableForId(tx, itemId)} WHERE id = ${itemId} AND deleted_at IS NULL FOR UPDATE`)
      const item = result.rows[0]
      if (!item) throw new Error('ไม่พบสิ่งของที่เลือก')
      assertCentralDisbursementItem(item)
      if (item.item_type === 'material') {
        materials.push({ item_id: item.id, requested_qty: data.quantities[item.id] ?? 1 })
        continue
      }
      if ((data.quantities[item.id] ?? 1) !== 1) throw new Error('ครุภัณฑ์สั่งจ่ายได้ครั้งละ 1 หน่วยต่อรายการ')
      if (item.status && !['active', 'spare'].includes(item.status)) throw new Error(`"${item.item_name}" ไม่อยู่ในสถานะพร้อมใช้งาน`)
      await assertItemUnreserved(tx, item.id)
      const newNote = syncCentralNote(item.note || '', false) || null
      await tx.execute(sql`UPDATE public.items SET responsible_person = ${recipient.full_name}, is_central = false, note = ${newNote}, updated_at = now() WHERE id = ${item.id}`)
      await tx.execute(sql`INSERT INTO public.audit_logs (user_id, action, target_table, target_id, old_data, new_data)
        VALUES (${admin.id}, 'ASSIGN_CUSTODY', 'items', ${item.id},
          ${JSON.stringify({ responsible_person: item.responsible_person, is_central: item.is_central, note: item.note })}::jsonb,
          ${JSON.stringify({ responsible_person: recipient.full_name, recipient_id: recipient.id, item_name: item.item_name, asset_no: item.asset_no, is_central: false, note: newNote })}::jsonb)`)
      assigned++
    }
    if (materials.length) {
      const doc = await createPostgresDisbursementDraft({
        transaction_type: 'material_issue', recipient_name: recipient.full_name,
        department_name: 'ส่วนกลาง', purpose: 'สั่งจ่ายวัสดุส่วนกลาง', items: materials,
      }, tx)
      await confirmPostgresDisbursement(doc.id, undefined, tx)
      assigned += materials.length
    }
    return { assigned }
  })
}
