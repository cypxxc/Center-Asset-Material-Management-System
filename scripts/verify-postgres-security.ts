// Run: node --conditions=react-server --import tsx scripts/verify-postgres-security.ts
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { parse } from 'dotenv'
import { Pool } from 'pg'
import { sql } from 'drizzle-orm'
import { getDatabase, withIdentity, closePostgresPools } from '../lib/postgres/db'
import { authenticatePassword, profileForToken, replacePasswordForToken, tokenHash } from '../lib/postgres/session'
import { hashPassword, verifyPassword } from '../lib/postgres/password'
import { consumeLoginAttempt } from '../lib/postgres/login-throttle'

async function main() {
  const config = parse(readFileSync('.env.postgres.app'))
  for (const key of ['DATABASE_URL', 'DATABASE_AUTH_URL']) process.env[key] = config[key]
  const owner = new Pool({ connectionString: config.DATABASE_MIGRATION_URL, max: 2 })
  const viewer = randomUUID(), staff = randomUUID(), disabled = randomUUID(), category = randomUUID()
  const fixtureIds = [viewer, staff, disabled, category]
  const password = 'security-test-password'
  const email = `security-${viewer}@example.invalid`
  const denied = async (operation: () => Promise<unknown>) => assert.rejects(operation, (error: unknown) => {
    const dbError = error as { code?: string; cause?: { code?: string } }
    return (dbError.code ?? dbError.cause?.code) === '42501'
  })
  try {
    const hash = await hashPassword(password)
    assert(await verifyPassword(password, hash))
    assert(!await verifyPassword('incorrect', hash))
    assert(!await verifyPassword(password, `${hash}:trailing`))
    assert(!await verifyPassword('x'.repeat(1025), hash))
    assert(!await verifyPassword(password, 'scrypt:bad:bad'))
    for (let attempt=0;attempt<10;attempt++) assert.equal(await consumeLoginAttempt(email),true)
    assert.equal(await consumeLoginAttempt(email.toUpperCase()),false,'Case variations share the persisted login budget')
    await owner.query(`insert into public.profiles(id,full_name,email,role,is_active) values ($1,'Security fixture',$4,'viewer',true),($2,$4,$5,'staff',true),($3,'Disabled security fixture',$6,'viewer',false)`, [viewer, staff, disabled, email, `staff-${staff}@example.invalid`, `disabled-${disabled}@example.invalid`])
    for (const id of [viewer, staff, disabled]) await owner.query('insert into private_auth.credentials(user_id,password_hash) values($1,$2)', [id, hash])
    await owner.query('insert into public.categories(id,name) values($1,$2)', [category, `Security fixture ${category}`])

    const role = await getDatabase().execute<{ rolsuper: boolean; rolbypassrls: boolean }>(sql`select rolsuper,rolbypassrls from pg_roles where rolname=current_user`)
    assert.equal(role.rows[0].rolsuper, false)
    assert.equal(role.rows[0].rolbypassrls, false)
    assert.equal((await getDatabase().execute(sql`select id from public.categories where id=${category}`)).rows.length, 0)
    await denied(() => getDatabase().execute(sql`select * from private_auth.credentials`))
    await denied(() => getDatabase().execute(sql`insert into public.categories(name) values('anonymous forbidden fixture')`))
    await withIdentity(viewer, async (tx) => {
      assert.equal((await tx.execute(sql`select id from public.categories where id=${category}`)).rows.length, 1)
      assert.equal((await tx.execute(sql`update public.categories set description='forbidden' where id=${category} returning id`)).rows.length, 0)
      assert.equal((await tx.execute(sql`update public.profiles set full_name='forbidden' where id=${staff} returning id`)).rows.length, 0)
    })
    await denied(() => withIdentity(viewer, tx => tx.execute(sql`insert into public.categories(name) values('viewer forbidden fixture')`)))
    await denied(() => withIdentity(viewer, tx => tx.execute(sql`update public.profiles set role='admin' where id=${viewer}`)))
    await denied(() => withIdentity(viewer, tx => tx.execute(sql`update public.profiles set is_active=false where id=${viewer}`)))
    await withIdentity(staff, async tx => {
      assert.equal((await tx.execute(sql`update public.categories set description='staff permitted' where id=${category} returning id`)).rows.length, 1)
      await tx.execute(sql`savepoint staff_delete_check`)
      assert.equal((await tx.execute(sql`delete from public.categories where id=${category} returning id`)).rows.length, 1)
      await tx.execute(sql`rollback to savepoint staff_delete_check`)
    })
    await withIdentity(disabled, async tx => assert.equal((await tx.execute(sql`select id from public.categories where id=${category}`)).rows.length, 0))
    assert.equal((await getDatabase().execute(sql`select private.current_user_id() as id`)).rows[0].id, null)
    await assert.rejects(withIdentity(staff, async tx => { await tx.execute(sql`select 1`); throw new Error('fixture rollback') }))
    assert.equal((await getDatabase().execute(sql`select private.current_user_id() as id`)).rows[0].id, null)
    console.log('PASS restricted roles, anonymous access, viewer writes, staff permissions, profile privilege escalation, identity cleanup')

    // Another user's full name equals this email; email must retain identifier precedence.
    const first = await authenticatePassword(email.toUpperCase(), password)
    assert(first)
    assert.equal((await profileForToken(first.token))?.id, viewer)
    assert.equal(await authenticatePassword(email, 'incorrect'), null)
    assert.equal(await authenticatePassword(disabled, password), null)
    assert.equal(await profileForToken('invalid-token'), null)
    const second = await authenticatePassword(viewer.toUpperCase(), password)
    assert(second)
    const replacement = await replacePasswordForToken(first.token, 'replacement-password')
    assert(replacement)
    assert.equal(await profileForToken(first.token), null)
    assert.equal(await profileForToken(second.token), null)
    assert.equal(await replacePasswordForToken(first.token, 'revoked-cookie-password'), null)
    assert.equal(await authenticatePassword(email, password), null)
    assert.equal((await profileForToken(replacement.token))?.id, viewer)
    await owner.query('update private_auth.sessions set expires_at=now()-interval \'1 second\' where token_hash=$1', [tokenHash(replacement.token)])
    assert.equal(await profileForToken(replacement.token), null)
    assert.equal(await replacePasswordForToken(replacement.token, 'expired-cookie-password'), null)
    const active = await authenticatePassword(email, 'replacement-password')
    assert(active)
    const resetConnection = await owner.connect()
    try {
      await resetConnection.query('begin')
      await resetConnection.query('select id from public.profiles where id=$1 for update', [viewer])
      const pendingLogin = authenticatePassword(email, 'replacement-password')
      const pendingChange = replacePasswordForToken(active.token, 'stale-session-password')
      // Observe actual blocked transactions, rather than relying on timing alone.
      let blocked = false
      for (let attempt = 0; attempt < 100; attempt++) {
        const waiting = await owner.query("select count(*)::int as count from pg_stat_activity where datname=current_database() and usename='camms_auth' and wait_event_type='Lock' and query like '%public.profiles p%'")
        if (waiting.rows[0].count >= 2) { blocked = true; break }
        await new Promise(resolve => setTimeout(resolve, 25))
      }
      await resetConnection.query('update private_auth.credentials set password_hash=$1 where user_id=$2', [await hashPassword('admin-reset-password'), viewer])
      await resetConnection.query('delete from private_auth.sessions where user_id=$1', [viewer])
      await resetConnection.query('commit')
      assert.equal(await pendingLogin, null)
      assert.equal(await pendingChange, null)
      assert(blocked, 'Both authentication operations must have waited for the reset profile lock')
      assert.equal(await profileForToken(active.token), null)
    } finally {
      await resetConnection.query('rollback')
      resetConnection.release()
    }
    const afterReset = await authenticatePassword(email, 'admin-reset-password')
    assert(afterReset)
    await owner.query('update public.profiles set is_active=false where id=$1', [viewer])
    assert.equal(await profileForToken(afterReset.token), null)
    assert.equal(await replacePasswordForToken(afterReset.token, 'disabled-cookie-password'), null)
    console.log('PASS password validation, identifier precedence, session rotation/revocation, expired and disabled sessions, concurrent reset races')
  } finally {
    // Delete only this run's UUID-scoped records, including trigger-generated audit rows.
    await owner.query('delete from public.categories where id=$1', [category])
    await owner.query('delete from public.profiles where id=any($1::uuid[])', [[viewer, staff, disabled]])
    await owner.query('delete from public.audit_logs where target_id=any($1::uuid[]) or user_id=any($1::uuid[])', [fixtureIds])
    await Promise.all([owner.end(), closePostgresPools()])
  }
}
main().catch((error: unknown) => { console.error(error); process.exitCode = 1 })
