import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildItemsUrl } from '@/features/items/hooks/use-items-filter'

test('buildItemsUrl constructs correct query url with provided params', () => {
  const url = buildItemsUrl('/items', {
    q: 'laptop',
    type: 'asset',
    status: 'active',
    category_id: 'cat-1',
    location_id: 'loc-1',
    sort_by: 'item_name',
    sort_dir: 'asc',
  })

  assert.equal(
    url,
    '/items?q=laptop&type=asset&status=active&category_id=cat-1&location_id=loc-1&sort_by=item_name&sort_dir=asc'
  )
})

test('buildItemsUrl omits empty or default params', () => {
  const url = buildItemsUrl('/items', {
    q: '',
    type: '',
    status: '',
    category_id: '',
    location_id: '',
    sort_by: '',
    sort_dir: '',
  })

  assert.equal(url, '/items')
})

test('buildItemsUrl trims q parameter', () => {
  const url = buildItemsUrl('/items', {
    q: '  desk  ',
    type: 'material',
  })

  assert.equal(url, '/items?q=desk&type=material')
})
