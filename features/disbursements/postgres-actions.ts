import 'server-only'
import { sql } from 'drizzle-orm'
import { z } from 'zod'
import { getCurrentProfile } from '@/features/auth/queries'
import { withUserDatabase } from '@/lib/postgres/request'
import {
  disbursementDraftSchema,
  updateDisbursementDraftSchema,
  cancelDisbursementDraftSchema,
  returnItemSchema,
  reverseDisbursementSchema,
  submitBorrowRequestSchema,
  rejectDisbursementSchema,
} from './schema'
import type {
  DisbursementRow,
  DisbursementItemRow,
  AssetCustodyLogRow,
} from './types'
import { computeThaiFiscalYear } from './fiscal-year'
import { assertCentralDisbursementItem } from './central-items'
import { syncCentralNote } from '@/features/items/central-note'
import { assertItemUnreserved, lockDisbursementItems } from './reservations'

async function requireDisbursementWriter() {
  const profile = await getCurrentProfile()
  if (!profile?.is_active || !['admin', 'user'].includes(profile.role)) {
    throw new Error('คุณไม่มีสิทธิ์ทำรายการเบิก-จ่ายพัสดุ')
  }
  return profile
}

async function requireDisbursementAdmin() {
  const profile = await getCurrentProfile()
  if (!profile?.is_active || profile.role !== 'admin') {
    throw new Error('เฉพาะผู้ดูแลระบบเท่านั้นที่มีสิทธิ์จ่าย รับคืน หรือย้อนรายการ')
  }
  return profile
}

/**
 * Create a new draft disbursement document with line items
 */
export async function createPostgresDisbursementDraft(rawInput: unknown): Promise<{ id: string }> {
  const user = await requireDisbursementWriter()
  const data = disbursementDraftSchema.parse(rawInput)
  if (user.role !== 'admin' && data.transaction_type !== 'material_issue') throw new Error('User สร้างได้เฉพาะเอกสารเบิกพัสดุ')

  return withUserDatabase(async (tx) => {
    await lockDisbursementItems(tx, data.items.map((item) => item.item_id))
    // 1. Verify item types and unique borrowing constraints
    for (const item of [...data.items].sort((a, b) => a.item_id.localeCompare(b.item_id))) {
      const itemRes = await tx.execute<{ id: string; item_type: string; asset_no: string | null; note: string | null; is_central: boolean; quantity: number; status: string | null }>(
        sql`SELECT id, item_type, asset_no, note, is_central, quantity, status FROM public.items WHERE id = ${item.item_id} AND deleted_at IS NULL ${user.role === 'admin' ? sql`FOR UPDATE` : sql``}`
      )
      const found = itemRes.rows[0]
      if (!found) throw new Error('ไม่พบข้อมูลพัสดุหรือพัสดุถูกลบแล้ว')
      assertCentralDisbursementItem(found)
      if (found.status && !['active', 'spare'].includes(found.status)) throw new Error('รายการนี้ไม่อยู่ในสถานะพร้อมใช้งาน')
      if (Number(found.quantity) < item.requested_qty) throw new Error('จำนวนพร้อมใช้งานไม่เพียงพอ')

      if (data.transaction_type === 'material_issue' && found.item_type !== 'material') {
        throw new Error('เอกสารเบิกจ่ายพัสดุ รองรับเฉพาะรายการประเภทพัสดุเท่านั้น')
      }
      if (data.transaction_type === 'asset_handover' && found.item_type !== 'asset') {
        throw new Error('เอกสารส่งมอบครุภัณฑ์ รองรับเฉพาะรายการประเภทครุภัณฑ์เท่านั้น')
      }
      await assertItemUnreserved(tx, item.item_id)
      if (data.transaction_type === 'asset_borrow') {
        if (item.requested_qty !== 1) {
          throw new Error('การยืมของส่วนกลาง สามารถยืมได้ครั้งละ 1 หน่วยต่อรายการ')
        }
        if (!found.is_central && (!found.note || !found.note.includes('ส่วนกลาง'))) {
          throw new Error('การยืมอนุญาตเฉพาะรายการที่เป็น "ของส่วนกลาง" เท่านั้น')
        }
      }
    }

    // 2. Insert header draft
    const docRes = await tx.execute<{ id: string }>(
      sql`INSERT INTO public.disbursements (
        transaction_type, recipient_name, department_name, purpose, status, due_date, created_by
      ) VALUES (
        ${data.transaction_type}, ${data.recipient_name}, ${data.department_name}, ${data.purpose}, ${user.role === 'user' ? 'pending_approval' : 'draft'}, ${data.due_date || null}, ${user.id}
      ) RETURNING id`
    )
    const docId = docRes.rows[0].id

    // 3. Insert lines
    for (const item of [...data.items].sort((a, b) => a.item_id.localeCompare(b.item_id))) {
      await tx.execute(
        sql`INSERT INTO public.disbursement_items (
          disbursement_id, item_id, requested_qty, status
        ) VALUES (
          ${docId}, ${item.item_id}, ${item.requested_qty}, 'pending'
        )`
      )
    }

    await tx.execute(sql`INSERT INTO public.audit_logs (user_id, action, target_table, target_id, old_data, new_data)
      VALUES (${user.id}, ${user.role === 'user' ? 'REQUEST_ISSUE' : 'CREATE_DISBURSEMENT_DRAFT'}, 'disbursements', ${docId}, NULL,
        ${JSON.stringify({ transaction_type: data.transaction_type, items: data.items, status: user.role === 'user' ? 'pending_approval' : 'draft' })}::jsonb)`)
    return { id: docId }
  })
}

