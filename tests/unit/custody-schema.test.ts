import { test } from 'node:test'
import assert from 'node:assert/strict'
import { assignCustodySchema } from '../../features/disbursements/custody-schema'

const item = '00000000-0000-4000-8000-000000000001'
const person = '00000000-0000-4000-8000-000000000002'
test('custody assignment requires selected items and a valid recipient', () => {
  assert.equal(assignCustodySchema.safeParse({ item_ids: [item], recipient_id: person }).success, true)
  assert.equal(assignCustodySchema.safeParse({ item_ids: [], recipient_id: person }).success, false)
  assert.equal(assignCustodySchema.safeParse({ item_ids: [item], recipient_id: '' }).success, false)
})
test('custody assignment rejects duplicates and oversized batches', () => {
  assert.equal(assignCustodySchema.safeParse({ item_ids: [item, item], recipient_id: person }).success, false)
  const ids = Array.from({ length: 21 }, (_, i) => `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`)
  assert.equal(assignCustodySchema.safeParse({ item_ids: ids, recipient_id: person }).success, false)
})
