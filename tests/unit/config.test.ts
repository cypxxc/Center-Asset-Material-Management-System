import { test } from 'node:test'
import assert from 'node:assert/strict'
import { config, validateEnvConfig } from '@/lib/config'

test('config exposes version and limits', () => {
  assert.ok(config.app.version)
  assert.ok(config.limits.rateLimitDefault > 0)
  assert.ok(config.retry.maxAttempts >= 1)
})

test('validateEnvConfig detects missing keys', () => {
  const result = validateEnvConfig({})
  assert.equal(result.valid, false)
  assert.ok(result.missing.includes('NEXT_PUBLIC_SUPABASE_URL'))
})

test('validateEnvConfig passes when all required keys set', () => {
  const result = validateEnvConfig({
    NEXT_PUBLIC_SUPABASE_URL: 'https://x.supabase.co',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon-key-value-here',
    SUPABASE_SERVICE_ROLE_KEY: 'service-role-key-value',
  })
  assert.equal(result.valid, true)
  assert.equal(result.missing.length, 0)
})
