import 'server-only'
import { randomUUID } from 'node:crypto'
import { sql } from 'drizzle-orm'
import { z } from 'zod'
import type { PostgresTransaction } from '@/lib/postgres/db'
import { getCurrentProfile } from '@/features/auth/queries'
import { withUserDatabase } from '@/lib/postgres/request'
import { requestFingerprint } from './request-batch'
import { borrowDueDateError } from './borrow-dates'
import {
  disbursementDraftSchema,
  updateDisbursementDraftSchema,
  cancelDisbursementDraftSchema,
  submitBorrowRequestSchema,
} from './schema'
import { assertCentralDisbursementItem } from './central-items'
import { assertItemUnreserved, assertMaterialAvailable, lockDisbursementItems } from './reservations'
import { requireDisbursementWriter, withOptionalTransaction } from './disbursement-shared'
import type { DisbursementRow } from './types'

type DraftInventoryItem = {
  id: string; item_name: string; unit_name: string | null; item_type: string;
  asset_no: string | null; note: string | null; is_central: boolean; quantity: number; status: string | null;
}

async function fetchDraftItemsContext(tx: PostgresTransaction, itemIds: string[], forUpdate: boolean) {
  const uniqueIds = [...new Set(itemIds.map((id) => id.toLowerCase()))].sort()
  const itemTypeById = new Map<string, string>()
  const itemsById = new Map<string, DraftInventoryItem>()
  if (uniqueIds.length === 0) return { itemTypeById, itemsById }

  const registryRes = await tx.execute<{ id: string; item_type: string }>(sql`
    SELECT id::text AS id, item_type
    FROM public.inventory_registry
    WHERE id IN (${sql.join(uniqueIds.map((id) => sql`${id}::uuid`), sql`, `)})
  `)
  for (const row of registryRes.rows) {
    itemTypeById.set(row.id.toLowerCase(), row.item_type)
  }

  const assetIds = uniqueIds.filter((id) => itemTypeById.get(id) === 'asset')
  const materialIds = uniqueIds.filter((id) => itemTypeById.get(id) === 'material')

  for (const [table, ids] of [
    [sql`public.items`, assetIds],
    [sql`public.materials`, materialIds],
  ] as const) {
    if (ids.length === 0) continue
    const itemRes = await tx.execute<DraftInventoryItem>(sql`
      SELECT id, item_name, (SELECT name FROM public.units u WHERE u.id=unit_id) AS unit_name,
        item_type, asset_no, note, is_central, quantity, status
      FROM ${table}
      WHERE id IN (${sql.join(ids.map((id) => sql`${id}::uuid`), sql`, `)})
        AND deleted_at IS NULL
      ORDER BY id ASC
      ${forUpdate ? sql`FOR UPDATE` : sql``}
    `)
    for (const row of itemRes.rows) {
      itemsById.set(row.id.toLowerCase(), row)
    }
  }

  return { itemTypeById, itemsById }
}

/**
 * Create a new draft disbursement document with line items
 */
export async function createPostgresDisbursementDraft(rawInput: unknown, transaction?: PostgresTransaction): Promise<{ id: string }> {
  const user = await requireDisbursementWriter()
  const data = disbursementDraftSchema.parse(rawInput)
  if (user.role !== 'admin' && data.transaction_type !== 'material_issue') throw new Error('User สร้างได้เฉพาะเอกสารเบิกวัสดุ')

  return withOptionalTransaction(transaction, async (tx) => {
    const sortedItems = [...data.items].sort((a, b) => a.item_id.localeCompare(b.item_id))
    await lockDisbursementItems(tx, sortedItems.map((item) => item.item_id))
    const { itemTypeById, itemsById } = await fetchDraftItemsContext(tx, sortedItems.map((item) => item.item_id), user.role === 'admin')
    // 1. Verify item types and unique borrowing constraints
    for (const item of sortedItems) {
      const normalizedId = item.item_id.toLowerCase()
      const itemType = itemTypeById.get(normalizedId)
      if (!itemType) throw new Error('ไม่พบรายการในทะเบียน')
      if (itemType !== 'asset' && itemType !== 'material') throw new Error('Invalid inventory type')
      const found = itemsById.get(normalizedId)
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
    for (const item of sortedItems) {
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
    if (user.role !== 'admin' && doc.created_by !== user.id) throw new Error('คุณไม่มีสิทธิ์แก้ไขคำขอของผู้อื่น')
    if (doc.status !== 'draft') throw new Error(`สามารถแก้ไขได้เฉพาะเอกสารฉบับร่างเท่านั้น (สถานะปัจจุบัน: ${doc.status})`)
    if (data.transaction_type === 'asset_borrow') {
      const dateError = borrowDueDateError(data.due_date, doc.created_at)
      if (dateError) throw new Error(dateError)
    }
    const sortedItems = [...data.items].sort((a, b) => a.item_id.localeCompare(b.item_id))
    await lockDisbursementItems(tx, sortedItems.map((item) => item.item_id))
    const { itemTypeById, itemsById } = await fetchDraftItemsContext(tx, sortedItems.map((item) => item.item_id), true)

    // 2. Validate items match transaction type
    for (const item of sortedItems) {
      const normalizedId = item.item_id.toLowerCase()
      const itemType = itemTypeById.get(normalizedId)
      if (!itemType) throw new Error('ไม่พบรายการในทะเบียน')
      if (itemType !== 'asset' && itemType !== 'material') throw new Error('Invalid inventory type')
      const found = itemsById.get(normalizedId)
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

    for (const item of sortedItems) {
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
    const sortedItemIds = [...input.item_ids].sort()
    await lockDisbursementItems(tx, sortedItemIds)
    const batchItemsRes = await tx.execute<{ id: string; item_name: string; unit_name: string | null; item_type: string; is_central: boolean; note: string | null; status: string; quantity: number }>(
      sql`SELECT id, item_name, (SELECT name FROM public.units u WHERE u.id=unit_id) AS unit_name, item_type, is_central, note, status, quantity
          FROM public.inventory_items
          WHERE id IN (${sql.join(sortedItemIds.map((id) => sql`${id}::uuid`), sql`, `)})
            AND deleted_at IS NULL`
    )
    const borrowItemsById = new Map(batchItemsRes.rows.map((row) => [row.id.toLowerCase(), row]))
    // 1. Verify items are central pool items and active
    const itemGroups = new Map<string, string[]>()
    for (const itemId of sortedItemIds) {
      const it = borrowItemsById.get(itemId.toLowerCase())
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
