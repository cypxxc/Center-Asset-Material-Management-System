import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { parse } from 'dotenv'
import { Pool } from 'pg'

test('owner restoration of pending material snapshots does not replay stock deductions', { skip: process.env.POSTGRES_QUERY_INTEGRATION !== '1' }, async () => {
  const env = parse(readFileSync('.env.postgres.app'))
  const pool = new Pool({ connectionString: env.DATABASE_MIGRATION_URL, max: 1 })
  const client = await pool.connect()
  try {
    await client.query('begin')
    const user = randomUUID(), item = randomUUID(), doc = randomUUID()
    await client.query("insert into public.profiles(id,full_name,role) values($1,'restore fixture','admin')", [user])
    await client.query("insert into public.materials(id,item_name,item_type,quantity,status) values($1,'restored stock snapshot','material',0,'active')", [item])
    await client.query("insert into public.disbursements(id,transaction_type,recipient_name,department_name,purpose,status,created_by) values($1,'material_issue','fixture','fixture','restore','pending_approval',$2)", [doc, user])
    const line = await client.query<{ id: string }>("insert into public.disbursement_items(disbursement_id,item_id,requested_qty,status) values($1,$2,2,'pending') returning id", [doc, item])
    assert.equal((await client.query('select quantity from public.materials where id=$1', [item])).rows[0].quantity, 0)
    assert.equal((await client.query('select count(*)::int as count from public.stock_movements where item_id=$1', [item])).rows[0].count, 0, 'restoration does not create a second issue movement')
    await client.query("insert into public.stock_movements(item_id,disbursement_item_id,delta,balance_after,movement_type,created_by) values($1,$2,-2,0,'issue',$3)", [item, line.rows[0].id, user])
    assert.equal((await client.query('select quantity from public.materials where id=$1', [item])).rows[0].quantity, 0)
  } finally { await client.query('rollback'); client.release(); await pool.end() }
})
