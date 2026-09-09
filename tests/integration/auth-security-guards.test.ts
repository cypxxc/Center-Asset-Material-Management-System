import '../setup/dom'
import test, { beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { mockSupabaseRegistry } from '../mocks/supabase'

const load = createRequire(`${process.cwd()}/tests/integration/auth-security-guards.test.ts`)
const ratePath = load.resolve('../../lib/rate-limit')
load(ratePath)
let allowed = true
const rateCalls: unknown[][] = []
load.cache[ratePath]!.exports = { ...load.cache[ratePath]!.exports, checkRateLimit: async (...args: unknown[]) => {
  rateCalls.push(args)
  return allowed ? { success: true } : { success: false, error: 'limited' }
} }
const factoryPath = load.resolve('../../lib/supabase/server')
const writes: string[] = []
let authenticated = true
load.cache[factoryPath]!.exports.createClient = async () => ({
  auth: {
    getUser: async () => ({ data: { user: authenticated ? { id: 'staff' } : null }, error: null }),
    updateUser: async () => { writes.push('password'); return { error: null } },
  },
  from: () => ({ update: () => { writes.push('profile'); return { eq: async () => ({ error: null }) } } }),
})
const actions = load('../../features/auth/actions') as typeof import('../../features/auth/actions')
const form = new FormData()
form.set('full_name', 'Staff Member')
form.set('password', 'secure-password')
form.set('confirm_password', 'secure-password')
const cases = [
  ['updatePersonalProfile', () => actions.updatePersonalProfile(null, form)],
  ['updatePersonalPassword', () => actions.updatePersonalPassword(null, form)],
  ['updateSidebarOrder', () => actions.updateSidebarOrder(['dashboard'])],
] as const
beforeEach(() => {
  mockSupabaseRegistry.clear()
  writes.length = 0
  rateCalls.length = 0
  allowed = true
  authenticated = true
})
for (const [action, run] of cases) {
  test(`${action} stops before writes when rate limiter denies`, async () => {
    allowed = false
    assert.equal((await run()).error, 'limited')
    assert.deepEqual(writes, [])
    assert.equal(rateCalls.length, 1)
    assert.equal(rateCalls[0][0], action)
  })
  test(`${action} authorizes before consuming a rate limit`, async () => {
    authenticated = false
    assert.ok((await run()).error)
    assert.deepEqual(rateCalls, [])
    assert.deepEqual(writes, [])
  })
  test(`${action} proceeds when authenticated and allowed`, async () => {
    assert.ok((await run()).success)
    assert.equal(rateCalls.length, 1)
    assert.equal(writes.length, 1)
  })
}
