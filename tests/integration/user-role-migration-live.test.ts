import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { parse } from 'dotenv'
import { Pool } from 'pg'

test('role upgrade preserves accounts and user request permissions without granting inventory writes', {
  skip: process.env.POSTGRES_ADMIN_LIVE_TEST !== '1', timeout: 60000,
}, async () => {
  const env = parse(readFileSync('.env.postgres.app'))
  const target = new URL(env.DATABASE_MIGRATION_URL)
  assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(target.hostname))
  const database = `camms_disposable_${randomUUID().replaceAll('-', '')}`
  assert.match(database, /^camms_disposable_[a-f0-9]{32}$/)
  const management = new Pool({ connectionString: env.DATABASE_MIGRATION_URL })
  const pools: Pool[] = []
  let created = false
  const fixturePool = (connection: string) => {
    const url = new URL(connection); url.pathname = `/${database}`
    const pool = new Pool({ connectionString: url.toString() }); pools.push(pool); return pool
  }
  try {
    await management.query(`CREATE DATABASE "${database}"`); created = true
    const owner = fixturePool(env.DATABASE_MIGRATION_URL)
    // The baseline includes all schema features in 0000_final_schema.sql.
    await owner.query(readFileSync('db/postgres/migrations/0000_final_schema.sql', 'utf8'))
    const userId = randomUUID(), itemId = randomUUID(), requestId = randomUUID()

    // Database check constraint strictly rejects legacy 'viewer' role
    await assert.rejects(
      owner.query("INSERT INTO public.profiles(id,full_name,role) VALUES($1,'Role fixture','viewer')", [randomUUID()]),
      (error: { code?: string }) => error.code === '23514'
    )

    await owner.query("INSERT INTO public.profiles(id,full_name,role) VALUES($1,'Role fixture','user')", [userId])
    await owner.query("INSERT INTO public.materials(id,item_name,item_type,quantity,is_central) VALUES($1,'Fixture','material',2,true)", [itemId])

    const account = (await owner.query('SELECT id,full_name,role,is_active FROM public.profiles WHERE id=$1', [userId])).rows[0]
    assert.deepEqual(account, { id: userId, full_name: 'Role fixture', role: 'user', is_active: true })
    assert.equal((await owner.query("INSERT INTO public.profiles(full_name) VALUES('Default role fixture') RETURNING role")).rows[0].role, 'user')
    assert.equal((await owner.query("SELECT count(*)::int AS count FROM pg_policies WHERE schemaname='public' AND (coalesce(qual,'') LIKE '%viewer%' OR coalesce(with_check,'') LIKE '%viewer%')")).rows[0].count, 0)
    const app = fixturePool(env.DATABASE_URL)
    const client = await app.connect()
    try {
      await client.query('BEGIN')
      await client.query("SELECT set_config('app.user_id',$1,true)", [userId])
      assert.equal((await client.query('SELECT private.current_app_role() AS role')).rows[0].role, 'user')
      await client.query("INSERT INTO public.disbursements(id,transaction_type,recipient_name,department_name,purpose,status,created_by) VALUES($1,'material_issue','Fixture','Fixture','Fixture','pending_approval',$2)", [requestId, userId])
      await client.query('INSERT INTO public.disbursement_items(disbursement_id,item_id,requested_qty) VALUES($1,$2,1)', [requestId, itemId])
      await client.query('SAVEPOINT denial_items')
      await assert.rejects(client.query("INSERT INTO public.items(item_name,item_type) VALUES('Denied','asset')"), /row-level security/)
      await client.query('ROLLBACK TO SAVEPOINT denial_items')
      await client.query('SAVEPOINT denial_materials')
      await assert.rejects(client.query("INSERT INTO public.materials(item_name,item_type) VALUES('Denied','material')"), /row-level security/)
      await client.query('ROLLBACK TO SAVEPOINT denial_materials')
      await client.query("UPDATE public.disbursements SET status='cancelled' WHERE id=$1", [requestId])
      assert.equal((await client.query('SELECT status FROM public.disbursements WHERE id=$1', [requestId])).rows[0].status, 'cancelled')
      await client.query('ROLLBACK')
    } finally { client.release() }
  } finally {
    await Promise.all(pools.map(pool => pool.end()))
    if (created) await management.query(`DROP DATABASE "${database}"`)
    await management.end()
  }
})
