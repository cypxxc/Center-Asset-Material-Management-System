import '../setup/dom'
import test from 'node:test'
import assert from 'node:assert/strict'
import { mockSupabaseRegistry } from '../mocks/supabase'
import { updatePersonalProfile, updateSidebarOrder } from '../../features/auth/actions'

test('personal profile updates send only the user-editable full_name column', async () => {
  mockSupabaseRegistry.clear()
  mockSupabaseRegistry.setAuth(
    { id: 'user-active', email: 'active@example.com' },
    { id: 'user-active', email: 'active@example.com', role: 'viewer', is_active: true },
  )

  const formData = new FormData()
  formData.set('full_name', '  Active User  ')

  const result = await updatePersonalProfile(null, formData)

  assert.equal(result.success, 'อัปเดตข้อมูลส่วนตัวเรียบร้อยแล้ว')
  const update = mockSupabaseRegistry.getQueryLog()
    .find((entry) => entry.table === 'profiles' && entry.operations.some(([operation]) => operation === 'update'))
  assert.ok(update)
  assert.deepEqual(update.operations.find(([operation]) => operation === 'update')?.[1], {
    full_name: 'Active User',
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
