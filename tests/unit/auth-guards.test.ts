import '../setup/dom'
import test, { describe, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { mockSupabaseRegistry } from '../mocks/supabase'
import {
  requireAuth,
  requireAdmin,
  requireEditor,
  requireDeletePermission,
  requireSettingsManager,
} from '@/features/auth/guards'

describe('features/auth/guards', () => {
  const originalSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const originalServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  beforeEach(() => {
    mockSupabaseRegistry.clear()
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://127.0.0.1:54321'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'mock-service-role-key'
  })

  afterEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = originalSupabaseUrl
    process.env.SUPABASE_SERVICE_ROLE_KEY = originalServiceKey
    mockSupabaseRegistry.clear()
  })

  test('requireAuth rejects unauthenticated users', async () => {
    const res = await requireAuth()
    assert.equal(res.error, 'กรุณาเข้าสู่ระบบก่อนทำรายการ')
    assert.equal(res.profile, null)
  })

  test('requireAuth accepts active authenticated users', async () => {
    mockSupabaseRegistry.setAuth(
      { id: 'user-1', email: 'user@test.local' },
      { id: 'user-1', role: 'viewer', is_active: true }
    )
    const res = await requireAuth()
    assert.equal(res.error, null)
    assert.equal(res.profile?.id, 'user-1')
  })

  test('requireAdmin accepts admin and rejects staff/viewer', async () => {
    mockSupabaseRegistry.setAuth(
      { id: 'staff-1', email: 'staff@test.local' },
      { id: 'staff-1', role: 'staff', is_active: true }
    )
    const staffRes = await requireAdmin()
    assert.ok(staffRes.error?.includes('Admin role required'))

    mockSupabaseRegistry.setAuth(
      { id: 'admin-1', email: 'admin@test.local' },
      { id: 'admin-1', role: 'admin', is_active: true }
    )
    const adminRes = await requireAdmin()
    assert.equal(adminRes.error, null)
    assert.equal(adminRes.profile?.role, 'admin')
  })

  test('requireEditor accepts admin and staff, rejects viewer', async () => {
    mockSupabaseRegistry.setAuth(
      { id: 'viewer-1', email: 'viewer@test.local' },
      { id: 'viewer-1', role: 'viewer', is_active: true }
    )
    const viewerRes = await requireEditor()
    assert.equal(viewerRes.error, 'คุณไม่มีสิทธิ์แก้ไขข้อมูลสิ่งของ')

    mockSupabaseRegistry.setAuth(
      { id: 'staff-1', email: 'staff@test.local' },
      { id: 'staff-1', role: 'staff', is_active: true }
    )
    const staffRes = await requireEditor()
    assert.equal(staffRes.error, null)
  })

  test('requireDeletePermission accepts admin only', async () => {
    mockSupabaseRegistry.setAuth(
      { id: 'staff-1', email: 'staff@test.local' },
      { id: 'staff-1', role: 'staff', is_active: true }
    )
    const staffRes = await requireDeletePermission()
    assert.equal(staffRes.error, 'เฉพาะผู้ดูแลระบบเท่านั้นที่มีสิทธิ์ทำรายการนี้')

    mockSupabaseRegistry.setAuth(
      { id: 'admin-1', email: 'admin@test.local' },
      { id: 'admin-1', role: 'admin', is_active: true }
    )
    const adminRes = await requireDeletePermission()
    assert.equal(adminRes.error, null)
  })

  test('requireSettingsManager accepts admin and staff, rejects viewer', async () => {
    mockSupabaseRegistry.setAuth(
      { id: 'viewer-1', email: 'viewer@test.local' },
      { id: 'viewer-1', role: 'viewer', is_active: true }
    )
    const viewerRes = await requireSettingsManager()
    assert.equal(viewerRes.error, 'เฉพาะผู้ดูแลระบบเท่านั้นที่สามารถจัดการตั้งค่าได้')

    mockSupabaseRegistry.setAuth(
      { id: 'staff-1', email: 'staff@test.local' },
      { id: 'staff-1', role: 'staff', is_active: true }
    )
    const staffRes = await requireSettingsManager()
    assert.equal(staffRes.error, null)
  })
})
