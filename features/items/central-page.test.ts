import assert from 'node:assert/strict'
import { test } from 'node:test'
import { buildItemsUrl, normalizeItemListSearchParams, resolveItemPageParams } from './list-params'

test('central page stays scoped after reset or an attempted query override', () => {
  for (const is_central of [undefined, '', 'false', '0', 'true']) {
    const params = resolveItemPageParams('/central-items', { is_central, q: 'desk' })
    assert.equal(normalizeItemListSearchParams(params).is_central, true)
    assert.equal(params.q, 'desk')
  }
  assert.equal(normalizeItemListSearchParams(resolveItemPageParams('/central-items', {})).is_central, true)
  assert.equal(normalizeItemListSearchParams(resolveItemPageParams('/items', {})).is_central, null)
})

test('central page URLs preserve filters and pagination without a removable scope parameter', () => {
  assert.equal(buildItemsUrl('/central-items', { is_central: 'true' }), '/central-items')
  assert.equal(buildItemsUrl('/central-items', { q: 'desk', is_central: 'false', page: '2' }), '/central-items?q=desk&page=2')
  assert.equal(buildItemsUrl('/items', { is_central: 'true' }), '/items?is_central=true')
})
