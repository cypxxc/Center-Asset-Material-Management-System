import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { parse } from 'dotenv'
import { Pool } from 'pg'
import { PgDialect } from 'drizzle-orm/pg-core'
import type { SQL } from 'drizzle-orm'
import type { PostgresTransaction } from '../../lib/postgres/db'

test('archive keeps closed history/images and blocks all selected rows when one has open work', {
  skip: process.env.POSTGRES_ITEM_ARCHIVE_LIVE_TEST !== '1' || !existsSync('.env.postgres.app'),
}, async () => {
  // Temporary tables + rollback only; no user registry records or schema changes.
  const marker = require.resolve('server-only')
  require.cache[marker] = { id: marker, filename: marker, loaded: true, exports: {} } as NodeJS.Module
  const { archivePostgresItems } = await import('../../features/items/archive-items')
  const env = parse(readFileSync('.env.postgres.app'))
  const pool = new Pool({ connectionString: env.DATABASE_URL, connectionTimeoutMillis: 5000 })
  const client = await pool.connect()
  const archived = randomUUID(), pending = randomUUID(), borrowed = randomUUID(), draft = randomUUID(), free = randomUUID(), actor = randomUUID()
  const documentIds = [randomUUID(), randomUUID(), randomUUID(), randomUUID()]
  const tx = { execute: async (statement: SQL) => {
    const query = new PgDialect().sqlToQuery(statement)
    const text = query.sql.replaceAll('public.disbursement_items', 'pg_temp.archive_lines')
      .replaceAll('public.disbursements', 'pg_temp.archive_docs').replaceAll(/public\.("?items"?)/g, 'pg_temp.archive_items')
    return client.query(text, query.params)
  } } as unknown as PostgresTransaction
  try {
    await client.query('BEGIN')
    await client.query('CREATE TEMP TABLE archive_items(id uuid PRIMARY KEY, image_url text, quantity integer, deleted_at timestamptz, deleted_by uuid, updated_by uuid, updated_at timestamptz) ON COMMIT DROP')
    await client.query('CREATE TEMP TABLE archive_docs(id uuid PRIMARY KEY, status text, transaction_type text) ON COMMIT DROP')
    await client.query('CREATE TEMP TABLE archive_lines(item_id uuid REFERENCES archive_items(id) ON DELETE RESTRICT, disbursement_id uuid REFERENCES archive_docs(id), issued_qty integer, returned_qty integer, status text, item_name_snapshot text) ON COMMIT DROP')
    for (const id of [archived, pending, borrowed, draft, free]) {
      await client.query("INSERT INTO archive_items VALUES($1,'/retained-image.png',5,null,null,null,now())", [id])
    }
    for (const [index, status] of ['returned', 'pending_approval', 'partially_returned', 'draft'].entries()) {
      await client.query("INSERT INTO archive_docs VALUES($1,$2,'asset_borrow')", [documentIds[index], status])
    }
    for (const [index, id] of [archived, pending, borrowed, draft].entries()) {
      await client.query("INSERT INTO archive_lines VALUES($1,$2,2,$3,$4,'original snapshot')", [id, documentIds[index], index === 0 ? 2 : index === 2 ? 1 : 0, index === 0 ? 'returned' : index === 2 ? 'partially_returned' : 'pending'])
    }
    const result = await archivePostgresItems(tx, [archived, archived], actor)
    assert.equal(result.length, 1)
    const stored = (await client.query('SELECT * FROM archive_items WHERE id=$1', [archived])).rows[0]
    assert.ok(stored.deleted_at)
    assert.equal(stored.deleted_by, actor)
    assert.equal(stored.updated_by, actor)
    assert.equal(stored.quantity, 5)
    assert.equal(stored.image_url, '/retained-image.png')
    const competing = await pool.connect()
    try {
      await competing.query('BEGIN')
      const lock = await competing.query("SELECT pg_try_advisory_xact_lock(hashtextextended($1,0)) AS acquired", [`camms-disbursement:${archived}`])
      assert.equal(lock.rows[0].acquired, false, 'Archive must hold the canonical reservation lock until transaction end')
    } finally {
      await competing.query('ROLLBACK')
      competing.release()
    }
    assert.equal((await client.query('SELECT item_name_snapshot FROM archive_lines WHERE item_id=$1', [archived])).rows[0].item_name_snapshot, 'original snapshot')
    assert.equal((await archivePostgresItems(tx, [archived], actor)).length, 0)
    for (const blocked of [pending, borrowed, draft]) {
      await assert.rejects(archivePostgresItems(tx, [free, blocked], actor), /คำขอ|ยืม|ร่าง/)
      const rows = (await client.query('SELECT deleted_at FROM archive_items WHERE id=ANY($1::uuid[])', [[free, blocked]])).rows
      assert.ok(rows.every(row => row.deleted_at === null), 'A blocked bulk operation must not archive any selected item')
    }
    await client.query("UPDATE archive_docs SET status='returned' WHERE id=$1", [documentIds[2]])
    await client.query('UPDATE archive_lines SET returned_qty=issued_qty WHERE item_id=$1', [borrowed])
    assert.equal((await archivePostgresItems(tx, [borrowed, free], actor)).length, 2)
  } finally {
    await client.query('ROLLBACK')
    client.release()
    await pool.end()
  }
})
