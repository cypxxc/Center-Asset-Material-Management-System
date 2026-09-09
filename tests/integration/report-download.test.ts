import '../setup/dom'
import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
const load = createRequire(`${process.cwd()}/package.json`)
let user: { id: string; is_active: boolean } | null = null
let allowed = true
let reads = 0
let fail = false
for (const [path, exports] of [
  ['./features/auth/queries', { getCurrentProfile: async () => user }],
  ['./lib/rate-limit', { checkRateLimit: async () => ({ success: allowed, error: 'limited' }) }],
  ['./features/reports/queries', { prepareReportExport: async () => { reads++; if (fail) throw new Error('offline'); return { totalCount: 0, batches: (async function* () {})() } } }],
] as const) {
  const id = load.resolve(path)
  load.cache[id] = { id, filename: id, loaded: true, exports } as NodeJS.Module
}
const serverId = load.resolve('next/server')
const server = load(serverId)
load.cache[serverId]!.exports = { ...server, after: () => {} }
const { GET } = load('./app/api/reports/export/route') as typeof import('../../app/api/reports/export/route')
const request = () => new Request('http://localhost/api/reports/export')

test('download requires active auth and rate budget before data access', async () => {
  assert.equal((await GET(request())).status, 401)
  user = { id: 'staff', is_active: false }
  assert.equal((await GET(request())).status, 401)
  user.is_active = true
  allowed = false
  assert.equal((await GET(request())).status, 429)
  assert.equal(reads, 0)
})
test('download returns useful error when preflight fails and streams XLSX on success', async () => {
  user = { id: 'staff', is_active: true }
  allowed = true
  fail = true
  assert.equal((await GET(request())).status, 503)
  fail = false
  const response = await GET(request())
  assert.equal(response.status, 200)
  assert.match(response.headers.get('content-type')!, /spreadsheetml/)
  assert.equal(response.headers.get('cache-control'), 'private, no-store')
  assert.ok((await response.arrayBuffer()).byteLength > 1000)
})
