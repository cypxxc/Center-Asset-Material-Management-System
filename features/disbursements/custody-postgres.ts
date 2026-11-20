import 'server-only'
import { sql } from 'drizzle-orm'
import { getCurrentProfile } from '@/features/auth/queries'
import { withUserDatabase } from '@/lib/postgres/request'
import type { PostgresTransaction } from '@/lib/postgres/db'
import { assignCustodySchema, custodyHistoryParamsSchema, returnCustodySchema } from './custody-schema'
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

export type CustodyStatusAction = 'can_return' | 'returned' | 'cancelled' | 'transferred' | 'completed'

export interface CustodyHistoryRow extends Record<string, unknown> {
  id: string
  action: string
  item_id: string | null
  item_name: string
  asset_no: string | null
  from_responsible: string | null
  to_responsible: string | null
  actor_name: string | null
  created_at: string
  can_return: boolean
  is_returned: boolean
  status_action?: CustodyStatusAction
  current_responsible?: string | null
  current_location_id?: string | null
}

export async function getCustodyHistory(rawInput: unknown = {}) {
  await requireAdmin()
  const params = custodyHistoryParamsSchema.parse(rawInput)
  const pageSize = 20
  const historySql = sql`
    SELECT a.id,
      a.action,
      a.target_id AS item_id,
      coalesce(a.new_data->>'item_name', i.item_name, '-') AS item_name,
      coalesce(a.new_data->>'asset_no', i.asset_no) AS asset_no,
      coalesce(a.old_data->>'responsible_person', a.new_data->>'previous_custodian') AS from_responsible,
      CASE
        WHEN a.action = 'RETURN_CUSTODY' THEN 'ส่วนกลาง'
        ELSE a.new_data->>'responsible_person'
      END AS to_responsible,
      p.full_name AS actor_name,
      a.created_at,
      i.responsible_person AS current_responsible,
      i.location_id AS current_location_id,
      CASE
        WHEN a.action = 'RETURN_CUSTODY' THEN 'returned'
        WHEN nl.action = 'RETURN_CUSTODY' THEN 'returned'
        WHEN nl.action = 'ASSIGN_CUSTODY' THEN 'transferred'
        WHEN i.id IS NULL OR i.deleted_at IS NOT NULL THEN 'cancelled'
        WHEN coalesce(i.is_central, false) = false
          AND i.responsible_person IS NOT NULL
          AND i.responsible_person = (a.new_data->>'responsible_person') THEN 'can_return'
        WHEN i.responsible_person IS NOT NULL
          AND i.responsible_person != (a.new_data->>'responsible_person') THEN 'transferred'
        ELSE 'completed'
      END AS status_action,
      (
        a.action = 'ASSIGN_CUSTODY'
        AND nl.action IS NULL
        AND i.id IS NOT NULL
        AND i.deleted_at IS NULL
        AND coalesce(i.is_central, false) = false
        AND i.responsible_person IS NOT NULL
        AND i.responsible_person = (a.new_data->>'responsible_person')
      ) AS can_return,
      (
        a.action = 'RETURN_CUSTODY'
        OR nl.action = 'RETURN_CUSTODY'
      ) AS is_returned
    FROM public.audit_logs a
    LEFT JOIN public.items i ON i.id = a.target_id
    LEFT JOIN public.profiles p ON p.id = a.user_id
    LEFT JOIN LATERAL (
      SELECT a2.action
      FROM public.audit_logs a2
      WHERE a2.target_table = 'items'
        AND a2.target_id = a.target_id
        AND a2.action IN ('ASSIGN_CUSTODY', 'RETURN_CUSTODY')
        AND (a2.created_at > a.created_at OR (a2.created_at = a.created_at AND a2.id > a.id))
      ORDER BY a2.created_at ASC, a2.id ASC
      LIMIT 1
    ) nl ON true
    WHERE a.action IN ('ASSIGN_CUSTODY', 'RETURN_CUSTODY') AND a.target_table = 'items'
  `
  const pattern = `%${normalizeForSearch(params.q)}%`
  const baseFilter = params.active_only ? sql`h.can_return = true` : sql`true`
  const filter = params.q
    ? sql`WHERE ${baseFilter} AND (h.item_name ILIKE ${pattern} OR h.asset_no ILIKE ${pattern}
        OR h.from_responsible ILIKE ${pattern} OR h.to_responsible ILIKE ${pattern} OR h.actor_name ILIKE ${pattern})`
    : (params.active_only ? sql`WHERE ${baseFilter}` : sql``)
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
        SELECT a.id,
          a.action,
          a.target_id AS item_id,
          coalesce(a.new_data->>'item_name', i.item_name, '-') AS item_name,
          coalesce(a.new_data->>'asset_no', i.asset_no) AS asset_no,
          coalesce(a.old_data->>'responsible_person', a.new_data->>'previous_custodian') AS from_responsible,
          CASE
            WHEN a.action = 'RETURN_CUSTODY' THEN 'ส่วนกลาง'
            ELSE a.new_data->>'responsible_person'
          END AS to_responsible,
          p.full_name AS actor_name,
          a.created_at::text AS created_at,
          i.responsible_person AS current_responsible,
          i.location_id AS current_location_id,
          CASE
            WHEN a.action = 'RETURN_CUSTODY' THEN 'returned'
            WHEN nl.action = 'RETURN_CUSTODY' THEN 'returned'
            WHEN nl.action = 'ASSIGN_CUSTODY' THEN 'transferred'
            WHEN i.id IS NULL OR i.deleted_at IS NOT NULL THEN 'cancelled'
            WHEN coalesce(i.is_central, false) = false
              AND i.responsible_person IS NOT NULL
              AND i.responsible_person = (a.new_data->>'responsible_person') THEN 'can_return'
            WHEN i.responsible_person IS NOT NULL
              AND i.responsible_person != (a.new_data->>'responsible_person') THEN 'transferred'
            ELSE 'completed'
          END AS status_action,
          (
            a.action = 'ASSIGN_CUSTODY'
            AND nl.action IS NULL
            AND i.id IS NOT NULL
            AND i.deleted_at IS NULL
            AND coalesce(i.is_central, false) = false
            AND i.responsible_person IS NOT NULL
            AND i.responsible_person = (a.new_data->>'responsible_person')
          ) AS can_return,
          (
            a.action = 'RETURN_CUSTODY'
            OR nl.action = 'RETURN_CUSTODY'
          ) AS is_returned
        FROM public.audit_logs a
        LEFT JOIN public.items i ON i.id = a.target_id
        LEFT JOIN public.profiles p ON p.id = a.user_id
        LEFT JOIN LATERAL (
          SELECT a2.action
          FROM public.audit_logs a2
          WHERE a2.target_table = 'items'
            AND a2.target_id = a.target_id
            AND a2.action IN ('ASSIGN_CUSTODY', 'RETURN_CUSTODY')
            AND (a2.created_at > a.created_at OR (a2.created_at = a.created_at AND a2.id > a.id))
          ORDER BY a2.created_at ASC, a2.id ASC
          LIMIT 1
        ) nl ON true
        WHERE a.action IN ('ASSIGN_CUSTODY', 'RETURN_CUSTODY') AND a.target_table = 'items'
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
        is_central: boolean; note: string | null; responsible_person: string | null; status: string | null; location_id: string | null
      }>(sql`SELECT id, item_type, item_name, asset_no, is_central, note, responsible_person, status, location_id
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
      await tx.execute(sql`SELECT private.apply_asset_custody_event(
        ${item.id}, NULL, 'assignment', 1, 'normal', NULL, ${newNote}, NULL, ${recipient.id}
      )`)
      await tx.execute(sql`INSERT INTO public.audit_logs (user_id, action, target_table, target_id, old_data, new_data)
        VALUES (${admin.id}, 'ASSIGN_CUSTODY', 'items', ${item.id},
          ${JSON.stringify({ responsible_person: item.responsible_person, is_central: item.is_central, note: item.note, location_id: item.location_id })}::jsonb,
          ${JSON.stringify({ responsible_person: recipient.full_name, recipient_id: recipient.id, item_name: item.item_name, asset_no: item.asset_no, is_central: false, note: newNote, origin_location_id: item.location_id })}::jsonb)`)
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

export async function getActiveLocations() {
  await requireAdmin()
  return withUserDatabase(async (tx) => {
    const res = await tx.execute<{ id: string; name: string }>(sql`
      SELECT id, name FROM public.locations WHERE is_active = true ORDER BY name
    `)
    return res.rows
  })
}

export async function findOriginLocation(
  tx: PostgresTransaction,
  itemId: string,
  responsiblePerson: string | null
): Promise<{ id: string; name: string } | null> {
  // Step 1: Look at the latest ASSIGN_CUSTODY audit log for this item and this responsible_person
  const assignLogRes = await tx.execute<{
    origin_location_id: string | null
    old_location_id: string | null
    log_created_at: string
    log_id: string
  }>(sql`
    SELECT
      a.new_data->>'origin_location_id' AS origin_location_id,
      a.old_data->>'location_id' AS old_location_id,
      a.created_at::text AS log_created_at,
      a.id::text AS log_id
    FROM public.audit_logs a
    WHERE a.action = 'ASSIGN_CUSTODY'
      AND a.target_table = 'items'
      AND a.target_id = ${itemId}
      AND (${responsiblePerson}::text IS NULL OR a.new_data->>'responsible_person' = ${responsiblePerson})
    ORDER BY a.created_at DESC, a.id DESC
    LIMIT 1
  `)

  const assignLog = assignLogRes.rows[0]
  const explicitLocId = assignLog?.origin_location_id || assignLog?.old_location_id
  if (explicitLocId) {
    const locRes = await tx.execute<{ id: string; name: string }>(sql`
      SELECT id, name FROM public.locations WHERE id = ${explicitLocId}::uuid
    `)
    if (locRes.rows[0]) return locRes.rows[0]
  }

  // Step 2: Check disbursement documents (asset_handover / asset_borrow)
  const disbRes = await tx.execute<{ location_id: string | null; location_name: string }>(sql`
    SELECT l.id AS location_id, coalesce(l.name, di.location_name_snapshot) AS location_name
    FROM public.disbursement_items di
    JOIN public.disbursements d ON d.id = di.disbursement_id
    LEFT JOIN public.locations l ON l.name = di.location_name_snapshot
    WHERE di.item_id = ${itemId}
      AND (${responsiblePerson}::text IS NULL OR d.recipient_name = ${responsiblePerson})
      AND di.location_name_snapshot IS NOT NULL
    ORDER BY d.created_at DESC, di.id DESC
    LIMIT 1
  `)
  if (disbRes.rows[0]?.location_id && disbRes.rows[0]?.location_name) {
    return { id: disbRes.rows[0].location_id, name: disbRes.rows[0].location_name }
  }

  // Step 3: If assignLog exists but didn't have location_id stored in its JSON,
  // find the latest item location audit log BEFORE or AT the time of this assignment
  if (assignLog) {
    const prevLocRes = await tx.execute<{ location_id: string }>(sql`
      SELECT coalesce(al.new_data->>'location_id', al.old_data->>'location_id') AS location_id
      FROM public.audit_logs al
      WHERE al.target_table = 'items'
        AND al.target_id = ${itemId}
        AND al.id::text != ${assignLog.log_id}
        AND al.created_at <= ${assignLog.log_created_at}::timestamptz
        AND (al.new_data->>'location_id' IS NOT NULL OR al.old_data->>'location_id' IS NOT NULL)
      ORDER BY al.created_at DESC, al.id DESC
      LIMIT 1
    `)
    const prevLocId = prevLocRes.rows[0]?.location_id
    if (prevLocId) {
      const loc = await tx.execute<{ id: string; name: string }>(sql`
        SELECT id, name FROM public.locations WHERE id = ${prevLocId}::uuid
      `)
      if (loc.rows[0]) return loc.rows[0]
    }
  }

  // Step 4: Check if there was an earlier RETURN_CUSTODY log before this assignment
  const returnLogRes = await tx.execute<{ location_id: string }>(sql`
    SELECT coalesce(al.new_data->>'origin_location_id', al.new_data->>'location_id') AS location_id
    FROM public.audit_logs al
    WHERE al.action = 'RETURN_CUSTODY'
      AND al.target_table = 'items'
      AND al.target_id = ${itemId}
    ORDER BY al.created_at DESC, al.id DESC
    LIMIT 1
  `)
  const returnLocId = returnLogRes.rows[0]?.location_id
  if (returnLocId) {
    const loc = await tx.execute<{ id: string; name: string }>(sql`
      SELECT id, name FROM public.locations WHERE id = ${returnLocId}::uuid
    `)
    if (loc.rows[0]) return loc.rows[0]
  }

  // Step 5: Check item creation / import log
  const createLogRes = await tx.execute<{ location_id: string }>(sql`
    SELECT coalesce(al.new_data->>'location_id', al.old_data->>'location_id') AS location_id
    FROM public.audit_logs al
    WHERE al.target_table = 'items'
      AND al.target_id = ${itemId}
      AND (al.new_data->>'location_id' IS NOT NULL OR al.old_data->>'location_id' IS NOT NULL)
    ORDER BY al.created_at ASC, al.id ASC
    LIMIT 1
  `)
  const createLocId = createLogRes.rows[0]?.location_id
  if (createLocId) {
    const loc = await tx.execute<{ id: string; name: string }>(sql`
      SELECT id, name FROM public.locations WHERE id = ${createLocId}::uuid
    `)
    if (loc.rows[0]) return loc.rows[0]
  }

  return null
}

export async function getOriginLocation(itemId: string, custodianName?: string | null) {
  await requireAdmin()
  return withUserDatabase(async (tx) => {
    return findOriginLocation(tx, itemId, custodianName ?? null)
  })
}

export async function returnPostgresCustody(rawInput: unknown) {
  const admin = await requireAdmin()
  const data = returnCustodySchema.parse(rawInput)
  return withUserDatabase(async (tx) => {
    await lockDisbursementItems(tx, [data.item_id])
    const result = await tx.execute<{
      id: string
      item_type: string
      item_name: string
      asset_no: string | null
      is_central: boolean
      responsible_person: string | null
      status: string | null
      location_id: string | null
      note: string | null
    }>(sql`
      SELECT id, item_type, item_name, asset_no, is_central, responsible_person, status, location_id, note
      FROM public.items
      WHERE id = ${data.item_id} AND deleted_at IS NULL
      FOR UPDATE
    `)
    const item = result.rows[0]
    if (!item) throw new Error('ไม่พบครุภัณฑ์ในระบบหรือครุภัณฑ์ถูกลบแล้ว')
    if (item.item_type !== 'asset') throw new Error('สามารถรับคืนได้เฉพาะครุภัณฑ์เท่านั้น')

    if (item.is_central && !item.responsible_person) {
      throw new Error('ครุภัณฑ์นี้ถูกรับคืนเป็นของส่วนกลางแล้ว')
    }
    if (!item.responsible_person) {
      throw new Error('ครุภัณฑ์นี้ไม่มีผู้ถือครองที่สามารถรับคืนได้')
    }

    const openIssue = await tx.execute<{ id: string; document_no: string | null; transaction_type: string }>(sql`
      SELECT d.id, d.document_no, d.transaction_type
      FROM public.disbursement_items di
      JOIN public.disbursements d ON d.id = di.disbursement_id
      WHERE di.item_id = ${data.item_id}
        AND (
          d.status = 'pending_approval'
          OR (d.transaction_type = 'asset_borrow' AND d.status IN ('active_borrow', 'partially_returned'))
        )
        AND di.status IN ('issued', 'partially_returned')
        AND di.issued_qty > di.returned_qty
      LIMIT 1
    `)
    const blockedDocument = openIssue.rows[0]
    if (blockedDocument) {
      const reference = blockedDocument.document_no || blockedDocument.id
      if (blockedDocument.transaction_type !== 'asset_handover') {
        throw new Error(`ครุภัณฑ์นี้อยู่ระหว่างการยืมตามเอกสาร ${reference} กรุณาบันทึกรับคืนผ่านเมนู "เบิก-จ่ายและยืม"`)
      }
      throw new Error(`ครุภัณฑ์นี้จ่ายแล้วตามเอกสารส่งมอบ ${reference} ที่ยังรออนุมัติ กรุณาดำเนินการเอกสารให้เสร็จก่อนรับคืน`)
    }

    const originLocation = await findOriginLocation(tx, item.id, item.responsible_person)
    if (!originLocation) {
      throw new Error('ไม่พบข้อมูลสถานที่ต้นทางเดิมก่อนสั่งจ่ายในระบบ ไม่สามารถเดาสถานที่ได้ กรุณาระบุข้อมูลต้นทางในระบบก่อนทำรายการ')
    }

    const newStatus = data.condition === 'damaged' ? 'damaged' : 'active'
    const newNote = syncCentralNote(item.note || '', true) || null

    await tx.execute(sql`SELECT private.apply_asset_custody_event(
      ${item.id}, NULL, 'custody_return', 1, ${data.condition}, ${data.reason}, ${newNote}, ${originLocation.id}
    )`)
    await tx.execute(sql`
      INSERT INTO public.audit_logs (user_id, action, target_table, target_id, old_data, new_data)
      VALUES (${admin.id}, 'RETURN_CUSTODY', 'items', ${item.id},
        ${JSON.stringify({
          responsible_person: item.responsible_person,
          is_central: item.is_central,
          status: item.status,
          location_id: item.location_id,
          note: item.note,
        })}::jsonb,
        ${JSON.stringify({
          responsible_person: null,
          is_central: true,
          status: newStatus,
          location_id: originLocation.id,
          origin_location_id: originLocation.id,
          origin_location_name: originLocation.name,
          note: newNote,
          condition: data.condition,
          reason: data.reason,
          return_date: data.return_date || new Date().toISOString().slice(0, 10),
          item_name: item.item_name,
          asset_no: item.asset_no,
          previous_custodian: item.responsible_person,
          additional_note: data.note || null,
        })}::jsonb)
    `)

    return { ok: true, item_id: item.id, origin_location: originLocation }
  })
}
