import '../../tests/setup/dom'
import test, { beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { mockSupabaseRegistry } from '../../tests/mocks/supabase'
import { decodeItemCursor, encodeItemCursor, normalizeItemListSearchParams } from './cursor'
import { getItemBatch } from './queries'

beforeEach(() => {
  process.env.DATA_BACKEND = 'supabase'
  mockSupabaseRegistry.clear()
})

test('item batches request 26 rows, return 25, and carry the tied sort key and id', async () => {
  mockSupabaseRegistry.setTableResponse('items', Array.from({ length: 26 }, (_, index) => ({
    id: `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`, item_name: 'Monitor', item_type: 'asset', quantity: 1, status: 'active', updated_at: '2026-09-22T00:00:00Z',
  })))
  const result = await getItemBatch({ sort_by: 'item_name', sort_dir: 'asc' })
  assert.equal(result.items.length, 25)
  assert.equal(result.total, 26)
  assert.ok(result.nextCursor)
  assert.deepEqual(
    decodeItemCursor(result.nextCursor!, normalizeItemListSearchParams({ sort_by: 'item_name', sort_dir: 'asc' })),
    { key: 'Monitor', id: '00000000-0000-4000-8000-000000000024' },
  )
  const query = mockSupabaseRegistry.getQueryLog().find((entry) => entry.table === 'items')
  assert.ok(query)
  assert.ok(query.operations.some((operation) => operation[0] === 'limit' && operation[1] === 26))
  assert.deepEqual(query.operations.filter((operation) => operation[0] === 'order'), [['order', 'item_name'], ['order', 'id']])
})

test('subsequent item batches omit totals and safely escape PostgREST predicates', async () => {
  mockSupabaseRegistry.setTableResponse('items', [])
  const params = { q: 'a",and(id.eq.evil)', sort_by: 'status' }
  await getItemBatch(params)
  const cursor = encodeItemCursor(normalizeItemListSearchParams(params), 'active', '00000000-0000-4000-8000-000000000001')
  const second = await getItemBatch(params, cursor)
  assert.equal(second.total, null)
  const query = mockSupabaseRegistry.getQueryLog().at(-1)
  assert.ok(query)
  const predicate = query.operations.find((operation) => operation[0] === 'or')?.[1]
  assert.equal(typeof predicate, 'string')
  assert.ok(!(predicate as string).includes('a",and(id.eq.evil)'))
})

test('batch display uses the same comma search text as all-match selection', async () => {
  mockSupabaseRegistry.setTableResponse('items', [])
  await getItemBatch({ q: 'a,b' })
  const query = mockSupabaseRegistry.getQueryLog().at(-1)!
  const predicate = String(query.operations.find(operation => operation[0] === 'or')?.[1])
  assert.ok(predicate.includes('item_name.ilike."%a b%"'))
  assert.ok(!predicate.includes('a,b'))
})
