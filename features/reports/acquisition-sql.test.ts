import test from 'node:test'
import assert from 'node:assert/strict'
import { PgDialect } from 'drizzle-orm/pg-core'
import { acquisitionSummarySql, materialAcquisitionSummarySql } from './acquisition-sql'

test('dashboard summaries keep asset and material records separate', () => {
  const dialect = new PgDialect()
  for (const [query, type] of [[acquisitionSummarySql, 'asset'], [materialAcquisitionSummarySql, 'material']] as const) {
    const compiled = dialect.sqlToQuery(query)
    assert.ok(compiled.params.includes(type))
    assert.match(compiled.sql, /i\.item_type = \$/)
    assert.match(compiled.sql, /i\.deleted_at is null/)
    assert.match(compiled.sql, /acquired_date <= as_of/)
  }
})

test('material chart uses ledger date, falling back to registration date without changing asset dates', () => {
  const dialect = new PgDialect()
  const material = dialect.sqlToQuery(materialAcquisitionSummarySql).sql
  assert.match(material, /coalesce\(i\.balance_as_of, \(i\.created_at at time zone 'Asia\/Bangkok'\)::date\) as acquired_date/)
  assert.match(material, /from public\.materials i/)
  const asset = dialect.sqlToQuery(acquisitionSummarySql).sql
  assert.doesNotMatch(asset, /balance_as_of|created_at/)
})
