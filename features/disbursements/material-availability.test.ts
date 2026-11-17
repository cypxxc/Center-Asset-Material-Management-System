import test from 'node:test'
import assert from 'node:assert/strict'
import { materialAvailability, assertMaterialQuantity } from './material-availability'
import { submitBorrowRequestSchema, disbursementDraftSchema } from './schema'

test('material availability uses physical stock without reservations', () => {
  assert.deepEqual(materialAvailability(10), { stock_quantity: 10, reserved_quantity: 0, available_quantity: 10 })
  assert.equal(materialAvailability(0).available_quantity, 0)
  assert.doesNotThrow(() => assertMaterialQuantity('กระดาษ', 7, 7, 'รีม'))
  assert.throws(() => assertMaterialQuantity('กระดาษ', 8, 7, 'รีม'), /กระดาษ.*7.*8/)
})

test('material request quantities preserve explicit counts and reject invalid counts', () => {
  const id = '00000000-0000-4000-8000-000000000001'
  const base = { item_ids: [id], request_type: 'issue', purpose: 'สำนักงาน' }
  assert.equal(submitBorrowRequestSchema.parse({ ...base, quantities: { [id]: 3 } }).quantities[id], 3)
  for (const qty of [0, -1, 1.5, 2147483648]) {
    assert.equal(submitBorrowRequestSchema.safeParse({ ...base, quantities: { [id]: qty } }).success, false)
    assert.equal(disbursementDraftSchema.safeParse({ transaction_type: 'material_issue', recipient_name: 'A', department_name: 'B', purpose: 'C', items: [{ item_id: id, requested_qty: qty }] }).success, false)
  }
})