/**
 * Update an existing draft disbursement document with line items
 */
export async function updatePostgresDisbursementDraft(rawInput: unknown): Promise<{ id: string }> {
  const user = await requireDisbursementWriter()
  const data = updateDisbursementDraftSchema.parse(rawInput)
  if (user.role !== 'admin' && data.transaction_type !== 'material_issue') throw new Error('User แก้ไขได้เฉพาะเอกสารเบิกพัสดุ')

  return withUserDatabase(async (tx) => {
    // 1. Lock document header and assert draft status
    const docRes = await tx.execute<DisbursementRow>(
      sql`SELECT * FROM public.disbursements WHERE id = ${data.id} FOR UPDATE`
    )
    const doc = docRes.rows[0]
    if (!doc) throw new Error('ไม่พบเอกสารเบิกจ่าย')
    if (doc.status !== 'draft') throw new Error(`สามารถแก้ไขได้เฉพาะเอกสารฉบับร่างเท่านั้น (สถานะปัจจุบัน: ${doc.status})`)
    await lockDisbursementItems(tx, data.items.map((item) => item.item_id))

    // 2. Validate items match transaction type
    for (const item of [...data.items].sort((a, b) => a.item_id.localeCompare(b.item_id))) {
      const itemRes = await tx.execute<{ id: string; item_type: string; asset_no: string | null; note: string | null; is_central: boolean; quantity: number; status: string | null }>(
        sql`SELECT id, item_type, asset_no, note, is_central, quantity, status FROM public.items WHERE id = ${item.item_id} AND deleted_at IS NULL FOR UPDATE`
      )
      const found = itemRes.rows[0]
      if (!found) throw new Error('ไม่พบข้อมูลพัสดุหรือพัสดุถูกลบแล้ว')
      assertCentralDisbursementItem(found)
      if (found.status && !['active', 'spare'].includes(found.status)) throw new Error('รายการนี้ไม่อยู่ในสถานะพร้อมใช้งาน')
      if (Number(found.quantity) < item.requested_qty) throw new Error('จำนวนพร้อมใช้งานไม่เพียงพอ')

      if (data.transaction_type === 'material_issue' && found.item_type !== 'material') {
        throw new Error('เอกสารเบิกจ่ายพัสดุ รองรับเฉพาะรายการประเภทพัสดุเท่านั้น')
      }
      if (data.transaction_type === 'asset_handover' && found.item_type !== 'asset') {
        throw new Error('เอกสารส่งมอบครุภัณฑ์ รองรับเฉพาะรายการประเภทครุภัณฑ์เท่านั้น')
      }
      await assertItemUnreserved(tx, item.item_id)
      if (data.transaction_type === 'asset_borrow') {
        if (item.requested_qty !== 1) {
          throw new Error('การยืมของส่วนกลาง สามารถยืมได้ครั้งละ 1 หน่วยต่อรายการ')
        }
        if (!found.is_central && (!found.note || !found.note.includes('ส่วนกลาง'))) {
          throw new Error('การยืมอนุญาตเฉพาะรายการที่เป็น "ของส่วนกลาง" เท่านั้น')
        }
      }
    }

    // 3. Update header
    await tx.execute(
      sql`UPDATE public.disbursements
          SET transaction_type = ${data.transaction_type},
              recipient_name = ${data.recipient_name},
              department_name = ${data.department_name},
              purpose = ${data.purpose},
              due_date = ${data.due_date || null},
              updated_at = now()
          WHERE id = ${data.id}`
    )

    // 4. Recreate lines cleanly for draft
    await tx.execute(sql`DELETE FROM public.disbursement_items WHERE disbursement_id = ${data.id}`)

    for (const item of [...data.items].sort((a, b) => a.item_id.localeCompare(b.item_id))) {
      await tx.execute(
        sql`INSERT INTO public.disbursement_items (
          disbursement_id, item_id, requested_qty, status
        ) VALUES (
          ${data.id}, ${item.item_id}, ${item.requested_qty}, 'pending'
        )`
      )
    }

    // 5. In-transaction audit
    await tx.execute(
      sql`INSERT INTO public.audit_logs (user_id, action, target_table, target_id, old_data, new_data)
          VALUES (
            ${user.id}, 'UPDATE_DISBURSEMENT_DRAFT', 'disbursements', ${data.id},
            ${JSON.stringify({ recipient_name: doc.recipient_name, purpose: doc.purpose })}::jsonb,
            ${JSON.stringify({ recipient_name: data.recipient_name, purpose: data.purpose })}::jsonb
          )`
    )

    return { id: data.id }
  })
}

/**
 * Cancel an unconfirmed draft disbursement document
 */
