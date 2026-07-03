import { test } from 'node:test'
import assert from 'node:assert'
import { startTimer, measureExecution, measureExecutionSync } from '@/lib/performance'

test('startTimer measures elapsed time in milliseconds', async () => {
  const timer = startTimer()
  await new Promise((resolve) => setTimeout(resolve, 50))
  const duration = timer.stop()
  
  assert.ok(duration >= 45, `Expected duration to be at least 45ms, got ${duration}ms`)
  assert.ok(duration < 200, `Expected duration to be under 200ms, got ${duration}ms`)
})

test('measureExecutionSync measures synchronous execution time', () => {
  const { result, durationMs } = measureExecutionSync(() => {
    let sum = 0
    for (let i = 0; i < 100000; i++) {
      sum += i
    }
    return sum
  })
  
  assert.strictEqual(result, 4999950000)
  assert.ok(durationMs >= 0)
})

test('measureExecution measures asynchronous execution time', async () => {
  const { result, durationMs } = await measureExecution(async () => {
    await new Promise((resolve) => setTimeout(resolve, 30))
    return 'done'
  })
  
  assert.strictEqual(result, 'done')
  assert.ok(durationMs >= 25)
})
