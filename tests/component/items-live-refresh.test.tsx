import '../setup/dom'
import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { renderHook, act } from '@testing-library/react'
import type { ItemListResult } from '../../features/items/types'
const load = createRequire(`${process.cwd()}/package.json`)
let change = () => {}
let removed = 0
let routeRefreshes = 0
load('next/navigation').useRouter = () => ({ refresh: () => { routeRefreshes++ } })
const clientId = load.resolve('./lib/supabase/client')
load.cache[clientId] = { id: clientId, filename: clientId, loaded: true, exports: {
  createClient: () => ({ channel: () => ({
    on(_event: unknown, _filter: unknown, callback: () => void) { change = callback; return this },
    subscribe() { return this },
  }), removeChannel: () => { removed++ } }),
} } as NodeJS.Module
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co'
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test'
const { useLiveItems } = load('./features/items/components/use-live-items') as typeof import('../../features/items/components/use-live-items')
const initial: ItemListResult = { items: [], total: 0, page: 1, pageSize: 10, totalPages: 1 }

test('item event burst fetches only filtered page data; old navigation results and unmount are cancelled', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  const calls: { url: string; signal: AbortSignal; resolve: (value: Response) => void }[] = []
  t.mock.method(globalThis, 'fetch', (url: string, options: RequestInit) => new Promise<Response>(resolve => {
    calls.push({ url, signal: options.signal!, resolve })
  }))
  const { result, rerender, unmount } = renderHook(({ q }) => useLiveItems(initial, { q }), { initialProps: { q: 'old' } })
  assert.equal(calls.length, 0)
  await act(async () => { for (let i = 0; i < 100; i++) change(); t.mock.timers.tick(2500) })
  assert.equal(calls.length, 1)
  assert.equal(calls[0].url, '/api/items/live?q=old')
  rerender({ q: 'new' })
  assert.equal(calls[0].signal.aborted, true)
  await act(async () => { calls[0].resolve(Response.json({ ...initial, total: 99 })) })
  assert.equal(result.current.data.total, 0)
  await act(async () => { change(); t.mock.timers.tick(2500) })
  assert.equal(calls[1].url, '/api/items/live?q=new')
  await act(async () => { calls[1].resolve(Response.json({ ...initial, total: 3 })) })
  assert.equal(result.current.data.total, 3)
  await act(async () => { change(); t.mock.timers.tick(2500) })
  unmount()
  assert.equal(calls[2].signal.aborted, true)
  assert.equal(removed, 2)
  assert.equal(routeRefreshes, 0)
})

test('failed live reads retain the last good data and complete so the next event can retry; revoked auth runs the route guard', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  let status = 503
  t.mock.method(globalThis, 'fetch', async () => Response.json({ ...initial, total: 8 }, { status }))
  const { result, unmount } = renderHook(() => useLiveItems(initial, {}))
  await act(async () => { change(); t.mock.timers.tick(2500) })
  assert.equal(result.current.data.total, 0)
  assert.ok(result.current.error)
  status = 200
  await act(async () => { change(); t.mock.timers.tick(2500) })
  assert.equal(result.current.data.total, 8)
  assert.equal(result.current.error, null)
  status = 401
  const before = routeRefreshes
  await act(async () => { change(); t.mock.timers.tick(2500) })
  assert.equal(routeRefreshes, before + 1)
  unmount()
})

test('active profile changes refresh role-dependent page controls; unchanged profiles keep data-only refresh', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  let authRevision = 'staff-v1'
  t.mock.method(globalThis, 'fetch', async () => Response.json({ ...initial, total: 5, authRevision }))
  const before = routeRefreshes
  const { result, unmount } = renderHook(() => useLiveItems(initial, {}, 'staff-v1'))
  await act(async () => { change(); t.mock.timers.tick(2500) })
  assert.equal(result.current.data.total, 5)
  assert.equal(routeRefreshes, before)
  authRevision = 'viewer-v2'
  await act(async () => { change(); t.mock.timers.tick(2500) })
  assert.equal(routeRefreshes, before + 1)
  unmount()
})
