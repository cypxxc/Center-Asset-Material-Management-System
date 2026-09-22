import '../../tests/setup/dom'
import test, { beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { PgDialect } from 'drizzle-orm/pg-core'
import type { SQL } from 'drizzle-orm'
import type { PostgresTransaction } from '@/lib/postgres/db'
import { mockSupabaseRegistry } from '../../tests/mocks/supabase'

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
  mockSupabaseRegistry.clear()
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
  assert.match(statements[1].sql, /order by i\.updated_at desc, i\.id/)
  assert.deepEqual(statements[1].params.slice(-2), [10, 10])
  assert.equal(mockSupabaseRegistry.getQueryLog().length, 0)
  assert.equal(mockSupabaseRegistry.getRpcLog().length, 0)
})

test('item pagination normalizes invalid pages and rejects external image URLs', async () => {
  const { getItems } = await import('./queries')
  responses = [[{ total: 11 }], [{ id: 'one', image_url: 'https://old.supabase.co/storage/v1/object/public/item-images/x.jpg' }]]
  const result = await getItems({ page: 'Infinity', sort_by: 'item_name' })
  assert.equal(result.page, 1)
  assert.equal(result.totalPages, 2)
  assert.equal(result.items[0].image_url, null)
  assert.match(statements[1].sql, /order by i\.item_name asc/)
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
  assert.match(statements[0].sql, /i\.updated_at < \$1/)
  assert.ok(!/count\(\*\)/.test(statements[0].sql))
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
  responses = [[{ id: 'cat', name: 'Category' }], [], []]
  assert.equal((await getItemReferences()).categories.length, 1)
  authorized = false
  await assert.rejects(getItemReferences(), /Unauthenticated/)
  assert.equal(requests, 2)
  assert.equal(statements.length, 3)
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
  assert.equal(mockSupabaseRegistry.getRpcLog().length, 0)
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
  assert.equal(mockSupabaseRegistry.getQueryLog().length, 0)
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
