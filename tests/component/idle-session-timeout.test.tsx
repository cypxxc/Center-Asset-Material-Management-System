import '../setup/dom'
import test, { type TestContext } from 'node:test'
import assert from 'node:assert/strict'
import React, { act } from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { IdleSessionTimeout } from '../../components/auth/idle-session-timeout'

Object.assign(globalThis, {
  getComputedStyle: window.getComputedStyle,
  MutationObserver: window.MutationObserver,
  CustomEvent: window.CustomEvent,
  NodeFilter: window.NodeFilter,
  Node: window.Node,
})

// jsdom does not implement the browser top layer; real browser coverage checks it.
window.HTMLDialogElement.prototype.showModal = function () { this.open = true }

;(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

function setup(t: TestContext, props: React.ComponentProps<typeof IdleSessionTimeout> = {}) {
  t.mock.timers.enable({ apis: ['Date', 'setInterval', 'setTimeout'], now: 1_000_000 })
  localStorage.clear()
  const destinations: string[] = []
  const logoutRequests: Array<{ url: string; method?: string }> = []
  const originalWindow = window
  const originalFetch = globalThis.fetch
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    logoutRequests.push({ url: String(input), method: init?.method })
    return new Response(JSON.stringify({ success: true }), { status: 200 })
  }) as typeof fetch
  globalThis.window = new Proxy(originalWindow, {
    get(target, property) {
      if (property === 'location') return { replace: (url: string) => destinations.push(url) }
      return Reflect.get(target, property)
    },
  })
  const view = render(<IdleSessionTimeout timeoutSeconds={20} warningSeconds={10} {...props} />)
  t.after(() => {
    view.unmount()
    globalThis.window = originalWindow
    globalThis.fetch = originalFetch
    localStorage.clear()
  })
  return { view, destinations, logoutRequests }
}

test('idle warning renders outside layout and continues on explicit confirmation', async (t) => {
  const { view } = setup(t)
  assert.equal(screen.queryByRole('alertdialog'), null)
  await act(async () => { t.mock.timers.tick(11_000) })
  const popup = screen.getByRole('alertdialog')
  assert.equal(view.container.contains(popup), false)
  assert.ok(screen.getByText('9 วินาที'))
  await act(async () => { t.mock.timers.tick(2_000) })
  assert.ok(screen.getByText('7 วินาที'))
  fireEvent.click(screen.getByRole('button', { name: 'คงอยู่ในระบบต่อไป' }))
  assert.equal(screen.queryByRole('alertdialog'), null)
  await act(async () => { t.mock.timers.tick(9000) })
  assert.equal(screen.queryByRole('alertdialog'), null)
})

test('idle expiry shows a blocking popup then navigates through server logout exactly once', async (t) => {
  const { destinations, logoutRequests } = setup(t)
  await act(async () => { t.mock.timers.tick(20_000) })
  assert.ok(screen.getByRole('alertdialog', { name: 'เซสชันหมดอายุ' }))
  assert.equal(screen.queryByRole('button', { name: 'คงอยู่ในระบบต่อไป' }), null)
  fireEvent.click(window)
  await act(async () => { t.mock.timers.tick(1500); await Promise.resolve() })
  assert.deepEqual(logoutRequests, [{ url: '/api/auth/logout', method: 'POST' }])
  assert.deepEqual(destinations, ['/login?reason=idle_timeout'])
  await act(async () => { t.mock.timers.tick(5000); await Promise.resolve() })
  assert.equal(destinations.length, 1)
})

test('activity before warning resets idle time', async (t) => {
  setup(t)
  await act(async () => { t.mock.timers.tick(9000) })
  fireEvent.keyDown(window, { key: 'a' })
  await act(async () => { t.mock.timers.tick(9000) })
  assert.equal(screen.queryByRole('alertdialog'), null)
})

test('returning to sleeping tab after expiry cannot resume session', (t) => {
  setup(t)
  t.mock.method(Date, 'now', () => 1_030_000)
  fireEvent(document, new window.Event('visibilitychange'))
  assert.ok(screen.getByRole('alertdialog', { name: 'เซสชันหมดอายุ' }))
})

test('expired stored activity is checked on mount instead of reset', () => {
  localStorage.setItem('camms_last_activity', String(Date.now() - 30_000))
  const view = render(<IdleSessionTimeout timeoutSeconds={20} warningSeconds={10} />)
  assert.ok(screen.getByRole('alertdialog', { name: 'เซสชันหมดอายุ' }))
  view.unmount()
  localStorage.clear()
})

test('logout from another tab works without BroadcastChannel', async (t) => {
  const { destinations, logoutRequests } = setup(t)
  fireEvent(window, new window.StorageEvent('storage', { key: 'camms_last_activity', oldValue: '1000000', newValue: null }))
  assert.ok(screen.getByRole('alertdialog', { name: 'เซสชันหมดอายุ' }))
  await act(async () => { t.mock.timers.tick(1500); await Promise.resolve() })
  assert.deepEqual(logoutRequests, [{ url: '/api/auth/logout', method: 'POST' }])
  assert.deepEqual(destinations, ['/login?reason=idle_timeout'])
})

test('eight-hour server deadline expires even when the user is active', async (t) => {
  setup(t, { timeoutSeconds: 86400, sessionExpiresAt: new Date(1_000_000 + 28_800_000).toISOString() })
  t.mock.method(Date, 'now', () => 1_000_000 + 28_799_000)
  fireEvent.click(window)
  fireEvent(document, new window.Event('visibilitychange'))
  assert.ok(screen.getByRole('alertdialog'))
  assert.equal(screen.queryByRole('button', { name: 'คงอยู่ในระบบต่อไป' }), null)
  t.mock.method(Date, 'now', () => 1_000_000 + 28_800_000)
  fireEvent.click(window)
  assert.ok(screen.getByRole('alertdialog', { name: 'เซสชันหมดอายุ' }))
})

test('default idle timeout allows thirty minutes and expires at eight hours', (t) => {
  setup(t, { timeoutSeconds: undefined, warningSeconds: 60 })
  let now = 1_000_000 + 1_800_000
  t.mock.method(Date, 'now', () => now)
  fireEvent(document, new window.Event('visibilitychange'))
  assert.equal(screen.queryByRole('alertdialog'), null)
  now = 1_000_000 + 28_740_000
  fireEvent(document, new window.Event('visibilitychange'))
  assert.ok(screen.getByText('60 วินาที'))
  now = 1_000_000 + 28_800_000
  fireEvent(document, new window.Event('visibilitychange'))
  assert.ok(screen.getByRole('alertdialog', { name: 'เซสชันหมดอายุ' }))
})
