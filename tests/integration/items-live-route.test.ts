import '../setup/dom'
import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
const load = createRequire(`${process.cwd()}/package.json`)
let profile: { id?: string; role?: string; is_active: boolean } | null = null
let reads = 0
let fail = false
let received: unknown
for (const [path, exports] of [
  ['./features/auth/queries', { getCurrentProfile: async () => profile }],
  ['./features/items/queries', { getSidebarData: async () => ({ counts: {} }), getItems: async (params: unknown) => {
    reads++; received = params
    if (fail) throw new Error('private database failure')
    return { items: [], total: 0, page: 2, pageSize: 10, totalPages: 1 }
  } }],
] as const) {
  const id = load.resolve(path)
  load.cache[id] = { id, filename: id, loaded: true, exports } as NodeJS.Module
}
const { GET } = load('./app/api/items/live/route') as typeof import('../../app/api/items/live/route')
test('live Items requires active auth before reading and never caches private responses', async () => {
  const request = () => new Request('http://localhost/api/items/live?page=2&q=printer&user_id=spoof')
  for (profile of [null, { is_active: false }]) {
    const response = await GET(request())
    assert.equal(response.status, 401)
    assert.equal(response.headers.get('cache-control'), 'private, no-store')
  }
  assert.equal(reads, 0)
  profile = { id: 'verified-user', role: 'staff', is_active: true }
  const response = await GET(request())
  assert.equal(response.status, 200)
  assert.equal(response.headers.get('cache-control'), 'private, no-store')
  assert.equal(response.headers.get('vary'), 'Cookie')
  assert.deepEqual(received, { page: '2', q: 'printer' })
  const body = await response.json()
  assert.equal(body.page, 2)
  assert.equal(body.authRevision, JSON.stringify(['verified-user', 'staff', null]))
  fail = true
  const failed = await GET(request())
  assert.equal(failed.status, 503)
  assert.ok(!(await failed.text()).includes('private database'))
})
