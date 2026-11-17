import { test } from 'node:test'
import assert from 'node:assert/strict'
import { config } from '@/lib/config'

test('config exposes version and limits', () => {
  assert.ok(config.app.version)
  assert.ok(config.limits.rateLimitDefault > 0)
  assert.ok(config.retry.maxAttempts >= 1)
})
