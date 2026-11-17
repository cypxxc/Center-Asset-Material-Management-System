import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { parse } from 'dotenv'
import { Pool } from 'pg'
import { PgDialect } from 'drizzle-orm/pg-core'
import { completedDisbursementSummarySql } from './completed-disbursement-sql'

// Opt-in, read-only: exercises the real aggregation over a CTE, with no application records or writes.
test('SQL counts successful documents using handover or approval date, including returned loans, in Bangkok time',
  { skip: process.env.COMPLETED_CHART_SQL_TEST !== '1' }, async () => {
    const env = parse(readFileSync('.env.postgres.app'))
    assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(new URL(env.DATABASE_URL).hostname))
    const pool = new Pool({ connectionString: env.DATABASE_URL, connectionTimeoutMillis: 5000 })
    const compiled = new PgDialect().sqlToQuery(completedDisbursementSummarySql)
    const fixture = `source(transaction_type,status,handed_over_at) as (values
      ('material_issue','confirmed','2026-09-30T18:00:00Z'::timestamptz),
      ('asset_handover','confirmed','2026-10-02T00:00:00Z'::timestamptz),
      ('asset_borrow','active_borrow','2026-10-03T00:00:00Z'::timestamptz),
      ('asset_borrow','partially_returned','2026-10-04T00:00:00Z'::timestamptz),
      ('asset_borrow','returned','2026-10-05T00:00:00Z'::timestamptz),
      ('asset_borrow','returned',null::timestamptz),
      ('material_issue','confirmed',null::timestamptz),
      ('material_issue','draft','2026-10-01T00:00:00Z'::timestamptz),
      ('material_issue','pending_approval','2026-10-01T00:00:00Z'::timestamptz),
      ('material_issue','rejected','2026-10-01T00:00:00Z'::timestamptz),
      ('material_issue','cancelled','2026-10-01T00:00:00Z'::timestamptz),
      ('asset_borrow','reversed','2026-10-01T00:00:00Z'::timestamptz),
      ('unknown','confirmed','2026-10-01T00:00:00Z'::timestamptz),
      ('asset_borrow','confirmed','2026-10-01T00:00:00Z'::timestamptz),
      ('material_issue','confirmed','2027-10-01T00:00:00Z'::timestamptz)
    ), fixture as (
      select *, case when handed_over_at is null then '2026-10-06T00:00:00Z'::timestamptz
        else '2026-09-01T00:00:00Z'::timestamptz end as confirmed_at from source
      union all select 'material_issue','confirmed',null::timestamptz,null::timestamptz
    ), `
    const query = compiled.sql.replace('with clock', `with ${fixture}clock`)
      .replace('public.disbursements', 'fixture')
      .replace('current_timestamp as instant', "'2026-11-17T05:00:00Z'::timestamptz as instant")
    try {
      const result = await pool.query(query, compiled.params)
      assert.deepEqual(result.rows[0].summary, {
        asOf: '2026-11-17', unrecordedHandoverCount: 3,
        months: [{ year: 2026, month: 10, borrowed: 4, issued: 3 }],
      })
    } finally { await pool.end() }
  })
