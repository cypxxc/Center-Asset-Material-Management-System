import 'server-only'
import { sql } from 'drizzle-orm'
import type { PostgresTransaction } from '@/lib/postgres/db'
import { getCurrentProfile } from '@/features/auth/queries'
import { withUserDatabase } from '@/lib/postgres/request'
import { inventoryTableForId } from '@/features/items/inventory-table'
import { syncCentralNote } from '@/features/items/central-note'
import { computeThaiFiscalYear } from './fiscal-year'
import { assertCentralDisbursementItem } from './central-items'
import { assertItemUnreserved, assertMaterialAvailable } from './reservations'
import type { DisbursementRow, DisbursementItemRow } from './types'

export function withOptionalTransaction<T>(
  transaction: PostgresTransaction | undefined,
  callback: (tx: PostgresTransaction) => Promise<T>
): Promise<T> {
  return transaction ? callback(transaction) : withUserDatabase(callback)
}

export async function requireDisbursementWriter() {
  const profile = await getCurrentProfile()
  if (!profile?.is_active || !['admin', 'user'].includes(profile.role)) {
    throw new Error('คุณไม่มีสิทธิ์ทำรายการเบิก-จ่ายวัสดุ')
  }
  return profile
}

export async function requireDisbursementAdmin() {
  const profile = await getCurrentProfile()
  if (!profile?.is_active || profile.role !== 'admin') {
    throw new Error('เฉพาะผู้ดูแลระบบเท่านั้นที่มีสิทธิ์จ่าย รับคืน หรือย้อนรายการ')
  }
  return profile
}

export async function restoreBorrowedMaterial(tx: PostgresTransaction, itemId: string, lineId: string, quantity: number, userId: string) {
  if (quantity === 0) return
  const result = await tx.execute<{ quantity: number }>(sql`UPDATE public.materials SET quantity=quantity+${quantity}, updated_at=now() WHERE id=${itemId} RETURNING quantity`)
  if (!result.rows[0]) throw new Error('ไม่พบวัสดุสำหรับรับคืน')
  await tx.execute(sql`INSERT INTO public.stock_movements(item_id,disbursement_item_id,delta,balance_after,movement_type,created_by)
    VALUES(${itemId},${lineId},${quantity},${result.rows[0].quantity},'material_return',${userId})`)
}

