import { test } from 'node:test'
import assert from 'node:assert/strict'
import { securityVerifyTool } from './security'
import { runToolPipeline } from '../pipeline'

test('securityVerifyTool verifies security posture with admin role', async () => {
  const adminContext = { actor: { role: 'admin' as const, isActive: true } }
  const result = await runToolPipeline(securityVerifyTool, {}, adminContext)
  assert.equal(result.success, true)
  if (result.success) {
    assert.equal(result.data.status, 'SECURE')
    assert.ok(result.data.headersCount >= 5)
    assert.ok(result.data.rateLimitTiers.includes('auth'))
    assert.ok(result.data.rateLimitTiers.includes('mutation'))
  }
})

test('securityVerifyTool rejects non-admin users', async () => {
  const staffContext = { actor: { role: 'staff' as const, isActive: true } }
  const result = await runToolPipeline(securityVerifyTool, {}, staffContext)
  assert.equal(result.success, false)
  if (!result.success) {
    assert.equal(result.error.code, 'UNAUTHORIZED_ERROR')
  }
})
