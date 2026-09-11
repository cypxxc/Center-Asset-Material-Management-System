import '../setup/dom'
import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import path from 'node:path'
import { mockSupabaseRegistry, createMockSupabaseClient } from '../mocks/supabase'
import { importDatabaseData } from '../../features/admin/actions'

const backup = { __meta: { version: 1 }, profiles: [], categories: [], locations: [], units: [], items: [], audit_logs: [] }

test('restore sends the authenticated admin session even when a service key is configured', async () => {
  mockSupabaseRegistry.clear()
  mockSupabaseRegistry.setAuth({ id: 'admin' }, { id: 'admin', role: 'admin', is_active: true })
  const loadModule = createRequire(path.join(process.cwd(), 'package.json'))
  const factories = loadModule('./lib/supabase/server')
  const originalUserClient = factories.createClient
  const originalAdminClient = factories.createAdminClient
  const originalKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key'
  let submitted: unknown
  const client = (hasSession: boolean) => ({
    ...createMockSupabaseClient(hasSession ? 'anon' : 'service'),
    rpc: async (name: string, args: unknown) => {
      assert.equal(name, 'restore_database_backup')
      submitted = args
      // The SQL contract rejects a missing auth.uid(), regardless of service privileges.
      return { data: hasSession ? { ok: true, tables_restored: ['items'] } : { ok: false, error: 'Forbidden: administrators only' }, error: null }
    },
  })
  factories.createClient = async () => client(true)
  factories.createAdminClient = async () => client(false)
  try {
    assert.deepEqual(await importDatabaseData(JSON.stringify(backup)), { success: true, tablesRestored: ['items'] })
    assert.deepEqual(submitted, { backup })
  } finally {
    factories.createClient = originalUserClient
    factories.createAdminClient = originalAdminClient
    if (originalKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY
    else process.env.SUPABASE_SERVICE_ROLE_KEY = originalKey
  }
})

test('restore rejects staff and inactive administrators before calling the database', async () => {
  for (const profile of [{ id: 'staff', role: 'staff', is_active: true }, { id: 'admin', role: 'admin', is_active: false }]) {
    mockSupabaseRegistry.clear()
    mockSupabaseRegistry.setAuth({ id: profile.id }, profile)
    const result = await importDatabaseData(JSON.stringify(backup))
    assert.ok(result.error)
    assert.deepEqual(mockSupabaseRegistry.getRpcLog(), [])
  }
})
