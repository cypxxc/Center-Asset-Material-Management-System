import '../../tests/setup/dom'
import test from 'node:test'
import assert from 'node:assert/strict'
import { categorySchema } from '../settings/schema'

test('category creation requires an explicit valid inventory type', () => {
  assert.equal(categorySchema.safeParse({ name: 'สำนักงาน', item_type: 'material', is_active: true }).success, true)
  assert.equal(categorySchema.safeParse({ name: 'สำนักงาน', item_type: 'asset', is_active: true }).success, true)
  assert.equal(categorySchema.safeParse({ name: 'สำนักงาน', is_active: true }).success, false)
  assert.equal(categorySchema.safeParse({ name: 'สำนักงาน', item_type: 'shared', is_active: true }).success, false)
})

test('category choices isolate identical names and omit untyped categories', async () => {
  const { categoriesForType } = await import('./category-types')
  const categories = [
    { id: 'a', name: 'สำนักงาน', item_type: 'asset' as const },
    { id: 'm', name: 'สำนักงาน', item_type: 'material' as const },
    { id: 'unknown', name: 'เก่า' },
  ]
  assert.deepEqual(categoriesForType(categories, 'asset').map(c => c.id), ['a'])
  assert.deepEqual(categoriesForType(categories, 'material').map(c => c.id), ['m'])
})
