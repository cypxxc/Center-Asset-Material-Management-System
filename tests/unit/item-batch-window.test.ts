import test from 'node:test'
import assert from 'node:assert/strict'
import { ItemBatchWindow, saveItemWindow, takeItemWindow } from '../../features/items/batch-window'
import type { ItemBatchResult, ItemListRow } from '../../features/items/types'

function batch(start: number, nextCursor: string | null = String(start + 25)): ItemBatchResult {
  return { items: Array.from({ length: 25 }, (_, i) => ({ id: String(start + i), item_name: `Item ${start + i}` } as ItemListRow)), nextCursor, total: start === 0 ? 1000 : null }
}
test('repeated auto/manual signals are single flight; end and duplicates preserve cursor slots', async () => {
  let resolve!: (value: ItemBatchResult) => void
  let calls = 0
  const window = new ItemBatchWindow(batch(0), () => { calls++; return new Promise(r => { resolve = r }) })
  const pending = window.loadMore()
  await window.loadMore(); await window.ensure(0, 25)
  assert.equal(calls, 1)
  resolve(batch(24, null)); await pending
  assert.equal(window.count, 50)
  assert.equal(window.at(25), null)
  assert.equal(window.at(26)?.id, '25')
  assert.equal(window.hasMore, false)
  await window.loadMore(); assert.equal(calls, 1)
})
test('errors pause auto loading and retry succeeds', async () => {
  let calls = 0
  const window = new ItemBatchWindow(batch(0), async () => { if (++calls === 1) throw new Error('offline'); return batch(25, null) })
  await window.ensure(0, 25)
  assert.equal(window.state.error, 'offline')
  await window.ensure(0, 25); assert.equal(calls, 1)
  await window.retry(); assert.equal(window.state.error, null); assert.equal(window.count, 50)
})
test('disposed old query cannot publish a late response, error or finally', async () => {
  let resolve!: (value: ItemBatchResult) => void
  const window = new ItemBatchWindow(batch(0), () => new Promise(r => { resolve = r }))
  const pending = window.loadMore()
  window.dispose()
  const snapshot = window.state
  resolve(batch(25)); await pending
  assert.equal(window.state, snapshot)
})
test('21st batch evicts distant records, preserves global slots and reloads on return', async () => {
  const cursors: (string | undefined)[] = []
  const window = new ItemBatchWindow(batch(0), async cursor => { cursors.push(cursor); return batch(Number(cursor ?? 0)) })
  for (let i = 1; i <= 25; i++) await window.ensure(i * 25 - 5, i * 25)
  assert.equal(window.count, 650)
  assert.equal(window.state.batches.filter(b => b.items).length, 20)
  assert.equal(window.state.batches.reduce((n, b) => n + (b.items?.length ?? 0), 0), 500)
  assert.equal(window.at(0), undefined)
  await window.ensure(0, 10)
  assert.equal(cursors.at(-1), undefined)
  assert.equal(window.at(0)?.id, '0')
  assert.equal(window.count, 650)
  assert.equal(window.state.batches.filter(b => b.items).length, 20)
})
test('refresh retains deep start and replaces stale following cursors atomically', async () => {
  let changed = false
  const cursors: (string | undefined)[] = []
  const window = new ItemBatchWindow(batch(0), async cursor => {
    cursors.push(cursor)
    return batch(Number(cursor ?? 0), changed ? null : undefined)
  })
  for (let i = 1; i <= 8; i++) await window.ensure(i * 25 - 5, i * 25)
  await window.ensure(150, 170)
  changed = true
  await window.refresh()
  assert.equal(cursors.at(-1), '150')
  assert.equal(window.at(150)?.id, '150')
  assert.equal(window.at(0), undefined)
  assert.equal(window.count, 175)
})
test('one return snapshot is user/query scoped, consumed and expires after five minutes', () => {
  const window = new ItemBatchWindow(batch(0), async () => batch(25))
  const snapshot = { identity: 'user:a/query:1', state: window.state, view: 'grid' as const, anchor: 123 }
  saveItemWindow(snapshot, 100)
  assert.equal(takeItemWindow('user:b/query:1', 200), undefined)
  assert.equal(takeItemWindow(snapshot.identity, 200), undefined)
  saveItemWindow(snapshot, 100)
  assert.equal(takeItemWindow(snapshot.identity, 300100), undefined)
  saveItemWindow(snapshot, 100)
  assert.equal(takeItemWindow(snapshot.identity, 200)?.anchor, 123)
  assert.equal(takeItemWindow(snapshot.identity, 201), undefined)
})

test('reloading a changed boundary does not deduplicate against discarded downstream records', async () => {
  let changed = false
  const window = new ItemBatchWindow(batch(0), async cursor => {
    const start = Number(cursor ?? 0)
    if (changed && start === 0) return batch(1, '26')
    return batch(start)
  })
  await window.loadMore()
  // Simulate eviction of the first batch while its downstream neighbour remains resident.
  window.state = { ...window.state, batches: window.state.batches.map((slot, index) => index === 0 ? { ...slot, items: undefined } : slot) }
  changed = true
  await window.ensure(0, 10)
  assert.equal(window.count, 25)
  assert.equal(window.at(24)?.id, '25', 'shifted record must survive when its stale downstream batch is discarded')
  assert.equal(window.state.batches[0].nextCursor, '26')
})
