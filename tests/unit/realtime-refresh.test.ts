import assert from 'node:assert/strict'
import { test } from 'node:test'
import { startRealtimeRefresh } from '../../hooks/realtime-refresh-controller'

function setup() {
  const visibility = new EventTarget() as EventTarget & { visibilityState: DocumentVisibilityState }
  visibility.visibilityState = 'visible'
  let refreshes = 0
  let removed = 0
  const subscriptions: { tables: string[]; change: () => void }[] = []
  const start = (tables = ['items', 'categories'], enabled = true) => startRealtimeRefresh({
    tables, enabled, visibility,
    refresh: () => { refreshes++ },
    subscribe: (subscribedTables, change) => {
      subscriptions.push({ tables: subscribedTables, change })
      return () => { removed++ }
    },
  })
  const hide = (state: DocumentVisibilityState) => {
    visibility.visibilityState = state
    visibility.dispatchEvent(new Event('visibilitychange'))
  }
  return { start, subscriptions, hide, get refreshes() { return refreshes }, get removed() { return removed } }
}

test('no mount refresh; changes from subscribed tables share a 750ms trailing debounce', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  const s = setup()
  const stop = s.start()
  assert.equal(s.refreshes, 0)
  assert.deepEqual(s.subscriptions[0].tables, ['items', 'categories'])
  s.subscriptions[0].change()
  t.mock.timers.tick(500)
  s.subscriptions[0].change()
  t.mock.timers.tick(749)
  assert.equal(s.refreshes, 0)
  t.mock.timers.tick(1)
  assert.equal(s.refreshes, 1)
  stop()
})

test('hidden changes and pending visible changes flush once when visible', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  const s = setup()
  const stop = s.start()
  s.subscriptions[0].change()
  s.hide('hidden')
  for (let i = 0; i < 10; i++) s.subscriptions[0].change()
  t.mock.timers.tick(10_000)
  assert.equal(s.refreshes, 0)
  s.hide('visible')
  assert.equal(s.refreshes, 1)
  s.hide('visible')
  t.mock.timers.tick(10_000)
  assert.equal(s.refreshes, 1)
  stop()
})

test('continuous events refresh within five seconds', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  const s = setup()
  const stop = s.start()
  for (let i = 0; i < 10; i++) {
    s.subscriptions[0].change()
    t.mock.timers.tick(500)
  }
  assert.equal(s.refreshes, 1)
  stop()
})

test('cleanup cancels timers, visibility handling, subscription and late events', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  const s = setup()
  const stop = s.start()
  s.subscriptions[0].change()
  stop()
  stop()
  s.subscriptions[0].change()
  s.hide('visible')
  t.mock.timers.tick(10_000)
  assert.equal(s.refreshes, 0)
  assert.equal(s.removed, 1)
})

test('disabled or empty subscriptions do nothing; table changes start a clean lifecycle', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  const s = setup()
  s.start(['items'], false)()
  s.start([])()
  assert.equal(s.subscriptions.length, 0)
  const stopItems = s.start(['items'])
  s.subscriptions[0].change()
  stopItems()
  const stopLocations = s.start(['locations'])
  t.mock.timers.tick(750)
  assert.equal(s.refreshes, 0)
  assert.deepEqual(s.subscriptions[1].tables, ['locations'])
  s.subscriptions[1].change()
  t.mock.timers.tick(750)
  assert.equal(s.refreshes, 1)
  stopLocations()
})
