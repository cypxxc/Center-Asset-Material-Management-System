import test from 'node:test'
import assert from 'node:assert/strict'
import {
  BATCH_SIZE,
  CursorError,
  decodeItemCursor,
  encodeItemCursor,
  normalizeItemListSearchParams,
} from './cursor'

test('item cursors round trip the normalized sort, filters, key and id', () => {
  const params = normalizeItemListSearchParams({ q: '  Monitor  ', type: 'asset', sort_by: 'item_name', sort_dir: 'desc' })
  const cursor = encodeItemCursor(params, 'Monitor', '33333333-3333-4333-8333-333333333333')
  assert.equal(BATCH_SIZE, 25)
  assert.deepEqual(decodeItemCursor(cursor, params), { key: 'Monitor', id: '33333333-3333-4333-8333-333333333333' })
})

test('item cursors reject malformed and filter-mismatched values', () => {
  const params = normalizeItemListSearchParams({ status: 'active', sort_by: 'quantity', sort_dir: 'asc' })
  const cursor = encodeItemCursor(params, 4, '33333333-3333-4333-8333-333333333333')
  assert.throws(() => decodeItemCursor('not-a-cursor', params), CursorError)
  assert.throws(
    () => decodeItemCursor(cursor, normalizeItemListSearchParams({ status: 'spare', sort_by: 'quantity', sort_dir: 'asc' })),
    CursorError,
  )
})

test('item cursors retain typed tied sort keys and reject invalid values', () => {
  const numeric = normalizeItemListSearchParams({ sort_by: 'quantity' })
  assert.deepEqual(decodeItemCursor(encodeItemCursor(numeric, 3, '33333333-3333-4333-8333-333333333333'), numeric), { key: 3, id: '33333333-3333-4333-8333-333333333333' })
  const text = normalizeItemListSearchParams({ sort_by: 'status' })
  assert.throws(() => encodeItemCursor(text, 3, '33333333-3333-4333-8333-333333333333'), CursorError)
})

test('emitted cursors round trip long searches and Thai names without exceeding URL bounds', () => {
  const params = normalizeItemListSearchParams({ q: 'ค้นหา'.repeat(1000), sort_by: 'item_name' })
  const key = 'ก'.repeat(512)
  const id = '33333333-3333-4333-8333-333333333333'
  const cursor = encodeItemCursor(params, key, id)
  assert.deepEqual(decodeItemCursor(cursor, params), { key, id })
  assert.ok(cursor.length < 4096)
})

test('batch search keeps the comma normalization used by all-matching bulk selection', () => {
  assert.equal(normalizeItemListSearchParams({ q: 'a,b' }).q, 'a b')
  assert.deepEqual(normalizeItemListSearchParams({ q: 'a,b' }), normalizeItemListSearchParams({ q: 'a b' }))
})