export async function cancelPostgresDisbursementDraft(rawInput: unknown): Promise<{ ok: boolean }> {
  const user = await requireDisbursementWriter()
  const data = cancelDisbursementDraftSchema.parse(rawInput)

  return withUserDatabase(async (tx) => {
    // Lock document header and assert draft status
    const docRes = await tx.execute<DisbursementRow>(
      sql`SELECT * FROM public.disbursements WHERE id = ${data.id} FOR UPDATE`
    )
    const doc = docRes.rows[0]
    if (!doc) throw new Error('ไม่พบเอกสารเบิกจ่าย')
    if (user.role !== 'admin' && doc.created_by !== user.id) throw new Error('คุณไม่มีสิทธิ์ยกเลิกคำขอของผู้อื่น')
    if (user.role !== 'admin' && doc.status !== 'pending_approval') throw new Error('ยกเลิกได้เฉพาะคำขอของตนเองที่รออนุมัติ')
    if (!['draft', 'pending_approval'].includes(doc.status)) throw new Error('ไม่สามารถยกเลิกรายการที่อนุมัติหรือจบแล้วได้')

    await tx.execute(
      sql`UPDATE public.disbursements SET status = 'cancelled', updated_at = now() WHERE id = ${data.id}`
    )

    // In-transaction audit
    await tx.execute(
      sql`INSERT INTO public.audit_logs (user_id, action, target_table, target_id, old_data, new_data)
          VALUES (
            ${user.id}, ${doc.status === 'draft' ? 'CANCEL_DISBURSEMENT_DRAFT' : 'WITHDRAW_DISBURSEMENT_REQUEST'}, 'disbursements', ${data.id},
            ${JSON.stringify({ status: doc.status })}::jsonb,
            ${JSON.stringify({ status: 'cancelled' })}::jsonb
          )`
    )

    return { ok: true }
  })
}

/**
 * Confirm disbursement draft: locks inventory, allocates Thai fiscal year sequence, snapshots items, updates custody/stock, writes audit log
 */
