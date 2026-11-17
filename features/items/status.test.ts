import { test } from 'node:test'
import assert from 'node:assert/strict'
import { itemFormSchema } from './schema'
import { bulkUpdatesSchema } from './bulk-edit'
import { normalizeItemStatus, itemStatusStorageValues } from './status'

test('legacy records belong to the same condition groups when editing and filtering', () => {
  for (const [stored, condition] of [
    ['spare', 'active'], ['waiting_repair', 'damaged'], ['disposed', 'inactive'],
    ['active', 'active'], ['damaged', 'damaged'], ['inactive', 'inactive'],
  ]) {
    assert.equal(normalizeItemStatus(stored), condition)
    assert.ok(itemStatusStorageValues(condition).includes(stored))
  }
  assert.deepEqual(itemStatusStorageValues('unknown'), [])
})

test('item forms and bulk edits accept only the three supported conditions', () => {
  const schema = itemFormSchema.shape.status
  for (const status of ['active', 'damaged', 'inactive']) {
    assert.equal(schema.safeParse(status).success, true)
    assert.equal(bulkUpdatesSchema.safeParse({ status }).success, true)
  }
  for (const status of ['spare', 'waiting_repair', 'disposed', 'unknown']) {
    assert.equal(schema.safeParse(status).success, false, `form accepted ${status}`)
    assert.equal(bulkUpdatesSchema.safeParse({ status }).success, false, `bulk edit accepted ${status}`)
  }
})
