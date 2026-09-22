import '../setup/dom'
import test, { beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { mockSupabaseRegistry } from '../mocks/supabase'
import { encodeItemCursor, normalizeItemListSearchParams } from '../../features/items/cursor'

let profile: { id: string; is_active: boolean } | null = null
const authPath = require.resolve('../../features/auth/queries')
require.cache[authPath] = {
  id: authPath, filename: authPath, loaded: true,
  exports: { getCurrentProfile: async () => profile },
} as NodeJS.Module

beforeEach(() => {
  process.env.DATA_BACKEND = 'supabase'
  profile = { id: 'user', is_active: true }
  mockSupabaseRegistry.clear()
})

async function getRoute() {
  return (await import('../../app/api/items/batch/route')).GET
}

test('item batch route rejects missing and inactive profiles without querying or caching', async () => {
  const GET = await getRoute()
  profile = null
  let response = await GET(new Request('http://localhost/api/items/batch'))
  assert.equal(response.status, 401)
  assert.match(response.headers.get('cache-control') ?? '', /no-store/)
  profile = { id: 'user', is_active: false }
  response = await GET(new Request('http://localhost/api/items/batch'))
  assert.equal(response.status, 403)
  assert.equal(mockSupabaseRegistry.getQueryLog().length, 0)
})

test('item batch route rejects a malformed cursor through the real decoder', async () => {
  const GET = await getRoute()
  const response = await GET(new Request('http://localhost/api/items/batch?cursor=bad'))
  assert.equal(response.status, 400)
  assert.deepEqual(await response.json(), { error: 'Invalid cursor' })
  assert.equal(mockSupabaseRegistry.getQueryLog().length, 0)
})

test('item batch route forwards filters and cursor and returns an uncached bounded batch', async () => {
  const GET = await getRoute()
  const params = { q: 'Monitor', type: 'asset', sort_by: 'item_name', sort_dir: 'asc' }
  const cursor = encodeItemCursor(normalizeItemListSearchParams(params), 'Monitor', '33333333-3333-4333-8333-333333333333')
  mockSupabaseRegistry.setTableResponse('items', [])
  const response = await GET(new Request(`http://localhost/api/items/batch?${new URLSearchParams({ ...params, cursor, limit: '5000' })}`))
  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), { items: [], total: null, nextCursor: null })
  assert.match(response.headers.get('cache-control') ?? '', /private, no-store/)
  const query = mockSupabaseRegistry.getQueryLog().find(entry => entry.table === 'items')!
  assert.ok(query.operations.some(operation => operation[0] === 'limit' && operation[1] === 26))
  assert.ok(query.operations.some(operation => operation[0] === 'eq' && operation[1] === 'item_type' && operation[2] === 'asset'))
  const predicates = query.operations.filter(operation => operation[0] === 'or').map(operation => operation[1])
  assert.ok(predicates.some(value => String(value).includes('item_name.ilike.')))
  assert.ok(predicates.some(value => String(value).includes('item_name.gt.')))
})