export async function confirmPostgresDisbursement(disbursementId: string): Promise<{ document_no: string }> {
  const user = await requireDisbursementAdmin()
  z.string().uuid().parse(disbursementId)

  return withUserDatabase(async (tx) => {
    // 1. Lock document header
    const docRes = await tx.execute<DisbursementRow>(
      sql`SELECT * FROM public.disbursements WHERE id = ${disbursementId} FOR UPDATE`
    )
    const doc = docRes.rows[0]
    if (!doc) throw new Error('ไม่พบเอกสารเบิกจ่าย')
    if (!['draft', 'pending_approval'].includes(doc.status)) {
      throw new Error(`ไม่สามารถยืนยันหรืออนุมัติเอกสารในสถานะ ${doc.status} ได้`)
    }

    // 2. Lock and fetch lines with current item metadata (deterministic order by item_id to prevent lock cycle)
    const linesRes = await tx.execute<DisbursementItemRow>(
      sql`SELECT * FROM public.disbursement_items
          WHERE disbursement_id = ${disbursementId} ORDER BY item_id ASC FOR UPDATE`
    )
    const lines = linesRes.rows
    if (lines.length === 0) throw new Error('ไม่สามารถยืนยันเอกสารที่ไม่มีรายการสิ่งของได้')
    await lockDisbursementItems(tx, lines.map((line) => line.item_id))

    // 3. Allocate Thai fiscal year sequence
    const fiscalYear = computeThaiFiscalYear()
    const seqRes = await tx.execute<{ current_val: number }>(
      sql`INSERT INTO public.disbursement_sequences (fiscal_year, prefix, current_val)
          VALUES (${fiscalYear}, 'DIS', 1)
          ON CONFLICT (fiscal_year, prefix)
          DO UPDATE SET current_val = public.disbursement_sequences.current_val + 1
          RETURNING current_val`
    )
    const seqVal = seqRes.rows[0].current_val
    const docNo = `DIS-${fiscalYear}-${String(seqVal).padStart(4, '0')}`

    // 4. Process each line with row locking on public.items
    for (const line of lines) {
      // Row lock on inventory item
      const itemLock = await tx.execute<{
        id: string; quantity: number; item_type: string; item_name: string;
        asset_no: string | null; serial_no: string | null; brand: string | null; model: string | null;
        responsible_person: string | null; is_central: boolean; note: string | null; status: string | null;
        unit_name: string | null; unit_price: number | null; category_name: string | null; location_name: string | null;
      }>(sql`SELECT i.*, u.name AS unit_name, c.name AS category_name, l.name AS location_name
        FROM public.items i
        LEFT JOIN public.units u ON u.id = i.unit_id
        LEFT JOIN public.categories c ON c.id = i.category_id
        LEFT JOIN public.locations l ON l.id = i.location_id
        WHERE i.id = ${line.item_id} AND i.deleted_at IS NULL FOR UPDATE OF i`)
      const currentItem = itemLock.rows[0]
      if (!currentItem) throw new Error(`พัสดุ ${line.item_id} ถูกลบหรือไม่พร้อมใช้งาน`)
      assertCentralDisbursementItem(currentItem)
      if (currentItem.status && !['active', 'spare'].includes(currentItem.status)) throw new Error('รายการนี้ไม่อยู่ในสถานะพร้อมใช้งาน')
      if (currentItem.quantity < line.requested_qty) throw new Error('จำนวนคงเหลือไม่เพียงพอสำหรับการอนุมัติ')
      if (doc.transaction_type === 'material_issue' ? currentItem.item_type !== 'material' : currentItem.item_type !== 'asset') {
        throw new Error('ประเภทสิ่งของเปลี่ยนแปลง ไม่ตรงกับคำขอ')
      }

      await assertItemUnreserved(tx, line.item_id, disbursementId)

      if (doc.transaction_type === 'material_issue') {
        // Deduct inventory
        await tx.execute(
          sql`UPDATE public.items SET quantity = quantity - ${line.requested_qty}, updated_at = now() WHERE id = ${line.item_id}`
        )

        // Ledger entry
        await tx.execute(
          sql`INSERT INTO public.stock_movements (
            item_id, disbursement_item_id, delta, balance_after, movement_type, created_by
          ) VALUES (
            ${line.item_id}, ${line.id}, ${-line.requested_qty}, ${currentItem.quantity - line.requested_qty}, 'issue', ${user.id}
          )`
        )
      } else if (['asset_handover', 'asset_borrow'].includes(doc.transaction_type)) {
        // Record custody log
        await tx.execute(
          sql`INSERT INTO public.asset_custody_logs (
            item_id, disbursement_item_id, action, quantity, from_responsible, to_responsible, created_by
          ) VALUES (
            ${line.item_id}, ${line.id},
            ${doc.transaction_type === 'asset_borrow' ? 'borrow' : 'handover'},
            ${line.requested_qty}, ${currentItem.responsible_person}, ${doc.recipient_name}, ${user.id}
          )`
        )

        // Update custody on item
        await tx.execute(sql`UPDATE public.items SET responsible_person = ${doc.recipient_name},
          is_central = false, note = ${syncCentralNote(currentItem.note || '', false) || null},
          updated_at = now() WHERE id = ${line.item_id}`)
      }

      // Snapshot line data
      await tx.execute(
        sql`UPDATE public.disbursement_items
            SET issued_qty = ${line.requested_qty},
                item_name_snapshot = ${currentItem.item_name},
                asset_no_snapshot = ${currentItem.asset_no},
                serial_no_snapshot = ${currentItem.serial_no},
                brand_snapshot = ${currentItem.brand},
                model_snapshot = ${currentItem.model},
                unit_name_snapshot = ${currentItem.unit_name},
                unit_price_snapshot = ${currentItem.unit_price},
                category_name_snapshot = ${currentItem.category_name},
                location_name_snapshot = ${currentItem.location_name},
                status = 'issued'
            WHERE id = ${line.id}`
      )
    }

    const targetStatus = doc.transaction_type === 'asset_borrow' ? 'active_borrow' : 'confirmed'

    // 5. Update header
    await tx.execute(
      sql`UPDATE public.disbursements
          SET document_no = ${docNo},
              fiscal_year = ${fiscalYear},
              status = ${targetStatus},
              confirmed_at = now(),
              confirmed_by = ${user.id},
              updated_at = now()
          WHERE id = ${disbursementId}`
    )

    // 6. In-transaction audit log
    await tx.execute(
      sql`INSERT INTO public.audit_logs (user_id, action, target_table, target_id, old_data, new_data)
          VALUES (
            ${user.id}, 'CONFIRM_DISBURSEMENT', 'disbursements', ${disbursementId},
            ${JSON.stringify({ status: doc.status })}::jsonb,
            ${JSON.stringify({ status: targetStatus, document_no: docNo })}::jsonb
          )`
    )

    return { document_no: docNo }
  })
}

/**
 * Record return of borrowed asset
 */
