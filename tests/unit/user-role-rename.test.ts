import assert from 'node:assert/strict'
import { test } from 'node:test'
import { canCreateDisbursement, canWrite, canDelete, canManageSettings, isAdmin } from '../../lib/permissions'
import { newUserSchema, profileUpdateSchema, parseBusinessBackup } from '../../features/admin/postgres-policy'

test('user retains request access and has no admin permissions', () => {
  assert.equal(canCreateDisbursement('user'), true)
  for (const permission of [isAdmin, canWrite, canDelete, canManageSettings]) assert.equal(permission('user'), false)
  assert.equal(canCreateDisbursement('admin'), true)
  assert.equal(canCreateDisbursement('viewer'), false)
})

test('account management accepts user and rejects the retired role', () => {
  const account = { full_name: 'Test user', role: 'user', is_active: true, password: 'test-password' }
  assert.equal(newUserSchema.safeParse(account).success, true)
  assert.equal(profileUpdateSchema.safeParse({ role: 'user' }).success, true)
  assert.equal(profileUpdateSchema.safeParse({ role: 'viewer' }).success, false)
})

test('legacy backups restore with user role while audit history stays unchanged', () => {
  const backup = {
    __meta: { version: 1 },
    profiles: [{ id: '00000000-0000-4000-8000-000000000001', full_name: 'Existing user', role: 'viewer', is_active: false }],
    categories: [], locations: [], units: [], items: [],
    audit_logs: [{ id: '00000000-0000-4000-8000-000000000002', old_data: { role: 'viewer' } }],
  }
  const parsed = parseBusinessBackup(JSON.stringify(backup))
  assert.equal(parsed.profiles[0].role, 'user')
  assert.equal(parsed.profiles[0].is_active, false)
  assert.deepEqual(parsed.audit_logs[0].old_data, { role: 'viewer' })
})
