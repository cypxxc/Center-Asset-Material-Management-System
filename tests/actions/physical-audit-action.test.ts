import '../setup/dom'
import test, { describe, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { mockSupabaseRegistry } from '../mocks/supabase'
import { logger, type LogPayload } from '@/lib/logging'
import { recordPhysicalAuditAction } from '@/features/items/actions'

describe('recordPhysicalAuditAction', () => {
  let auditLogs: LogPayload[] = []
  let originalLoggerInfo: typeof logger.info
  const originalSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const originalServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  const staffUser = {
    id: 'staff-user-001',
    email: 'staff@system.local',
  }
  const staffProfile = {
    id: 'staff-user-001',
    email: 'staff@system.local',
    role: 'staff',
    is_active: true,
    full_name: 'นายตรวจนับ พัสดุ',
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

    mockSupabaseRegistry.setAuth(staffUser, staffProfile)
  })

  afterEach(() => {
    logger.info = originalLoggerInfo
    process.env.NEXT_PUBLIC_SUPABASE_URL = originalSupabaseUrl
    process.env.SUPABASE_SERVICE_ROLE_KEY = originalServiceKey
    mockSupabaseRegistry.clear()
  })

  test('records PHYSICAL_AUDIT log when staff confirms asset check-in', async () => {
    const result = await recordPhysicalAuditAction('item-123', 'ตรวจพบสภาพปกติ ครบถ้วน')
    assert.equal(result.success, true)

    const auditEntry = auditLogs.find((l) => l.operation === 'PHYSICAL_AUDIT')
    assert.ok(auditEntry, 'PHYSICAL_AUDIT log should be emitted')
    assert.equal(auditEntry.userId, 'staff-user-001')
    assert.equal((auditEntry.details as any)?.targetId, 'item-123')
  })

  test('rejects audit check-in when user is unauthenticated', async () => {
    mockSupabaseRegistry.clear()
    const result = await recordPhysicalAuditAction('item-123')
    assert.equal(result.success, false)
    assert.ok(result.error)
  })
})
