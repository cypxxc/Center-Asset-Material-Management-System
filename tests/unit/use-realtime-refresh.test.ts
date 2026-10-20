import '../setup/dom'
import test from 'node:test'
import assert from 'node:assert/strict'
import { renderHook, act } from '@testing-library/react'
import { useRealtimeRefresh } from '../../hooks/use-realtime-refresh'

// Mock next/navigation
let refreshed = false
const nextNavigationPath = require.resolve('next/navigation')
const nextNavigation = require.cache[nextNavigationPath]?.exports as {
  useRouter: () => { push: (url: string) => void; refresh: () => void }
}

const originalUseRouter = nextNavigation.useRouter
nextNavigation.useRouter = () => ({
  push: () => {},
  refresh: () => { refreshed = true },
})

class MockEventSource {
  static instances: MockEventSource[] = []
  url: string
  closed = false
  onmessage: ((ev: { data: string }) => void) | null = null
  onerror: (() => void) | null = null

  constructor(url: string) {
    this.url = url
    MockEventSource.instances.push(this)
  }

  close() {
    this.closed = true
  }

  emit(data: string) {
    this.onmessage?.({ data })
  }
}

test('useRealtimeRefresh ignores initial reconnect event but triggers on actual table events and subsequent reconnects', async () => {
  const originalBackend = process.env.NEXT_PUBLIC_DATA_BACKEND
  const originalEventSource = global.EventSource
  process.env.NEXT_PUBLIC_DATA_BACKEND = 'postgres'
  // @ts-expect-error Mocking EventSource for unit test
  global.EventSource = MockEventSource
  MockEventSource.instances = []
  refreshed = false

  try {
    const { unmount } = renderHook(() => useRealtimeRefresh(['items', 'categories']))

    assert.equal(MockEventSource.instances.length, 1)
    const es = MockEventSource.instances[0]
    assert.ok(es.url.includes('api/events'))

    // 1. Initial connection handshake emits 'reconnect' -> MUST NOT refresh
    act(() => {
      es.emit('reconnect')
    })
    await new Promise((r) => setTimeout(r, 200))
    assert.equal(refreshed, false, 'Initial reconnect handshake must not trigger router.refresh()')

    // 2. Heartbeat -> MUST NOT refresh
    act(() => {
      es.emit('heartbeat')
    })
    await new Promise((r) => setTimeout(r, 200))
    assert.equal(refreshed, false, 'Heartbeat must not trigger router.refresh()')

    // 3. Real table event -> MUST trigger refresh after debounce
    act(() => {
      es.emit('items')
    })
    await new Promise((r) => setTimeout(r, 250))
    assert.equal(refreshed, true, 'Table mutation event must trigger router.refresh()')

    // Reset and test subsequent reconnect (e.g. after connection drop)
    refreshed = false
    act(() => {
      es.emit('reconnect')
    })
    await new Promise((r) => setTimeout(r, 250))
    assert.equal(refreshed, true, 'Subsequent reconnect event must trigger router.refresh()')

    // Cleanup
    unmount()
    assert.equal(es.closed, true, 'EventSource must be closed on unmount')
  } finally {
    process.env.NEXT_PUBLIC_DATA_BACKEND = originalBackend
    global.EventSource = originalEventSource
    nextNavigation.useRouter = originalUseRouter
  }
})

test('useRealtimeRefresh queues pending events when tab is hidden and refreshes once visible without losing updates', async () => {
  const originalBackend = process.env.NEXT_PUBLIC_DATA_BACKEND
  const originalEventSource = global.EventSource
  process.env.NEXT_PUBLIC_DATA_BACKEND = 'postgres'
  // @ts-expect-error Mocking EventSource for unit test
  global.EventSource = MockEventSource
  MockEventSource.instances = []
  let localRefreshCount = 0

  nextNavigation.useRouter = () => ({
    push: () => {},
    refresh: () => {
      localRefreshCount++
    },
  })

  let isHidden = true
  Object.defineProperty(document, 'hidden', {
    configurable: true,
    get: () => isHidden,
  })

  let visibilityListenerRemoved = false
  const originalRemoveEventListener = document.removeEventListener
  document.removeEventListener = function (type: string, listener: EventListenerOrEventListenerObject, options?: boolean | EventListenerOptions) {
    if (type === 'visibilitychange') {
      visibilityListenerRemoved = true
    }
    return originalRemoveEventListener.call(this, type, listener, options)
  }

  try {
    const { unmount } = renderHook(() =>
      useRealtimeRefresh(['items', 'categories', 'locations', 'units'], {
        pauseOnHidden: true,
        debounceDelay: 50,
        maxWait: 150,
      })
    )

    assert.equal(MockEventSource.instances.length, 1)
    const es = MockEventSource.instances[0]

    // 1. Handshake reconnect does not trigger refresh
    act(() => {
      es.emit('reconnect')
    })
    await new Promise((r) => setTimeout(r, 60))
    assert.equal(localRefreshCount, 0)

    // 2. Incoming events while tab is hidden
    await act(async () => {
      es.emit('items')
      es.emit('categories')
    })
    await new Promise((r) => setTimeout(r, 160))
    assert.equal(localRefreshCount, 0, 'Should not refresh while tab is hidden')

    // 3. Tab becomes visible -> pending events trigger refresh
    isHidden = false
    await act(async () => {
      document.dispatchEvent(new window.Event('visibilitychange'))
    })

    await new Promise((r) => setTimeout(r, 120))
    assert.equal(localRefreshCount, 1, 'Should trigger refresh once tab becomes visible')

    // 4. Cleanup on unmount
    unmount()
    assert.equal(es.closed, true, 'EventSource must be closed on unmount')
    assert.equal(visibilityListenerRemoved, true, 'visibilitychange event listener must be removed on unmount')
  } finally {
    process.env.NEXT_PUBLIC_DATA_BACKEND = originalBackend
    global.EventSource = originalEventSource
    nextNavigation.useRouter = originalUseRouter
    document.removeEventListener = originalRemoveEventListener
  }
})

test('useRealtimeRefresh cleans up pending timers when unmounted during debounce window', async () => {
  const originalBackend = process.env.NEXT_PUBLIC_DATA_BACKEND
  const originalEventSource = global.EventSource
  process.env.NEXT_PUBLIC_DATA_BACKEND = 'postgres'
  // @ts-expect-error Mocking EventSource for unit test
  global.EventSource = MockEventSource
  MockEventSource.instances = []
  refreshed = false

  try {
    const { unmount } = renderHook(() =>
      useRealtimeRefresh(['audit_logs'], {
        pauseOnHidden: true,
        debounceDelay: 100,
        maxWait: 500,
      })
    )

    const es = MockEventSource.instances[0]
    act(() => {
      es.emit('reconnect')
    })
    await new Promise((r) => setTimeout(r, 20))

    // Trigger mutation event
    act(() => {
      es.emit('audit_logs')
    })

    // Unmount before debounce timer finishes
    unmount()
    assert.equal(es.closed, true, 'EventSource closed on unmount')

    // Wait past debounceDelay and maxWait
    await new Promise((r) => setTimeout(r, 150))
    assert.equal(refreshed, false, 'Unmounted hook must not fire refresh from pending timer')
  } finally {
    process.env.NEXT_PUBLIC_DATA_BACKEND = originalBackend
    global.EventSource = originalEventSource
    nextNavigation.useRouter = originalUseRouter
  }
})
