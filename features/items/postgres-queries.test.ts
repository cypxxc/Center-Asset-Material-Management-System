import '../../tests/setup/dom'
import test, { beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { PgDialect } from 'drizzle-orm/pg-core'
import type { SQL } from 'drizzle-orm'
import type { PostgresTransaction } from '@/lib/postgres/db'


const dialect = new PgDialect()
const statements: { sql: string; params: unknown[] }[] = []
let responses: unknown[][] = []
let authorized = true
let requests = 0
const requestPath = require.resolve('../../lib/postgres/request')
require.cache[requestPath] = {
  id: requestPath, filename: requestPath, loaded: true,
  exports: {
    withUserDatabase: async (callback: (tx: PostgresTransaction) => Promise<unknown>) => {
      requests++
      if (!authorized) throw new Error('Unauthenticated')
      return callback({ execute: async (query: SQL) => {
        statements.push(dialect.sqlToQuery(query))
        return { rows: responses.shift() ?? [] }
      } } as unknown as PostgresTransaction)
    },
  },
} as NodeJS.Module

beforeEach(() => {
  process.env.DATA_BACKEND = 'postgres'
  statements.length = 0
  responses = []
  authorized = true
  requests = 0

})

test('central explorer includes categories of both types unless a type is selected', async () => {
  const { getItemsExplorerPageData } = await import('./queries')
  const categories = [{ id: 'asset-cat', name: 'Asset', item_type: 'asset' }, { id: 'material-cat', name: 'Material', item_type: 'material' }]
  for (const type of [undefined, 'asset', 'material']) {
    responses = [categories, [{ total: 0 }], [], [], [], []]
    const result = await getItemsExplorerPageData({ is_central: 'true', type })
    assert.deepEqual(result.references.categories, type ? categories.filter(category => category.item_type === type) : categories)
  }
})

test('central scope requires positive stock for lists, totals and incremental batches', async () => {
  const { itemFilters } = await import('./postgres-queries')
  for (const is_central of ['true', '1', true] as const) {
    const query = dialect.sqlToQuery(itemFilters({ is_central } as Parameters<typeof itemFilters>[0]))
    assert.match(query.sql, /i\.quantity >= 1/)
  }
  const query = dialect.sqlToQuery(itemFilters({ type: 'material' }))
  assert.doesNotMatch(query.sql, /i\.quantity >= 1/)
})

test('item search binds hostile filter values and ignores hostile sort identifiers', async () => {
  const { getItems } = await import('./queries')
  responses = [[{ total: 0 }], []]
  const malicious = "x'); drop table public.items; --"
  const result = await getItems({ q: malicious, sort_by: malicious, page: '2' })
  assert.equal(result.page, 2)
  assert.equal(result.totalPages, 1)
  assert.equal(statements.length, 2)
  for (const statement of statements) {
    assert.ok(!statement.sql.includes(malicious))
    assert.ok(statement.params.includes(`%${malicious}%`))
    assert.match(statement.sql, /i\.deleted_at is null/)
  }
  assert.match(statements[1].sql, /'color', c\.color/)
  assert.match(statements[1].sql, /order by i\.updated_at desc nulls last, i\.id/)
  assert.deepEqual(statements[1].params.slice(-2), [10, 10])
})

test('item pagination normalizes invalid pages and rejects external image URLs', async () => {
  const { getItems } = await import('./queries')
  responses = [[{ total: 11 }], [{ id: 'one', image_url: 'https://old.supabase.co/storage/v1/object/public/item-images/x.jpg' }]]
  const result = await getItems({ page: 'Infinity', sort_by: 'item_name' })
  assert.equal(result.page, 1)
  assert.equal(result.totalPages, 2)
  assert.equal(result.items[0].image_url, null)
  assert.match(statements[1].sql, /order by i\.item_name collate "th-TH-x-icu" asc nulls last/)

  responses = [[{ total: 1 }], [{ id: 'two', image_url: null }]]
  await getItems({ sort_by: 'category', sort_dir: 'asc' })
  assert.match(statements[3].sql, /order by c\.name collate "th-TH-x-icu" asc nulls last/)
})

test('Postgres item batches use a precise timestamp projection and omit count after a cursor', async () => {
  const { getItemBatch } = await import('./queries')
  const { encodeItemCursor, normalizeItemListSearchParams } = await import('./cursor')
  const params = { sort_by: 'updated_at', sort_dir: 'desc' } as const
  const normalized = normalizeItemListSearchParams(params)
  responses = [[{ id: '00000000-0000-4000-8000-000000000001', updated_at: '2026-09-22 10:00:00.123456+00' }]]
  const cursor = encodeItemCursor(normalized, '2026-09-22 10:00:00.123456+00', '00000000-0000-4000-8000-000000000001')
  const result = await getItemBatch(params, cursor)
  assert.equal(result.total, null)
  assert.equal(statements.length, 1)
  assert.match(statements[0].sql, /updated_at::text as updated_at/)
  assert.match(statements[0].sql, /'color', c\.color/)
  assert.match(statements[0].sql, /i\.updated_at < \$1/)
  assert.ok(!/count\(\*\)/.test(statements[0].sql))
})

test('ledger sort columns are applied to item batches and nullable cursor pages keep null rows', async () => {
  const { getItemBatch } = await import('./queries')
  const { encodeItemCursor, normalizeItemListSearchParams } = await import('./cursor')
  responses = [[{ total: 2 }], [{ id: '00000000-0000-4000-8000-000000000001', unit_price: null }]]
  await getItemBatch({ sort_by: 'unit_price', sort_dir: 'asc' })
  assert.match(statements[1].sql, /order by i\.unit_price asc nulls last/)

  const params = normalizeItemListSearchParams({ sort_by: 'unit_price', sort_dir: 'asc' })
  const cursor = encodeItemCursor(params, null, '00000000-0000-4000-8000-000000000001')
  responses = [[{ id: '00000000-0000-4000-8000-000000000002', unit_price: null }]]
  await getItemBatch({ sort_by: 'unit_price', sort_dir: 'asc' }, cursor)
  assert.match(statements[2].sql, /i\.unit_price is null and i\.id >/)
  assert.match(statements[2].sql, /order by i\.unit_price asc nulls last/)
})

test('Postgres batch display preserves all-match selection comma normalization', async () => {
  const { getItemBatch } = await import('./queries')
  responses = [[{ total: 0 }], []]
  await getItemBatch({ q: 'a,b' })
  assert.ok(statements[1].params.includes('%a b%'))
  assert.ok(!statements[1].params.includes('%a,b%'))
})

test('Postgres batch preserves spaces introduced by leading and trailing commas', async () => {
  const { getItemBatch } = await import('./queries')
  responses = [[{ total: 0 }], []]
  await getItemBatch({ q: ',a,' })
  assert.ok(statements[1].params.includes('% a %'))
  assert.ok(!statements[1].params.includes('%a%'))
})

test('references recheck authorization for every request instead of sharing a cached result', async () => {
  const { getItemReferences } = await import('./queries')
  responses = [[{ id: 'cat', name: 'Category', color: '#3B82F6' }], [], []]
  assert.equal((await getItemReferences()).categories.length, 1)
  assert.match(statements[0].sql, /select id, name, color(?:, icon)?, item_type from public\.categories where is_active order by name/)
  authorized = false
  await assert.rejects(getItemReferences(), /Unauthenticated/)
  assert.equal(requests, 2)
  assert.equal(statements.length, 4)
})

test('report empty pages retain totals from one snapshot and bind pagination', async () => {
  const { getReportItemsList } = await import('../reports/queries')
  const expected = { items: [], totalCount: 2, totalQuantity: 5, totalValue: 123.45, totalPages: 1, page: 99 }
  responses = [[{ result: expected }]]
  assert.deepEqual(await getReportItemsList({ page: '99', sort_by: 'total_price', sort_dir: 'asc' }), expected)
  assert.equal(statements.length, 1)
  assert.match(statements[0].sql, /coalesce\(i\.unit_price, 0\) \* i\.quantity asc/)
  assert.match(statements[0].sql, /sum\(coalesce\(unit_price, 0\) \* quantity\)/)
  assert.ok(statements[0].params.includes(1470))
})

test('report export keeps the 5000-row cap while retaining full matching totals', async () => {
  const { getExportReportItems } = await import('../reports/queries')
  const expected = { items: [], totalCount: 5001, totalQuantity: 5001, totalValue: 25005 }
  responses = [[{ result: { ...expected, totalPages: 1, page: 1 } }]]
  assert.deepEqual(await getExportReportItems({ page: '17' }), expected)
  assert.ok(statements[0].params.includes(5000))
  assert.match(statements[0].sql, /i\.created_at desc/)
})

test('settings only loads the requested section', async () => {
  const { getSettingsData } = await import('../settings/queries')
  responses = [[{ id: 'unit', name: 'ชิ้น', is_active: true, updated_at: '2026-09-11T00:00:00.000Z' }]]
  const result = await getSettingsData('units')
  assert.equal(result.units.length, 1)
  assert.deepEqual(result.categories, [])
  assert.deepEqual(result.locations, [])
  assert.equal(statements.length, 1)
  assert.match(statements[0].sql, /from public.units/)
})

test('inherited object properties are not accepted as report sort columns', async () => {
  const { getReportItemsList } = await import('../reports/queries')
  responses = [[{ result: { items: [], totalCount: 0, totalQuantity: 0, totalValue: 0, totalPages: 1, page: 1 } }]]
  await getReportItemsList({ sort_by: '__proto__' })
  assert.match(statements[0].sql, /order by i\.updated_at desc/)
  assert.ok(!statements[0].params.includes(Object.prototype))
})

test('depreciation uses date strings and numeric amounts and excludes incomplete assets', async () => {
  const { getDepreciationReport } = await import('../depreciation/queries')
  responses = [[
    { id: 'asset', item_name: 'Asset', asset_no: null, depreciation_cost: 1000, depreciation_useful_life_years: 5, depreciation_start_date: '2000-01-01', depreciation_residual_value: 1 },
    { id: 'incomplete', item_name: 'Incomplete', asset_no: null, depreciation_cost: null, depreciation_useful_life_years: null, depreciation_start_date: null, depreciation_residual_value: null },
  ]]
  const result = await getDepreciationReport()
  assert.equal(result.items.length, 1)
  assert.deepEqual(result.totals, { cost: 1000, accumulated: 999, netBook: 1 })
  assert.match(statements[0].sql, /depreciation_enabled = true and deleted_at is null/)
})

test('item pagination clamps pageSize between 1 and 100', async () => {
  const { getItems } = await import('./queries')
  responses = [[{ total: 50 }], []]
  const resultOver = await getItems({ page: '1' }, 500)
  assert.equal(resultOver.pageSize, 100)
  assert.equal(statements[1].params.slice(-2)[0], 100)

  responses = [[{ total: 50 }], []]
  const resultUnder = await getItems({ page: '1' }, -10)
  assert.equal(resultUnder.pageSize, 1)
  assert.equal(statements[3].params.slice(-2)[0], 1)
})

test('item list returns accurate asset and material counts across the selected type', async () => {
  const { getItems } = await import('./queries')
  responses = [
    [{ total: 4, assets: 12, materials: 8, qualified: 7, below_threshold: 5, unclassified: 8 }],
    [{ id: 'asset-1', item_type: 'asset', image_url: null }],
  ]

  const result = await getItems({ type: 'asset', qualification: 'below_threshold', q: 'เครื่อง', category_id: 'category-id', page: '1' })

  assert.equal(result.total, 4)
  assert.deepEqual(result.classificationCounts, { all: 20, assets: 12, materials: 8, qualified: 7, belowThreshold: 5, unclassified: 8 })
  assert.equal(statements.length, 2)
  assert.match(statements[0].sql, /count\(\*\) filter \(where .*item_type.*asset.*\)/)
  assert.match(statements[0].sql, /count\(\*\) filter \(where item_type = 'asset'\)/)
  assert.match(statements[0].sql, /count\(\*\) filter \(where item_type = 'material'\)/)
  assert.ok(statements[0].params.includes('%เครื่อง%'))
  assert.ok(statements[0].params.includes('category-id'))
  assert.match(statements[1].sql, /i\.item_type = \$\d+/)
  assert.match(statements[1].sql, /i\.qualification_status = \$\d+/)
})
