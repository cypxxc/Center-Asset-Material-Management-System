import '../setup/dom'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { PgDialect } from 'drizzle-orm/pg-core'
import type { SQL } from 'drizzle-orm'

const docId = '00000000-0000-4000-8000-000000000001'
const lineId = '00000000-0000-4000-8000-000000000002'
const itemId = '00000000-0000-4000-8000-000000000003'
let role = 'admin'
let mode: 'confirm' | 'return' = 'confirm'
const writes: { sql: string; params: unknown[] }[] = []
const dialect = new PgDialect()
let currentQuantity = 1
let isDue = true
function stub(path: string, exports: unknown) {
  const filename = require.resolve(path)
  require.cache[filename] = { id: filename, filename, loaded: true, exports } as NodeJS.Module
}
stub('../../features/auth/queries', { getCurrentProfile: async () => ({ id: docId, role, is_active: true }) })
stub('../../lib/postgres/request', {
  withUserDatabase: async (callback: (tx: unknown) => Promise<unknown>) => callback({ execute: async (statement: SQL) => {
    const query = dialect.sqlToQuery(statement)
    if (query.sql.includes('public.inventory_registry')) return { rows: [{ id: itemId, item_type: 'asset' }] }
    if (query.sql.includes('AS is_due')) return { rows: [{ is_due: isDue }] }
    if (query.sql.includes('SELECT disbursement_id')) return { rows: [{ disbursement_id: docId }] }
    if (query.sql.includes('SELECT * FROM public.disbursements')) return { rows: [{ id: docId, status: mode === 'confirm' ? 'pending_approval' : 'active_borrow', transaction_type: 'asset_borrow', recipient_name: 'ผู้ยืม', due_date: '2099-01-01' }] }
    if (query.sql.includes('SELECT di.*') || query.sql.includes('SELECT * FROM public.disbursement_items')) return { rows: [{ id: lineId, item_id: itemId, disbursement_id: docId, status: mode === 'return' ? 'issued' : 'pending', requested_qty: 1, issued_qty: 1, returned_qty: 0, item_name: 'ครุภัณฑ์ส่วนกลาง' }] }
    if (query.sql.includes('SELECT') && (query.sql.includes('public.items') || query.sql.includes('public."items"') || query.sql.includes('public.inventory_items'))) return { rows: [{ id: itemId, item_name: 'ชื่อปัจจุบัน', item_type: 'asset', asset_no: 'CURRENT-ASSET', quantity: currentQuantity, is_central: mode === 'confirm', note: mode === 'confirm' ? 'บันทึกเดิม\nส่วนกลาง' : 'บันทึกเดิม', responsible_person: 'ผู้ยืม' }] }
    if (query.sql.includes('count(*)')) return { rows: [{ count: 0 }] }
    writes.push(query)
    return { rows: query.sql.includes('disbursement_sequences') ? [{ current_val: 1 }] : [] }
  } }),
})
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { confirmPostgresDisbursement, returnPostgresDisbursementItem } = require('../../features/disbursements/postgres-actions') as typeof import('../../features/disbursements/postgres-actions')

test('approved borrowing removes central flag and marker while preserving other notes', async () => {
  mode = 'confirm'; writes.length = 0
  await confirmPostgresDisbursement(docId)
  const event = writes.find((query) => query.sql.includes('private.apply_asset_custody_event'))
  assert.ok(event)
  assert.deepEqual(event.params, [itemId, lineId, 'borrow', 1, 'บันทึกเดิม'])
})

test('approval snapshots use inventory reread under lock', async () => {
  mode = 'confirm'; writes.length = 0
  await confirmPostgresDisbursement(docId)
  const snapshot = writes.find((query) => query.sql.includes('item_name_snapshot ='))!
  assert.ok(snapshot.params.includes('ชื่อปัจจุบัน'))
  assert.ok(snapshot.params.includes('CURRENT-ASSET'))
})

test('asset approval rejects quantity reduced to zero after submission', async () => {
  mode = 'confirm'; writes.length = 0; currentQuantity = 0
  try {
    await assert.rejects(confirmPostgresDisbursement(docId), /จำนวน|คงเหลือ|เพียงพอ/)
    assert.equal(writes.some((query) => query.sql.includes('private.apply_asset_custody_event')), false)
  } finally { currentQuantity = 1 }
})

test('admin confirmed return restores central flag and marker', async () => {
  mode = 'return'; writes.length = 0
  await returnPostgresDisbursementItem({ line_id: lineId, return_qty: 1, condition: 'normal' })
  const event = writes.find((query) => query.sql.includes('private.apply_asset_custody_event'))
  assert.ok(event)
  assert.ok(event.sql.includes("'return'"))
  assert.deepEqual(event.params, [itemId, lineId, 1, 'normal', null, 'บันทึกเดิม\nส่วนกลาง'])
})

test('user cannot confirm a return or restore central status', async () => {
  role = 'user'; writes.length = 0
  try {
    await assert.rejects(returnPostgresDisbursementItem({ line_id: lineId, return_qty: 1, condition: 'normal' }), /ผู้ดูแลระบบ/)
    assert.equal(writes.length, 0)
  } finally { role = 'admin' }
})

test('lost assets do not return to the central pool', async () => {
  mode = 'return'; writes.length = 0
  await returnPostgresDisbursementItem({ line_id: lineId, return_qty: 1, condition: 'lost' })
  const event = writes.find((query) => query.sql.includes('private.apply_asset_custody_event'))
  assert.ok(event)
  assert.ok(event.sql.includes("'return'"))
  assert.deepEqual(event.params, [itemId, lineId, 1, 'lost', null, 'บันทึกเดิม [บันทึกสูญหายจากการยืม]'])
})

test('return before the due date is allowed and does not block returns', async () => {
  mode = 'return'; writes.length = 0; isDue = false
  await returnPostgresDisbursementItem({ line_id: lineId, return_qty: 1, condition: 'normal' })
  assert.ok(writes.some((query) => query.sql.includes('private.apply_asset_custody_event') && query.sql.includes("'return'")))
})
