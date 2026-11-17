import '../setup/dom'
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { parse } from 'dotenv'
import { Pool, type PoolClient } from 'pg'
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres'
import type { SQL } from 'drizzle-orm'

// All fixtures, sessions and the schema change are rolled back together.
test('NULL-email accounts log in by name/UUID and can add a unique email later', {
  skip: process.env.POSTGRES_NULL_EMAIL_LIVE_TEST !== '1',
}, async () => {
  const env = parse(readFileSync('.env.postgres.app'))
  const target = new URL(env.DATABASE_MIGRATION_URL)
  assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(target.hostname), 'Live test requires a local database')
  const pool = new Pool({ connectionString: env.DATABASE_MIGRATION_URL, connectionTimeoutMillis: 5000 })
  let client: PoolClient | undefined
  let token: string | undefined
  const actor = randomUUID()
  function mockModule(path: string, exports: unknown) {
    const filename = require.resolve(path)
    require.cache[filename] = { id: filename, filename, loaded: true, exports } as NodeJS.Module
  }
  try {
    client = await pool.connect()
    await client.query('begin')
    await client.query('ALTER TABLE public.profiles ALTER COLUMN email DROP NOT NULL')
    await client.query("insert into public.profiles(id, full_name, email, role) values($1, 'Email test admin', $2, 'admin')", [actor, `${actor}@example.com`])

    async function scoped<T>(role: 'camms_auth' | 'camms_app', work: (db: NodePgDatabase) => Promise<T>): Promise<T> {
      await client!.query('savepoint email_action')
      try {
        await client!.query(`set local role ${role}`)
        await client!.query("select set_config('app.user_id', $1, true)", [actor])
        const result = await work(drizzle(client!))
        await client!.query('reset role')
        await client!.query('release savepoint email_action')
        return result
      } catch (error) {
        await client!.query('rollback to savepoint email_action')
        await client!.query('release savepoint email_action')
        throw error
      }
    }
    mockModule('../../features/auth/queries', { getCurrentProfile: async () => ({ id: actor, role: 'admin', is_active: true }) })
    mockModule('../../lib/postgres/request', { withUserDatabase: (work: (db: NodePgDatabase) => Promise<unknown>) => scoped('camms_app', work) })
    mockModule('../../lib/postgres/db', {
      getAuthDatabase: () => ({
        transaction: (work: (db: NodePgDatabase) => Promise<unknown>) => scoped('camms_auth', work),
        execute: (query: SQL) => scoped('camms_auth', db => db.execute(query)),
      }),
    })
    mockModule('next/headers', { cookies: async () => ({ get: () => token ? { value: token } : undefined }) })

    const admin = await import('../../features/admin/postgres-admin')
    const auth = await import('../../lib/postgres/session')
    const actions = await import('../../features/auth/postgres-actions')
    const name = `No email ${randomUUID()}`
    const first = await admin.pgCreateAuthUser({ full_name: name, password: 'test-password', role: 'user', is_active: true })
    const second = await admin.pgCreateAuthUser({ email: '', full_name: `Other ${randomUUID()}`, password: 'test-password', role: 'user', is_active: true })
    assert.equal(first.success, true, JSON.stringify(first))
    assert.equal(second.success, true, JSON.stringify(second))
    const accounts = await client.query('select email from public.profiles where id=any($1::uuid[])', [[first.userId, second.userId]])
    assert.equal(accounts.rowCount, 2)
    assert.ok(accounts.rows.every(row => row.email === null))

    const byName = await auth.authenticatePassword(name, 'test-password')
    assert.ok(byName)
    assert.ok(await auth.authenticatePassword(first.userId!, 'test-password'))
    assert.equal(await auth.authenticatePassword(name, 'wrong-password'), null)
    token = byName.token
    assert.equal((await auth.getPostgresProfile())?.email, null)

    const invalid = new FormData()
    invalid.set('email', 'not-an-email')
    assert.ok((await actions.postgresAddPersonalEmail(invalid)).error)
    const duplicate = new FormData()
    duplicate.set('email', `${actor}@example.com`)
    assert.ok((await actions.postgresAddPersonalEmail(duplicate)).error)
    assert.equal((await auth.getPostgresProfile())?.email, null)

    const email = `${randomUUID()}@example.com`
    const form = new FormData()
    form.set('email', email.toUpperCase())
    assert.ok((await actions.postgresAddPersonalEmail(form)).success)
    assert.equal((await auth.getPostgresProfile())?.email, email)
    assert.ok(await auth.authenticatePassword(email, 'test-password'))
    assert.ok((await actions.postgresAddPersonalEmail(form)).error, 'Cannot replace an existing real email')
    const other = await client.query('select email from public.profiles where id=$1', [second.userId])
    assert.equal(other.rows[0].email, null, 'Adding an email cannot affect another account')

    const secondLogin = await auth.authenticatePassword(second.userId!, 'test-password')
    token = secondLogin!.token
    await client.query('update private_auth.sessions set expires_at=now()-interval \'1 second\' where token_hash=$1', [auth.tokenHash(token)])
    assert.equal(await auth.addCurrentAccountEmail(`${randomUUID()}@example.com`, null), false)
  } finally {
    if (client) { await client.query('rollback'); client.release() }
    await pool.end()
  }
})