export async function approvalDocumentNumber(tx: PostgresTransaction, doc: DisbursementRow) {
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

type LockedApprovalItem = {
  id: string; quantity: number; item_type: string; item_name: string;
  asset_no: string | null; serial_no: string | null; brand: string | null; model: string | null;
  responsible_person: string | null; is_central: boolean; note: string | null; status: string | null;
  unit_name: string | null; unit_price: number | null; category_name: string | null; location_name: string | null;
}

export async function lockPendingDisbursementForApproval(tx: PostgresTransaction, disbursementId: string) {
  const docRes = await tx.execute<DisbursementRow>(
    sql`SELECT * FROM public.disbursements WHERE id = ${disbursementId} FOR UPDATE`
  )
  const doc = docRes.rows[0]
  if (!doc) throw new Error('ไม่พบเอกสารเบิกจ่าย')
  if (!['draft', 'pending_approval'].includes(doc.status)) {
    throw new Error(`ไม่สามารถยืนยันหรืออนุมัติเอกสารในสถานะ ${doc.status} ได้`)
  }

  const linesRes = await tx.execute<DisbursementItemRow>(
    sql`SELECT * FROM public.disbursement_items
        WHERE disbursement_id = ${disbursementId} ORDER BY item_id ASC FOR UPDATE`
  )
  const lines = linesRes.rows
  if (lines.length === 0) throw new Error('ไม่สามารถยืนยันเอกสารที่ไม่มีรายการสิ่งของได้')
  return { doc, lines }
}

export type ApprovalLineContext = {
  ledgerNetByLineId: Map<string, number>
  itemTypeById: Map<string, string>
  lockedItemsById: Map<string, LockedApprovalItem>
}

export async function prefetchApprovalLineContext(
  tx: PostgresTransaction,
  lines: DisbursementItemRow[]
): Promise<ApprovalLineContext> {
  const ledgerNetByLineId = new Map<string, number>()
  const itemTypeById = new Map<string, string>()
  const lockedItemsById = new Map<string, LockedApprovalItem>()
  if (lines.length === 0) return { ledgerNetByLineId, itemTypeById, lockedItemsById }

  const lineIds = [...new Set(lines.map((line) => line.id.toLowerCase()))]
  const ledgerRes = await tx.execute<{ disbursement_item_id?: string; net: number }>(sql`
    SELECT disbursement_item_id::text AS disbursement_item_id, coalesce(sum(delta), 0)::int AS net
    FROM public.stock_movements
    WHERE disbursement_item_id IN (${sql.join(lineIds.map((id) => sql`${id}::uuid`), sql`, `)})
      AND movement_type IN ('issue', 'reversal')
    GROUP BY disbursement_item_id
  `)
  for (const row of ledgerRes.rows) {
    if (row.disbursement_item_id) {
      ledgerNetByLineId.set(row.disbursement_item_id.toLowerCase(), Number(row.net ?? 0))
    }
  }

  const uniqueItemIds = [...new Set(lines.map((line) => line.item_id.toLowerCase()))].sort()
  const registryRes = await tx.execute<{ id: string; item_type: string }>(sql`
    SELECT id::text AS id, item_type
    FROM public.inventory_registry
    WHERE id IN (${sql.join(uniqueItemIds.map((id) => sql`${id}::uuid`), sql`, `)})
  `)
  for (const row of registryRes.rows) {
    itemTypeById.set(row.id.toLowerCase(), row.item_type)
  }

  const assetIds = uniqueItemIds.filter((id) => itemTypeById.get(id) === 'asset')
  const materialIds = uniqueItemIds.filter((id) => itemTypeById.get(id) === 'material')

  for (const [table, ids] of [
    [sql`public.items`, assetIds],
    [sql`public.materials`, materialIds],
  ] as const) {
    if (ids.length === 0) continue
    const itemLock = await tx.execute<LockedApprovalItem>(sql`
      SELECT i.*, u.name AS unit_name, c.name AS category_name, l.name AS location_name
      FROM ${table} i
      LEFT JOIN public.units u ON u.id = i.unit_id
      LEFT JOIN public.categories c ON c.id = i.category_id
      LEFT JOIN public.locations l ON l.id = i.location_id
      WHERE i.id IN (${sql.join(ids.map((id) => sql`${id}::uuid`), sql`, `)})
        AND i.deleted_at IS NULL
      ORDER BY i.id ASC
      FOR UPDATE OF i
    `)
    for (const row of itemLock.rows) {
      lockedItemsById.set(row.id.toLowerCase(), row)
    }
  }

  return { ledgerNetByLineId, itemTypeById, lockedItemsById }
}

async function getLineMaterialDebitStatus(
  tx: PostgresTransaction,
  line: DisbursementItemRow,
  context?: ApprovalLineContext
): Promise<boolean> {
  let materialNet: number
  if (context) {
    materialNet = context.ledgerNetByLineId.get(line.id.toLowerCase()) ?? 0
  } else {
    const stockLedger = await tx.execute<{ net: number }>(
      sql`select coalesce(sum(delta),0)::int as net from public.stock_movements where disbursement_item_id=${line.id} and movement_type in ('issue','reversal')`
    )
    materialNet = Number(stockLedger?.rows[0]?.net ?? 0)
  }
  if (materialNet !== 0 && materialNet !== -line.requested_qty) {
    throw new Error('ยอดตัดสต็อกคำขอไม่ตรงกับจำนวนที่ขอเบิก กรุณาตรวจสอบรายการ')
  }
  return materialNet < 0
}

async function lockInventoryItemForApproval(
  tx: PostgresTransaction,
  itemId: string,
  context?: ApprovalLineContext
): Promise<LockedApprovalItem | undefined> {
  if (context) {
    const normalizedId = itemId.toLowerCase()
    const itemType = context.itemTypeById.get(normalizedId)
    if (!itemType) throw new Error('ไม่พบรายการในทะเบียน')
    if (itemType !== 'asset' && itemType !== 'material') throw new Error('Invalid inventory type')
    return context.lockedItemsById.get(normalizedId)
  }
  const itemLock = await tx.execute<LockedApprovalItem>(sql`SELECT i.*, u.name AS unit_name, c.name AS category_name, l.name AS location_name
    FROM ${await inventoryTableForId(tx, itemId)} i
    LEFT JOIN public.units u ON u.id = i.unit_id
    LEFT JOIN public.categories c ON c.id = i.category_id
    LEFT JOIN public.locations l ON l.id = i.location_id
    WHERE i.id = ${itemId} AND i.deleted_at IS NULL FOR UPDATE OF i`)
  return itemLock.rows[0]
}

async function recordMaterialIssueMovement(
  tx: PostgresTransaction,
  lineId: string,
  itemId: string,
  requestedQty: number,
  balanceAfter: number,
  userId: string
) {
  await tx.execute(
    sql`INSERT INTO public.stock_movements (
      item_id, disbursement_item_id, delta, balance_after, movement_type, created_by
    ) VALUES (
      ${itemId}, ${lineId}, ${-requestedQty}, ${balanceAfter}, 'issue', ${userId}
    )`
  )
}

async function issueDisbursementLineSnapshot(
  tx: PostgresTransaction,
  line: DisbursementItemRow,
  currentItem: LockedApprovalItem
) {
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

export async function approveDisbursementLine(
  tx: PostgresTransaction,
  doc: DisbursementRow,
  line: DisbursementItemRow,
  userId: string,
  options: { issueLine: boolean; checkItemTypeMatch: boolean; includeItemNameInErrors: boolean },
  context?: ApprovalLineContext
) {
  const materialAlreadyDebited = await getLineMaterialDebitStatus(tx, line, context)
  const currentItem = await lockInventoryItemForApproval(tx, line.item_id, context)
  if (!currentItem) {
    throw new Error(
      options.includeItemNameInErrors
        ? `สิ่งของ ${line.item_id} ถูกลบหรือไม่พร้อมใช้งาน`
        : `วัสดุ ${line.item_id} ถูกลบหรือไม่พร้อมใช้งาน`
    )
  }
  if (doc.transaction_type !== 'material_issue') assertCentralDisbursementItem(currentItem)
  if (currentItem.status && !['active', 'spare'].includes(currentItem.status)) {
    throw new Error(
      options.includeItemNameInErrors
        ? `รายการ "${currentItem.item_name}" ไม่อยู่ในสถานะพร้อมใช้งาน`
        : 'รายการนี้ไม่อยู่ในสถานะพร้อมใช้งาน'
    )
  }
  const insufficientMsg = options.includeItemNameInErrors
    ? `จำนวนคงเหลือของ "${currentItem.item_name}" ไม่เพียงพอสำหรับการอนุมัติ`
    : 'จำนวนคงเหลือไม่เพียงพอสำหรับการอนุมัติ'
  if (!materialAlreadyDebited && currentItem.quantity < line.requested_qty) {
    throw new Error(insufficientMsg)
  }
  if (
    options.checkItemTypeMatch &&
    (doc.transaction_type === 'material_issue'
      ? currentItem.item_type !== 'material'
      : doc.transaction_type === 'asset_handover' && currentItem.item_type !== 'asset')
  ) {
    throw new Error('ประเภทสิ่งของเปลี่ยนแปลง ไม่ตรงกับคำขอ')
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
    if (deducted.rows.length !== 1) throw new Error(insufficientMsg)

    await recordMaterialIssueMovement(
      tx,
      line.id,
      line.item_id,
      line.requested_qty,
      currentItem.quantity - line.requested_qty,
      userId
    )
  } else if (
    options.issueLine &&
    currentItem.item_type === 'asset' &&
    ['asset_handover', 'asset_borrow'].includes(doc.transaction_type)
  ) {
    await tx.execute(sql`SELECT private.apply_asset_custody_event(
      ${line.item_id}, ${line.id}, ${doc.transaction_type === 'asset_borrow' ? 'borrow' : 'handover'},
      ${line.requested_qty}, 'normal', NULL, ${syncCentralNote(currentItem.note || '', false) || null}
    )`)
  }

  if (options.issueLine) {
    await issueDisbursementLineSnapshot(tx, line, currentItem)
  }
}

export async function finalizeApprovedDisbursementHeader(
  tx: PostgresTransaction,
  doc: DisbursementRow,
  userId: string,
  approvedDueDate: string | null
): Promise<{ docNo: string; targetStatus: string }> {
  const { docNo, fiscalYear } = await approvalDocumentNumber(tx, doc)
  const targetStatus = doc.transaction_type === 'asset_borrow' ? 'active_borrow' : 'confirmed'
  await tx.execute(
    sql`UPDATE public.disbursements
        SET document_no = ${docNo},
            fiscal_year = ${fiscalYear},
            status = ${targetStatus},
            confirmed_at = now(),
            confirmed_by = ${userId},
            due_date = ${approvedDueDate},
            updated_at = now()
        WHERE id = ${doc.id}`
  )
  return { docNo, targetStatus }
}
