import 'server-only'
import { randomUUID } from 'node:crypto'
import { requestFingerprint } from './request-batch'
import { approvalBorrowDueDate, borrowDueDateError } from './borrow-dates'
import { inventoryTableForId } from '@/features/items/inventory-table'
import { sql } from 'drizzle-orm'
import type { PostgresTransaction } from '@/lib/postgres/db'
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
  partialApproveDisbursementSchema,
  partialRejectDisbursementSchema,
  partialReturnDisbursementSchema,
} from './schema'
import { findOriginLocation } from './custody-postgres'
import type {
  DisbursementRow,
  DisbursementItemRow,
  AssetCustodyLogRow,
} from './types'
import { computeThaiFiscalYear } from './fiscal-year'
import { assertCentralDisbursementItem } from './central-items'
import { syncCentralNote } from '@/features/items/central-note'
import { assertItemUnreserved, assertMaterialAvailable, lockDisbursementItems } from './reservations'

async function restoreBorrowedMaterial(tx: PostgresTransaction, itemId: string, lineId: string, quantity: number, userId: string) {
  if (quantity === 0) return
  const result = await tx.execute<{ quantity: number }>(sql`UPDATE public.materials SET quantity=quantity+${quantity}, updated_at=now() WHERE id=${itemId} RETURNING quantity`)
  if (!result.rows[0]) throw new Error('ไม่พบวัสดุสำหรับรับคืน')
  await tx.execute(sql`INSERT INTO public.stock_movements(item_id,disbursement_item_id,delta,balance_after,movement_type,created_by)
    VALUES(${itemId},${lineId},${quantity},${result.rows[0].quantity},'material_return',${userId})`)
}

async function approvalDocumentNumber(tx: PostgresTransaction, doc: DisbursementRow) {
  if (doc.document_no && doc.fiscal_year !== null) {
    return { docNo: doc.document_no, fiscalYear: doc.fiscal_year }
  }
  const fiscalYear = computeThaiFiscalYear()
  const sequence = await tx.execute<{ current_val: number }>(sql`
    INSERT INTO public.disbursement_sequences (fiscal_year, prefix, current_val)
    VALUES (${fiscalYear}, 'DIS', 1)
    ON CONFLICT (fiscal_year, prefix)
    DO UPDATE SET current_val = public.disbursement_sequences.current_val + 1
    RETURNING current_val
  `)
  return { docNo: `DIS-${fiscalYear}-${String(sequence.rows[0].current_val).padStart(4, '0')}`, fiscalYear }
}