export async function returnPostgresDisbursementItem(rawInput: unknown): Promise<{ ok: boolean }> {
  const user = await requireDisbursementAdmin()
  const data = returnItemSchema.parse(rawInput)

  return withUserDatabase(async (tx) => {
    // 1. Look up parent disbursement ID for the target line item
    const refRes = await tx.execute<{ disbursement_id: string }>(
      sql`SELECT disbursement_id FROM public.disbursement_items WHERE id = ${data.line_id}`
    )
    const ref = refRes.rows[0]
    if (!ref) throw new Error('ไม่พบรายการพัสดุในเอกสาร')

    // 2. Lock parent document FIRST (Standard lock hierarchy: Header -> Lines -> Items)
    const docRes = await tx.execute<DisbursementRow>(
      sql`SELECT * FROM public.disbursements WHERE id = ${ref.disbursement_id} FOR UPDATE`
    )
    const doc = docRes.rows[0]
    if (!doc) throw new Error('ไม่พบเอกสารเบิกจ่าย')
    if (doc.transaction_type !== 'asset_borrow') throw new Error('สามารถบันทึกรับคืนได้เฉพาะรายการยืมครุภัณฑ์เท่านั้น')
    if (!['active_borrow', 'partially_returned'].includes(doc.status)) {
      throw new Error(`ไม่สามารถบันทึกรับคืนเอกสารในสถานะ ${doc.status} ได้`)
    }
    const dueCheck = await tx.execute<{ is_due: boolean }>(
      sql`SELECT ${doc.due_date}::date <= (current_timestamp AT TIME ZONE 'Asia/Bangkok')::date AS is_due`
    )
    if (dueCheck.rows[0]?.is_due !== true) throw new Error('ยังไม่ถึงกำหนดคืนพัสดุ')

    // 3. Lock target line item SECOND (under acquired parent lock)
    const lineRes = await tx.execute<DisbursementItemRow>(
      sql`SELECT * FROM public.disbursement_items WHERE id = ${data.line_id} FOR UPDATE`
    )
    const line = lineRes.rows[0]
    if (!line) throw new Error('ไม่พบรายการพัสดุในเอกสาร')
    if (!['issued', 'partially_returned'].includes(line.status)) throw new Error('รายการนี้ไม่ได้อยู่ระหว่างการยืมหรือรับคืนครบแล้ว')

    const newReturned = line.returned_qty + data.return_qty
    if (newReturned > line.issued_qty) {
      throw new Error(`ไม่สามารถรับคืนเกินจำนวนที่ยืมได้ (จ่ายไป: ${line.issued_qty}, คืนแล้ว: ${line.returned_qty}, จะคืน: ${data.return_qty})`)
    }

    // 4. Lock asset item THIRD
    await lockDisbursementItems(tx, [line.item_id])
    const itemRes = await tx.execute<{ id: string; responsible_person: string | null; note: string | null }>(
      sql`SELECT id, responsible_person, note FROM public.items WHERE id = ${line.item_id} AND deleted_at IS NULL FOR UPDATE`
    )
    const item = itemRes.rows[0]
    if (!item) throw new Error('ไม่พบครุภัณฑ์หรือครุภัณฑ์ถูกลบแล้ว')

    // 4. Record custody return event
    await tx.execute(
      sql`INSERT INTO public.asset_custody_logs (
        item_id, disbursement_item_id, action, quantity, from_responsible, to_responsible, item_condition, note, created_by
      ) VALUES (
        ${item.id}, ${line.id}, 'return', ${data.return_qty}, ${doc.recipient_name}, NULL, ${data.condition}, ${data.note || null}, ${user.id}
      )`
    )

    // Return to the central pool only after an admin receives the full quantity.
    const restoredToPool = newReturned === line.issued_qty && data.condition !== 'lost'
    const centralNote = syncCentralNote(item.note || '', restoredToPool) || null
    // 5. Update item status & custody based on return condition
    if (data.condition === 'damaged') {
      await tx.execute(
        sql`UPDATE public.items 
            SET responsible_person = NULL, 
                status = 'damaged', 
                is_central = ${restoredToPool},
                note = ${centralNote},
                updated_at = now() 
            WHERE id = ${item.id}`
      )
    } else if (data.condition === 'lost') {
      await tx.execute(
        sql`UPDATE public.items 
            SET responsible_person = NULL, 
                status = 'inactive', 
                is_central = false,
                quantity = 0,
                note = CASE 
                  WHEN ${centralNote}::text IS NULL THEN 'บันทึกสูญหายจากการยืม'
                  ELSE ${centralNote} || ' [บันทึกสูญหายจากการยืม]'
                END,
                updated_at = now() 
            WHERE id = ${item.id}`
      )
    } else {
      await tx.execute(
        sql`UPDATE public.items SET responsible_person = NULL, is_central = ${restoredToPool},
          note = ${centralNote}, updated_at = now() WHERE id = ${item.id}`
      )
    }

    // 6. Update line status
    const lineStatus = newReturned === line.issued_qty ? 'returned' : 'partially_returned'
    await tx.execute(
      sql`UPDATE public.disbursement_items
          SET returned_qty = ${newReturned}, status = ${lineStatus}
          WHERE id = ${line.id}`
    )

    // 7. Check if all lines are returned
    const pendingRes = await tx.execute<{ count: number }>(
      sql`SELECT count(*)::int as count FROM public.disbursement_items WHERE disbursement_id = ${doc.id} AND status != 'returned'`
    )
    const allReturned = pendingRes.rows[0].count === 0
    const newDocStatus = allReturned ? 'returned' : 'partially_returned'

    await tx.execute(
      sql`UPDATE public.disbursements SET status = ${newDocStatus}, updated_at = now() WHERE id = ${doc.id}`
    )

    // 8. In-transaction audit log
    await tx.execute(
      sql`INSERT INTO public.audit_logs (user_id, action, target_table, target_id, old_data, new_data)
          VALUES (
            ${user.id}, 'RETURN_DISBURSEMENT_ITEM', 'disbursement_items', ${line.id},
            ${JSON.stringify({ returned_qty: line.returned_qty })}::jsonb,
            ${JSON.stringify({ returned_qty: newReturned, condition: data.condition, doc_status: newDocStatus })}::jsonb
          )`
    )

    return { ok: true }
  })
}

