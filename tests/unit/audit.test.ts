import { test } from 'node:test'
import assert from 'node:assert'
import { writeAuditLog } from '@/lib/audit'
import { logger } from '@/lib/logging'

test('writeAuditLog formats logs and runs without throwing outside request context', async () => {
  const payload = {
    operation: 'test-operation',
    feature: 'test-feature',
    userId: 'user-id-123',
    targetType: 'test_table',
    targetId: 'target-id-456',
    oldValues: { name: 'old' },
    newValues: { name: 'new' }
  }

  // Should complete successfully even without next/headers context
  await assert.doesNotReject(async () => {
    await writeAuditLog(payload)
  })
})

test('writeAuditLog logs audit_failure diagnostics when database persistence fails', async () => {
  const originalUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const originalKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const originalLoggerError = logger.error

  process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://127.0.0.1:9999'
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'dummy-key'

  const loggedErrors: Array<{ payload: Record<string, unknown>; error?: unknown }> = []
  logger.error = (payload: Record<string, unknown>, err?: unknown) => {
    loggedErrors.push({ payload, error: err })
  }

  try {
    const payload = {
      operation: 'test-failing-audit',
      feature: 'test-feature',
      userId: 'user-789',
      targetType: 'items',
      targetId: 'item-999',
    }

    await writeAuditLog(payload)

    const auditFailureLog = loggedErrors.find(
      (entry) => entry.payload.operation === 'writeAuditLogDb'
    )

    assert.ok(auditFailureLog, 'Expected a logger.error entry for writeAuditLogDb')
    assert.strictEqual(auditFailureLog.payload.operation, 'writeAuditLogDb')
    assert.strictEqual(auditFailureLog.payload.feature, 'audit')
    assert.strictEqual(auditFailureLog.payload.audit_failure, true)
    assert.strictEqual(auditFailureLog.payload.userId, 'user-789')
    assert.strictEqual(auditFailureLog.payload.targetTable, 'items')
    assert.strictEqual(auditFailureLog.payload.targetId, 'item-999')
  } finally {
    process.env.NEXT_PUBLIC_SUPABASE_URL = originalUrl
    process.env.SUPABASE_SERVICE_ROLE_KEY = originalKey
    logger.error = originalLoggerError
  }
})
