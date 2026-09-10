import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'

test('RLS role lookup is a statement InitPlan and retains active-profile boundaries', async () => {
  const db = new PGlite()
  try {
    await db.exec(readFileSync('tests/fixtures/performance-rls.sql', 'utf8'))
    await db.exec(`INSERT INTO items SELECT n, 'item ' || n, CASE WHEN n % 2 = 0 THEN now() END FROM generate_series(1, 100) n`)
    await db.exec(readFileSync('db/migrations/20260910083125_statement_scoped_rls_role.sql', 'utf8'))
    await db.exec(`SET ROLE authenticated; SET request.jwt.claim.sub = '00000000-0000-0000-0000-000000000003'`)
    const plan = await db.query('EXPLAIN (ANALYZE, FORMAT JSON) SELECT count(*) FROM items WHERE deleted_at IS NULL')
    assert.match(JSON.stringify(plan.rows), /InitPlan/, 'role lookup must not run per row')
    const count = async (table: string) => (await db.query<{ count: number }>(`SELECT count(*)::int AS count FROM ${table}`)).rows[0].count
    assert.equal(await count('items'), 50)
    assert.equal(await count('categories'), 1)
    assert.equal(await count('audit_logs'), 0)
    await assert.rejects(db.exec(`INSERT INTO items VALUES (101, 'forbidden', NULL)`), /row-level security/)
    for (const id of [1, 2]) {
      await db.exec(`SET request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000${id}'`)
      assert.equal(await count('items'), 100)
      assert.equal(await count('categories'), 2)
      assert.equal(await count('audit_logs'), id === 1 ? 1 : 0)
      await db.exec(`INSERT INTO items VALUES (101, 'allowed', NULL); UPDATE items SET item_name='changed' WHERE id=101; DELETE FROM items WHERE id=101`)
    }
    for (const id of [4, 5]) {
      await db.exec(`SET request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000${id}'`)
      for (const table of ['items', 'categories', 'locations', 'units', 'audit_logs', 'asset_number_templates']) assert.equal(await count(table), 0)
      await assert.rejects(db.exec(`INSERT INTO items VALUES (101, 'forbidden', NULL)`), /row-level security/)
    }
    // Revocation is visible on the next statement, never cached across requests.
    await db.exec(`RESET ROLE; UPDATE profiles SET is_active=false WHERE role='staff'; SET ROLE authenticated; SET request.jwt.claim.sub='00000000-0000-0000-0000-000000000002'`)
    assert.equal(await count('items'), 0)
    await db.exec('RESET ROLE; SET ROLE anon')
    await assert.rejects(db.query('SELECT * FROM items'), /permission denied/)
  } finally { await db.close() }
})
