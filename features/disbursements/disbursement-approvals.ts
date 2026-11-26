import 'server-only'
import { sql } from 'drizzle-orm'
import { z } from 'zod'
import type { PostgresTransaction } from '@/lib/postgres/db'
import { withUserDatabase } from '@/lib/postgres/request'
import { approvalBorrowDueDate } from './borrow-dates'
import {
  rejectDisbursementSchema,
  partialApproveDisbursementSchema,
  partialRejectDisbursementSchema,
} from './schema'
import { lockDisbursementItems } from './reservations'
import {
  approvalDocumentNumber,
  approveDisbursementLine,
  finalizeApprovedDisbursementHeader,
  lockPendingDisbursementForApproval,
  prefetchApprovalLineContext,
  requireDisbursementAdmin,
  withOptionalTransaction,
} from './disbursement-shared'
import type { DisbursementRow, DisbursementItemRow } from './types'

/**
 * Confirm disbursement draft: locks inventory, allocates Thai fiscal year sequence, snapshots items, updates custody/stock, writes audit log
 */
export async function confirmPostgresDisbursement(disbursementId: string, replacementDueDate?: string, transaction?: PostgresTransaction): Promise<{ document_no: string }> {
  const user = await requireDisbursementAdmin()
  z.string().uuid().parse(disbursementId)

  return withOptionalTransaction(transaction, async (tx) => {
    // 1. Lock document header and lines
    const { doc, lines } = await lockPendingDisbursementForApproval(tx, disbursementId)
    const approvedDueDate = doc.transaction_type === 'asset_borrow'
      ? approvalBorrowDueDate(doc.due_date, replacementDueDate, doc.created_at)
      : doc.due_date

    // 2. Filter pending lines and acquire deterministic item locks
    const pendingLines = lines.filter((line) => line.status === 'pending')
    const hasIssuedLines = lines.some((line) => line.status === 'issued')
    if (pendingLines.length === 0 && !hasIssuedLines) {
      throw new Error('ไม่มีรายการที่รออนุมัติในเอกสารนี้')
    }
    await lockDisbursementItems(tx, pendingLines.map((line) => line.item_id))
    const lineContext = await prefetchApprovalLineContext(tx, pendingLines)

    // 4. Process each pending line with row locking on public.items
    for (const line of pendingLines) {
      await approveDisbursementLine(tx, doc, line, user.id, {
        issueLine: true,
        checkItemTypeMatch: true,
        includeItemNameInErrors: false,
      }, lineContext)
    }

    const { docNo, targetStatus } = await finalizeApprovedDisbursementHeader(tx, doc, user.id, approvedDueDate)

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
    // 1. Lock document header and all lines
    const { doc, lines: allLines } = await lockPendingDisbursementForApproval(tx, data.disbursement_id)

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
    const lineContext = await prefetchApprovalLineContext(tx, linesToProcess)
    for (const line of linesToProcess) {
      await approveDisbursementLine(tx, doc, line, user.id, {
        issueLine: selectedSet.has(line.id),
        checkItemTypeMatch: false,
        includeItemNameInErrors: true,
      }, lineContext)
    }

    let docNo = doc.document_no
    let targetDocStatus = 'pending_approval'
    if (closesReview) {
      const finalized = await finalizeApprovedDisbursementHeader(tx, doc, user.id, approvedDueDate)
      docNo = finalized.docNo
      targetDocStatus = finalized.targetStatus
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

    const requestedLineIds = new Set(data.line_ids.map((id) => id.toLowerCase()))
    if (requestedLineIds.size !== data.line_ids.length) {
      throw new Error('ไม่สามารถระบุรายการสิ่งของซ้ำได้')
    }

    const selectedLines = allLines.filter((line) => requestedLineIds.has(line.id.toLowerCase()))
    if (selectedLines.length !== requestedLineIds.size) {
      throw new Error('ไม่พบรายการที่เลือกสำหรับปฏิเสธในเอกสาร')
    }

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
