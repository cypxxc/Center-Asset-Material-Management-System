import '../setup/dom'
import test from 'node:test'
import assert from 'node:assert/strict'
import { mockSupabaseRegistry } from '../mocks/supabase'
import { updatePersonalProfile, updatePersonalPassword, updateSidebarOrder } from '../../features/auth/actions'

process.env.NEXT_PUBLIC_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321';
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'dummy-service-role-key-for-test';

test('personal profile updates send user-editable display_name column and allow fallback full_name', async () => {
  mockSupabaseRegistry.clear()
  mockSupabaseRegistry.setAuth(
    { id: 'user-active', email: 'active@example.com' },
    { id: 'user-active', email: 'active@example.com', role: 'viewer', is_active: true },
  )

  // 1. Updating display_name (custom alias)
  const displayNameForm = new FormData()
  displayNameForm.set('display_name', '  My Alias  ')

  const result1 = await updatePersonalProfile(null, displayNameForm)

  assert.equal(result1.success, 'อัปเดตข้อมูลส่วนตัวเรียบร้อยแล้ว')
  const update1 = mockSupabaseRegistry.getQueryLog()
    .find((entry) => entry.table === 'profiles' && entry.operations.some(([operation]) => operation === 'update'))
  assert.ok(update1)
  assert.deepEqual(update1.operations.find(([operation]) => operation === 'update')?.[1], {
    display_name: 'My Alias',
  })

  // 2. Clearing display_name sets it to null
  mockSupabaseRegistry.clear()
  mockSupabaseRegistry.setAuth(
    { id: 'user-active', email: 'active@example.com' },
    { id: 'user-active', email: 'active@example.com', role: 'viewer', is_active: true },
  )
  const clearForm = new FormData()
  clearForm.set('display_name', '')
  const result2 = await updatePersonalProfile(null, clearForm)
  assert.equal(result2.success, 'อัปเดตข้อมูลส่วนตัวเรียบร้อยแล้ว')
  const update2 = mockSupabaseRegistry.getQueryLog()
    .find((entry) => entry.table === 'profiles' && entry.operations.some(([operation]) => operation === 'update'))
  assert.ok(update2)
  assert.deepEqual(update2.operations.find(([operation]) => operation === 'update')?.[1], {
    display_name: null,
  })
})

test('sidebar preference updates send only the user-editable sidebar_order column', async () => {
  mockSupabaseRegistry.clear()
  mockSupabaseRegistry.setAuth(
    { id: 'user-active', email: 'active@example.com' },
    { id: 'user-active', email: 'active@example.com', role: 'viewer', is_active: true },
  )

  const result = await updateSidebarOrder(['dashboard', 'items'])

  assert.equal(result.success, true)
  const update = mockSupabaseRegistry.getQueryLog()
    .find((entry) => entry.table === 'profiles' && entry.operations.some(([operation]) => operation === 'update'))
  assert.ok(update)
  assert.deepEqual(update.operations.find(([operation]) => operation === 'update')?.[1], {
    sidebar_order: ['dashboard', 'items'],
  })
})

test('personal password update records audit log and requires valid matching input', async () => {
  mockSupabaseRegistry.clear()
  mockSupabaseRegistry.setAuth(
    { id: 'user-active', email: 'active@example.com' },
    { id: 'user-active', email: 'active@example.com', role: 'viewer', is_active: true },
  )

  // Mismatch
  const mismatchForm = new FormData()
  mismatchForm.set('password', 'newpass123')
  mismatchForm.set('confirm_password', 'different123')
  const mismatchResult = await updatePersonalPassword(null, mismatchForm)
  assert.equal(mismatchResult.error, 'รหัสผ่านใหม่และการยืนยันรหัสผ่านไม่ตรงกัน')

  // Too short
  const shortForm = new FormData()
  shortForm.set('password', '12345')
  shortForm.set('confirm_password', '12345')
  const shortResult = await updatePersonalPassword(null, shortForm)
  assert.equal(shortResult.error, 'รหัสผ่านใหม่ต้องมีความยาวอย่างน้อย 6 ตัวอักษร')

  // Valid password update
  const validForm = new FormData()
  validForm.set('password', 'validpass123')
  validForm.set('confirm_password', 'validpass123')
  const validResult = await updatePersonalPassword(null, validForm)
  assert.equal(validResult.success, 'เปลี่ยนรหัสผ่านเรียบร้อยแล้ว')

  const auditInsert = mockSupabaseRegistry.getQueryLog()
    .find((entry) => entry.table === 'audit_logs' && entry.operations.some(([op]) => op === 'insert'))
  assert.ok(auditInsert, 'Password change must record audit log')
  const insertOp = auditInsert.operations.find(([op]) => op === 'insert')
  const payload = insertOp?.[1] as Record<string, unknown>
  assert.equal(payload.action, 'UPDATE_PASSWORD')
  assert.equal(payload.target_id, 'user-active')
})
