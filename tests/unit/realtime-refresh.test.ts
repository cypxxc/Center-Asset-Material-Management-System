import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createTransitionCompletion, startRealtimeRefresh } from '../../hooks/realtime-refresh-controller'

function setup(debounceMs = 750, holdRefresh = false) {
  const visibility = new EventTarget() as EventTarget & { visibilityState: DocumentVisibilityState }
  visibility.visibilityState = 'visible'
  let refreshes = 0
  let removed = 0
  let completeRefresh: (() => void) | undefined
  const subscriptions: { tables: string[]; change: () => void }[] = []
  const start = (tables = ['items', 'categories'], enabled = true) => startRealtimeRefresh({
    tables, enabled, visibility, debounceMs,
    refresh: (complete: () => void) => {
      refreshes++
      completeRefresh = complete
      if (!holdRefresh) complete()
    },
    subscribe: (subscribedTables, change) => {
      subscriptions.push({ tables: subscribedTables, change })
      return () => { removed++ }
    },
  })
  const hide = (state: DocumentVisibilityState) => {
    visibility.visibilityState = state
    visibility.dispatchEvent(new Event('visibilitychange'))
  }
  return { start, subscriptions, hide, complete: () => completeRefresh?.(), get refreshes() { return refreshes }, get removed() { return removed } }
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


test('a custom debounce coalesces a burst across tables', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  const s = setup(2500)
  const stop = s.start()
  s.subscriptions[0].change()
  t.mock.timers.tick(2000)
  s.subscriptions[0].change()
  t.mock.timers.tick(2499)
  assert.equal(s.refreshes, 0)
  t.mock.timers.tick(1)
  assert.equal(s.refreshes, 1)
  stop()
})

test('continuous custom-debounce events still flush within five seconds', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  const s = setup(2500)
  const stop = s.start()
  for (let i = 0; i < 10; i++) {
    s.subscriptions[0].change()
    t.mock.timers.tick(500)
  }
  assert.equal(s.refreshes, 1)
  stop()
})

test('pending refresh blocks max-wait and coalesces queued events after completion', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  const s = setup(2500, true)
  const stop = s.start()
  s.subscriptions[0].change()
  t.mock.timers.tick(2500)
  for (let i = 0; i < 20; i++) {
    s.subscriptions[0].change()
    t.mock.timers.tick(500)
  }
  assert.equal(s.refreshes, 1)
  s.complete()
  assert.equal(s.refreshes, 2)
  s.complete()
  t.mock.timers.tick(10000)
  assert.equal(s.refreshes, 2)
  stop()
})

test('completion preserves an unexpired trailing debounce', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  const s = setup(2500, true)
  const stop = s.start()
  s.subscriptions[0].change()
  t.mock.timers.tick(2500)
  s.subscriptions[0].change()
  t.mock.timers.tick(1000)
  s.complete()
  assert.equal(s.refreshes, 1)
  t.mock.timers.tick(1500)
  assert.equal(s.refreshes, 2)
  stop()
})

test('pending completion defers hidden changes and cleanup ignores late completion', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  const s = setup(2500, true)
  const stop = s.start()
  s.subscriptions[0].change()
  t.mock.timers.tick(2500)
  s.hide('hidden')
  s.subscriptions[0].change()
  t.mock.timers.tick(10000)
  s.complete()
  assert.equal(s.refreshes, 1)
  s.hide('visible')
  assert.equal(s.refreshes, 2)
  s.subscriptions[0].change()
  stop()
  s.complete()
  s.hide('visible')
  t.mock.timers.tick(10000)
  assert.equal(s.refreshes, 2)
  assert.equal(s.removed, 1)
})


test('transition completion waits for the pending edge and ignores cancelled lifecycles', () => {
  const transition = createTransitionCompletion()
  let completions = 0
  transition.begin(() => { completions++ })
  transition.observe(false)
  assert.equal(completions, 0)
  transition.observe(true)
  transition.observe(false)
  transition.observe(false)
  assert.equal(completions, 1)
  transition.begin(() => { completions++ })
  transition.observe(true)
  transition.cancel()
  transition.observe(false)
  assert.equal(completions, 1)
  transition.begin(() => { completions++ })
  transition.observe(false)
  assert.equal(completions, 1)
  transition.observe(true)
  transition.observe(false)
  assert.equal(completions, 2)
})


test('a synchronous refresh failure does not block later changes', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  const visibility = new EventTarget() as EventTarget & { visibilityState: DocumentVisibilityState }
  visibility.visibilityState = 'visible'
  let change = () => {}
  let attempts = 0
  const stop = startRealtimeRefresh({
    tables: ['items'], enabled: true, visibility,
    subscribe: (_tables, onChange) => { change = onChange; return () => {} },
    refresh: (complete) => {
      attempts++
      if (attempts === 1) throw new Error('refresh failed')
      complete()
    },
  })
  change()
  assert.throws(() => t.mock.timers.tick(750), /refresh failed/)
  change()
  t.mock.timers.tick(750)
  assert.equal(attempts, 2)
  stop()
})
