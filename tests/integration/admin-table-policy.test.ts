import test from 'node:test'
import assert from 'node:assert/strict'
import { assertAdminTable } from '@/features/admin/table-policy'

test('admin table policy permits registry tables', () => {
  assert.equal(assertAdminTable('items', 'read'), 'items')
  assert.equal(assertAdminTable('categories', 'write'), 'categories')
  assert.equal(assertAdminTable('audit_logs', 'delete'), 'audit_logs')
})

test('admin table policy rejects tables outside the registry contract', () => {
  assert.throws(() => assertAdminTable('auth.users', 'read'), /Unsupported admin table/)
  assert.throws(() => assertAdminTable('storage.objects', 'delete'), /Unsupported admin table/)
})
