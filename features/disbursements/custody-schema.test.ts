import test from 'node:test'
import assert from 'node:assert/strict'
import { assignCustodySchema } from './custody-schema'

const id = '11111111-1111-4111-8111-111111111111'
const recipient = '22222222-2222-4222-8222-222222222222'
test('direct issue preserves requested quantities and rejects invalid or unrelated quantities', () => {
  assert.deepEqual(assignCustodySchema.parse({ item_ids: [id], recipient_id: recipient, quantities: { [id]: 3 } }).quantities, { [id]: 3 })
  for (const quantities of [{ [id]: 0 }, { [id]: 1.5 }, { [recipient]: 2 }]) {
    assert.equal(assignCustodySchema.safeParse({ item_ids: [id], recipient_id: recipient, quantities }).success, false)
  }
})
