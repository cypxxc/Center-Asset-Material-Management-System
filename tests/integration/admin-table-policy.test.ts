import test from 'node:test'
import assert from 'node:assert/strict'
import { assertAdminTable, parseAdminMutation } from '@/features/admin/table-policy'

test('admin table policy permits registry tables', () => {
  assert.equal(assertAdminTable('items', 'read'), 'items')
  assert.equal(assertAdminTable('categories', 'write'), 'categories')
  assert.equal(assertAdminTable('audit_logs', 'read'), 'audit_logs')
  assert.throws(() => assertAdminTable('audit_logs', 'delete'), /read.only/i)
  assert.throws(() => assertAdminTable('audit_logs', 'write'), /read.only/i)
})

test('admin table policy rejects tables outside the registry contract', () => {
  assert.throws(() => assertAdminTable('auth.users', 'read'), /Unsupported admin table/)
  assert.throws(() => assertAdminTable('storage.objects', 'delete'), /Unsupported admin table/)
})

test('full-row updates accept Thai names within the normal form grapheme limits', () => {
  for (const table of ['categories', 'locations', 'units', 'items'] as const) {
    const field = table === 'items' ? 'item_name' : 'name'
    const limit = table === 'items' ? 255 : 120
    const name = 'ก้'.repeat(limit)
    const row = { id: '12345678-1234-4234-8234-123456789abc', [field]: name, created_at: '2025-01-01', updated_at: '2025-01-01' }
    assert.equal(parseAdminMutation(table, 'update', row)[field], name)
    assert.throws(() => parseAdminMutation(table, 'update', { ...row, [field]: `${name}ก้` }))
  }
})
