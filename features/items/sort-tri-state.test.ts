import test from 'node:test'
import assert from 'node:assert/strict'
import {
  normalizeItemListSearchParams,
  buildItemsUrl,
  ascSortColumns,
  type ItemSortColumn,
} from './list-params'

test('ascSortColumns includes category and all alphabetical Thai fields', () => {
  assert.ok(ascSortColumns.includes('item_name'))
  assert.ok(ascSortColumns.includes('category'))
  assert.ok(ascSortColumns.includes('item_type'))
  assert.ok(ascSortColumns.includes('acquired_date'))
  assert.ok(ascSortColumns.includes('budget_source'))
  assert.ok(ascSortColumns.includes('asset_no'))
  assert.ok(ascSortColumns.includes('gfmis_number'))
  assert.ok(ascSortColumns.includes('responsible_person'))

  // Numbers default to desc
  assert.ok(!ascSortColumns.includes('unit_price' as ItemSortColumn))
  assert.ok(!ascSortColumns.includes('quantity' as ItemSortColumn))
})

test('normalizeItemListSearchParams sets correct default sort_dir for asc and desc fields', () => {
  // Category defaults to asc
  const categoryParams = normalizeItemListSearchParams({ sort_by: 'category' })
  assert.equal(categoryParams.sort_by, 'category')
  assert.equal(categoryParams.sort_dir, 'asc')

  // Unit price defaults to desc
  const priceParams = normalizeItemListSearchParams({ sort_by: 'unit_price' })
  assert.equal(priceParams.sort_by, 'unit_price')
  assert.equal(priceParams.sort_dir, 'desc')

  // Empty sort_by defaults to updated_at desc
  const defaultParams = normalizeItemListSearchParams({})
  assert.equal(defaultParams.sort_by, 'updated_at')
  assert.equal(defaultParams.sort_dir, 'desc')
})

test('buildItemsUrl omits sort_by and sort_dir when cleared (resetting sort)', () => {
  const urlWithSort = buildItemsUrl('/items', { sort_by: 'unit_price', sort_dir: 'asc' })
  assert.ok(urlWithSort.includes('sort_by=unit_price'))
  assert.ok(urlWithSort.includes('sort_dir=asc'))

  const urlReset = buildItemsUrl('/items', { sort_by: '', sort_dir: '', page: '1' })
  assert.equal(urlReset, '/items')
  assert.ok(!urlReset.includes('sort_by'))
  assert.ok(!urlReset.includes('sort_dir'))
})

test('tri-state sorting cycle logic transitions correctly', () => {
  function getNextSort(currentSortBy: string, currentSortDir: string, field: ItemSortColumn) {
    const isAscDefault = ascSortColumns.includes(field)
    const initialDir: 'asc' | 'desc' = isAscDefault ? 'asc' : 'desc'
    const oppositeDir: 'asc' | 'desc' = initialDir === 'asc' ? 'desc' : 'asc'

    if (currentSortBy !== field) {
      return { sort_by: field, sort_dir: initialDir }
    }
    if (currentSortDir === initialDir) {
      return { sort_by: field, sort_dir: oppositeDir }
    }
    return { sort_by: '', sort_dir: '' }
  }

  // 1. Text field (item_name): None -> asc -> desc -> reset
  const step1 = getNextSort('', '', 'item_name')
  assert.deepEqual(step1, { sort_by: 'item_name', sort_dir: 'asc' })

  const step2 = getNextSort(step1.sort_by, step1.sort_dir, 'item_name')
  assert.deepEqual(step2, { sort_by: 'item_name', sort_dir: 'desc' })

  const step3 = getNextSort(step2.sort_by, step2.sort_dir, 'item_name')
  assert.deepEqual(step3, { sort_by: '', sort_dir: '' })

  // 2. Numeric field (unit_price): None -> desc -> asc -> reset
  const price1 = getNextSort('', '', 'unit_price')
  assert.deepEqual(price1, { sort_by: 'unit_price', sort_dir: 'desc' })

  const price2 = getNextSort(price1.sort_by, price1.sort_dir, 'unit_price')
  assert.deepEqual(price2, { sort_by: 'unit_price', sort_dir: 'asc' })

  const price3 = getNextSort(price2.sort_by, price2.sort_dir, 'unit_price')
  assert.deepEqual(price3, { sort_by: '', sort_dir: '' })
})
