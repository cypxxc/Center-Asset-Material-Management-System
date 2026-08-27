import test from 'node:test'
import assert from 'node:assert/strict'
import { MemoryRateLimiter, RATE_LIMIT_TIERS, getRateLimiter, checkRateLimit } from './rate-limit'

test('MemoryRateLimiter enforces sliding window limits and resets properly', async () => {
  const limiter = new MemoryRateLimiter(100)
  const key = 'test-ip:test-action'

  for (let i = 0; i < 5; i++) {
    const res = await limiter.limit(key, 5, 1000)
    assert.equal(res.success, true)
  }

  // 6th request should fail
  const blockedRes = await limiter.limit(key, 5, 1000)
  assert.equal(blockedRes.success, false)
  assert.equal(blockedRes.remaining, 0)
  assert.ok(blockedRes.reset > Date.now())
})

test('RATE_LIMIT_TIERS configuration defines correct security thresholds', () => {
  assert.equal(RATE_LIMIT_TIERS.auth.limit, 10)
  assert.equal(RATE_LIMIT_TIERS.auth.windowMs, 60000)
  assert.equal(RATE_LIMIT_TIERS.mutation.limit, 30)
  assert.equal(RATE_LIMIT_TIERS.mutation.windowMs, 60000)
  assert.equal(RATE_LIMIT_TIERS.export.limit, 20)
  assert.equal(RATE_LIMIT_TIERS.export.windowMs, 60000)
  assert.equal(RATE_LIMIT_TIERS.read.limit, 120)
  assert.equal(RATE_LIMIT_TIERS.read.windowMs, 60000)
})

test('checkRateLimit handles tier names and numeric limits gracefully outside request context', async () => {
  const resAuth = await checkRateLimit('test-auth', 'auth')
  assert.equal(resAuth.success, true)

  const resMutation = await checkRateLimit('test-mutation', 'mutation')
  assert.equal(resMutation.success, true)

  const resExport = await checkRateLimit('test-export', 'export')
  assert.equal(resExport.success, true)

  const resRead = await checkRateLimit('test-read', 'read')
  assert.equal(resRead.success, true)

  const resCustom = await checkRateLimit('test-custom', 50, 30000)
  assert.equal(resCustom.success, true)

  const resDefault = await checkRateLimit('test-default')
  assert.equal(resDefault.success, true)
})

test('getRateLimiter returns MemoryRateLimiter singleton', () => {
  const limiter1 = getRateLimiter()
  const limiter2 = getRateLimiter()
  assert.equal(limiter1, limiter2)
  assert.ok(limiter1 instanceof MemoryRateLimiter)
})

test('MemoryRateLimiter isolates different keys', async () => {
  const limiter = new MemoryRateLimiter()
  const key1 = 'user-1:ip-1:action-a'
  const key2 = 'user-2:ip-2:action-a'

  const res1 = await limiter.limit(key1, 1, 1000)
  assert.equal(res1.success, true)
  const blocked1 = await limiter.limit(key1, 1, 1000)
  assert.equal(blocked1.success, false)

  // key2 is independent and must succeed
  const res2 = await limiter.limit(key2, 1, 1000)
  assert.equal(res2.success, true)
})

test('MemoryRateLimiter evicts oldest key when maxKeys capacity is exceeded', async () => {
  const limiter = new MemoryRateLimiter(2)
  await limiter.limit('key-1', 5, 10000)
  await limiter.limit('key-2', 5, 10000)
  // Adding 3rd key should evict oldest (key-1)
  await limiter.limit('key-3', 5, 10000)

  // key-1 should start fresh if called again
  const res1 = await limiter.limit('key-1', 5, 10000)
  assert.equal(res1.remaining, 4)
})

test('MemoryRateLimiter accurately tracks remaining requests count', async () => {
  const limiter = new MemoryRateLimiter()
  const key = 'test-remaining-tracker'

  const r1 = await limiter.limit(key, 3, 5000)
  assert.equal(r1.success, true)
  assert.equal(r1.remaining, 2)

  const r2 = await limiter.limit(key, 3, 5000)
  assert.equal(r2.success, true)
  assert.equal(r2.remaining, 1)

  const r3 = await limiter.limit(key, 3, 5000)
  assert.equal(r3.success, true)
  assert.equal(r3.remaining, 0)

  const r4 = await limiter.limit(key, 3, 5000)
  assert.equal(r4.success, false)
  assert.equal(r4.remaining, 0)
})
