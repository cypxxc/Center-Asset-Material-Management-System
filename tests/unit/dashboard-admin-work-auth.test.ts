import '../setup/dom'
import test from 'node:test'
import assert from 'node:assert/strict'

test('queue refuses anonymous, inactive, staff and user access before executing SQL', async () => {
  const authPath = require.resolve('../../features/auth/queries')
  const dbPath = require.resolve('../../lib/postgres/request')
  const originalAuth = require.cache[authPath]
  const originalDb = require.cache[dbPath]
  let profile: { role: string; is_active: boolean } | null = null
  let queries = 0
  const summary = { asOf: '2026-11-12', items: [], pendingCount: 0, overdueCount: 0 }
  require.cache[authPath] = { id: authPath, filename: authPath, loaded: true, exports: { getCurrentProfile: async () => profile } } as NodeJS.Module
  require.cache[dbPath] = { id: dbPath, filename: dbPath, loaded: true, exports: {
    withUserDatabase: async (operation: (tx: unknown) => unknown) => {
      queries++
      return operation({ execute: async () => ({ rows: [{ summary }] }) })
    },
  } } as NodeJS.Module
  try {
    const { getAdminWorkQueue } = await import('../../features/disbursements/admin-work-queue-queries')
    const { AdminDashboardWorkQueue } = await import('../../components/dashboard/dashboard-admin-work-queue')
    for (const candidate of [null, { role: 'admin', is_active: false }, { role: 'staff', is_active: true }, { role: 'user', is_active: true }]) {
      profile = candidate
      assert.equal(await getAdminWorkQueue(), null)
      assert.equal(await AdminDashboardWorkQueue(), null)
    }
    assert.equal(queries, 0)
    profile = { role: 'admin', is_active: true }
    assert.deepEqual(await getAdminWorkQueue(), summary)
    assert.equal(queries, 1)
    assert.ok(await AdminDashboardWorkQueue())
  } finally {
    if (originalAuth) require.cache[authPath] = originalAuth; else delete require.cache[authPath]
    if (originalDb) require.cache[dbPath] = originalDb; else delete require.cache[dbPath]
  }
})
