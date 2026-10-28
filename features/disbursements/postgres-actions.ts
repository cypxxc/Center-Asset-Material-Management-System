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
} from './schema'
import type {
  DisbursementRow,
  DisbursementItemRow,
  AssetCustodyLogRow,
} from './types'

async function requireDisbursementWriter() {
  const profile = await getCurrentProfile()
  if (!profile?.is_active || !['admin', 'staff'].includes(profile.role)) {
    throw new Error('คุณไม่มีสิทธิ์ทำรายการเบิก-จ่ายพัสดุ')
  }
  return profile
}

import { computeThaiFiscalYear } from './fiscal-year'
export { computeThaiFiscalYear }

/**
 * Create a new draft disbursement document with line items
 */
export async function createPostgresDisbursementDraft(rawInput: unknown): Promise<{ id: string }> {
  const user = await requireDisbursementWriter()
  const data = disbursementDraftSchema.parse(rawInput)

  return withUserDatabase(async (tx) => {
    // 1. Verify item types and unique borrowing constraints
    for (const item of data.items) {
      const itemRes = await tx.execute<{ id: string; item_type: string; asset_no: string | null }>(
        sql`SELECT id, item_type, asset_no FROM public.items WHERE id = ${item.item_id} AND deleted_at IS NULL FOR SHARE`
      )
      const found = itemRes.rows[0]
      if (!found) throw new Error('ไม่พบข้อมูลพัสดุหรือพัสดุถูกลบแล้ว')

      if (data.transaction_type === 'material_issue' && found.item_type !== 'material') {
        throw new Error('เอกสารเบิกจ่ายพัสดุ รองรับเฉพาะรายการประเภทพัสดุเท่านั้น')
      }
      if (['asset_handover', 'asset_borrow'].includes(data.transaction_type) && found.item_type !== 'asset') {
        throw new Error('เอกสารส่งมอบ/ยืมครุภัณฑ์ รองรับเฉพาะรายการประเภทครุภัณฑ์เท่านั้น')
      }
      if (data.transaction_type === 'asset_borrow') {
        if (!found.asset_no || !found.asset_no.trim()) {
          throw new Error('การยืมครุภัณฑ์ต้องระบุครุภัณฑ์ที่มีเลขทะเบียนครุภัณฑ์ (Asset No.)')
        }
        if (item.requested_qty !== 1) {
          throw new Error('การยืมครุภัณฑ์ที่มีทะเบียน สามารถยืมได้ครั้งละ 1 หน่วยต่อรายการ')
        }
      }
    }

    // 2. Insert header draft
    const docRes = await tx.execute<{ id: string }>(
      sql`INSERT INTO public.disbursements (
        transaction_type, recipient_name, department_name, purpose, status, due_date, created_by
      ) VALUES (
        ${data.transaction_type}, ${data.recipient_name}, ${data.department_name}, ${data.purpose}, 'draft', ${data.due_date || null}, ${user.id}
      ) RETURNING id`
    )
    const docId = docRes.rows[0].id

    // 3. Insert lines
    for (const item of data.items) {
      await tx.execute(
        sql`INSERT INTO public.disbursement_items (
          disbursement_id, item_id, requested_qty, status
        ) VALUES (
          ${docId}, ${item.item_id}, ${item.requested_qty}, 'pending'
        )`
      )
    }

    return { id: docId }
  })
}

/**
 * Update an existing draft disbursement document with line items
 */
