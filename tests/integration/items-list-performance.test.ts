import '../setup/dom'
import test from 'node:test'
import assert from 'node:assert/strict'
import { mockSupabaseRegistry } from '../mocks/supabase'
import { getItems } from '../../features/items/queries'

test('item data and exact count share filters while only data is ordered and paginated', async () => {
  mockSupabaseRegistry.clear()
  mockSupabaseRegistry.setTableResponse('items', [])
  await getItems({ q: 'monitor,dell', type: 'asset', status: 'inactive', category_id: 'cat', location_id: 'loc', page: '3', sort_by: 'item_name' })
  const queries = mockSupabaseRegistry.getQueryLog().filter(q => q.table === 'items')
  assert.equal(queries.length, 2)
  const count = queries.find(q => (q.selectOptions as { head?: boolean })?.head)
  const data = queries.find(q => !q.selectOptions)
  assert.ok(count)
  assert.ok(data)
  assert.deepEqual(count.selectOptions, { count: 'exact', head: true })
  assert.equal(count.selectColumns, 'id')
  const filters = (ops: typeof data.operations) => ops.filter(op => ['is', 'or', 'eq'].includes(op[0]))
  assert.deepEqual(filters(data.operations), filters(count.operations))
  assert.equal(filters(data.operations).length, 6)
  assert.deepEqual(data.operations.slice(-3), [['order', 'item_name'], ['order', 'id'], ['range', 20, 29]])
  assert.ok(!count.operations.some(op => ['range', 'order'].includes(op[0])))
  assert.equal(mockSupabaseRegistry.getStorageLog().length, 0)
})

test('item list signs a duplicate image only once using one page batch', async () => {
  mockSupabaseRegistry.clear()
  const image_url = 'https://example.com/item-images/a'
  mockSupabaseRegistry.setTableResponse('items', [{ id: 'a', image_url }, { id: 'b', image_url }])
  const result = await getItems({})
  assert.equal(result.total, 2)
  assert.deepEqual(result.items.map(i => i.image_url), ['https://signed.example/a', 'https://signed.example/a'])
  assert.deepEqual(mockSupabaseRegistry.getStorageLog(), [{ bucket: 'item-images', operation: 'createSignedUrls', path: 'a' }])
})
