import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizeAdminPagination } from './pagination'

test('URL pagination accepts numeric strings and produces consistent bounded ranges', () => {
  assert.deepEqual(normalizeAdminPagination('2', '25'), { page: 2, pageSize: 25, from: 25, to: 49 })
  assert.deepEqual(normalizeAdminPagination('2.9', '25.9'), { page: 2, pageSize: 25, from: 25, to: 49 })
  assert.deepEqual(normalizeAdminPagination('-99', '0'), { page: 1, pageSize: 10, from: 0, to: 9 })
  assert.deepEqual(normalizeAdminPagination('1e200', '1e200'), { page: 100000, pageSize: 100, from: 9999900, to: 9999999 })
})

test('malformed and nonfinite pagination falls back without coercing objects', () => {
  for (const value of [undefined, null, '', ' ', '2junk', 'NaN', 'Infinity', '-Infinity', NaN, Infinity, -Infinity, true, [], {}, Symbol('page'), { valueOf() { throw new Error('must not coerce') } }]) {
    assert.deepEqual(normalizeAdminPagination(value, value), { page: 1, pageSize: 50, from: 0, to: 49 })
  }
})