/** Return every outstanding item in a due borrowed-asset document as normal. */
export async function returnPostgresDisbursement(disbursementIdInput: unknown): Promise<{ ok: boolean }> {
  const user = await requireDisbursementAdmin()
  const { disbursement_id: disbursementId } = z.object({ disbursement_id: z.string().uuid() }).parse({ disbursement_id: disbursementIdInput })

  return withUserDatabase(async (tx) => {
    const docRes = await tx.execute<DisbursementRow>(
      sql`SELECT * FROM public.disbursements WHERE id = ${disbursementId} FOR UPDATE`
    )
    const doc = docRes.rows[0]
    if (!doc) throw new Error('ไม่พบเอกสารเบิกจ่าย')
    if (doc.transaction_type !== 'asset_borrow') throw new Error('สามารถคืนได้เฉพาะเอกสารยืมครุภัณฑ์')
    if (!['active_borrow', 'partially_returned'].includes(doc.status)) throw new Error('เอกสารนี้ไม่ได้อยู่ระหว่างการยืม')

    const dueCheck = await tx.execute<{ is_due: boolean }>(
      sql`SELECT ${doc.due_date}::date <= (current_timestamp AT TIME ZONE 'Asia/Bangkok')::date AS is_due`
    )
    if (dueCheck.rows[0]?.is_due !== true) throw new Error('ยังไม่ถึงกำหนดคืนพัสดุ')

    const linesRes = await tx.execute<DisbursementItemRow>(
      sql`SELECT * FROM public.disbursement_items WHERE disbursement_id = ${doc.id} ORDER BY item_id ASC FOR UPDATE`
    )
    const outstandingLines = linesRes.rows.filter(line =>
      ['issued', 'partially_returned'].includes(line.status) && line.issued_qty > line.returned_qty
    )
    if (outstandingLines.length === 0) throw new Error('ไม่มีรายการค้างคืนในเอกสารนี้')

    await lockDisbursementItems(tx, outstandingLines.map(line => line.item_id))
    for (const line of outstandingLines) {
      const itemRes = await tx.execute<{ id: string; note: string | null }>(
        sql`SELECT id, note FROM public.items WHERE id = ${line.item_id} AND deleted_at IS NULL FOR UPDATE`
      )
      const item = itemRes.rows[0]
      if (!item) throw new Error('ไม่พบครุภัณฑ์หรือครุภัณฑ์ถูกลบแล้ว')

      const returnedQty = line.issued_qty - line.returned_qty
      const centralNote = syncCentralNote(item.note || '', true) || null
      await tx.execute(sql`
        INSERT INTO public.asset_custody_logs (
          item_id, disbursement_item_id, action, quantity, from_responsible, to_responsible, item_condition, note, created_by
        ) VALUES (
          ${item.id}, ${line.id}, 'return', ${returnedQty}, ${doc.recipient_name}, NULL, 'normal', NULL, ${user.id}
        )
      `)
      await tx.execute(sql`
        UPDATE public.items SET responsible_person = NULL, is_central = true, note = ${centralNote}, updated_at = now()
        WHERE id = ${item.id}
      `)
      await tx.execute(sql`
        UPDATE public.disbursement_items SET returned_qty = ${line.issued_qty}, status = 'returned' WHERE id = ${line.id}
      `)
      await tx.execute(sql`
        INSERT INTO public.audit_logs (user_id, action, target_table, target_id, old_data, new_data)
        VALUES (
          ${user.id}, 'RETURN_DISBURSEMENT_ITEM', 'disbursement_items', ${line.id},
          ${JSON.stringify({ returned_qty: line.returned_qty })}::jsonb,
          ${JSON.stringify({ returned_qty: line.issued_qty, condition: 'normal', doc_status: 'returned' })}::jsonb
        )
      `)
    }

    await tx.execute(sql`UPDATE public.disbursements SET status = 'returned', updated_at = now() WHERE id = ${doc.id}`)
    return { ok: true }
  })
}

/**
 * Reverse a confirmed disbursement
 */
