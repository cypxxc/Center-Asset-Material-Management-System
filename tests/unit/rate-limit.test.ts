import { test } from 'node:test'
import assert from 'node:assert'
import { MemoryRateLimiter } from '@/lib/rate-limit/memory-rate-limiter'
import { getRateLimiter, checkRateLimit } from '@/lib/rate-limit'

test('MemoryRateLimiter enforces sliding window limits', async () => {
  const limiter = new MemoryRateLimiter()
  const key = 'test-client-ip'

  // 1. First 2 requests should be successful
  const r1 = await limiter.limit(key, 2, 1000)
  assert.strictEqual(r1.success, true)
  assert.strictEqual(r1.remaining, 1)

  const r2 = await limiter.limit(key, 2, 1000)
  assert.strictEqual(r2.success, true)
  assert.strictEqual(r2.remaining, 0)

  // 2. Third request should be blocked (rate limited)
  const r3 = await limiter.limit(key, 2, 1000)
  assert.strictEqual(r3.success, false)
  assert.strictEqual(r3.remaining, 0)
  assert.ok(r3.reset > Date.now())
})

test('getRateLimiter returns MemoryRateLimiter singleton', () => {
  const limiter1 = getRateLimiter()
  const limiter2 = getRateLimiter()
  assert.strictEqual(limiter1, limiter2)
  assert.ok(limiter1 instanceof MemoryRateLimiter)
})

test('checkRateLimit returns success: true outside request context (graceful fallback)', async () => {
  const result = await checkRateLimit('test-action')
  assert.strictEqual(result.success, true)
})
