import 'server-only'
import { sql } from 'drizzle-orm'
import { z } from 'zod'
import { withUserDatabase } from '@/lib/postgres/request'
import { inventoryTableForId } from '@/features/items/inventory-table'
import { syncCentralNote } from '@/features/items/central-note'
import {
  returnItemSchema,
  reverseDisbursementSchema,
  partialReturnDisbursementSchema,
} from './schema'
import { findOriginLocation } from './origin-location'
import { assertItemUnreserved, lockDisbursementItems } from './reservations'
import { requireDisbursementAdmin, restoreBorrowedMaterial } from './disbursement-shared'
import type { DisbursementRow, DisbursementItemRow, AssetCustodyLogRow } from './types'

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
      const line = allLines.find((l) =>
        l.id === retItem.line_id.toLowerCase() && l.item_id === retItem.item_id.toLowerCase()
      )
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
