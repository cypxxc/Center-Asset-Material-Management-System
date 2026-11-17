import test from 'node:test'
import assert from 'node:assert/strict'
import { bulkEditSchema } from './bulk-edit'
const id = '11111111-1111-4111-8111-111111111111'
test('bulk edit changes only opted-in fields and deduplicates IDs', () => {
  const result = bulkEditSchema.parse({ ids: [id, id], updates: { location_id: id } })
  assert.deepEqual(result, { ids: [id], updates: { location_id: id } })
})
test('bulk edit rejects unsafe, empty and oversized requests', () => {
  for (const input of [
    { ids: [id], updates: {} }, { ids: [], updates: { status: 'active' } },
    { ids: [id], updates: { quantity: 0 } }, { ids: [id], updates: { status: 'invalid' } },
    { ids: [id], updates: { location_id: '' } },
    { ids: Array(1001).fill(id), updates: { status: 'active' } },
  ]) assert.equal(bulkEditSchema.safeParse(input).success, false)
})
test('responsible person can be explicitly cleared without clearing references', () => {
  assert.deepEqual(bulkEditSchema.parse({ ids: [id], updates: { responsible_person: '' } }).updates, { responsible_person: '' })
})
