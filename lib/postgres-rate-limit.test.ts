import test from 'node:test'
import assert from 'node:assert/strict'
import { PostgresRateLimiter } from './postgres-rate-limit'

test('delegates each attempt to shared storage and hashes the identity', async () => {
  const calls: Record<string, unknown>[] = []
  const rpc = async (_name: string, args: Record<string, unknown>) => {
    calls.push(args)
    return { data: { success: calls.length <= 1, remaining: 0, reset: Date.now() + 60000 }, error: null }
  }
  assert.equal((await new PostgresRateLimiter(rpc).limit('private-user:ip', 1, 60000)).success, true)
  assert.equal((await new PostgresRateLimiter(rpc).limit('private-user:ip', 1, 60000)).success, false)
  assert.deepEqual(calls[0], calls[1])
  assert.match(String(calls[0].bucket_key), /^[a-f0-9]{64}$/)
})
test('fails closed on storage errors, invalid responses and invalid limits', async () => {
  for (const response of [{ data: null, error: { message: 'offline' } }, { data: {}, error: null }, { data: { success: 'true', remaining: 1, reset: 4 }, error: null }]) {
    await assert.rejects(new PostgresRateLimiter(async () => response).limit('key', 1, 1000))
  }
  await assert.rejects(new PostgresRateLimiter(async () => { throw new Error('offline') }).limit('key', 1, 1000))
  await assert.rejects(new PostgresRateLimiter(async () => { throw new Error('must not run') }).limit('key', 0, 1000), /Invalid/)
})
