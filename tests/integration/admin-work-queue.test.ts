import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { parse } from 'dotenv'
import { Pool } from 'pg'
import { PgDialect } from 'drizzle-orm/pg-core'
import { adminWorkQueueSql } from '../../features/disbursements/admin-work-queue-sql'
import type { AdminWorkQueueSummary } from '../../features/disbursements/admin-work-queue-types'

test('admin queue counts beyond display limit and excludes due-today, returned and exhausted loans', {
  skip: process.env.POSTGRES_ADMIN_QUEUE_LIVE_TEST !== '1' || !existsSync('.env.postgres.app'),
}, async () => {
  const env = parse(readFileSync('.env.postgres.app'))
  const pool = new Pool({ connectionString: env.DATABASE_URL, connectionTimeoutMillis: 5000 })
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await client.query(`CREATE TEMP TABLE work_docs(id text, document_no text, recipient_name text, department_name text, status text, transaction_type text, due_date date, created_at timestamptz) ON COMMIT DROP`)
    await client.query(`CREATE TEMP TABLE work_lines(disbursement_id text, issued_qty integer, returned_qty integer, status text) ON COMMIT DROP`)
    await client.query(`INSERT INTO work_docs
      SELECT 'pending-'||n, null, 'Recipient', 'Department', 'pending_approval', 'asset_borrow', null, '2026-11-01'::timestamptz + n*interval '1 hour'
      FROM generate_series(1,12) n`)
    await client.query(`INSERT INTO work_docs VALUES
      ('overdue','DOC-1','A','B','active_borrow','asset_borrow','2026-11-01','2026-10-01'),
      ('partial','DOC-2','A','B','partially_returned','asset_borrow','2026-11-05','2026-10-02'),
      ('today','DOC-3','A','B','active_borrow','asset_borrow','2026-11-12','2026-10-03'),
      ('returned','DOC-4','A','B','returned','asset_borrow','2026-11-01','2026-10-01'),
      ('exhausted','DOC-5','A','B','active_borrow','asset_borrow','2026-11-01','2026-10-01'),
      ('issue','DOC-6','A','B','active_borrow','material_issue','2026-11-01','2026-10-01'),
      ('nodate','DOC-7','A','B','active_borrow','asset_borrow',null,'2026-10-01')`)
    await client.query(`INSERT INTO work_lines SELECT id,2,case when id='exhausted' then 2 else 1 end,'issued' FROM work_docs WHERE document_no is not null`)
    await client.query("ALTER TABLE work_docs ADD COLUMN purpose text NOT NULL DEFAULT 'ทดสอบคำขอ'")
    const query = new PgDialect().sqlToQuery(adminWorkQueueSql)
    const fixtureSql = query.sql.replaceAll('public.disbursements', 'pg_temp.work_docs').replaceAll('public.disbursement_items', 'pg_temp.work_lines')
      .replace("(current_timestamp at time zone 'Asia/Bangkok')::date", "'2026-11-12'::date")
    const result = (await client.query<{ summary: AdminWorkQueueSummary }>(fixtureSql, query.params)).rows[0].summary
    assert.equal(result.pendingCount, 12)
    assert.equal(result.overdueCount, 2)
    assert.equal(result.items.length, 8)
    assert.deepEqual(result.items.slice(0, 3).map(row => row.id), ['overdue', 'partial', 'pending-1'])
    assert.equal(result.items[0].overdue_days, 11)
    assert.equal(result.items[1].overdue_days, 7)
    assert.equal(result.items[2].transaction_type, 'asset_borrow')
    assert.equal(result.items[2].purpose, 'ทดสอบคำขอ')
    await client.query('TRUNCATE work_docs, work_lines')
    const empty = (await client.query<{ summary: AdminWorkQueueSummary }>(fixtureSql, query.params)).rows[0].summary
    assert.deepEqual(empty.items, [])
    assert.equal(empty.pendingCount + empty.overdueCount, 0)
  } finally {
    await client.query('ROLLBACK')
    client.release()
    await pool.end()
  }
})
