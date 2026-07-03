import { test } from 'node:test'
import assert from 'node:assert'
import { writeAuditLog } from '@/lib/audit'

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
