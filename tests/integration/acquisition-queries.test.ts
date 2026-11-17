import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { parse } from 'dotenv'
import { Pool } from 'pg'
import { PgDialect } from 'drizzle-orm/pg-core'
import { acquisitionSummarySql } from '../../features/reports/acquisition-sql'
import type { AcquisitionSummary } from '../../features/reports/acquisition-series'

// No writes to the registry: fixtures live only in a transaction-local temporary table.
test('PostgreSQL acquisition aggregation handles missing/future dates, prices and deleted rows', {
  skip: process.env.POSTGRES_ACQUISITION_LIVE_TEST !== '1' || !existsSync('.env.postgres.app'),
}, async () => {
  const env = parse(readFileSync('.env.postgres.app'))
  const pool = new Pool({ connectionString: env.DATABASE_URL, connectionTimeoutMillis: 5000 })
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await client.query("CREATE TEMP TABLE acquisition_fixture(acquired_date date, quantity integer, unit_price numeric, deleted_at timestamptz, status text, item_type text DEFAULT 'asset') ON COMMIT DROP")
    await client.query(`INSERT INTO acquisition_fixture VALUES
      ('2025-09-30', 4, 100, null, 'active'),
      ('2025-10-01', 1, null, null, 'disposed'),
      ('2025-10-02', 8, 0, null, 'active'),
      (null, 1, 500, null, 'active'),
      ('9999-01-01', 1, 900, null, 'active'),
      ('2025-09-01', 1, 999, now(), 'active')`)
    const compiled = new PgDialect().sqlToQuery(acquisitionSummarySql)
    const fixtureSql = compiled.sql.replace(/public\.(inventory_)?items/, 'pg_temp.acquisition_fixture')
    const result = await client.query<{ summary: AcquisitionSummary }>(fixtureSql, compiled.params)
    assert.deepEqual(result.rows[0].summary.months, [
      { year: 2025, month: 9, recordCount: 1, knownValue: 400, missingPriceCount: 0 },
      { year: 2025, month: 10, recordCount: 2, knownValue: 0, missingPriceCount: 1 },
    ])
    assert.equal(result.rows[0].summary.missingDateCount, 1)
    assert.equal(result.rows[0].summary.futureDateCount, 1)
    assert.match(result.rows[0].summary.asOf, /^\d{4}-\d{2}-\d{2}$/)
    await client.query('TRUNCATE acquisition_fixture')
    const empty = await client.query<{ summary: AcquisitionSummary }>(fixtureSql, compiled.params)
    assert.deepEqual(empty.rows[0].summary.months, [])
    assert.equal(empty.rows[0].summary.missingDateCount, 0)
  } finally {
    await client.query('ROLLBACK')
    client.release()
    await pool.end()
  }
})

test('acquisition query preserves PostgreSQL RLS for an unauthenticated connection', {
  skip: process.env.POSTGRES_ACQUISITION_LIVE_TEST !== '1' || !existsSync('.env.postgres.app'),
}, async () => {
  const env = parse(readFileSync('.env.postgres.app'))
  const pool = new Pool({ connectionString: env.DATABASE_URL, connectionTimeoutMillis: 5000 })
  const client = await pool.connect()
  try {
    await client.query('BEGIN READ ONLY')
    await client.query("select set_config('app.user_id', '', true)")
    const compiled = new PgDialect().sqlToQuery(acquisitionSummarySql)
    const result = await client.query<{ summary: AcquisitionSummary }>(compiled.sql, compiled.params)
    assert.deepEqual(result.rows[0].summary.months, [])
    assert.equal(result.rows[0].summary.missingDateCount, 0)
    assert.equal(result.rows[0].summary.futureDateCount, 0)
  } finally {
    await client.query('ROLLBACK')
    client.release()
    await pool.end()
  }
})