export async function reversePostgresDisbursement(rawInput: unknown): Promise<{ ok: boolean }> {
  const user = await requireDisbursementAdmin()
  const data = reverseDisbursementSchema.parse(rawInput)

  return withUserDatabase(async (tx) => {
    // 1. Lock document
    const docRes = await tx.execute<DisbursementRow>(
      sql`SELECT * FROM public.disbursements WHERE id = ${data.disbursement_id} FOR UPDATE`
    )
    const doc = docRes.rows[0]
    if (!doc) throw new Error('ไม่พบเอกสารเบิกจ่าย')

    // 2. Reversal guard: cannot reverse if any return has taken place
    const returnedCheck = await tx.execute<{ count: number }>(
      sql`SELECT count(*)::int as count FROM public.disbursement_items WHERE disbursement_id = ${doc.id} AND returned_qty > 0`
    )
    if (returnedCheck.rows[0].count > 0) {
      throw new Error('ไม่สามารถคืนสภาพเอกสารได้เนื่องจากมีการบันทึกคืนพัสดุบางส่วนไปแล้ว กรุณาใช้การรับคืนจนครบแทน')
    }

    if (!['confirmed', 'active_borrow'].includes(doc.status)) {
      throw new Error(`ไม่สามารถคืนสภาพเอกสารในสถานะ ${doc.status} ได้`)
    }

    // 3. Process lines (deterministic order by item_id ASC to match global lock hierarchy)
    const linesRes = await tx.execute<DisbursementItemRow>(
      sql`SELECT * FROM public.disbursement_items WHERE disbursement_id = ${doc.id} ORDER BY item_id ASC FOR UPDATE`
    )
    await lockDisbursementItems(tx, linesRes.rows.map((line) => line.item_id))

    for (const line of linesRes.rows) {
      const itemRes = await tx.execute<{ id: string; quantity: number; responsible_person: string | null; note: string | null }>(
        sql`SELECT id, quantity, responsible_person, note FROM public.items WHERE id = ${line.item_id} AND deleted_at IS NULL FOR UPDATE`
      )
      const item = itemRes.rows[0]
      if (!item) throw new Error(`พัสดุ ${line.item_id} ถูกลบหรือไม่พร้อมใช้งาน`)

      if (doc.transaction_type === 'material_issue') {
        // Refund stock
        await tx.execute(
          sql`UPDATE public.items SET quantity = quantity + ${line.issued_qty}, updated_at = now() WHERE id = ${item.id}`
        )

        // Ledger entry
        await tx.execute(
          sql`INSERT INTO public.stock_movements (
            item_id, disbursement_item_id, delta, balance_after, movement_type, created_by
          ) VALUES (
            ${item.id}, ${line.id}, ${line.issued_qty}, ${item.quantity + line.issued_qty}, 'reversal', ${user.id}
          )`
        )
      } else if (['asset_handover', 'asset_borrow'].includes(doc.transaction_type)) {
        // Safety: verify custody has not changed away from recipient
        if (item.responsible_person !== doc.recipient_name) {
          throw new Error(`ไม่สามารถคืนสภาพครุภัณฑ์ ${line.item_id} ได้ เนื่องจากผู้รับผิดชอบปัจจุบัน (${item.responsible_person || 'ไม่มี'}) เปลี่ยนแปลงไปจากผู้รับในเอกสาร`)
        }

        // Fetch preceding custody
        const origCustody = await tx.execute<Pick<AssetCustodyLogRow, 'from_responsible'>>(
          sql`SELECT from_responsible FROM public.asset_custody_logs
              WHERE disbursement_item_id = ${line.id} AND action IN ('borrow', 'handover')
              ORDER BY created_at ASC LIMIT 1`
        )
        const prevPerson = origCustody.rows[0]?.from_responsible ?? null

        // Revert custody
        await tx.execute(sql`UPDATE public.items SET responsible_person = ${prevPerson},
          is_central = true, note = ${syncCentralNote(item.note || '', true)}, updated_at = now() WHERE id = ${item.id}`)

        // Custody log
        await tx.execute(
          sql`INSERT INTO public.asset_custody_logs (
            item_id, disbursement_item_id, action, quantity, from_responsible, to_responsible, note, created_by
          ) VALUES (
            ${item.id}, ${line.id}, 'reversal', ${line.issued_qty}, ${item.responsible_person}, ${prevPerson}, ${data.reason}, ${user.id}
          )`
        )
      }

      await tx.execute(
        sql`UPDATE public.disbursement_items SET status = 'reversed' WHERE id = ${line.id}`
      )
    }

    // 4. Update document status
    await tx.execute(
      sql`UPDATE public.disbursements
          SET status = 'reversed', reversal_reason = ${data.reason}, reversed_at = now(), reversed_by = ${user.id}, updated_at = now()
          WHERE id = ${doc.id}`
    )

    // 5. In-transaction audit log
    await tx.execute(
      sql`INSERT INTO public.audit_logs (user_id, action, target_table, target_id, old_data, new_data)
          VALUES (
            ${user.id}, 'REVERSE_DISBURSEMENT', 'disbursements', ${doc.id},
            ${JSON.stringify({ status: doc.status })}::jsonb,
            ${JSON.stringify({ status: 'reversed', reason: data.reason })}::jsonb
          )`
    )

    return { ok: true }
  })
}

