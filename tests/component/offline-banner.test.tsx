import '../setup/dom'
import test, { beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import React, { act } from 'react'
import { render, screen } from '@testing-library/react'
import ReactDOMServer from 'react-dom/server'
import { hydrateRoot } from 'react-dom/client'
import { OfflineBanner } from '../../components/offline-banner'

// Enable React act() environment
;(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const originalOnLine = navigator.onLine

function setNavigatorOnLine(value: boolean) {
  Object.defineProperty(navigator, 'onLine', {
    value,
    configurable: true,
    writable: true,
  })
}

beforeEach(() => {
  setNavigatorOnLine(true)
})

afterEach(() => {
  setNavigatorOnLine(originalOnLine)
})

test('OfflineBanner renders nothing during SSR when online', () => {
  const ssrHtml = ReactDOMServer.renderToString(React.createElement(OfflineBanner))
  assert.equal(ssrHtml, '')
})

test('OfflineBanner renders nothing during SSR even when client navigator is offline', () => {
  setNavigatorOnLine(false)
  const ssrHtml = ReactDOMServer.renderToString(React.createElement(OfflineBanner))
  assert.equal(ssrHtml, '')
})

test('OfflineBanner hydrates without mismatch when initially offline', async () => {
  setNavigatorOnLine(false)

  // 1. SSR render
  const ssrHtml = ReactDOMServer.renderToString(React.createElement(OfflineBanner))
  assert.equal(ssrHtml, '')

  // 2. Prepare container matching SSR
  const container = document.createElement('div')
  container.innerHTML = ssrHtml
  document.body.appendChild(container)

  // Capture any console errors during hydration
  const originalConsoleError = console.error
  const consoleErrors: string[] = []
  console.error = (...args: unknown[]) => {
    consoleErrors.push(args.map(String).join(' '))
  }

  let root: ReturnType<typeof hydrateRoot> | null = null
  try {
    await act(async () => {
      root = hydrateRoot(container, React.createElement(OfflineBanner))
    })

    // Hydration mismatch warnings must NOT occur
    const hydrationErrors = consoleErrors.filter(
      (err) => err.includes('Hydration failed') || err.includes('did not match')
    )
    assert.equal(hydrationErrors.length, 0, `Expected 0 hydration errors, got: ${hydrationErrors.join('\n')}`)

    // Post-hydration, the offline alert banner should be present
    const alert = screen.getByRole('alert')
    assert.ok(alert)
    assert.match(alert.textContent || '', /ขาดการเชื่อมต่ออินเทอร์เน็ต/)
  } finally {
    console.error = originalConsoleError
    if (root) {
      await act(async () => {
        (root as ReturnType<typeof hydrateRoot>).unmount()
      })
    }
    if (container.parentNode) {
      container.parentNode.removeChild(container)
    }
  }
})

test('OfflineBanner renders nothing when initially online', () => {
  setNavigatorOnLine(true)
  render(React.createElement(OfflineBanner))

  assert.equal(screen.queryByRole('alert'), null)
  assert.equal(screen.queryByRole('status'), null)
})

test('OfflineBanner transitions from online to offline on window offline event', () => {
  setNavigatorOnLine(true)
  const { unmount } = render(React.createElement(OfflineBanner))

  assert.equal(screen.queryByRole('alert'), null)

  // Trigger offline
  act(() => {
    setNavigatorOnLine(false)
    window.dispatchEvent(new window.Event('offline'))
  })

  const alert = screen.getByRole('alert')
  assert.ok(alert)
  assert.match(alert.textContent || '', /ขาดการเชื่อมต่ออินเทอร์เน็ต/)

  unmount()
})

test('OfflineBanner transitions from offline to online and shows reconnected banner for 3.5s', async () => {
  setNavigatorOnLine(false)
  const { unmount } = render(React.createElement(OfflineBanner))

  assert.ok(screen.getByRole('alert'))

  // Reconnect
  act(() => {
    setNavigatorOnLine(true)
    window.dispatchEvent(new window.Event('online'))
  })

  // Offline alert should be gone, reconnected status should be visible
  assert.equal(screen.queryByRole('alert'), null)
  const status = screen.getByRole('status')
  assert.ok(status)
  assert.match(status.textContent || '', /เชื่อมต่อสัญญาณอินเทอร์เน็ตเรียบร้อยแล้ว/)

  // Fast forward past 3500ms
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 3600))
  })

  // Reconnected banner should have faded/unmounted
  assert.equal(screen.queryByRole('status'), null)
  assert.equal(screen.queryByRole('alert'), null)

  unmount()
})

test('OfflineBanner cancels reconnected banner if connection drops again during the 3.5s window', async () => {
  setNavigatorOnLine(false)
  const { unmount } = render(React.createElement(OfflineBanner))

  assert.ok(screen.getByRole('alert'))

  // Reconnect
  act(() => {
    setNavigatorOnLine(true)
    window.dispatchEvent(new window.Event('online'))
  })

  assert.ok(screen.getByRole('status'))

  // Go offline again after 100ms
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 100))
  })

  act(() => {
    setNavigatorOnLine(false)
    window.dispatchEvent(new window.Event('offline'))
  })

  // Status banner is immediately replaced by alert banner
  assert.equal(screen.queryByRole('status'), null)
  assert.ok(screen.getByRole('alert'))

  unmount()
})

test('OfflineBanner always prioritizes offline alert whenever offline', () => {
  setNavigatorOnLine(false)
  const { unmount } = render(React.createElement(OfflineBanner))

  // Must render role="alert" and never role="status"
  assert.ok(screen.getByRole('alert'))
  assert.equal(screen.queryByRole('status'), null)

  unmount()
})
