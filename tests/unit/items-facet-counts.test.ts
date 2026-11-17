import '../setup/dom'
import test from 'node:test'
import assert from 'node:assert/strict'
import { PgDialect } from 'drizzle-orm/pg-core'
import type { SQL } from 'drizzle-orm'
import type { PostgresTransaction } from '@/lib/postgres/db'

const statements: { sql: string; params: unknown[] }[] = []
const requestPath = require.resolve('../../lib/postgres/request')
require.cache[requestPath] = {
  id: requestPath, filename: requestPath, loaded: true,
  exports: {
    withUserDatabase: async (callback: (tx: PostgresTransaction) => Promise<unknown>) => callback({
      execute: async (query: SQL) => {
        statements.push(new PgDialect().sqlToQuery(query))
        return { rows: [] }
      },
    } as unknown as PostgresTransaction),
  },
} as NodeJS.Module

for (const qualification of ['qualified', 'below_threshold', 'unclassified']) {
 for (const type of ['asset', 'material', undefined]) {
  test(`type totals stay independent of qualification; qualification counts respect type: ${type}/${qualification}`, async () => {
    statements.length = 0
    const { getPostgresItems } = await import('@/features/items/postgres-queries')
    await getPostgresItems({ type, qualification, status: 'active', q: 'Dell', category_id: 'category-id', location_id: 'location-id' })
    const totals = statements[0]
    const base = totals.sql.split(/from public\.(?:items|inventory_items) i where /)[1]
    assert.doesNotMatch(base, /i\.qualification_status|i\.item_type/)
    assert.match(base, /i\.status in/)
    assert.ok(totals.params.includes('active'))
    assert.ok(totals.params.includes('spare'))
    assert.match(base, /i\.item_name ilike/)
    assert.ok(totals.params.includes('%dell%'))
    assert.ok(totals.params.includes('category-id'))
    assert.ok(totals.params.includes('location-id'))
    const assets = totals.sql.match(/count\(\*\) filter \(where ([^\n]+)\)::int as assets/)?.[1] ?? ''
    assert.equal(assets, "item_type = 'asset'")
    const materials = totals.sql.match(/count\(\*\) filter \(where ([^\n]+)\)::int as materials/)?.[1] ?? ''
    assert.equal(materials, "item_type = 'material'")
    const qualified = totals.sql.match(/count\(\*\) filter \(where ([^\n]+)\)::int as qualified/)?.[1] ?? ''
    if (type) assert.match(qualified, /item_type =/)
    else assert.doesNotMatch(qualified, /item_type/)
    const rows = statements[1]
    if (type) assert.match(rows.sql, /i\.item_type =/)
    assert.match(rows.sql, /i\.qualification_status/)
    if (type) assert.ok(rows.params.includes(type))
    if (qualification !== 'unclassified') assert.ok(rows.params.includes(qualification))
  })
 }
}
