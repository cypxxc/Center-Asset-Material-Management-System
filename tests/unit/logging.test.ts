// tests/unit/logging.test.ts
import { test } from 'node:test'
import assert from 'node:assert'
import { formatLog, logger } from '@/lib/logging'

test('formatLog sanitizes sensitive fields and keys', () => {
  const payload = {
    operation: 'testOp',
    feature: 'testFeature',
    userId: 'user-123',
    details: {
      password: 'super-secret-password',
      accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c',
      apiKey: 'sbp_1234567890abcdef1234567890abcdef',
      normalField: 'all-clear',
      nested: {
        sessionToken: 'xyz-token',
        userSecret: 'keep-private'
      }
    }
  }

  const resultStr = formatLog('INFO', payload)
  const result = JSON.parse(resultStr)

  // Verify non-sensitive elements are preserved
  assert.strictEqual(result.level, 'INFO')
  assert.strictEqual(result.operation, 'testOp')
  assert.strictEqual(result.feature, 'testFeature')
  assert.strictEqual(result.userId, 'user-123')
  assert.strictEqual(result.details.normalField, 'all-clear')

  // Verify sensitive keys are redacted
  assert.strictEqual(result.details.password, '[REDACTED]')
  assert.strictEqual(result.details.accessToken, '[REDACTED]')
  assert.strictEqual(result.details.apiKey, '[REDACTED]')
  assert.strictEqual(result.details.nested.sessionToken, '[REDACTED]')
  assert.strictEqual(result.details.nested.userSecret, '[REDACTED]')
})

test('formatLog sanitizes inline secrets within strings', () => {
  const payload = {
    operation: 'testOp',
    feature: 'testFeature',
    details: {
      url: 'http://localhost:3000/?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c',
      message: 'Failed connection using key sbp_1234567890abcdef1234567890abcdef on server'
    }
  }

  const resultStr = formatLog('ERROR', payload)
  const result = JSON.parse(resultStr)

  assert.strictEqual(result.details.url, 'http://localhost:3000/?token=[JWT_TOKEN_REDACTED]')
  assert.strictEqual(result.details.message, 'Failed connection using key [KEY_REDACTED] on server')
})

test('formatLog includes environment, latency, and requestId', () => {
  const payload = {
    operation: 'latencyTest',
    feature: 'performance',
    requestId: 'req-uuid-456',
    latency: 12.34,
    environment: 'staging',
    details: 'some-info'
  }

  const resultStr = formatLog('INFO', payload)
  const result = JSON.parse(resultStr)

  assert.strictEqual(result.requestId, 'req-uuid-456')
  assert.strictEqual(result.latency, 12.34)
  assert.strictEqual(result.environment, 'staging')
})

test('formatLog sanitizes secrets in Error message and stack', () => {
  const secret = 'sbp_1234567890abcdef1234567890abcdef'
  const error = new Error(`connection failed with ${secret}`)
  error.stack = `Error: ${secret}\n at test`

  const result = JSON.parse(formatLog('ERROR', { operation: 'test', feature: 'logging' }, error))

  assert.equal(result.error_message, 'connection failed with [KEY_REDACTED]')
  assert.equal(result.error_stack, 'Error: [KEY_REDACTED]\n at test')
  assert.equal(JSON.stringify(result).includes(secret), false)
})

test('formatLog sanitizes non-Error diagnostic strings', () => {
  const result = JSON.parse(formatLog(
    'ERROR',
    { operation: 'test', feature: 'logging' },
    'token eyJabcdefghij.abcdefghij.abcdefghij',
  ))
  assert.equal(result.error_message.includes('eyJabcdefghij'), false)
})

test('logger object supports info, warn, error, audit, and debug methods', () => {
  // Make sure calling these does not crash
  logger.info({ operation: 'test', feature: 'test' })
  logger.warn({ operation: 'test', feature: 'test' })
  logger.error({ operation: 'test', feature: 'test' }, new Error('test-err'))
  logger.audit({ operation: 'test', feature: 'test' })
  logger.debug({ operation: 'test', feature: 'test' })
  assert.ok(true)
})

