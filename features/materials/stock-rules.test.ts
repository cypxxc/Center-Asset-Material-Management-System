import test from 'node:test'
import assert from 'node:assert/strict'
import { stockCommandSchema, stockDelta, returnQuantities, reconciliation, metadataUpdateColumns } from './stock-rules'

const id = '00000000-0000-4000-8000-000000000001'
const base = { item_id: id, request_key: id, kind: 'receipt', quantity: 3, reason: 'รับจากผู้ขาย', reference: 'RC-1' }

test('stock changes require evidence, bounded integers and a count cutoff version', () => {
  assert.equal(stockCommandSchema.safeParse(base).success, true)
  for (const quantity of [-1, 0, 1.5, 2147483648]) assert.equal(stockCommandSchema.safeParse({ ...base, quantity }).success, false)
  assert.equal(stockCommandSchema.safeParse({ ...base, reference: '' }).success, false)
  assert.equal(stockCommandSchema.safeParse({ ...base, kind: 'count', quantity: 0 }).success, false)
  assert.equal(stockCommandSchema.safeParse({ ...base, kind: 'count', quantity: 0, expected_stock_version: 3 }).success, true)
  assert.equal(stockDelta('receipt', 7, 3), 3)
  assert.equal(stockDelta('count', 7, 5), -2)
  assert.throws(() => stockDelta('receipt', 2147483647, 1))
})

test('partial returns consume original issued allowance but restock only accepted usable quantity', () => {
  assert.deepEqual(returnQuantities(10, 3, 4, 2), { returned: 7, restock: 2 })
  assert.throws(() => returnQuantities(10, 7, 4, 4))
  assert.throws(() => returnQuantities(10, 0, 2, 3))
  assert.throws(() => returnQuantities(10, 0, 0, 0))
  assert.deepEqual(returnQuantities(10, 0, 2, 0), { returned: 2, restock: 0 })
})

test('reconciliation reports gaps and metadata edits cannot overwrite material quantity', () => {
  assert.deepEqual(reconciliation(7, 10, -3), { expected: 7, difference: 0, balanced: true })
  assert.deepEqual(reconciliation(9, 10, -3), { expected: 7, difference: 2, balanced: false })
  assert.equal(metadataUpdateColumns(['item_name', 'quantity', 'status'], 'material').includes('quantity'), false)
  assert.equal(metadataUpdateColumns(['item_name', 'quantity', 'status'], 'asset').includes('quantity'), true)
})
