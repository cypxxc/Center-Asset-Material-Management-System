import '../setup/dom'
import test, { describe, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { mockSupabaseRegistry } from '../mocks/supabase'
import { logger, type LogPayload } from '@/lib/logging'
import {
  upsertTableRow,
  deleteTableRow,
  createAuthUser,
  deleteAuthUser,
  resetAuthPassword,
  updateUserEmail,
  updateUserProfileRoleAndStatus,
} from '@/features/admin/actions'

describe('Admin Actions Audit Logging Integration Tests', () => {
  let auditLogs: LogPayload[] = []
  let originalLoggerInfo: typeof logger.info
  const originalSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const originalServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  const adminUser = {
    id: 'admin-user-001',
    email: 'admin@system.local',
  }
  const adminProfile = {
    id: 'admin-user-001',
    email: 'admin@system.local',
    role: 'admin',
    is_active: true,
    full_name: 'Super Admin',
  }

  beforeEach(() => {
    mockSupabaseRegistry.clear()
    auditLogs = []

    process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://127.0.0.1:54321'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'mock-service-role-key'

    originalLoggerInfo = logger.info
    logger.info = (payload: LogPayload) => {
      const details = payload.details as Record<string, unknown> | undefined
      if (details?.audit === true) {
        auditLogs.push(payload)
      }
      originalLoggerInfo(payload)
    }

    mockSupabaseRegistry.setAuth(adminUser, adminProfile)
  })

  afterEach(() => {
    logger.info = originalLoggerInfo
    process.env.NEXT_PUBLIC_SUPABASE_URL = originalSupabaseUrl
    process.env.SUPABASE_SERVICE_ROLE_KEY = originalServiceKey
    mockSupabaseRegistry.clear()
  })

  describe('Admin Table Operations', () => {
    test('upsertTableRow (INSERT) records structured audit log and persists to database', async () => {
      mockSupabaseRegistry.setAuth(adminUser, adminProfile)
      mockSupabaseRegistry.setTableResponse('categories', [
        { id: 'cat-new-1', name: 'IT Equipment', description: 'Laptops and monitors' },
      ])

      const result = await upsertTableRow('categories', null, {
        name: 'IT Equipment',
        description: 'Laptops and monitors',
      })

      assert.equal(result.success, true)
      assert.equal(result.data?.id, 'cat-new-1')

      // Verify audit log emitted via logger.info
      const auditLog = auditLogs.find((log) => log.operation === 'INSERT')
      assert.ok(auditLog, 'Expected audit log entry for INSERT')
      assert.equal(auditLog.operation, 'INSERT')
      assert.equal(auditLog.feature, 'admin')
      assert.equal(auditLog.userId, adminUser.id)
      assert.equal(auditLog.status, 'success')

      const details = auditLog.details as Record<string, unknown>
      assert.equal(details.audit, true)
      assert.equal(details.targetType, 'categories')
      assert.equal(details.targetId, 'cat-new-1')
      assert.deepEqual(details.newValues, {
        name: 'IT Equipment',
        description: 'Laptops and monitors',
      })

      // Verify database persistence to audit_logs
      const queryLog = mockSupabaseRegistry.getQueryLog()
      const auditInsert = queryLog.find(
        (entry) => entry.table === 'audit_logs' && entry.operations.some((op) => op[0] === 'insert')
      )
      assert.ok(auditInsert, 'Expected audit_logs insert in database')
      const insertPayload = auditInsert.operations.find((op) => op[0] === 'insert')?.[1] as Record<string, unknown>
      assert.equal(insertPayload.action, 'INSERT')
      assert.equal(insertPayload.target_table, 'categories')
      assert.equal(insertPayload.target_id, 'cat-new-1')
    })

    test('upsertTableRow (UPDATE) records structured audit log and persists to database', async () => {
      mockSupabaseRegistry.setAuth(adminUser, adminProfile)
      mockSupabaseRegistry.setTableResponse('categories', [
        { id: 'cat-existing-1', name: 'IT Equipment Updated', description: 'Updated description' },
      ])

      const result = await upsertTableRow('categories', 'cat-existing-1', {
        name: 'IT Equipment Updated',
        description: 'Updated description',
      })

      assert.equal(result.success, true)
      assert.equal(result.data?.id, 'cat-existing-1')

      const auditLog = auditLogs.find((log) => log.operation === 'UPDATE')
      assert.ok(auditLog, 'Expected audit log entry for UPDATE')
      assert.equal(auditLog.operation, 'UPDATE')
      assert.equal(auditLog.feature, 'admin')
      assert.equal(auditLog.userId, adminUser.id)
      assert.equal(auditLog.status, 'success')

      const details = auditLog.details as Record<string, unknown>
      assert.equal(details.audit, true)
      assert.equal(details.targetType, 'categories')
      assert.equal(details.targetId, 'cat-existing-1')
      assert.deepEqual(details.newValues, {
        name: 'IT Equipment Updated',
        description: 'Updated description',
      })
    })

    test('deleteTableRow records structured audit log with old values', async () => {
      mockSupabaseRegistry.setAuth(adminUser, adminProfile)
      const oldRow = {
        id: 'cat-delete-1',
        name: 'Office Furniture',
        description: 'Chairs and tables',
      }
      mockSupabaseRegistry.setTableResponse('categories', oldRow)

      const result = await deleteTableRow('categories', 'cat-delete-1')

      assert.equal(result.success, true)

      const auditLog = auditLogs.find((log) => log.operation === 'DELETE')
      assert.ok(auditLog, 'Expected audit log entry for DELETE')
      assert.equal(auditLog.operation, 'DELETE')
      assert.equal(auditLog.feature, 'admin')
      assert.equal(auditLog.userId, adminUser.id)
      assert.equal(auditLog.status, 'success')

      const details = auditLog.details as Record<string, unknown>
      assert.equal(details.audit, true)
      assert.equal(details.targetType, 'categories')
      assert.equal(details.targetId, 'cat-delete-1')
      assert.deepEqual(details.oldValues, oldRow)
    })
  })

  describe('Admin User Management Operations', () => {
    test('createAuthUser records structured CREATE_USER audit log', async () => {
      mockSupabaseRegistry.setAuth(adminUser, adminProfile)
      mockSupabaseRegistry.setTableResponseForClient('profiles', 'service', [])

      const result = await createAuthUser({
        email: 'staff.member@example.com',
        password: 'securePassword123',
        full_name: 'Staff Member',
        role: 'staff',
        is_active: true,
      })

      assert.equal(result.success, true)
      assert.ok(result.userId)

      const auditLog = auditLogs.find((log) => log.operation === 'CREATE_USER')
      assert.ok(auditLog, 'Expected audit log entry for CREATE_USER')
      assert.equal(auditLog.operation, 'CREATE_USER')
      assert.equal(auditLog.feature, 'admin')
      assert.equal(auditLog.userId, adminUser.id)
      assert.equal(auditLog.status, 'success')

      const details = auditLog.details as Record<string, unknown>
      assert.equal(details.audit, true)
      assert.equal(details.targetType, 'profiles')
      assert.equal(details.targetId, result.userId)
      assert.deepEqual(details.newValues, {
        email: 'staff.member@example.com',
        full_name: 'Staff Member',
        role: 'staff',
      })
    })

    test('deleteAuthUser records structured DELETE_USER audit log', async () => {
      mockSupabaseRegistry.setAuth(adminUser, adminProfile)
      const targetUserId = 'target-user-to-remove'

      const result = await deleteAuthUser(targetUserId)

      assert.equal(result.success, true)

      const auditLog = auditLogs.find((log) => log.operation === 'DELETE_USER')
      assert.ok(auditLog, 'Expected audit log entry for DELETE_USER')
      assert.equal(auditLog.operation, 'DELETE_USER')
      assert.equal(auditLog.feature, 'admin')
      assert.equal(auditLog.userId, adminUser.id)
      assert.equal(auditLog.status, 'success')

      const details = auditLog.details as Record<string, unknown>
      assert.equal(details.audit, true)
      assert.equal(details.targetType, 'profiles')
      assert.equal(details.targetId, targetUserId)
    })

    test('resetAuthPassword records structured RESET_PASSWORD audit log', async () => {
      mockSupabaseRegistry.setAuth(adminUser, adminProfile)
      const targetUserId = 'target-user-password-reset'

      const result = await resetAuthPassword(targetUserId, 'newPassword456!')

      assert.equal(result.success, true)

      const auditLog = auditLogs.find((log) => log.operation === 'RESET_PASSWORD')
      assert.ok(auditLog, 'Expected audit log entry for RESET_PASSWORD')
      assert.equal(auditLog.operation, 'RESET_PASSWORD')
      assert.equal(auditLog.feature, 'admin')
      assert.equal(auditLog.userId, adminUser.id)
      assert.equal(auditLog.status, 'success')

      const details = auditLog.details as Record<string, unknown>
      assert.equal(details.audit, true)
      assert.equal(details.targetType, 'profiles')
      assert.equal(details.targetId, targetUserId)
      assert.deepEqual(details.newValues, { note: 'Password reset by admin' })
    })

    test('updateUserEmail records structured UPDATE_EMAIL audit log', async () => {
      mockSupabaseRegistry.setAuth(adminUser, adminProfile)
      const targetUserId = 'target-user-email-change'
      const newEmail = 'brand.new@example.com'

      const result = await updateUserEmail(targetUserId, newEmail)

      assert.equal(result.success, true)

      const auditLog = auditLogs.find((log) => log.operation === 'UPDATE_EMAIL')
      assert.ok(auditLog, 'Expected audit log entry for UPDATE_EMAIL')
      assert.equal(auditLog.operation, 'UPDATE_EMAIL')
      assert.equal(auditLog.feature, 'admin')
      assert.equal(auditLog.userId, adminUser.id)
      assert.equal(auditLog.status, 'success')

      const details = auditLog.details as Record<string, unknown>
      assert.equal(details.audit, true)
      assert.equal(details.targetType, 'profiles')
      assert.equal(details.targetId, targetUserId)
      assert.deepEqual(details.newValues, { new_email: newEmail })
    })

    test('updateUserProfileRoleAndStatus records structured UPDATE_PROFILE audit log', async () => {
      mockSupabaseRegistry.setAuth(adminUser, adminProfile)
      const targetUserId = 'target-user-profile-change'
      const oldProfile = {
        id: targetUserId,
        full_name: 'Original Name',
        email: 'orig@example.com',
        role: 'viewer',
        is_active: true,
      }
      mockSupabaseRegistry.setTableResponseForClient('profiles', 'service', [oldProfile])

      const result = await updateUserProfileRoleAndStatus(targetUserId, {
        role: 'staff',
        is_active: false,
        full_name: 'Updated Name',
      })

      assert.equal(result.success, true)

      const auditLog = auditLogs.find((log) => log.operation === 'UPDATE_PROFILE')
      assert.ok(auditLog, 'Expected audit log entry for UPDATE_PROFILE')
      assert.equal(auditLog.operation, 'UPDATE_PROFILE')
      assert.equal(auditLog.feature, 'admin')
      assert.equal(auditLog.userId, adminUser.id)
      assert.equal(auditLog.status, 'success')

      const details = auditLog.details as Record<string, unknown>
      assert.equal(details.audit, true)
      assert.equal(details.targetType, 'profiles')
      assert.equal(details.targetId, targetUserId)
      assert.deepEqual(details.oldValues, oldProfile)

      const newValues = details.newValues as Record<string, unknown>
      assert.equal(newValues.role, 'staff')
      assert.equal(newValues.is_active, false)
      assert.equal(newValues.full_name, 'Updated Name')
      assert.ok(newValues.updated_at)
    })
  })

  describe('Authorization and Rejection Handling', () => {
    test('non-admin role is rejected and does not emit audit logs', async () => {
      mockSupabaseRegistry.setAuth(
        { id: 'user-viewer', email: 'viewer@example.com' },
        { id: 'user-viewer', email: 'viewer@example.com', role: 'viewer', is_active: true }
      )

      const upsertRes = await upsertTableRow('categories', null, { name: 'Unauthorized' })
      assert.ok(upsertRes.error)
      assert.match(upsertRes.error, /Admin role required/i)

      const deleteRes = await deleteTableRow('categories', 'some-id')
      assert.ok(deleteRes.error)
      assert.match(deleteRes.error, /Admin role required/i)

      const createUserRes = await createAuthUser({
        email: 'test@example.com',
        password: 'password123',
        full_name: 'Test',
        role: 'viewer',
        is_active: true,
      })
      assert.ok(createUserRes.error)
      assert.match(createUserRes.error, /Admin role required/i)

      const deleteUserRes = await deleteAuthUser('some-user')
      assert.ok(deleteUserRes.error)
      assert.match(deleteUserRes.error, /Admin role required/i)

      const resetPwRes = await resetAuthPassword('some-user', 'newpassword123')
      assert.ok(resetPwRes.error)
      assert.match(resetPwRes.error, /Admin role required/i)

      const updateEmailRes = await updateUserEmail('some-user', 'test@example.com')
      assert.ok(updateEmailRes.error)
      assert.match(updateEmailRes.error, /Admin role required/i)

      const updateProfileRes = await updateUserProfileRoleAndStatus('some-user', { role: 'staff' })
      assert.ok(updateProfileRes.error)
      assert.match(updateProfileRes.error, /Admin role required/i)

      assert.equal(auditLogs.length, 0, 'No audit logs should be emitted on unauthorized calls')
    })
  })
})
