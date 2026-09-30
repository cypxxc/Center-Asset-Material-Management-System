import test from 'node:test'
import assert from 'node:assert/strict'
import { ItemBatchWindow } from '../../features/items/batch-window'
import type { ItemBatchResult, ItemListRow } from '../../features/items/types'

function makeBatch(start: number, count = 25, nextCursor: string | null = String(start + count)): ItemBatchResult {
  return {
    items: Array.from({ length: count }, (_, i) => ({
      id: String(start + i),
      item_name: `Item ${start + i}`,
      item_type: 'material' as const,
      quantity: 10 + start + i,
      unit_price: 100,
      asset_no: null,
      serial_no: null,
      responsible_person: null,
      status: 'active' as const,
      updated_at: '2026-09-25T00:00:00Z',
      category: { id: 'c1', name: 'Cat 1' },
      unit: { id: 'u1', name: 'Unit 1' },
      location: { id: 'l1', name: 'Loc 1' },
    } as ItemListRow)),
    nextCursor,
    total: start === 0 ? 100 : null,
  }
}

test('optimisticDelete removes matching items and decrements count and total', async () => {
  const window = new ItemBatchWindow(makeBatch(0, 10), async () => makeBatch(10, 10))
  let notified = 0
  window.subscribe(() => { notified++ })

  assert.equal(window.count, 10)
  assert.equal(window.state.total, 100)
  assert.equal(window.at(0)?.id, '0')
  assert.equal(window.at(1)?.id, '1')

  const nextState = window.optimisticDelete(['0', '2'])

  assert.equal(notified, 1)
  assert.equal(nextState.batches[0].length, 8)
  assert.equal(window.count, 8)
  assert.equal(window.state.total, 98)
  assert.equal(window.at(0)?.id, '1')
  assert.equal(window.at(1)?.id, '3')
  assert.equal(window.state.batches[0].items?.some(item => item?.id === '0' || item?.id === '2'), false)
})

test('optimisticDelete recomputes batch starts contiguously across multiple batches', async () => {
  const window = new ItemBatchWindow(makeBatch(0, 10, '10'), async () => makeBatch(10, 10, null))
  await window.loadMore()

  assert.equal(window.state.batches.length, 2)
  assert.equal(window.count, 20)
  assert.equal(window.state.batches[0].start, 0)
  assert.equal(window.state.batches[0].length, 10)
  assert.equal(window.state.batches[1].start, 10)
  assert.equal(window.state.batches[1].length, 10)

  // Delete item '1' from batch 0, and item '12' and '15' from batch 1
  window.optimisticDelete(['1', '12', '15'])

  assert.equal(window.state.batches[0].length, 9)
  assert.equal(window.state.batches[0].start, 0)
  assert.equal(window.state.batches[1].length, 8)
  assert.equal(window.state.batches[1].start, 9)
  assert.equal(window.count, 17)
  assert.equal(window.state.total, 97)

  // Verify contiguous lookup via window.at
  assert.equal(window.at(0)?.id, '0')
  assert.equal(window.at(1)?.id, '2') // item '1' was deleted
  assert.equal(window.at(8)?.id, '9') // end of batch 0
  assert.equal(window.at(9)?.id, '10') // start of batch 1
  assert.equal(window.at(10)?.id, '11')
  assert.equal(window.at(11)?.id, '13') // item '12' was deleted
  assert.equal(window.at(16)?.id, '19')
  assert.equal(window.at(17), undefined)
})

test('optimisticUpdate applies partial updates to matching items across batches', async () => {
  const window = new ItemBatchWindow(makeBatch(0, 5, '5'), async () => makeBatch(5, 5, null))
  await window.loadMore()

  let notified = 0
  window.subscribe(() => { notified++ })

  const nextState = window.optimisticUpdate(['2', '7'], {
    item_name: 'Updated Name',
    status: 'inactive',
  })

  assert.equal(notified, 1)
  assert.equal(nextState, window.state)

  const item2 = window.at(2)
  assert.equal(item2?.id, '2')
  assert.equal(item2?.item_name, 'Updated Name')
  assert.equal(item2?.status, 'inactive')
  assert.equal(item2?.quantity, 12) // unaffected field preserved

  const item7 = window.at(7)
  assert.equal(item7?.id, '7')
  assert.equal(item7?.item_name, 'Updated Name')
  assert.equal(item7?.status, 'inactive')
  assert.equal(item7?.quantity, 17) // unaffected field preserved

  const item1 = window.at(1)
  assert.equal(item1?.item_name, 'Item 1')
  assert.equal(item1?.status, 'active')
})

test('snapshot and rollback restores state accurately after delete and update', async () => {
  const window = new ItemBatchWindow(makeBatch(0, 10, null), async () => makeBatch(10, 10, null))
  const snap = window.snapshot()

  assert.deepEqual(snap, window.state)
  assert.notEqual(snap.batches, window.state.batches)
  assert.notEqual(snap.batches[0].items, window.state.batches[0].items)

  let notified = 0
  window.subscribe(() => { notified++ })

  // Mutate with delete
  window.optimisticDelete(['0', '1', '2'])
  assert.equal(window.count, 7)
  assert.equal(window.state.total, 97)
  assert.equal(notified, 1)

  // Rollback
  window.rollback(snap)
  assert.equal(notified, 2)
  assert.equal(window.count, 10)
  assert.equal(window.state.total, 100)
  assert.equal(window.at(0)?.id, '0')
  assert.equal(window.at(1)?.id, '1')
  assert.equal(window.at(2)?.id, '2')

  // Snapshot before update
  const snapBeforeUpdate = window.snapshot()
  window.optimisticUpdate(['0'], { item_name: 'Modified 0' })
  assert.equal(window.at(0)?.item_name, 'Modified 0')

  // Rollback update
  window.rollback(snapBeforeUpdate)
  assert.equal(window.at(0)?.item_name, 'Item 0')
})