export async function submitPostgresBorrowRequest(rawInput: unknown) {
  const input = submitBorrowRequestSchema.parse(rawInput)
  const profile = await getCurrentProfile()
  if (!profile?.is_active) {
    throw new Error('กรุณาเข้าสู่ระบบก่อนทำรายการ')
  }

  if (!input.item_ids || !Array.isArray(input.item_ids) || input.item_ids.length === 0) {
    throw new Error('กรุณาเลือกรายการพัสดุที่ต้องการยืมอย่างน้อย 1 รายการ')
  }
  if (input.item_ids.length > 20) {
    throw new Error('สามารถยืมได้สูงสุดครั้งละไม่เกิน 20 รายการ')
  }
  if (input.request_type === 'borrow' && !input.due_date) {
    throw new Error('กรุณาระบุกำหนดวันส่งคืนพัสดุ')
  }
  if (!input.purpose || !input.purpose.trim()) {
    throw new Error('กรุณาระบุวัตถุประสงค์การใช้งาน')
  }

  return withUserDatabase(async (tx) => {
    await lockDisbursementItems(tx, input.item_ids)
    // 1. Verify items are central pool items and active
    const itemTypes = new Set<string>()
    for (const itemId of [...input.item_ids].sort()) {
      const itemRes = await tx.execute<{ id: string; item_name: string; item_type: string; is_central: boolean; note: string | null; status: string; quantity: number }>(
        sql`SELECT id, item_name, item_type, is_central, note, status, quantity FROM public.items WHERE id = ${itemId} AND deleted_at IS NULL ${profile.role === 'admin' ? sql`FOR UPDATE` : sql``}`
      )
      const it = itemRes.rows[0]
      if (!it) throw new Error('ไม่พบข้อมูลพัสดุบางรายการ')
      itemTypes.add(it.item_type)
      if (input.request_type === 'borrow' && it.item_type !== 'asset') {
        throw new Error('การยืมรองรับเฉพาะครุภัณฑ์ กรุณาใช้แท็บเบิกสำหรับวัสดุ')
      }
      if (!it.is_central && (!it.note || !it.note.includes('ส่วนกลาง'))) {
        throw new Error(`รายการ "${it.item_name}" ไม่ใช่ของส่วนกลาง`)
      }
      if (it.status !== 'active' && it.status !== 'spare') {
        throw new Error(`รายการ "${it.item_name}" ไม่อยู่ในสถานะพร้อมใช้งาน`)
      }

      // The inventory lock serializes concurrent requests before checking reservations.
      if (Number(it.quantity) < 1) throw new Error(`รายการ "${it.item_name}" ไม่มีจำนวนพร้อมใช้งาน`)

      await assertItemUnreserved(tx, itemId)
    }

    if (itemTypes.size > 1) {
      throw new Error('กรุณาแยกคำขอเบิกวัสดุและครุภัณฑ์คนละเอกสาร')
    }
    const transactionType = input.request_type === 'borrow'
      ? 'asset_borrow'
      : itemTypes.has('material') ? 'material_issue' : 'asset_handover'
    const recipientName = profile.full_name || 'ผู้ใช้งาน'
    const departmentName = profile.department || 'สำนักงานเขตสุขภาพที่ 7'

    // 2. Insert disbursement header
    const docRes = await tx.execute<{ id: string }>(
      sql`INSERT INTO public.disbursements (
        transaction_type, recipient_name, department_name, purpose, status, due_date, created_by
      ) VALUES (
        ${transactionType},
        ${recipientName},
        ${departmentName},
        ${input.purpose.trim()},
        'pending_approval',
        ${input.due_date},
        ${profile.id}
      ) RETURNING id`
    )
    const docId = docRes.rows[0].id

    // 3. Insert line items
    for (const itemId of [...input.item_ids].sort()) {
      await tx.execute(
        sql`INSERT INTO public.disbursement_items (
          disbursement_id, item_id, requested_qty, status
        ) VALUES (
          ${docId}, ${itemId}, 1, 'pending'
        )`
      )
    }

    // 4. Audit log
    await tx.execute(
      sql`INSERT INTO public.audit_logs (user_id, action, target_table, target_id, old_data, new_data)
          VALUES (
            ${profile.id}, ${input.request_type === 'borrow' ? 'REQUEST_BORROW' : 'REQUEST_ISSUE'}, 'disbursements', ${docId},
            null,
            ${JSON.stringify({
              items_count: input.item_ids.length,
              request_type: input.request_type,
              due_date: input.due_date,
              purpose: input.purpose.trim(),
            })}::jsonb
          )`
    )

    return { id: docId }
  })
}

export async function rejectPostgresDisbursement(disbursementId: string, reason?: string) {
  const user = await requireDisbursementAdmin()
  const data = rejectDisbursementSchema.parse({ disbursement_id: disbursementId, reason })
  reason = data.reason
  return withUserDatabase(async (tx) => {
    const docRes = await tx.execute<DisbursementRow>(
      sql`SELECT * FROM public.disbursements WHERE id = ${disbursementId} FOR UPDATE`
    )
    const doc = docRes.rows[0]
    if (!doc) throw new Error('ไม่พบเอกสาร')
    if (doc.status !== 'pending_approval') {
      throw new Error(`สามารถปฏิเสธได้เฉพาะคำขอในสถานะรออนุมัติเท่านั้น (สถานะปัจจุบัน: ${doc.status})`)
    }

    await tx.execute(
      sql`UPDATE public.disbursements
          SET status = 'rejected',
              reversal_reason = ${reason || 'ไม่อนุมัติคำขอ'},
              updated_at = now()
          WHERE id = ${disbursementId}`
    )

    await tx.execute(
      sql`INSERT INTO public.audit_logs (user_id, action, target_table, target_id, old_data, new_data)
          VALUES (
            ${user.id}, 'REJECT_BORROW_REQUEST', 'disbursements', ${disbursementId},
            ${JSON.stringify({ status: doc.status })}::jsonb,
            ${JSON.stringify({ status: 'rejected', reason: reason || 'ไม่อนุมัติคำขอ' })}::jsonb
          )`
    )

    return { ok: true }
  })
}
