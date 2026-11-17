import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { parse } from 'dotenv'
import { Pool } from 'pg'
import { drizzle } from 'drizzle-orm/node-postgres'
import { migrate } from 'drizzle-orm/node-postgres/migrator'

test('isolated PostgreSQL request RLS, approval immutability and rollback', {
  skip: process.env.POSTGRES_ADMIN_LIVE_TEST !== '1' || !existsSync('.env.postgres.app'), timeout: 120_000,
}, async () => {
  const env = parse(readFileSync('.env.postgres.app'))
  const name = `camms_disposable_${randomUUID().replaceAll('-', '')}`
  const management = new Pool({ connectionString: env.DATABASE_MIGRATION_URL, connectionTimeoutMillis: 5000 })
  const pools: Pool[] = []
  let created = false
  const poolFor = (connection: string) => {
    const url = new URL(connection); url.pathname = `/${name}`
    const pool = new Pool({ connectionString: url.toString(), connectionTimeoutMillis: 5000 })
    pools.push(pool); return pool
  }
  try {
    assert.match(name, /^camms_disposable_[a-f0-9]{32}$/)
    await management.query(`CREATE DATABASE "${name}"`); created = true
    const owner = poolFor(env.DATABASE_MIGRATION_URL)
    const folder = 'db/postgres/migrations'
    await migrate(drizzle(owner), { migrationsFolder: folder })
    const user = randomUUID(), other = randomUUID(), admin = randomUUID()
    for (const [id, role] of [[user, 'user'], [other, 'user'], [admin, 'admin']]) {
      await owner.query('INSERT INTO profiles(id,full_name,email,role) VALUES($1,$2,$3,$4)', [id, role, `${id}@fixture.invalid`, role])
    }
    const material = randomUUID(), asset = randomUUID(), handAsset = randomUUID()
    await owner.query("INSERT INTO items(id,item_name,item_type,quantity,is_central,asset_no) VALUES ($1,'Material','material',10,true,NULL),($2,'Asset','asset',1,true,'FIXTURE-1'),($3,'Handover','asset',1,true,'FIXTURE-2')", [material, asset, handAsset])
    const app = poolFor(env.DATABASE_URL)
    async function asUser<T>(id: string, operation: (client: import('pg').PoolClient) => Promise<T>) {
      const client = await app.connect()
      try {
        await client.query('BEGIN'); await client.query("SELECT set_config('app.user_id',$1,true)", [id])
        assert.equal((await client.query('SELECT current_user AS role')).rows[0].role, 'camms_app')
        const result = await operation(client); await client.query('COMMIT'); return result
      } catch (error) { await client.query('ROLLBACK'); throw error } finally { client.release() }
    }
    const docs: string[] = []
    for (const type of ['material_issue','asset_handover','asset_borrow']) {
      const id = randomUUID(); docs.push(id)
      await asUser(user, async client => {
        await client.query("INSERT INTO disbursements(id,transaction_type,recipient_name,department_name,purpose,status,due_date,created_by) VALUES($1,$2,'Recipient','Department','Fixture','pending_approval','2027-01-01',$3)", [id,type,user])
        await client.query('INSERT INTO disbursement_items(disbursement_id,item_id,requested_qty) VALUES($1,$2,1)', [id,type === 'material_issue' ? material : type === 'asset_handover' ? handAsset : asset])
      })
    }
    await assert.rejects(asUser(user, c => c.query("INSERT INTO disbursements(transaction_type,recipient_name,department_name,purpose,status,created_by) VALUES('material_issue','R','D','P','pending_approval',$1)", [other])), /row-level security/)
    await assert.rejects(asUser(other, c => c.query('INSERT INTO disbursement_items(disbursement_id,item_id,requested_qty) VALUES($1,$2,1)', [docs[0],material])), /row-level security/)
    await assert.rejects(asUser(user, c => c.query("INSERT INTO stock_movements(item_id,delta,balance_after,movement_type,created_by) VALUES($1,-1,9,'issue',$2)", [material,user])), /row-level security/)
    await assert.rejects(asUser(user, c => c.query("INSERT INTO disbursements(transaction_type,recipient_name,department_name,purpose,status,created_by) VALUES('material_issue','R','D','P','confirmed',$1)", [user])), /row-level security/)
    await asUser(user, async c => {
      assert.equal((await c.query('UPDATE items SET quantity=999 WHERE id=$1', [material])).rowCount, 0)
      assert.equal((await c.query("UPDATE disbursement_items SET issued_qty=1 WHERE disbursement_id=$1", [docs[0]])).rowCount, 0)
    })
    await assert.rejects(asUser(user, c => c.query("UPDATE disbursements SET status='confirmed',document_no='BAD',fiscal_year=2570,confirmed_at=now(),confirmed_by=$2 WHERE id=$1", [docs[0],user])), /User|row-level security/)
    await asUser(other, async c => assert.equal((await c.query("UPDATE disbursements SET status='cancelled' WHERE id=$1", [docs[0]])).rowCount, 0))
    await assert.rejects(asUser(user, c => c.query("UPDATE disbursements SET status='cancelled',purpose='tampered' WHERE id=$1", [docs[0]])), /immutable/)
    await asUser(user, async c => {
      assert.equal((await c.query('SELECT id FROM disbursements WHERE id=$1 FOR UPDATE', [docs[0]])).rowCount, 1)
      await c.query("UPDATE disbursements SET status='cancelled' WHERE id=$1", [docs[0]])
    })
    await assert.rejects(asUser(user, c => c.query('INSERT INTO disbursement_items(disbursement_id,item_id,requested_qty) VALUES($1,$2,1)', [docs[1],material])), /only accepts/)
    for (const [index, status] of [[1, 'confirmed'],[2, 'active_borrow']] as const) {
      await asUser(admin, c => c.query('UPDATE disbursements SET status=$2,document_no=$3,fiscal_year=2570,confirmed_at=now(),confirmed_by=$4 WHERE id=$1', [docs[index],status,`FIXTURE-${index}`,admin]))
      await assert.rejects(asUser(admin, c => c.query('UPDATE disbursements SET confirmed_by=NULL WHERE id=$1', [docs[index]])), /immutable/)
      await assert.rejects(asUser(admin, c => c.query("UPDATE disbursements SET purpose='changed' WHERE id=$1", [docs[index]])), /immutable/)
    }
    await assert.rejects(asUser(admin, async c => {
      await c.query('UPDATE items SET quantity=quantity-1 WHERE id=$1', [material])
      await c.query("UPDATE disbursements SET status='pending_approval' WHERE id=$1", [docs[1]])
    }), /Invalid disbursement transition/)
    assert.equal((await owner.query('SELECT quantity FROM items WHERE id=$1', [material])).rows[0].quantity, 10)
    await assert.rejects(asUser(admin, c => c.query('INSERT INTO disbursement_items(disbursement_id,item_id,requested_qty) VALUES($1,$2,1)', [docs[1],handAsset])), /Cannot add lines/)
    const lockingHeader = randomUUID()
    await owner.query("INSERT INTO disbursements(id,transaction_type,recipient_name,department_name,purpose,status,created_by) VALUES($1,'material_issue','R','D','P','pending_approval',$2)", [lockingHeader,user])
    const parentLocker = await owner.connect()
    try {
      await parentLocker.query('BEGIN')
      await parentLocker.query('SELECT id FROM disbursements WHERE id=$1 FOR UPDATE',[lockingHeader])
      await assert.rejects(asUser(admin, async c => {
        await c.query("SET LOCAL lock_timeout='100ms'")
        await c.query('INSERT INTO disbursement_items(disbursement_id,item_id,requested_qty) VALUES($1,$2,1)',[lockingHeader,material])
      }), /lock timeout/)
      await parentLocker.query("UPDATE disbursements SET status='cancelled' WHERE id=$1",[lockingHeader])
      await parentLocker.query('COMMIT')
    } finally { await parentLocker.query('ROLLBACK'); parentLocker.release() }
    await assert.rejects(asUser(admin, c => c.query('INSERT INTO disbursement_items(disbursement_id,item_id,requested_qty) VALUES($1,$2,1)',[lockingHeader,material])),/Cannot add lines/)
    // Concurrent actors use the same transaction-scoped reservation lock. The
    // second reader must observe the first committed reservation before deciding.
    const lockKey = `camms:disbursement:${asset}`
    const first = await app.connect(), second = await app.connect()
    try {
      await first.query('BEGIN'); await second.query('BEGIN')
      await first.query("SELECT set_config('app.user_id',$1,true)", [user])
      await second.query("SELECT set_config('app.user_id',$1,true)", [other])
      await first.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [lockKey])
      const tryLock = await second.query('SELECT pg_try_advisory_xact_lock(hashtextextended($1,0)) AS acquired', [lockKey])
      assert.equal(tryLock.rows[0].acquired, false)
      await first.query('COMMIT')
      await second.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [lockKey])
      const reservations = await second.query("SELECT count(*)::int AS total FROM disbursement_items l JOIN disbursements d ON d.id=l.disbursement_id WHERE l.item_id=$1 AND d.status IN ('pending_approval','active_borrow','partially_returned')", [asset])
      assert.equal(reservations.rows[0].total, 1)
      await second.query('ROLLBACK')
    } finally {
      await first.query('ROLLBACK'); await second.query('ROLLBACK')
      first.release(); second.release()
    }
    await asUser(admin, c => c.query("UPDATE disbursements SET status='returned' WHERE id=$1", [docs[2]]))
    await assert.rejects(asUser(admin, c => c.query("UPDATE disbursements SET status='active_borrow' WHERE id=$1", [docs[2]])), /Invalid disbursement transition/)
  } finally {
    await Promise.all(pools.map(pool => pool.end()))
    if (created) {
      assert.match(name, /^camms_disposable_[a-f0-9]{32}$/)
      assert.notEqual(name, new URL(env.DATABASE_MIGRATION_URL).pathname.slice(1))
      await management.query(`DROP DATABASE "${name}"`)
    }
    await management.end()
  }
})