async function requireDisbursementWriter() {
  const profile = await getCurrentProfile()
  if (!profile?.is_active || !['admin', 'user'].includes(profile.role)) {
    throw new Error('คุณไม่มีสิทธิ์ทำรายการเบิก-จ่ายวัสดุ')
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
export async function createPostgresDisbursementDraft(rawInput: unknown, transaction?: PostgresTransaction): Promise<{ id: string }> {
  const user = await requireDisbursementWriter()
  const data = disbursementDraftSchema.parse(rawInput)
  if (user.role !== 'admin' && data.transaction_type !== 'material_issue') throw new Error('User สร้างได้เฉพาะเอกสารเบิกวัสดุ')

  const execute = transaction ? async <T>(callback: (tx: PostgresTransaction) => Promise<T>) => callback(transaction) : withUserDatabase
  return execute(async (tx) => {
    await lockDisbursementItems(tx, data.items.map((item) => item.item_id))
    // 1. Verify item types and unique borrowing constraints
    for (const item of [...data.items].sort((a, b) => a.item_id.localeCompare(b.item_id))) {
      const itemRes = await tx.execute<{ id: string; item_name: string; unit_name: string | null; item_type: string; asset_no: string | null; note: string | null; is_central: boolean; quantity: number; status: string | null }>(
        sql`SELECT id, item_name, (SELECT name FROM public.units u WHERE u.id=unit_id) AS unit_name, item_type, asset_no, note, is_central, quantity, status FROM ${await inventoryTableForId(tx, item.item_id)} WHERE id = ${item.item_id} AND deleted_at IS NULL ${user.role === 'admin' ? sql`FOR UPDATE` : sql``}`
      )
      const found = itemRes.rows[0]
      if (!found) throw new Error('ไม่พบข้อมูลวัสดุหรือวัสดุถูกลบแล้ว')
      if (data.transaction_type !== 'material_issue') assertCentralDisbursementItem(found)
      if (found.status && !['active', 'spare'].includes(found.status)) throw new Error('รายการนี้ไม่อยู่ในสถานะพร้อมใช้งาน')
      if (data.transaction_type !== 'material_issue' && Number(found.quantity) < item.requested_qty) throw new Error('จำนวนพร้อมใช้งานไม่เพียงพอ')

      if (data.transaction_type === 'material_issue' && found.item_type !== 'material') {
        throw new Error('เอกสารเบิกจ่ายวัสดุ รองรับเฉพาะรายการประเภทวัสดุเท่านั้น')
      }
      if (data.transaction_type === 'asset_handover' && found.item_type !== 'asset') {
        throw new Error('เอกสารส่งมอบครุภัณฑ์ รองรับเฉพาะรายการประเภทครุภัณฑ์เท่านั้น')
      }
      if (data.transaction_type === 'material_issue') {
        if (user.role !== 'admin') await assertMaterialAvailable(tx, found, item.requested_qty)
      } else if (found.item_type === 'asset') await assertItemUnreserved(tx, item.item_id)
      if (data.transaction_type === 'asset_borrow') {
        if (found.item_type === 'asset' && item.requested_qty !== 1) {
          throw new Error('การยืมของส่วนกลาง สามารถยืมได้ครั้งละ 1 หน่วยต่อรายการ')
        }
        if (found.item_type !== 'material' && !found.is_central && (!found.note || !found.note.includes('ส่วนกลาง'))) {
          throw new Error('การยืมอนุญาตเฉพาะรายการที่เป็น "ของส่วนกลาง" เท่านั้น')
        }
      }
    }

    // 2. Insert header draft
    const docRes = await tx.execute<{ id: string }>(
      sql`INSERT INTO public.disbursements (
        transaction_type, recipient_name, department_name, purpose, status, due_date, created_by, submitted_at
      ) VALUES (
        ${data.transaction_type}, ${data.recipient_name}, ${data.department_name}, ${data.purpose}, ${user.role === 'user' ? 'pending_approval' : 'draft'}, ${data.due_date || null}, ${user.id}, ${user.role === 'user' ? sql`now()` : sql`null`}
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
  if (user.role !== 'admin' && data.transaction_type !== 'material_issue') throw new Error('User แก้ไขได้เฉพาะเอกสารเบิกวัสดุ')

  return withUserDatabase(async (tx) => {
    // 1. Lock document header and assert draft status
    const docRes = await tx.execute<DisbursementRow>(
      sql`SELECT * FROM public.disbursements WHERE id = ${data.id} FOR UPDATE`
    )
    const doc = docRes.rows[0]
    if (!doc) throw new Error('ไม่พบเอกสารเบิกจ่าย')
    if (doc.status !== 'draft') throw new Error(`สามารถแก้ไขได้เฉพาะเอกสารฉบับร่างเท่านั้น (สถานะปัจจุบัน: ${doc.status})`)
    if (data.transaction_type === 'asset_borrow') {
      const dateError = borrowDueDateError(data.due_date, doc.created_at)
      if (dateError) throw new Error(dateError)
    }
    await lockDisbursementItems(tx, data.items.map((item) => item.item_id))

    // 2. Validate items match transaction type
    for (const item of [...data.items].sort((a, b) => a.item_id.localeCompare(b.item_id))) {
      const itemRes = await tx.execute<{ id: string; item_name: string; unit_name: string | null; item_type: string; asset_no: string | null; note: string | null; is_central: boolean; quantity: number; status: string | null }>(
        sql`SELECT id, item_name, (SELECT name FROM public.units u WHERE u.id=unit_id) AS unit_name, item_type, asset_no, note, is_central, quantity, status FROM ${await inventoryTableForId(tx, item.item_id)} WHERE id = ${item.item_id} AND deleted_at IS NULL FOR UPDATE`
      )
      const found = itemRes.rows[0]
      if (!found) throw new Error('ไม่พบข้อมูลวัสดุหรือวัสดุถูกลบแล้ว')
      if (data.transaction_type !== 'material_issue') assertCentralDisbursementItem(found)
      if (found.status && !['active', 'spare'].includes(found.status)) throw new Error('รายการนี้ไม่อยู่ในสถานะพร้อมใช้งาน')
      if (data.transaction_type !== 'material_issue' && Number(found.quantity) < item.requested_qty) throw new Error('จำนวนพร้อมใช้งานไม่เพียงพอ')

      if (data.transaction_type === 'material_issue' && found.item_type !== 'material') {
        throw new Error('เอกสารเบิกจ่ายวัสดุ รองรับเฉพาะรายการประเภทวัสดุเท่านั้น')
      }
      if (data.transaction_type === 'asset_handover' && found.item_type !== 'asset') {
        throw new Error('เอกสารส่งมอบครุภัณฑ์ รองรับเฉพาะรายการประเภทครุภัณฑ์เท่านั้น')
      }
      if (found.item_type !== 'material') await assertItemUnreserved(tx, item.item_id)
      if (data.transaction_type === 'asset_borrow') {
        if (found.item_type === 'asset' && item.requested_qty !== 1) {
          throw new Error('การยืมของส่วนกลาง สามารถยืมได้ครั้งละ 1 หน่วยต่อรายการ')
        }
        if (found.item_type !== 'material' && !found.is_central && (!found.note || !found.note.includes('ส่วนกลาง'))) {
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

    // Prevent cancellation if any line item was already issued via partial approval
    const issuedLinesRes = await tx.execute<{ count: number }>(
      sql`SELECT count(*)::int as count FROM public.disbursement_items 
          WHERE disbursement_id = ${data.id} AND (status = 'issued' OR issued_qty > 0)`
    )
    if (Number(issuedLinesRes.rows[0]?.count ?? 0) > 0) {
      throw new Error('ไม่สามารถยกเลิกเอกสารนี้ได้เนื่องจากมีบางรายการได้รับการอนุมัติจ่ายไปแล้ว กรุณาปฏิเสธเฉพาะรายการที่เหลือแทน')
    }

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
export async function confirmPostgresDisbursement(disbursementId: string, replacementDueDate?: string, transaction?: PostgresTransaction): Promise<{ document_no: string }> {
  const user = await requireDisbursementAdmin()
  z.string().uuid().parse(disbursementId)

  const execute = transaction ? async <T>(callback: (tx: PostgresTransaction) => Promise<T>) => callback(transaction) : withUserDatabase
  return execute(async (tx) => {
    // 1. Lock document header
    const docRes = await tx.execute<DisbursementRow>(
      sql`SELECT * FROM public.disbursements WHERE id = ${disbursementId} FOR UPDATE`
    )
    const doc = docRes.rows[0]
    if (!doc) throw new Error('ไม่พบเอกสารเบิกจ่าย')
    if (!['draft', 'pending_approval'].includes(doc.status)) {
      throw new Error(`ไม่สามารถยืนยันหรืออนุมัติเอกสารในสถานะ ${doc.status} ได้`)
    }
    const approvedDueDate = doc.transaction_type === 'asset_borrow'
      ? approvalBorrowDueDate(doc.due_date, replacementDueDate, doc.created_at)
      : doc.due_date

    // 2. Lock and fetch lines with current item metadata (deterministic order by item_id to prevent lock cycle)
    const linesRes = await tx.execute<DisbursementItemRow>(
      sql`SELECT * FROM public.disbursement_items
          WHERE disbursement_id = ${disbursementId} ORDER BY item_id ASC FOR UPDATE`
    )
    const lines = linesRes.rows
    if (lines.length === 0) throw new Error('ไม่สามารถยืนยันเอกสารที่ไม่มีรายการสิ่งของได้')
    const pendingLines = lines.filter((line) => line.status === 'pending')
    const hasIssuedLines = lines.some((line) => line.status === 'issued')
    if (pendingLines.length === 0 && !hasIssuedLines) {
      throw new Error('ไม่มีรายการที่รออนุมัติในเอกสารนี้')
    }
    await lockDisbursementItems(tx, pendingLines.map((line) => line.item_id))

    // 4. Process each pending line with row locking on public.items
    for (const line of pendingLines) {
      const stockLedger = await tx.execute<{ net: number }>(sql`select coalesce(sum(delta),0)::int as net from public.stock_movements where disbursement_item_id=${line.id} and movement_type in ('issue','reversal')`)
      const materialNet = Number(stockLedger?.rows[0]?.net ?? 0)
      if (materialNet !== 0 && materialNet !== -line.requested_qty) throw new Error('ยอดตัดสต็อกคำขอไม่ตรงกับจำนวนที่ขอเบิก กรุณาตรวจสอบรายการ')
      const materialAlreadyDebited = materialNet < 0
      // Row lock on inventory item
      const itemLock = await tx.execute<{
        id: string; quantity: number; item_type: string; item_name: string;
        asset_no: string | null; serial_no: string | null; brand: string | null; model: string | null;
        responsible_person: string | null; is_central: boolean; note: string | null; status: string | null;
        unit_name: string | null; unit_price: number | null; category_name: string | null; location_name: string | null;
      }>(sql`SELECT i.*, u.name AS unit_name, c.name AS category_name, l.name AS location_name
        FROM ${await inventoryTableForId(tx, line.item_id)} i
        LEFT JOIN public.units u ON u.id = i.unit_id
        LEFT JOIN public.categories c ON c.id = i.category_id
        LEFT JOIN public.locations l ON l.id = i.location_id
        WHERE i.id = ${line.item_id} AND i.deleted_at IS NULL FOR UPDATE OF i`)
      const currentItem = itemLock.rows[0]
      if (!currentItem) throw new Error(`วัสดุ ${line.item_id} ถูกลบหรือไม่พร้อมใช้งาน`)
      if (doc.transaction_type !== 'material_issue') assertCentralDisbursementItem(currentItem)
      if (currentItem.status && !['active', 'spare'].includes(currentItem.status)) throw new Error('รายการนี้ไม่อยู่ในสถานะพร้อมใช้งาน')
      if (!materialAlreadyDebited && currentItem.quantity < line.requested_qty) throw new Error('จำนวนคงเหลือไม่เพียงพอสำหรับการอนุมัติ')
      if (doc.transaction_type === 'material_issue' ? currentItem.item_type !== 'material' : doc.transaction_type === 'asset_handover' && currentItem.item_type !== 'asset') {
        throw new Error('ประเภทสิ่งของเปลี่ยนแปลง ไม่ตรงกับคำขอ')
      }

      if (currentItem.item_type === 'material') {
        if (!materialAlreadyDebited) await assertMaterialAvailable(tx, currentItem, line.requested_qty)
      } else await assertItemUnreserved(tx, line.item_id, disbursementId)

      if (currentItem.item_type === 'material' && !materialAlreadyDebited) {
        // Deduct inventory
        const deducted = await tx.execute(
          sql`UPDATE public.materials SET quantity = quantity - ${line.requested_qty}, updated_at = now() WHERE id = ${line.item_id} AND quantity >= ${line.requested_qty} RETURNING id`
        )
        if (deducted.rows.length !== 1) throw new Error('จำนวนคงเหลือไม่เพียงพอสำหรับการอนุมัติ')

        // Ledger entry
        await tx.execute(
          sql`INSERT INTO public.stock_movements (
            item_id, disbursement_item_id, delta, balance_after, movement_type, created_by
          ) VALUES (
            ${line.item_id}, ${line.id}, ${-line.requested_qty}, ${currentItem.quantity - line.requested_qty}, 'issue', ${user.id}
          )`
        )
      } else if (currentItem.item_type === 'asset' && ['asset_handover', 'asset_borrow'].includes(doc.transaction_type)) {
        await tx.execute(sql`SELECT private.apply_asset_custody_event(
          ${line.item_id}, ${line.id}, ${doc.transaction_type === 'asset_borrow' ? 'borrow' : 'handover'},
          ${line.requested_qty}, 'normal', NULL, ${syncCentralNote(currentItem.note || '', false) || null}
        )`)
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

    const { docNo, fiscalYear } = await approvalDocumentNumber(tx, doc)
    const targetStatus = doc.transaction_type === 'asset_borrow' ? 'active_borrow' : 'confirmed'

    // 5. Update header
    await tx.execute(
      sql`UPDATE public.disbursements
          SET document_no = ${docNo},
              fiscal_year = ${fiscalYear},
              status = ${targetStatus},
              confirmed_at = now(),
              confirmed_by = ${user.id},
              due_date = ${approvedDueDate},
              updated_at = now()
          WHERE id = ${disbursementId}`
    )

    // 6. In-transaction audit log
    await tx.execute(
      sql`INSERT INTO public.audit_logs (user_id, action, target_table, target_id, old_data, new_data)
          VALUES (
            ${user.id}, 'CONFIRM_DISBURSEMENT', 'disbursements', ${disbursementId},
            ${JSON.stringify({ status: doc.status, due_date: doc.due_date })}::jsonb,
            ${JSON.stringify({ status: targetStatus, document_no: docNo, due_date: approvedDueDate })}::jsonb
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
    if (!ref) throw new Error('ไม่พบรายการวัสดุในเอกสาร')

    // 2. Lock parent document FIRST (Standard lock hierarchy: Header -> Lines -> Items)
    const docRes = await tx.execute<DisbursementRow>(
      sql`SELECT * FROM public.disbursements WHERE id = ${ref.disbursement_id} FOR UPDATE`
    )
    const doc = docRes.rows[0]
    if (!doc) throw new Error('ไม่พบเอกสารเบิกจ่าย')
    if (doc.transaction_type !== 'asset_borrow') throw new Error('สามารถบันทึกรับคืนได้เฉพาะรายการยืมสิ่งของเท่านั้น')
    if (!['active_borrow', 'partially_returned'].includes(doc.status)) {
      throw new Error(`ไม่สามารถบันทึกรับคืนเอกสารในสถานะ ${doc.status} ได้`)
    }

    // 3. Lock target line item SECOND (under acquired parent lock)
    const lineRes = await tx.execute<DisbursementItemRow>(
      sql`SELECT * FROM public.disbursement_items WHERE id = ${data.line_id} FOR UPDATE`
    )
    const line = lineRes.rows[0]
    if (!line) throw new Error('ไม่พบรายการวัสดุในเอกสาร')
    if (!['issued', 'partially_returned'].includes(line.status)) throw new Error('รายการนี้ไม่ได้อยู่ระหว่างการยืมหรือรับคืนครบแล้ว')

    const newReturned = line.returned_qty + data.return_qty
    if (newReturned > line.issued_qty) {
      throw new Error(`ไม่สามารถรับคืนเกินจำนวนที่ยืมได้ (จ่ายไป: ${line.issued_qty}, คืนแล้ว: ${line.returned_qty}, จะคืน: ${data.return_qty})`)
    }

    // 4. Lock asset item THIRD
    await lockDisbursementItems(tx, [line.item_id])
    const itemRes = await tx.execute<{ id: string; item_type: string; quantity: number; responsible_person: string | null; status: string | null; note: string | null }>(
      sql`SELECT id, item_type, quantity, responsible_person, status, note FROM ${await inventoryTableForId(tx, line.item_id)} WHERE id = ${line.item_id} AND deleted_at IS NULL FOR UPDATE`
    )
    const item = itemRes.rows[0]
    if (!item) throw new Error('ไม่พบครุภัณฑ์หรือครุภัณฑ์ถูกลบแล้ว')

    if (item.item_type === 'material') {
      await restoreBorrowedMaterial(tx, item.id, line.id, data.condition === 'normal' ? data.return_qty : 0, user.id)
    } else {
      if (data.condition === 'lost' && item.quantity > 1) {
        throw new Error('ไม่สามารถบันทึกสูญหายสำหรับครุภัณฑ์ที่มีจำนวนมากกว่า 1 หน่วยได้ เนื่องจากระบบไม่รองรับการแยกสถานะรายหน่วย กรุณาติดต่อผู้ดูแลระบบ')
      }

      // Return to the central pool only after an admin receives the full quantity.
      const isFullReturn = newReturned === line.issued_qty
      const restoresToPool = isFullReturn && data.condition !== 'lost'
      const centralNote = syncCentralNote(item.note || '', restoresToPool) || null
      const itemNote = data.condition === 'lost'
        ? (centralNote ? `${centralNote} [บันทึกสูญหายจากการยืม]` : 'บันทึกสูญหายจากการยืม')
        : centralNote
      await tx.execute(sql`SELECT private.apply_asset_custody_event(
        ${item.id}, ${line.id}, 'return', ${data.return_qty}, ${data.condition}, ${data.note || null}, ${itemNote}
      )`)
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
      sql`SELECT count(*)::int as count FROM public.disbursement_items WHERE disbursement_id = ${doc.id} AND status NOT IN ('returned', 'reversed')`
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

/** Return every outstanding item in a borrowed-asset document as normal. */
export async function returnPostgresDisbursement(disbursementIdInput: unknown): Promise<{ ok: boolean }> {
  const user = await requireDisbursementAdmin()
  const { disbursement_id: disbursementId } = z.object({ disbursement_id: z.string().uuid() }).parse({ disbursement_id: disbursementIdInput })

  return withUserDatabase(async (tx) => {
    const docRes = await tx.execute<DisbursementRow>(
      sql`SELECT * FROM public.disbursements WHERE id = ${disbursementId} FOR UPDATE`
    )
    const doc = docRes.rows[0]
    if (!doc) throw new Error('ไม่พบเอกสารเบิกจ่าย')
    if (doc.transaction_type !== 'asset_borrow') throw new Error('สามารถคืนได้เฉพาะเอกสารยืมสิ่งของ')
    if (!['active_borrow', 'partially_returned'].includes(doc.status)) throw new Error('เอกสารนี้ไม่ได้อยู่ระหว่างการยืม')


    const linesRes = await tx.execute<DisbursementItemRow>(
      sql`SELECT * FROM public.disbursement_items WHERE disbursement_id = ${doc.id} ORDER BY item_id ASC FOR UPDATE`
    )
    const outstandingLines = linesRes.rows.filter(line =>
      ['issued', 'partially_returned'].includes(line.status) && line.issued_qty > line.returned_qty
    )
    if (outstandingLines.length === 0) throw new Error('ไม่มีรายการค้างคืนในเอกสารนี้')

    await lockDisbursementItems(tx, outstandingLines.map(line => line.item_id))
    for (const line of outstandingLines) {
      const itemRes = await tx.execute<{ id: string; item_type: string; note: string | null }>(
        sql`SELECT id, item_type, note FROM ${await inventoryTableForId(tx, line.item_id)} WHERE id = ${line.item_id} AND deleted_at IS NULL FOR UPDATE`
      )
      const item = itemRes.rows[0]
      if (!item) throw new Error('ไม่พบครุภัณฑ์หรือครุภัณฑ์ถูกลบแล้ว')

      const returnedQty = line.issued_qty - line.returned_qty
      if (item.item_type === 'material') {
        await restoreBorrowedMaterial(tx, item.id, line.id, returnedQty, user.id)
      } else {
        const centralNote = syncCentralNote(item.note || '', true) || null
        await tx.execute(sql`SELECT private.apply_asset_custody_event(
          ${item.id}, ${line.id}, 'return', ${returnedQty}, 'normal', NULL, ${centralNote}
        )`)
      }
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
      throw new Error('ไม่สามารถคืนสภาพเอกสารได้เนื่องจากมีการบันทึกคืนวัสดุบางส่วนไปแล้ว กรุณาใช้การรับคืนจนครบแทน')
    }

    if (!['confirmed', 'active_borrow'].includes(doc.status)) {
      throw new Error(`ไม่สามารถคืนสภาพเอกสารในสถานะ ${doc.status} ได้`)
    }

    // 3. Process lines (deterministic order by item_id ASC to match global lock hierarchy)
    const linesRes = await tx.execute<DisbursementItemRow>(
      sql`SELECT * FROM public.disbursement_items WHERE disbursement_id = ${doc.id} ORDER BY item_id ASC FOR UPDATE`
    )
    const issuedLines = linesRes.rows.filter((line) => line.status === 'issued' && line.issued_qty > 0)
    await lockDisbursementItems(tx, issuedLines.map((line) => line.item_id))

    for (const line of issuedLines) {
      const itemRes = await tx.execute<{ id: string; item_type: string; quantity: number; responsible_person: string | null; note: string | null }>(
        sql`SELECT id, item_type, quantity, responsible_person, note FROM ${await inventoryTableForId(tx, line.item_id)} WHERE id = ${line.item_id} AND deleted_at IS NULL FOR UPDATE`
      )
      const item = itemRes.rows[0]
      if (!item) throw new Error(`วัสดุ ${line.item_id} ถูกลบหรือไม่พร้อมใช้งาน`)

      if (item.item_type === 'material') {
        // Refund stock
        await tx.execute(
          sql`UPDATE public.materials SET quantity = quantity + ${line.issued_qty}, updated_at = now() WHERE id = ${item.id}`
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
        await assertItemUnreserved(tx, item.id, doc.id)
        // Safety: verify custody has not changed away from recipient
        if (item.responsible_person !== doc.recipient_name) {
          throw new Error(`ไม่สามารถคืนสภาพครุภัณฑ์ ${line.item_id} ได้ เนื่องจากผู้รับผิดชอบปัจจุบัน (${item.responsible_person || 'ไม่มี'}) เปลี่ยนแปลงไปจากผู้รับในเอกสาร`)
        }

        const origCustody = await tx.execute<Pick<AssetCustodyLogRow, 'from_responsible'>>(
          sql`SELECT c.from_responsible FROM public.asset_custody_logs c
              JOIN public.items i ON i.id = c.item_id
                AND i.latest_custody_event_id = c.id AND i.custody_revision = c.custody_revision_after
              WHERE c.item_id = ${item.id} AND c.disbursement_item_id = ${line.id} AND c.custody_origin_verified
                AND c.action = ${doc.transaction_type === 'asset_borrow' ? 'borrow' : 'handover'}`
        )
        const precedingCustody = origCustody.rows[0]
        if (!precedingCustody) throw new Error('ไม่สามารถคืนสภาพครุภัณฑ์ได้ เนื่องจากรายการส่งมอบไม่ใช่เหตุการณ์ถือครองล่าสุดหรือไม่มีประวัติ')
        const prevPerson = precedingCustody.from_responsible

        const centralNote = syncCentralNote(item.note || '', prevPerson === null)
        await tx.execute(sql`SELECT private.apply_asset_custody_event(
          ${item.id}, ${line.id}, 'reversal', ${line.issued_qty}, 'normal', ${data.reason}, ${centralNote}
        )`)
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
  const suppliedKey = (rawInput as { request_key?: unknown }).request_key
  const requestKey = suppliedKey === undefined ? randomUUID() : z.string().uuid('รหัสชุดคำขอไม่ถูกต้อง').parse(suppliedKey)
  const fingerprint = requestFingerprint(input)
  const profile = await getCurrentProfile()
  if (!profile?.is_active) {
    throw new Error('กรุณาเข้าสู่ระบบก่อนทำรายการ')
  }

  if (!input.item_ids || !Array.isArray(input.item_ids) || input.item_ids.length === 0) {
    throw new Error('กรุณาเลือกรายการวัสดุที่ต้องการยืมอย่างน้อย 1 รายการ')
  }
  if (input.item_ids.length > 20) {
    throw new Error('สามารถยืมได้สูงสุดครั้งละไม่เกิน 20 รายการ')
  }
  if (!input.purpose || !input.purpose.trim()) {
    throw new Error('กรุณาระบุวัตถุประสงค์การใช้งาน')
  }

  return withUserDatabase(async (tx) => {
    // Serialize retries before inventory checks, including requests whose stock is now zero.
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${`camms-request:${profile.id}:${requestKey}`}, 0))`)
    const prior = await tx.execute<{ id: string; payload_hash: string }>(sql`SELECT id,payload_hash FROM public.request_batches WHERE created_by=${profile.id} AND request_key=${requestKey}`)
    if (prior.rows[0]) {
      if (prior.rows[0].payload_hash !== fingerprint) throw new Error('รหัสคำขอเดิมถูกใช้กับข้อมูลอื่นแล้ว กรุณาสร้างคำขอใหม่')
      const children = await tx.execute<{ id: string }>(sql`SELECT id FROM public.disbursements WHERE request_batch_id=${prior.rows[0].id} AND created_by=${profile.id} ORDER BY created_at,id`)
      if (!children.rows.length) throw new Error('ชุดคำขอเดิมไม่มีเอกสาร กรุณาติดต่อผู้ดูแลระบบ')
      return { id: children.rows[0].id, ids: children.rows.map(row => row.id), batch_id: prior.rows[0].id }
    }
    const batch = await tx.execute<{ id: string }>(sql`INSERT INTO public.request_batches(created_by,request_key,payload_hash) VALUES (${profile.id},${requestKey},${fingerprint}) RETURNING id`)
    const batchId = batch.rows[0].id
    await lockDisbursementItems(tx, input.item_ids)
    // 1. Verify items are central pool items and active
    const itemGroups = new Map<string, string[]>()
    for (const itemId of [...input.item_ids].sort()) {
      const itemRes = await tx.execute<{ id: string; item_name: string; unit_name: string | null; item_type: string; is_central: boolean; note: string | null; status: string; quantity: number }>(
        sql`SELECT id, item_name, (SELECT name FROM public.units u WHERE u.id=unit_id) AS unit_name, item_type, is_central, note, status, quantity FROM public.inventory_items WHERE id = ${itemId} AND deleted_at IS NULL`
      )
      const it = itemRes.rows[0]
      if (!it) throw new Error('ไม่พบข้อมูลวัสดุบางรายการ')
      if (it.item_type === 'material' && input.request_type === 'issue' && input.item_actions[itemId] === 'borrow') {
        throw new Error('ไม่สามารถยืมวัสดุในคำขอเบิกได้')
      }
      const action = input.item_actions[itemId] ?? (it.item_type === 'material' ? 'issue' : input.request_type)
      const documentType = action === 'borrow' ? 'asset_borrow' : it.item_type === 'material' ? 'material_issue' : 'asset_handover'
      if (documentType === 'asset_borrow' && !input.due_date) throw new Error('กรุณาระบุกำหนดส่งคืนสำหรับรายการยืมสิ่งของ')
      if (documentType === 'asset_borrow') {
        const dateError = borrowDueDateError(input.due_date)
        if (dateError) throw new Error(dateError)
      }
      itemGroups.set(documentType, [...(itemGroups.get(documentType) ?? []), itemId])
      if (it.item_type !== 'material' && !it.is_central && (!it.note || !it.note.includes('ส่วนกลาง'))) {
        throw new Error(`รายการ "${it.item_name}" ไม่ใช่ของส่วนกลาง`)
      }
      if (it.status !== 'active' && it.status !== 'spare') {
        throw new Error(`รายการ "${it.item_name}" ไม่อยู่ในสถานะพร้อมใช้งาน`)
      }

      // The inventory lock serializes concurrent requests before checking reservations.
      if (Number(it.quantity) < 1) throw new Error(`รายการ "${it.item_name}" ไม่มีจำนวนพร้อมใช้งาน`)

      const requested = input.quantities[itemId] ?? 1
      if (it.item_type === 'material') await assertMaterialAvailable(tx, it, requested)
      else {
        if (requested !== 1) throw new Error('ครุภัณฑ์แต่ละชิ้นต้องมีจำนวนเท่ากับ 1')
        await assertItemUnreserved(tx, itemId)
      }
    }

    const recipientName = profile.full_name || 'ผู้ใช้งาน'
    const departmentName = profile.department || 'สำนักงานเขตสุขภาพที่ 7'
    const documentIds: string[] = []
    // Split documents by type and commit the entire cart in this transaction.
    for (const [transactionType, itemIds] of itemGroups) {
    const dueDate = transactionType === 'asset_borrow' ? input.due_date : null

    // 2. Insert disbursement header
    const docRes = await tx.execute<{ id: string }>(
      sql`INSERT INTO public.disbursements (
        transaction_type, recipient_name, department_name, purpose, status, due_date, created_by, request_batch_id, submitted_at
      ) VALUES (
        ${transactionType},
        ${recipientName},
        ${departmentName},
        ${input.purpose.trim()},
        'pending_approval',
        ${dueDate},
        ${profile.id}, ${batchId}, now()
      ) RETURNING id`
    )
    const docId = docRes.rows[0].id
    documentIds.push(docId)

    // 3. Insert line items
    for (const itemId of itemIds) {
      await tx.execute(
        sql`INSERT INTO public.disbursement_items (
          disbursement_id, item_id, requested_qty, status
        ) VALUES (
          ${docId}, ${itemId}, ${input.quantities[itemId] ?? 1}, 'pending'
        )`
      )
    }

    // 4. Audit log
    await tx.execute(
      sql`INSERT INTO public.audit_logs (user_id, action, target_table, target_id, old_data, new_data)
          VALUES (
            ${profile.id}, ${transactionType === 'asset_borrow' ? 'REQUEST_BORROW' : 'REQUEST_ISSUE'}, 'disbursements', ${docId},
            null,
            ${JSON.stringify({
              items_count: itemIds.length,
              request_type: transactionType === 'asset_borrow' ? 'borrow' : 'issue',
              due_date: dueDate,
              purpose: input.purpose.trim(),
            })}::jsonb
          )`
    )

    }
    documentIds.sort()
    return { id: documentIds[0], ids: documentIds, batch_id: batchId }
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

    // Prevent rejecting entire document if some lines were already issued via partial approval
    const issuedLinesRes = await tx.execute<{ count: number }>(
      sql`SELECT count(*)::int as count FROM public.disbursement_items 
          WHERE disbursement_id = ${disbursementId} AND (status = 'issued' OR issued_qty > 0)`
    )
    if (Number(issuedLinesRes.rows[0]?.count ?? 0) > 0) {
      throw new Error('ไม่สามารถปฏิเสธเอกสารนี้ทั้งฉบับได้เนื่องจากมีบางรายการได้รับการอนุมัติจ่ายไปแล้ว กรุณาปฏิเสธเฉพาะรายการที่เหลือแทน')
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

export async function partialApprovePostgresDisbursement(
  rawInput: unknown
): Promise<{ ok: boolean; document_no?: string; status: string }> {
  const user = await requireDisbursementAdmin()
  const data = partialApproveDisbursementSchema.parse(rawInput)

  return withUserDatabase(async (tx) => {
    // 1. Lock document header
    const docRes = await tx.execute<DisbursementRow>(
      sql`SELECT * FROM public.disbursements WHERE id = ${data.disbursement_id} FOR UPDATE`
    )
    const doc = docRes.rows[0]
    if (!doc) throw new Error('ไม่พบเอกสารเบิกจ่าย')
    if (!['draft', 'pending_approval'].includes(doc.status)) {
      throw new Error(`ไม่สามารถยืนยันหรืออนุมัติเอกสารในสถานะ ${doc.status} ได้`)
    }

    // 2. Lock ALL lines for this document
    const allLinesRes = await tx.execute<DisbursementItemRow>(
      sql`SELECT * FROM public.disbursement_items
          WHERE disbursement_id = ${data.disbursement_id} ORDER BY item_id ASC FOR UPDATE`
    )
    const allLines = allLinesRes.rows
    if (allLines.length === 0) throw new Error('ไม่สามารถยืนยันเอกสารที่ไม่มีรายการสิ่งของได้')

    if (new Set(data.line_ids.map((id) => id.toLowerCase())).size !== data.line_ids.length) {
      throw new Error('ไม่สามารถระบุรายการสิ่งของซ้ำได้')
    }

    const allLineIds = new Set(allLines.map((line) => line.id.toLowerCase()))
    for (const id of data.line_ids) {
      if (!allLineIds.has(id.toLowerCase())) {
        throw new Error(`ไม่พบรายการสิ่งของ ${id} ในเอกสาร`)
      }
    }

    const selectedLines = allLines.filter((line) => data.line_ids.includes(line.id))
    if (selectedLines.length === 0) throw new Error('ไม่พบรายการที่เลือกสำหรับอนุมัติ')

    for (const line of selectedLines) {
      if (line.status !== 'pending') {
        throw new Error(`รายการ ${line.item_name_snapshot || line.id} ได้รับการดำเนินการไปแล้ว (${line.status})`)
      }
    }

    const selectedSet = new Set(selectedLines.map((line) => line.id))
    const remainingPending = allLines.filter((line) => line.status === 'pending' && !selectedSet.has(line.id))
    const closesReview = remainingPending.length === 0
    const canChangeDueDate = closesReview || doc.status === 'draft'
    if (doc.transaction_type === 'asset_borrow' && !canChangeDueDate &&
        data.replacement_due_date && data.replacement_due_date !== doc.due_date) {
      throw new Error('สามารถเปลี่ยนกำหนดส่งคืนได้เมื่ออนุมัติรายการที่เหลือทั้งหมด')
    }
    const approvedDueDate = doc.transaction_type === 'asset_borrow'
      ? approvalBorrowDueDate(doc.due_date, data.replacement_due_date ?? undefined, doc.created_at)
      : doc.due_date

    // Reserve remaining draft lines as the document enters pending approval.
    const linesToProcess = doc.status === 'draft' ? allLines.filter((line) => line.status === 'pending') : selectedLines
    await lockDisbursementItems(tx, linesToProcess.map((line) => line.item_id))
    for (const line of linesToProcess) {
      const isSelected = selectedSet.has(line.id)
      const stockLedger = await tx.execute<{ net: number }>(
        sql`select coalesce(sum(delta),0)::int as net from public.stock_movements where disbursement_item_id=${line.id} and movement_type in ('issue','reversal')`
      )
      const materialNet = Number(stockLedger?.rows[0]?.net ?? 0)
      if (materialNet !== 0 && materialNet !== -line.requested_qty) {
        throw new Error('ยอดตัดสต็อกคำขอไม่ตรงกับจำนวนที่ขอเบิก กรุณาตรวจสอบรายการ')
      }
      const materialAlreadyDebited = materialNet < 0

      const itemLock = await tx.execute<{
        id: string; quantity: number; item_type: string; item_name: string;
        asset_no: string | null; serial_no: string | null; brand: string | null; model: string | null;
        responsible_person: string | null; is_central: boolean; note: string | null; status: string | null;
        unit_name: string | null; unit_price: number | null; category_name: string | null; location_name: string | null;
      }>(sql`SELECT i.*, u.name AS unit_name, c.name AS category_name, l.name AS location_name
        FROM ${await inventoryTableForId(tx, line.item_id)} i
        LEFT JOIN public.units u ON u.id = i.unit_id
        LEFT JOIN public.categories c ON c.id = i.category_id
        LEFT JOIN public.locations l ON l.id = i.location_id
        WHERE i.id = ${line.item_id} AND i.deleted_at IS NULL FOR UPDATE OF i`)
      const currentItem = itemLock.rows[0]
      if (!currentItem) throw new Error(`สิ่งของ ${line.item_id} ถูกลบหรือไม่พร้อมใช้งาน`)
      if (doc.transaction_type !== 'material_issue') assertCentralDisbursementItem(currentItem)
      if (currentItem.status && !['active', 'spare'].includes(currentItem.status)) {
        throw new Error(`รายการ "${currentItem.item_name}" ไม่อยู่ในสถานะพร้อมใช้งาน`)
      }
      if (!materialAlreadyDebited && currentItem.quantity < line.requested_qty) {
        throw new Error(`จำนวนคงเหลือของ "${currentItem.item_name}" ไม่เพียงพอสำหรับการอนุมัติ`)
      }

      if (currentItem.item_type === 'material') {
        if (!materialAlreadyDebited) await assertMaterialAvailable(tx, currentItem, line.requested_qty)
      } else {
        await assertItemUnreserved(tx, line.item_id, doc.id)
      }

      if (currentItem.item_type === 'material' && !materialAlreadyDebited) {
        const deducted = await tx.execute(
          sql`UPDATE public.materials SET quantity = quantity - ${line.requested_qty}, updated_at = now() WHERE id = ${line.item_id} AND quantity >= ${line.requested_qty} RETURNING id`
        )
        if (deducted.rows.length !== 1) throw new Error(`จำนวนคงเหลือของ "${currentItem.item_name}" ไม่เพียงพอสำหรับการอนุมัติ`)

        await tx.execute(
          sql`INSERT INTO public.stock_movements (
            item_id, disbursement_item_id, delta, balance_after, movement_type, created_by
          ) VALUES (
            ${line.item_id}, ${line.id}, ${-line.requested_qty}, ${currentItem.quantity - line.requested_qty}, 'issue', ${user.id}
          )`
        )
      } else if (isSelected && currentItem.item_type === 'asset' && ['asset_handover', 'asset_borrow'].includes(doc.transaction_type)) {
        await tx.execute(sql`SELECT private.apply_asset_custody_event(
          ${line.item_id}, ${line.id}, ${doc.transaction_type === 'asset_borrow' ? 'borrow' : 'handover'},
          ${line.requested_qty}, 'normal', NULL, ${syncCentralNote(currentItem.note || '', false) || null}
        )`)
      }

      if (!isSelected) continue
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

    let docNo = doc.document_no
    let targetDocStatus = 'pending_approval'
    if (closesReview) {
      const { docNo: finalDocNo, fiscalYear } = await approvalDocumentNumber(tx, doc)
      docNo = finalDocNo
      targetDocStatus = doc.transaction_type === 'asset_borrow' ? 'active_borrow' : 'confirmed'
      await tx.execute(
        sql`UPDATE public.disbursements
            SET document_no = ${docNo},
                fiscal_year = ${fiscalYear},
                status = ${targetDocStatus},
                confirmed_at = now(),
                confirmed_by = ${user.id},
                due_date = ${approvedDueDate},
                updated_at = now()
            WHERE id = ${data.disbursement_id}`
      )
    } else {
      await tx.execute(
        sql`UPDATE public.disbursements
            SET status = 'pending_approval',
                due_date = ${approvedDueDate},
                submitted_at = coalesce(submitted_at, ${doc.status === 'draft' ? sql`now()` : sql`NULL`}),
                updated_at = now()
            WHERE id = ${data.disbursement_id}`
      )
    }

    // 7. Audit log
    await tx.execute(
      sql`INSERT INTO public.audit_logs (user_id, action, target_table, target_id, old_data, new_data)
          VALUES (
            ${user.id}, 'PARTIAL_APPROVE_DISBURSEMENT', 'disbursements', ${data.disbursement_id},
            ${JSON.stringify({ status: doc.status, approved_lines: selectedLines.map((l) => l.id) })}::jsonb,
            ${JSON.stringify({ status: targetDocStatus, document_no: docNo, approved_count: selectedLines.length, remaining_pending: remainingPending.length })}::jsonb
          )`
    )

    return { ok: true, document_no: docNo ?? undefined, status: targetDocStatus }
  })
}

export async function partialRejectPostgresDisbursement(
  rawInput: unknown
): Promise<{ ok: boolean; status: string }> {
  const user = await requireDisbursementAdmin()
  const data = partialRejectDisbursementSchema.parse(rawInput)

  return withUserDatabase(async (tx) => {
    // 1. Lock document header
    const docRes = await tx.execute<DisbursementRow>(
      sql`SELECT * FROM public.disbursements WHERE id = ${data.disbursement_id} FOR UPDATE`
    )
    const doc = docRes.rows[0]
    if (!doc) throw new Error('ไม่พบเอกสาร')
    if (doc.status !== 'pending_approval') {
      throw new Error(`สามารถปฏิเสธได้เฉพาะคำขอในสถานะรออนุมัติเท่านั้น (สถานะปัจจุบัน: ${doc.status})`)
    }

    // 2. Lock ALL lines for this document
    const allLinesRes = await tx.execute<DisbursementItemRow>(
      sql`SELECT * FROM public.disbursement_items
          WHERE disbursement_id = ${data.disbursement_id} ORDER BY item_id ASC FOR UPDATE`
    )
    const allLines = allLinesRes.rows
    if (allLines.length === 0) throw new Error('ไม่พบรายการสิ่งของในเอกสาร')

    const selectedLines = allLines.filter((line) => data.line_ids.includes(line.id))
    if (selectedLines.length === 0) throw new Error('ไม่พบรายการที่เลือกสำหรับปฏิเสธ')

    for (const line of selectedLines) {
      if (line.status !== 'pending') {
        throw new Error(`รายการ ${line.item_name_snapshot || line.id} ได้รับการดำเนินการไปแล้ว (${line.status})`)
      }
    }

    // 3. For each selected line, if material was debited, restore stock
    await lockDisbursementItems(tx, allLines.map((line) => line.item_id))
    for (const line of selectedLines) {
      const stockLedger = await tx.execute<{ net: number }>(
        sql`select coalesce(sum(delta),0)::int as net from public.stock_movements where disbursement_item_id=${line.id} and movement_type in ('issue','reversal')`
      )
      const materialNet = Number(stockLedger?.rows[0]?.net ?? 0)
      if (materialNet < 0) {
        const refundQty = Math.abs(materialNet)
        const updated = await tx.execute<{ quantity: number }>(
          sql`UPDATE public.materials SET quantity = quantity + ${refundQty}, updated_at = now() WHERE id = ${line.item_id} RETURNING quantity`
        )
        if (updated.rows[0]) {
          await tx.execute(
            sql`INSERT INTO public.stock_movements (
              item_id, disbursement_item_id, delta, balance_after, movement_type, created_by
            ) VALUES (
              ${line.item_id}, ${line.id}, ${refundQty}, ${updated.rows[0].quantity}, 'reversal', ${user.id}
            )`
          )
        }
      }

      await tx.execute(
        sql`UPDATE public.disbursement_items SET status = 'reversed' WHERE id = ${line.id}`
      )
    }

    // 4. Check remaining pending lines
    const selectedSet = new Set(selectedLines.map((l) => l.id))
    const remainingPendingCount = allLines.filter(
      (l) => !selectedSet.has(l.id) && l.status === 'pending'
    ).length

    let targetDocStatus: DisbursementRow['status'] = doc.status
    if (remainingPendingCount === 0) {
      const hasIssued = allLines.some((l) => !selectedSet.has(l.id) && ['issued', 'returned', 'partially_returned'].includes(l.status))
      targetDocStatus = hasIssued
        ? (doc.transaction_type === 'asset_borrow' ? 'active_borrow' : 'confirmed')
        : 'rejected'

      if (hasIssued) {
        const { docNo, fiscalYear } = await approvalDocumentNumber(tx, doc)
        await tx.execute(sql`
          UPDATE public.disbursements
          SET status = ${targetDocStatus}, document_no = ${docNo}, fiscal_year = ${fiscalYear},
              confirmed_at = now(), confirmed_by = ${user.id}, updated_at = now()
          WHERE id = ${data.disbursement_id}
        `)
      } else {
        await tx.execute(sql`
          UPDATE public.disbursements
          SET status = 'rejected', reversal_reason = ${data.reason}, updated_at = now()
          WHERE id = ${data.disbursement_id}
        `)
      }
    } else {
      targetDocStatus = 'pending_approval'
      await tx.execute(
        sql`UPDATE public.disbursements SET updated_at = now() WHERE id = ${data.disbursement_id}`
      )
    }

    // 5. Audit log
    await tx.execute(
      sql`INSERT INTO public.audit_logs (user_id, action, target_table, target_id, old_data, new_data)
          VALUES (
            ${user.id}, 'PARTIAL_REJECT_DISBURSEMENT', 'disbursements', ${data.disbursement_id},
            ${JSON.stringify({ status: doc.status, rejected_lines: selectedLines.map((l) => l.id) })}::jsonb,
            ${JSON.stringify({ status: targetDocStatus, reason: data.reason, rejected_count: selectedLines.length, remaining_pending: remainingPendingCount })}::jsonb
          )`
    )

    return { ok: true, status: targetDocStatus }
  })
}

export async function partialReturnPostgresDisbursement(
  rawInput: unknown
): Promise<{ ok: boolean; status: string }> {
  const user = await requireDisbursementAdmin()
  const data = partialReturnDisbursementSchema.parse(rawInput)

  return withUserDatabase(async (tx) => {
    // 1. Lock parent document
    const docRes = await tx.execute<DisbursementRow>(
      sql`SELECT * FROM public.disbursements WHERE id = ${data.disbursement_id} FOR UPDATE`
    )
    const doc = docRes.rows[0]
    if (!doc) throw new Error('ไม่พบเอกสารเบิกจ่าย')
    if (doc.transaction_type !== 'asset_borrow') {
      throw new Error('สามารถบันทึกรับคืนได้เฉพาะรายการยืมสิ่งของเท่านั้น')
    }
    if (!['active_borrow', 'partially_returned'].includes(doc.status)) {
      throw new Error(`ไม่สามารถบันทึกรับคืนเอกสารในสถานะ ${doc.status} ได้`)
    }

    // 2. Lock ALL lines for this document
    const allLinesRes = await tx.execute<DisbursementItemRow>(
      sql`SELECT * FROM public.disbursement_items
          WHERE disbursement_id = ${data.disbursement_id} ORDER BY item_id ASC FOR UPDATE`
    )
    const allLines = allLinesRes.rows

    // 3. Lock items of target return lines
    await lockDisbursementItems(tx, data.items.map((i) => i.item_id))

    // 4. Process each return item
    for (const retItem of data.items) {
      const line = allLines.find((l) => l.id === retItem.line_id && l.item_id === retItem.item_id)
      if (!line) throw new Error(`ไม่พบรายการสิ่งของ ${retItem.item_id} ในเอกสาร`)
      if (!['issued', 'partially_returned'].includes(line.status)) {
        throw new Error(`รายการ ${line.item_name_snapshot || line.id} ไม่ได้อยู่ระหว่างการยืมหรือคืนครบแล้ว`)
      }

      const unreturned = line.issued_qty - line.returned_qty
      if (unreturned <= 0) {
        throw new Error(`รายการ ${line.item_name_snapshot || line.id} คืนครบแล้ว`)
      }

      const itemRes = await tx.execute<{ id: string; item_type: string; note: string | null; quantity: number }>(
        sql`SELECT id, item_type, note, quantity FROM ${await inventoryTableForId(tx, retItem.item_id)} WHERE id = ${retItem.item_id} AND deleted_at IS NULL FOR UPDATE`
      )
      const currentItem = itemRes.rows[0]
      if (!currentItem) throw new Error(`ไม่พบสิ่งของ ${retItem.item_id} หรือถูกลบแล้ว`)

      let originLocationName: string | null = null

      if (currentItem.item_type === 'material') {
        await restoreBorrowedMaterial(tx, currentItem.id, line.id, retItem.condition === 'normal' ? unreturned : 0, user.id)
      } else {
        if (retItem.condition === 'lost' && currentItem.quantity > 1) {
          throw new Error('ไม่สามารถบันทึกสูญหายสำหรับครุภัณฑ์ที่มีจำนวนมากกว่า 1 หน่วยได้ เนื่องจากระบบไม่รองรับการแยกสถานะรายหน่วย กรุณาติดต่อผู้ดูแลระบบ')
        }

        let originLocationId: string | null = null
        let itemNote: string | null
        if (retItem.condition === 'lost') {
          const centralNote = syncCentralNote(currentItem.note || '', false) || null
          itemNote = centralNote ? `${centralNote} [บันทึกสูญหายจากการยืม]` : 'บันทึกสูญหายจากการยืม'
        } else {
          const originLocation = await findOriginLocation(tx, retItem.item_id, doc.recipient_name)
          if (!originLocation) {
            throw new Error(`ไม่พบสถานที่ต้นทางเดิมสำหรับครุภัณฑ์ ${line.item_name_snapshot || retItem.item_id} ไม่สามารถเดาสถานที่ได้`)
          }
          originLocationId = originLocation.id
          originLocationName = originLocation.name
          itemNote = syncCentralNote(currentItem.note || '', true) || null
        }
        await tx.execute(sql`SELECT private.apply_asset_custody_event(
          ${retItem.item_id}, ${line.id}, 'return', ${unreturned}, ${retItem.condition}, ${retItem.reason},
          ${itemNote}, ${originLocationId}
        )`)
      }

      // Update line
      await tx.execute(
        sql`UPDATE public.disbursement_items
            SET returned_qty = ${line.issued_qty},
                status = 'returned'
            WHERE id = ${line.id}`
      )

      // Audit log
      await tx.execute(
        sql`INSERT INTO public.audit_logs (user_id, action, target_table, target_id, old_data, new_data)
            VALUES (
              ${user.id}, 'RETURN_DISBURSEMENT_ITEM', 'disbursement_items', ${line.id},
              ${JSON.stringify({ returned_qty: line.returned_qty })}::jsonb,
              ${JSON.stringify({ returned_qty: line.issued_qty, condition: retItem.condition, reason: retItem.reason, origin_location: originLocationName })}::jsonb
            )`
      )
    }

    // 5. Check remaining unreturned lines across entire document
    const updatedPendingRes = await tx.execute<{ count: number }>(
      sql`SELECT count(*)::int as count FROM public.disbursement_items
          WHERE disbursement_id = ${data.disbursement_id} AND status != 'returned' AND status != 'reversed'`
    )
    const allReturned = Number(updatedPendingRes.rows[0]?.count ?? 0) === 0
    const newDocStatus = allReturned ? 'returned' : 'partially_returned'

    await tx.execute(
      sql`UPDATE public.disbursements SET status = ${newDocStatus}, updated_at = now() WHERE id = ${data.disbursement_id}`
    )

    return { ok: true, status: newDocStatus }
  })
}
