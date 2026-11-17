import { test } from 'node:test'
import assert from 'node:assert/strict'
import { retry } from '@/lib/retry'

test('retry succeeds on first attempt', async () => {
  let calls = 0
  const result = await retry(async () => {
    calls++
    return 'ok'
  })
  assert.equal(result, 'ok')
  assert.equal(calls, 1)
})

test('retry retries transient errors then succeeds', async () => {
  let calls = 0
  const result = await retry(
    async () => {
      calls++
      if (calls < 3) throw new Error('fetch failed')
      return 'ok'
    },
    { baseDelayMs: 1, maxDelayMs: 5 },
  )
  assert.equal(result, 'ok')
  assert.equal(calls, 3)
})

test('retry throws after max attempts on persistent failure', async () => {
  let calls = 0
  await assert.rejects(
    () =>
      retry(
        async () => {
          calls++
          throw new Error('econnreset')
        },
        { maxAttempts: 2, baseDelayMs: 1 },
      ),
    /econnreset/,
  )
  assert.equal(calls, 2)
})

test('retry does not retry non-transient errors', async () => {
  let calls = 0
  await assert.rejects(
    () =>
      retry(async () => {
        calls++
        throw new Error('validation failed')
      }),
    /validation failed/,
  )
  assert.equal(calls, 1)
})
