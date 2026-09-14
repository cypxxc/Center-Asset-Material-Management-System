import '../setup/dom'
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { parse } from 'dotenv'
import { Pool, type PoolClient } from 'pg'
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres'
import { verifyPassword } from '../../lib/postgres/password'

// Opt in: node --import tsx --test tests/integration/postgres-admin-live.test.ts
// with POSTGRES_ADMIN_LIVE_TEST=1. All fixtures and mutations roll back.
test('live restricted roles support account, session, audit and business administration', { skip: process.env.POSTGRES_ADMIN_LIVE_TEST !== '1' }, async () => {
  const env = parse(readFileSync('.env.postgres.app'))
  const pool = new Pool({ connectionString: env.DATABASE_MIGRATION_URL, connectionTimeoutMillis: 5000 })
  let client: PoolClient | undefined
  const actor = randomUUID()
  function mockModule(path: string, exports: unknown) {
    const filename = require.resolve(path)
    require.cache[filename] = { id: filename, filename, loaded: true, exports } as NodeJS.Module
  }
  try {
    client = await pool.connect()
    await client.query('begin')
    await client.query("insert into public.profiles(id,email,full_name,role) values($1,$2,'Admin test','admin')", [actor, `${actor}@example.com`])
    async function scoped<T>(role: 'camms_auth' | 'camms_app', callback: (tx: NodePgDatabase) => Promise<T>) {
      await client!.query('savepoint admin_action')
      try {
        await client!.query(`set local role ${role}`)
        await client!.query("select set_config('app.user_id',$1,true)", [actor])
        const result = await callback(drizzle(client!))
        await client!.query('reset role')
        await client!.query('release savepoint admin_action')
        return result
      } catch (error) {
        await client!.query('rollback to savepoint admin_action')
        throw error
      }
    }
    mockModule('../../features/auth/queries', { getCurrentProfile: async () => ({ id: actor, role: 'admin', is_active: true }) })
    mockModule('../../lib/postgres/request', { withUserDatabase: (callback: Parameters<typeof scoped>[1]) => scoped('camms_app', callback) })
    mockModule('../../lib/postgres/db', { getAuthDatabase: () => ({ transaction: (callback: Parameters<typeof scoped>[1]) => scoped('camms_auth', callback) }) })
    const admin = await import('../../features/admin/postgres-admin')
    const created = await admin.pgCreateAuthUser({ email: `${randomUUID()}@example.com`, full_name: 'Account fixture', password: 'first-password', role: 'staff', is_active: true })
    assert.equal(created.success, true, JSON.stringify(created))
    const userId = created.userId!
    const session = async () => client!.query("insert into private_auth.sessions(token_hash,user_id,expires_at) values($1,$2,now()+interval '1 day')", [randomUUID(), userId])
    await session()
    assert.equal((await admin.pgResetAuthPassword(userId, 'replacement-password')).success, true)
    assert.equal((await client.query('select * from private_auth.sessions where user_id=$1', [userId])).rowCount, 0)
    const credentials = await client.query('select password_hash from private_auth.credentials where user_id=$1', [userId])
    assert.equal(await verifyPassword('replacement-password', credentials.rows[0].password_hash), true)
    assert.equal(await verifyPassword('first-password', credentials.rows[0].password_hash), false)
    await session()
    assert.equal((await admin.pgUpdateUserEmail(userId, `${randomUUID()}@example.com`)).success, true)
    assert.equal((await client.query('select * from private_auth.sessions where user_id=$1', [userId])).rowCount, 0)
    await session()
    assert.equal((await admin.pgUpdateUserProfile(userId, { role: 'viewer', is_active: false })).success, true)
    assert.equal((await client.query('select * from private_auth.sessions where user_id=$1', [userId])).rowCount, 0)
    const metadata = await admin.pgUpsertTableRow('categories', null, { name: `Fixture ${randomUUID()}` })
    assert.equal(metadata.success, true, JSON.stringify(metadata))
    const categoryId = String(metadata.data!.id)
    assert.equal((await admin.pgUpsertTableRow('categories', categoryId, { description: 'Updated fixture' })).success, true)
    assert.equal((await admin.pgDeleteTableRow('categories', categoryId)).success, true)
    assert.ok((await admin.pgGetAuditLogsList({ action: 'INSERT' })).totalCount > 0)
    assert.ok((await admin.pgGetProfilesList({ q: 'Account fixture' })).totalCount > 0)
    const exported = await admin.pgExportDatabaseData()
    assert.ok(exported.backup, JSON.stringify(exported))
    assert.ok(!JSON.stringify(exported.backup).includes('password_hash'))
    assert.equal((await admin.pgDeleteAuthUser(userId)).success, true)
    assert.equal((await client.query('select * from private_auth.credentials where user_id=$1', [userId])).rowCount, 0)
    const events = await client.query('select action from public.audit_logs where target_id=$1', [userId])
    for (const action of ['create_user', 'RESET_PASSWORD', 'update_user', 'delete_user']) assert.ok(events.rows.some(row => row.action === action), action)
    assert.ok((await admin.pgDeleteAuthUser(actor)).error)
  } finally {
    if (client) { await client.query('rollback'); client.release() }
    await pool.end()
  }
})
