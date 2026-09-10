import '../setup/dom'
import test, { beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { mockSupabaseRegistry } from '../mocks/supabase'

const loadModule = createRequire(`${process.cwd()}/package.json`)
let serviceCalls = 0
const ranges: number[][] = []
const factoryPath = require.resolve('../../lib/supabase/server')
require.cache[factoryPath]!.exports.createServiceRoleClient = () => {
  serviceCalls++
  const query = {
    select: () => query,
    order: () => query,
    range: async (from: number, to: number) => {
      ranges.push([from, to])
      return { data: [{ id: 'visible-row' }], count: 1, error: null }
    },
  }
  return { from: () => query }
}
const { getProfilesList, getAuditLogsList } = loadModule('./features/admin/queries') as typeof import('../../features/admin/queries')

beforeEach(() => {
  mockSupabaseRegistry.clear()
  serviceCalls = 0
  ranges.length = 0
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-only'
})

test('direct list calls deny unauthenticated, staff, and inactive administrators before service access', async () => {
  for (const profile of [null, { id: 'staff', role: 'staff', is_active: true }, { id: 'admin', role: 'admin', is_active: false }]) {
    mockSupabaseRegistry.setAuth(profile ? { id: profile.id } : null, profile)
    const users = await getProfilesList()
    const audit = await getAuditLogsList()
    assert.ok(users.error)
    assert.deepEqual(users.profiles, [])
    assert.equal(users.totalCount, 0)
    assert.ok(audit.error)
    assert.deepEqual(audit.logs, [])
  }
  assert.equal(serviceCalls, 0)
})

test('active administrators list rows using bounded integer ranges', async () => {
  mockSupabaseRegistry.setAuth({ id: 'admin' }, { id: 'admin', role: 'admin', is_active: true })
  for (const list of [getProfilesList, getAuditLogsList]) {
    for (const [page, pageSize, expected] of [
      [NaN, Infinity, [0, 49]],
      [-3, -50, [0, 9]],
      [2.9, 25.9, [25, 49]],
      [999999999, 999999999, [9999900, 9999999]],
    ] as const) {
      const result = await list({ page, pageSize })
      assert.equal(result.error, undefined)
      assert.equal(result.totalCount, 1)
      assert.deepEqual(ranges.at(-1), expected)
    }
  }
})
