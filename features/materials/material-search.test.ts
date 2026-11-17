import test from 'node:test'
import assert from 'node:assert/strict'
import { PgDialect } from 'drizzle-orm/pg-core'

test('material code and specification searches apply to rows and type-independent totals', async () => {
  const filename = require.resolve('server-only')
  require.cache[filename] = { id: filename, filename, loaded: true, exports: {} } as NodeJS.Module
  const { itemFilters } = await import('@/features/items/postgres-queries')
  const dialect = new PgDialect()
  for (const type of ['material', undefined]) {
    const query = dialect.sqlToQuery(itemFilters({ q: '14111500', type }, true))
    assert.match(query.sql, /m\.commodity_code ilike/)
    assert.match(query.sql, /m\.specification ilike/)
    assert.ok(query.params.includes('%14111500%'))
  }
  const assets = dialect.sqlToQuery(itemFilters({ q: '14111500', type: 'asset' }, true))
  assert.doesNotMatch(assets.sql, /m\.commodity_code/)
})
