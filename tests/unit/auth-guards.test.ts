import '../setup/dom'
import test, { describe, beforeEach } from 'node:test'
import assert from 'node:assert/strict'

let currentProfile: { id: string; email: string; role: 'admin' | 'viewer'; is_active: boolean } | null = null

const queriesPath = require.resolve('../../features/auth/queries')
require.cache[queriesPath] = {
  id: queriesPath,
  filename: queriesPath,
  loaded: true,
  exports: {
    getCurrentProfile: async () => currentProfile,
  },
} as NodeJS.Module

const guardsPromise = import('../../features/auth/guards')

describe('features/auth/guards', () => {
  beforeEach(() => {
    currentProfile = null
  })

  test('requireAuth rejects unauthenticated users', async () => {
    const { requireAuth } = await guardsPromise
    const res = await requireAuth()
    assert.equal(res.error, 'กรุณาเข้าสู่ระบบก่อนทำรายการ')
    assert.equal(res.profile, null)
  })

  test('requireAuth accepts active authenticated users', async () => {
    const { requireAuth } = await guardsPromise
    currentProfile = { id: 'user-1', email: 'user@test.local', role: 'viewer', is_active: true }
    const res = await requireAuth()
    assert.equal(res.error, null)
    assert.equal(res.profile?.id, 'user-1')
  })

  test('requireAdmin accepts admin and rejects viewer', async () => {
    const { requireAdmin } = await guardsPromise
    currentProfile = { id: 'viewer-1', email: 'viewer@test.local', role: 'viewer', is_active: true }
    const viewerRes = await requireAdmin()
    assert.ok(viewerRes.error?.includes('Admin role required'))

    currentProfile = { id: 'admin-1', email: 'admin@test.local', role: 'admin', is_active: true }
    const adminRes = await requireAdmin()
    assert.equal(adminRes.error, null)
    assert.equal(adminRes.profile?.role, 'admin')
  })

  test('requireEditor accepts admin and rejects viewer', async () => {
    const { requireEditor } = await guardsPromise
    currentProfile = { id: 'viewer-1', email: 'viewer@test.local', role: 'viewer', is_active: true }
    const viewerRes = await requireEditor()
    assert.equal(viewerRes.error, 'คุณไม่มีสิทธิ์แก้ไขข้อมูลสิ่งของ')

    currentProfile = { id: 'admin-1', email: 'admin@test.local', role: 'admin', is_active: true }
    const adminRes = await requireEditor()
    assert.equal(adminRes.error, null)
  })

  test('requireDeletePermission accepts admin only', async () => {
    const { requireDeletePermission } = await guardsPromise
    currentProfile = { id: 'viewer-1', email: 'viewer@test.local', role: 'viewer', is_active: true }
    const viewerRes = await requireDeletePermission()
    assert.equal(viewerRes.error, 'เฉพาะผู้ดูแลระบบเท่านั้นที่มีสิทธิ์ทำรายการนี้')

    currentProfile = { id: 'admin-1', email: 'admin@test.local', role: 'admin', is_active: true }
    const adminRes = await requireDeletePermission()
    assert.equal(adminRes.error, null)
  })

  test('requireSettingsManager accepts admin and rejects viewer', async () => {
    const { requireSettingsManager } = await guardsPromise
    currentProfile = { id: 'viewer-1', email: 'viewer@test.local', role: 'viewer', is_active: true }
    const viewerRes = await requireSettingsManager()
    assert.equal(viewerRes.error, 'เฉพาะผู้ดูแลระบบเท่านั้นที่สามารถจัดการตั้งค่าได้')

    currentProfile = { id: 'admin-1', email: 'admin@test.local', role: 'admin', is_active: true }
    const adminRes = await requireSettingsManager()
    assert.equal(adminRes.error, null)
  })
})
