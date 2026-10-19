import '../setup/dom'
import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { render, act } from '@testing-library/react'
import { DashboardRealtimeBoundary } from '../../components/dashboard/dashboard-realtime-boundary'
import { useRealtimeRefresh, type RealtimeRefreshOptions } from '../../hooks/use-realtime-refresh'

test('DashboardRealtimeBoundary renders with default items and categories tables and relaxed debounce options', async () => {
  // We can render DashboardRealtimeBoundary and assert on its props / structure
  const element = React.createElement(DashboardRealtimeBoundary)
  assert.equal(element.type, DashboardRealtimeBoundary)
  
  // Test default props when instantiated without arguments
  const boundaryElement = DashboardRealtimeBoundary({}) as React.ReactElement<{
    tables?: string[]
    options?: RealtimeRefreshOptions
  }>
  const boundaryProps = boundaryElement?.props
  assert.deepEqual(boundaryProps?.tables, ['items', 'categories'])
  assert.deepEqual(boundaryProps?.options, {
    debounceDelay: 1000,
    maxWait: 2500,
    pauseOnHidden: true,
  })
})

test('useRealtimeRefresh handles pauseOnHidden and triggers refresh on visibility change', async () => {
  let refreshCount = 0
  const nextNavigationPath = require.resolve('next/navigation')
  const nextNavigation = require.cache[nextNavigationPath]?.exports as {
    useRouter: () => {
      refresh: () => void
      push: (url: string) => void
      replace: (url: string) => void
      prefetch: (url: string) => void
      back: () => void
      forward: () => void
    }
  }
  const originalUseRouter = nextNavigation.useRouter
  nextNavigation.useRouter = () => ({
    refresh: () => {
      refreshCount++
    },
    push: () => {},
    replace: () => {},
    prefetch: () => {},
    back: () => {},
    forward: () => {},
  })

  // Set SSE backend to avoid supabase mock requirements
  process.env.NEXT_PUBLIC_DATA_BACKEND = 'postgres'

  // Mock EventSource
  let eventSourceListener: ((event: { data: string }) => void) | null = null
  let eventSourceClosed = false

  class MockEventSource {
    constructor(public url: string) {}
    set onmessage(fn: (event: { data: string }) => void) {
      eventSourceListener = fn
    }
    close() {
      eventSourceClosed = true
    }
  }
  ;(globalThis as unknown as { EventSource: unknown }).EventSource = MockEventSource

  // Set initial document.hidden to true
  Object.defineProperty(document, 'hidden', {
    configurable: true,
    get: () => isHidden,
  })
  let isHidden = true

  function TestHookComponent({ options }: { options?: RealtimeRefreshOptions }) {
    useRealtimeRefresh(['items', 'categories'], options)
    return null
  }

  const { unmount } = render(
    React.createElement(TestHookComponent, {
      options: { debounceDelay: 50, maxWait: 150, pauseOnHidden: true },
    })
  )

  assert.ok(eventSourceListener, 'EventSource message listener was registered')

  // 1. Simulate an event arrival while hidden
  await act(async () => {
    eventSourceListener!({ data: 'items' })
  })

  // Wait past debounce delay
  await new Promise((resolve) => setTimeout(resolve, 80))
  assert.equal(refreshCount, 0, 'Refresh should NOT fire while document is hidden')

  // 2. Simulate visibilitychange to visible
  isHidden = false
  await act(async () => {
    document.dispatchEvent(new window.Event('visibilitychange'))
  })

  // Refresh should fire after debounceDelay
  await new Promise((resolve) => setTimeout(resolve, 80))
  assert.equal(refreshCount, 1, 'Refresh should fire once document becomes visible')

  unmount()
  assert.ok(eventSourceClosed, 'EventSource should be closed on unmount')

  // Restore
  nextNavigation.useRouter = originalUseRouter
  delete process.env.NEXT_PUBLIC_DATA_BACKEND
})
