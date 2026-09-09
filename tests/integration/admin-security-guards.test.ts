import '../setup/dom'
import test, { beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { mockSupabaseRegistry } from '../mocks/supabase'
import { createRequire } from 'node:module'
const loadModule = createRequire(`${process.cwd()}/package.json`)

const ratePath = require.resolve('../../lib/rate-limit')
loadModule(ratePath)
let allowed = true
const rateCalls: unknown[][] = []
require.cache[ratePath]!.exports = { ...require.cache[ratePath]!.exports, checkRateLimit: async (...args: unknown[]) => {
  rateCalls.push(args)
  return allowed ? { success: true } : { success: false, error: 'limited' }
} }
const factoryPath = require.resolve('../../lib/supabase/server')
const events: string[] = []
let auditError = false
require.cache[factoryPath]!.exports.createServiceRoleClient = () => ({
  from: () => ({ insert: async () => { events.push('audit'); return { error: auditError ? { message: 'offline' } : null } } }),
  rpc: async () => { events.push('sql'); return { data: { ok: true, rows: [] }, error: null } },
})
const actions = loadModule('./features/admin/actions') as typeof import('../../features/admin/actions')

beforeEach(() => {
  mockSupabaseRegistry.clear()
  mockSupabaseRegistry.setAuth({ id: 'admin' }, { id: 'admin', role: 'admin', is_active: true })
  events.length = 0
  rateCalls.length = 0
  allowed = true
  auditError = false
  process.env.ADMIN_SQL_ENABLED = 'true'
})

test('admin exports and restores stop before work on limit failure', async () => {
  allowed = false
  assert.equal((await actions.exportDatabaseData()).error, 'limited')
  assert.equal((await actions.importDatabaseData('{}')).error, 'limited')
  assert.equal((await actions.upsertTableRow('items', null, {})).error, 'limited')
  assert.deepEqual(events, [])
  assert.equal(rateCalls.length, 3)
})
test('SQL needs maintenance flag and explicit confirmation', async () => {
  assert.ok((await actions.runAdminSql('select 1')).error)
  process.env.ADMIN_SQL_ENABLED = 'false'
  assert.ok((await actions.runAdminSql('select 1', 'EXECUTE SQL')).error)
  assert.deepEqual(events, [])
})
test('SQL refuses execution when attempt audit cannot persist', async () => {
  auditError = true
  assert.ok((await actions.runAdminSql('select 1', 'EXECUTE SQL')).error)
  assert.deepEqual(events, ['audit'])
})
test('SQL records attempt before execution and records completion', async () => {
  assert.equal((await actions.runAdminSql('select 1', 'EXECUTE SQL')).ok, true)
  assert.deepEqual(events, ['audit', 'sql', 'audit'])
})
test('inactive or non-admin users never execute SQL', async () => {
  for (const profile of [{ id: 'staff', role: 'staff', is_active: true }, { id: 'admin', role: 'admin', is_active: false }]) {
    mockSupabaseRegistry.setAuth({ id: profile.id }, profile)
    assert.ok((await actions.runAdminSql('select 1', 'EXECUTE SQL')).error)
  }
  assert.deepEqual(events, [])
  assert.deepEqual(rateCalls, [])
})
