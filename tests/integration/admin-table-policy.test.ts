import test from 'node:test'
import assert from 'node:assert/strict'
import { assertAdminTable } from '@/features/admin/table-policy'

test('admin table policy permits registry tables', () => {
  assert.equal(assertAdminTable('items', 'read'), 'items')
  assert.equal(assertAdminTable('categories', 'write'), 'categories')
  assert.equal(assertAdminTable('audit_logs', 'read'), 'audit_logs')
  assert.throws(() => assertAdminTable('audit_logs', 'write'), /Audit history is read-only/)
  assert.throws(() => assertAdminTable('audit_logs', 'delete'), /Audit history is read-only/)
})

test('admin table policy rejects tables outside the registry contract', () => {
  assert.throws(() => assertAdminTable('auth.users', 'read'), /Unsupported admin table/)
  assert.throws(() => assertAdminTable('storage.objects', 'delete'), /Unsupported admin table/)
})

test('admin postgres policy defines searchColumns and tableColumns parity', async () => {
  const { searchColumns, tableColumns, pageBounds } = await import('@/features/admin/postgres-policy')
  assert.ok(Array.isArray(searchColumns.items))
  assert.ok(searchColumns.items.includes('item_name'))
  assert.ok(searchColumns.items.includes('asset_no'))
  assert.ok(tableColumns.items.includes('depreciation_cost'))
  assert.ok(tableColumns.items.includes('depreciation_method'))

  // pageBounds clamping
  assert.deepEqual(pageBounds(-5, 999), { limit: 200, offset: 0 })
  assert.deepEqual(pageBounds(2, 20), { limit: 20, offset: 20 })
})