export async function updatePostgresDisbursementDraft(rawInput: unknown): Promise<{ id: string }> {
  const user = await requireDisbursementWriter()
  const data = updateDisbursementDraftSchema.parse(rawInput)

  return withUserDatabase(async (tx) => {
    // 1. Lock document header and assert draft status
    const docRes = await tx.execute<DisbursementRow>(
      sql`SELECT * FROM public.disbursements WHERE id = ${data.id} FOR UPDATE`
    )
    const doc = docRes.rows[0]
    if (!doc) throw new Error('ไม่พบเอกสารเบิกจ่าย')
    if (doc.status !== 'draft') throw new Error(`สามารถแก้ไขได้เฉพาะเอกสารฉบับร่างเท่านั้น (สถานะปัจจุบัน: ${doc.status})`)

    // 2. Validate items match transaction type
    for (const item of data.items) {
      const itemRes = await tx.execute<{ id: string; item_type: string; asset_no: string | null }>(
        sql`SELECT id, item_type, asset_no FROM public.items WHERE id = ${item.item_id} AND deleted_at IS NULL FOR SHARE`
      )
      const found = itemRes.rows[0]
      if (!found) throw new Error('ไม่พบข้อมูลพัสดุหรือพัสดุถูกลบแล้ว')

      if (data.transaction_type === 'material_issue' && found.item_type !== 'material') {
        throw new Error('เอกสารเบิกจ่ายพัสดุ รองรับเฉพาะรายการประเภทพัสดุเท่านั้น')
      }
      if (['asset_handover', 'asset_borrow'].includes(data.transaction_type) && found.item_type !== 'asset') {
        throw new Error('เอกสารส่งมอบ/ยืมครุภัณฑ์ รองรับเฉพาะรายการประเภทครุภัณฑ์เท่านั้น')
      }
      if (data.transaction_type === 'asset_borrow') {
        if (!found.asset_no || !found.asset_no.trim()) {
          throw new Error('การยืมครุภัณฑ์ต้องระบุครุภัณฑ์ที่มีเลขทะเบียนครุภัณฑ์ (Asset No.)')
        }
        if (item.requested_qty !== 1) {
          throw new Error('การยืมครุภัณฑ์ที่มีทะเบียน สามารถยืมได้ครั้งละ 1 หน่วยต่อรายการ')
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

    for (const item of data.items) {
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
    if (doc.status !== 'draft') throw new Error(`สามารถยกเลิกได้เฉพาะเอกสารฉบับร่างเท่านั้น (สถานะปัจจุบัน: ${doc.status})`)

    await tx.execute(
      sql`UPDATE public.disbursements SET status = 'cancelled', updated_at = now() WHERE id = ${data.id}`
    )

    // In-transaction audit
    await tx.execute(
      sql`INSERT INTO public.audit_logs (user_id, action, target_table, target_id, old_data, new_data)
          VALUES (
            ${user.id}, 'CANCEL_DISBURSEMENT_DRAFT', 'disbursements', ${data.id},
            ${JSON.stringify({ status: 'draft' })}::jsonb,
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
  const user = await requireDisbursementWriter()
  z.string().uuid().parse(disbursementId)

  return withUserDatabase(async (tx) => {
    // 1. Lock document header
    const docRes = await tx.execute<DisbursementRow>(
      sql`SELECT * FROM public.disbursements WHERE id = ${disbursementId} FOR UPDATE`
    )
    const doc = docRes.rows[0]
    if (!doc) throw new Error('ไม่พบเอกสารเบิกจ่าย')
    if (doc.status !== 'draft') throw new Error(`ไม่สามารถยืนยันเอกสารในสถานะ ${doc.status} ได้`)

    // 2. Lock and fetch lines with current item metadata (deterministic order by item_id to prevent lock cycle)
    const linesRes = await tx.execute<DisbursementItemRow & {
      current_qty: number
      item_name: string
      asset_no: string | null
      serial_no: string | null
      brand: string | null
      model: string | null
      responsible_person: string | null
      unit_name: string | null
      unit_price: number | null
      category_name: string | null
      location_name: string | null
    }>(
      sql`SELECT di.*, i.quantity as current_qty, i.item_name, i.asset_no, i.serial_no, i.brand, i.model, i.responsible_person,
                 coalesce(u.name, '-') as unit_name, coalesce(i.unit_price, 0) as unit_price,
                 c.name as category_name, l.name as location_name
          FROM public.disbursement_items di
          JOIN public.items i ON i.id = di.item_id
          LEFT JOIN public.categories c ON c.id = i.category_id
          LEFT JOIN public.units u ON u.id = i.unit_id
          LEFT JOIN public.locations l ON l.id = i.location_id
          WHERE di.disbursement_id = ${disbursementId}
          ORDER BY di.item_id ASC
          FOR UPDATE OF di`
    )
    const lines = linesRes.rows
    if (lines.length === 0) throw new Error('ไม่สามารถยืนยันเอกสารที่ไม่มีรายการสิ่งของได้')

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
      const itemLock = await tx.execute<{ id: string; quantity: number; responsible_person: string | null }>(
        sql`SELECT id, quantity, responsible_person FROM public.items WHERE id = ${line.item_id} AND deleted_at IS NULL FOR UPDATE`
      )
      const currentItem = itemLock.rows[0]
      if (!currentItem) throw new Error(`พัสดุ ${line.item_name} ถูกลบหรือไม่พร้อมใช้งาน`)

      if (doc.transaction_type === 'material_issue') {
        if (currentItem.quantity < line.requested_qty) {
          throw new Error(`ยอดคงเหลือไม่เพียงพอสำหรับ ${line.item_name} (ต้องการ: ${line.requested_qty}, คงเหลือ: ${currentItem.quantity})`)
        }

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
        await tx.execute(
          sql`UPDATE public.items SET responsible_person = ${doc.recipient_name}, updated_at = now() WHERE id = ${line.item_id}`
        )
      }

      // Snapshot line data
      await tx.execute(
        sql`UPDATE public.disbursement_items
            SET issued_qty = ${line.requested_qty},
                item_name_snapshot = ${line.item_name},
                asset_no_snapshot = ${line.asset_no},
                serial_no_snapshot = ${line.serial_no},
                brand_snapshot = ${line.brand},
                model_snapshot = ${line.model},
                unit_name_snapshot = ${line.unit_name},
                unit_price_snapshot = ${line.unit_price},
                category_name_snapshot = ${line.category_name},
                location_name_snapshot = ${line.location_name},
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
            ${JSON.stringify({ status: 'draft' })}::jsonb,
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
  const user = await requireDisbursementWriter()
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

    // 3. Lock target line item SECOND (under acquired parent lock)
    const lineRes = await tx.execute<DisbursementItemRow>(
      sql`SELECT * FROM public.disbursement_items WHERE id = ${data.line_id} FOR UPDATE`
    )
    const line = lineRes.rows[0]
    if (!line) throw new Error('ไม่พบรายการพัสดุในเอกสาร')

    const newReturned = line.returned_qty + data.return_qty
    if (newReturned > line.issued_qty) {
      throw new Error(`ไม่สามารถรับคืนเกินจำนวนที่ยืมได้ (จ่ายไป: ${line.issued_qty}, คืนแล้ว: ${line.returned_qty}, จะคืน: ${data.return_qty})`)
    }

    // 4. Lock asset item THIRD
    const itemRes = await tx.execute<{ id: string; responsible_person: string | null }>(
      sql`SELECT id, responsible_person FROM public.items WHERE id = ${line.item_id} AND deleted_at IS NULL FOR UPDATE`
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

    // 5. Revert responsible_person to central pool (NULL)
    await tx.execute(
      sql`UPDATE public.items SET responsible_person = NULL, updated_at = now() WHERE id = ${item.id}`
    )

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

/**
 * Reverse a confirmed disbursement
 */
export async function reversePostgresDisbursement(rawInput: unknown): Promise<{ ok: boolean }> {
  const user = await requireDisbursementWriter()
  const data = reverseDisbursementSchema.parse(rawInput)

  return withUserDatabase(async (tx) => {
    // 1. Lock document
    const docRes = await tx.execute<DisbursementRow>(
      sql`SELECT * FROM public.disbursements WHERE id = ${data.disbursement_id} FOR UPDATE`
    )
    const doc = docRes.rows[0]
    if (!doc) throw new Error('ไม่พบเอกสารเบิกจ่าย')
    if (!['confirmed', 'active_borrow'].includes(doc.status)) {
      throw new Error(`ไม่สามารถคืนสภาพเอกสารในสถานะ ${doc.status} ได้`)
    }

    // 2. Reversal guard: cannot reverse if any return has taken place
    const returnedCheck = await tx.execute<{ count: number }>(
      sql`SELECT count(*)::int as count FROM public.disbursement_items WHERE disbursement_id = ${doc.id} AND returned_qty > 0`
    )
    if (returnedCheck.rows[0].count > 0) {
      throw new Error('ไม่สามารถคืนสภาพเอกสารได้เนื่องจากมีการบันทึกคืนพัสดุบางส่วนไปแล้ว กรุณาใช้การรับคืนจนครบแทน')
    }

    // 3. Process lines (deterministic order by item_id ASC to match global lock hierarchy)
    const linesRes = await tx.execute<DisbursementItemRow>(
      sql`SELECT * FROM public.disbursement_items WHERE disbursement_id = ${doc.id} ORDER BY item_id ASC FOR UPDATE`
    )

    for (const line of linesRes.rows) {
      const itemRes = await tx.execute<{ id: string; quantity: number; responsible_person: string | null }>(
        sql`SELECT id, quantity, responsible_person FROM public.items WHERE id = ${line.item_id} AND deleted_at IS NULL FOR UPDATE`
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
        await tx.execute(
          sql`UPDATE public.items SET responsible_person = ${prevPerson}, updated_at = now() WHERE id = ${item.id}`
        )

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
