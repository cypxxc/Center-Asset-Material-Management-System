import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { parse } from 'dotenv'
import { Pool } from 'pg'
import { drizzle } from 'drizzle-orm/node-postgres'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { verifyPassword } from '../../lib/postgres/password'

test('Navicat password input is atomic, private, owner-only, and usable for login', {
  skip: process.env.POSTGRES_ADMIN_LIVE_TEST !== '1', timeout: 120000,
}, async () => {
  const env = parse(readFileSync('.env.postgres.app'))
  const name = `camms_password_${randomUUID().replaceAll('-', '')}`
  const admin = new Pool({ connectionString: env.DATABASE_MIGRATION_URL })
  let db: Pool | undefined
  try {
    await admin.query(`CREATE DATABASE "${name}"`)
    const url = new URL(env.DATABASE_MIGRATION_URL)
    url.pathname = '/' + name
    db = new Pool({ connectionString: url.toString(), max: 1 })
    await migrate(drizzle(db), { migrationsFolder: './db/postgres/migrations' })
    await migrate(drizzle(db), { migrationsFolder: './db/postgres/migrations' })
    const inserted = await db.query("INSERT INTO public.profiles(full_name,password) VALUES('password-fixture',$1) RETURNING id,password", ['Navicat-ทดสอบ!'])
    const id = inserted.rows[0].id
    assert.equal(inserted.rows[0].password, null)
    const credential = async () => (await db!.query('SELECT password_hash FROM private_auth.credentials WHERE user_id=$1', [id])).rows[0].password_hash as string
    assert.equal(await verifyPassword('Navicat-ทดสอบ!', await credential()), true)
    const initialHash = await credential()
    // A skipped import row must never reset an existing account's credentials.
    await assert.rejects(db.query("INSERT INTO public.profiles(id,full_name,password) VALUES($1,'duplicate',$2) ON CONFLICT(id) DO NOTHING", [id, 'import-password']), /already exists/i)
    assert.equal(await credential(), initialHash)
    // A concurrent password-less insert must also participate in serialization.
    const concurrentId = randomUUID()
    const other = new Pool({ connectionString: url.toString(), application_name: 'navicat-password-concurrency', max: 1 })
    let pending: Promise<unknown> | undefined
    try {
      await db.query('BEGIN')
      await db.query("INSERT INTO public.profiles(id,full_name) VALUES($1,'concurrent-original')", [concurrentId])
      pending = other.query("INSERT INTO public.profiles(id,full_name,password) VALUES($1,'concurrent-ignored','concurrent-password') ON CONFLICT(id) DO NOTHING", [concurrentId]).then(() => null, error => error)
      let waiting = false
      for (let attempt = 0; attempt < 100; attempt++) {
        await db.query('SELECT pg_stat_clear_snapshot()')
        const activity = await db.query("SELECT 1 FROM pg_stat_activity WHERE application_name='navicat-password-concurrency' AND wait_event_type='Lock'")
        if (activity.rowCount) { waiting = true; break }
        await new Promise(resolve => setTimeout(resolve, 20))
      }
      assert.equal(waiting, true, 'Second insertion must reach its lock before the first commits')
      await db.query('COMMIT')
      const error = await pending
      assert.ok(error instanceof Error && /already exists/i.test(error.message))
      assert.equal((await db.query('SELECT count(*)::int AS n FROM private_auth.credentials WHERE user_id=$1', [concurrentId])).rows[0].n, 0)
    } finally {
      await db.query('ROLLBACK')
      await pending
      await other.end()
    }
    await db.query("UPDATE public.profiles SET password='' WHERE id=$1", [id])
    await db.query('UPDATE public.profiles SET password=NULL WHERE id=$1', [id])
    assert.equal(await credential(), initialHash)
    await db.query("INSERT INTO private_auth.sessions(token_hash,user_id,expires_at) VALUES('fixture-token',$1,now()+interval '1 hour')", [id])
    await db.query('UPDATE public.profiles SET password=$1 WHERE id=$2', ['replacement-password', id])
    assert.equal(await verifyPassword('replacement-password', await credential()), true)
    assert.equal(await verifyPassword('Navicat-ทดสอบ!', await credential()), false)
    assert.equal((await db.query('SELECT count(*)::int AS n FROM private_auth.sessions WHERE user_id=$1', [id])).rows[0].n, 0)
    for (const invalid of ['short', 'a'.repeat(73), 'ร'.repeat(25)]) {
      await assert.rejects(db.query('UPDATE public.profiles SET password=$1 WHERE id=$2', [invalid, id]), /Password/)
    }
    assert.equal(await verifyPassword('replacement-password', await credential()), true)
    await db.query('BEGIN')
    await db.query("UPDATE public.profiles SET password='rollback-password' WHERE id=$1", [id])
    await db.query('ROLLBACK')
    assert.equal(await verifyPassword('replacement-password', await credential()), true)
    await db.query('BEGIN')
    await db.query('SET LOCAL ROLE camms_auth')
    await assert.rejects(db.query("INSERT INTO public.profiles(full_name,password) VALUES('forbidden','runtime-password')"), /owner|permission denied/i)
    await db.query('ROLLBACK')
    const audit = await db.query('SELECT old_data,new_data FROM public.audit_logs WHERE target_id=$1', [id])
    assert.ok(audit.rows.length > 0)
    for (const row of audit.rows) {
      assert.doesNotMatch(JSON.stringify(row), /Navicat-|replacement-password|rollback-password|\$2[aby]\$/)
      assert.ok(row.new_data === null || row.new_data.password === null)
    }
    await db.query('DELETE FROM public.profiles WHERE id=$1', [id])
    assert.equal((await db.query('SELECT count(*)::int AS n FROM private_auth.credentials WHERE user_id=$1', [id])).rows[0].n, 0)
  } finally {
    await db?.end()
    await admin.query(`DROP DATABASE IF EXISTS "${name}"`)
    await admin.end()
  }
})
