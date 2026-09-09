import test from 'node:test'
import assert from 'node:assert/strict'
import { walkReportBatches } from './export-batches'

test('exports more than 5000 rows in bounded batches without dropping the last batch', async () => {
  let calls = 0
  let count = 0
  for await (const batch of walkReportBatches(async cursor => {
    calls++
    const start = cursor ? Number(cursor.value) : 0
    const end = Math.min(start + 500, 5501)
    const items = Array.from({ length: end - start }, (_, i) => ({ id: String(start + i + 1) }))
    return { items, next_cursor: end < 5501 ? { value: end, id: String(end) } : null }
  }, 5501)) {
    assert.ok(batch.length <= 500)
    count += batch.length
  }
  assert.equal(count, 5501)
  assert.equal(calls, 12)
})
test('does not silently complete truncated, duplicate or failed exports', async () => {
  const drain = async (source: AsyncIterable<unknown>) => { for await (const batch of source) void batch }
  await assert.rejects(drain(walkReportBatches(async () => ({ items: [], next_cursor: null }), 3)), /changed|incomplete/i)
  await assert.rejects(drain(walkReportBatches(async () => { throw new Error('RPC offline') }, 1)), /offline/)
  await assert.rejects(drain(walkReportBatches(async () => ({ items: [{ id: '1' }, { id: '1' }], next_cursor: null }), 2)), /duplicate/i)
  await assert.rejects(drain(walkReportBatches(async () => ({ items: [{ id: '1' }], next_cursor: { id: '1', value: 1 } }), 5)), /cursor|changed/i)
})
test('cancellation prevents fetching another batch', async () => {
  const controller = new AbortController()
  controller.abort()
  let called = false
  const iterator = walkReportBatches(async () => { called = true; return { items: [], next_cursor: null } }, 0, controller.signal)
  await assert.rejects(iterator.next())
  assert.equal(called, false)
})
