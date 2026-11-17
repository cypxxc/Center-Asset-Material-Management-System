import '../setup/dom'
import test from 'node:test'
import assert from 'node:assert/strict'
import { PgDialect } from 'drizzle-orm/pg-core'
import { itemFilters } from '@/features/items/postgres-queries'

const dialect = new PgDialect()

test('Global Search Coverage: searches item_name, asset_no, serial_no, brand, model, responsible_person, gfmis_number, budget_source, note, acquired_date, unit_price, status, categories, units, locations', () => {
  const query = dialect.sqlToQuery(itemFilters({ q: 'Dell' }))
  
  // Verify WHERE clauses use OR between search fields
  assert.match(query.sql, /i\.item_name ilike \$\d+/)
  assert.match(query.sql, /i\.asset_no ilike \$\d+/)
  assert.match(query.sql, /i\.serial_no ilike \$\d+/)
  assert.match(query.sql, /i\.brand ilike \$\d+/)
  assert.match(query.sql, /i\.model ilike \$\d+/)
  assert.match(query.sql, /i\.responsible_person ilike \$\d+/)
  assert.match(query.sql, /i\.gfmis_number ilike \$\d+/)
  assert.match(query.sql, /i\.budget_source ilike \$\d+/)
  assert.match(query.sql, /i\.note ilike \$\d+/)
  assert.match(query.sql, /i\.acquired_date::text ilike \$\d+/)
  assert.match(query.sql, /i\.unit_price::text ilike \$\d+/)
  assert.match(query.sql, /i\.status ilike \$\d+/)
  assert.match(query.sql, /select 1 from public\.categories/)
  assert.match(query.sql, /select 1 from public\.units/)
  assert.match(query.sql, /select 1 from public\.locations/)

  // Verify parameter binding
  assert.ok(query.params.includes('%dell%'))
})

test('Global Search: Thai status search maps to database status enum', () => {
  // 'ชำรุด' maps to 'damaged'
  const damagedQuery = dialect.sqlToQuery(itemFilters({ q: 'ชำรุด' }))
  assert.match(damagedQuery.sql, /i\.status in \([^)]+\)/)
  assert.ok(damagedQuery.params.includes('damaged'))

  // 'รอซ่อม' maps to 'waiting_repair'
  const repairQuery = dialect.sqlToQuery(itemFilters({ q: 'รอซ่อม' }))
  assert.match(repairQuery.sql, /i\.status in \([^)]+\)/)
  assert.ok(repairQuery.params.includes('waiting_repair'))

  // 'สำรอง' maps to 'spare'
  const spareQuery = dialect.sqlToQuery(itemFilters({ q: 'สำรอง' }))
  assert.match(spareQuery.sql, /i\.status in \([^)]+\)/)
  assert.ok(spareQuery.params.includes('spare'))

  // 'ใช้งาน' maps to 'active'
  const activeQuery = dialect.sqlToQuery(itemFilters({ q: 'ใช้งานอยู่' }))
  assert.match(activeQuery.sql, /i\.status in \([^)]+\)/)
  assert.ok(activeQuery.params.includes('active'))
})

test('Global Search: numeric price search handles comma-formatted numbers and exact numbers', () => {
  // '1,500' handles both textual search and comma-stripped numeric search
  const priceQuery = dialect.sqlToQuery(itemFilters({ q: '1,500' }))
  assert.match(priceQuery.sql, /i\.unit_price::text ilike/)
  assert.ok(priceQuery.params.includes('%1500%'))
})

test('Global Search: handles special characters in asset numbers and serials (-, /, .)', () => {
  const assetQuery = dialect.sqlToQuery(itemFilters({ q: 'ASSET-2026/001.A' }))
  assert.ok(assetQuery.params.includes('%asset-2026/001.a%'))
})

test('Global Search: Thai Buddhist Era year (พ.ศ.) converts to CE year for acquired_date', () => {
  // 2568 BE = 2025 CE
  const yearQuery = dialect.sqlToQuery(itemFilters({ q: '2568' }))
  assert.match(yearQuery.sql, /i\.acquired_date::text ilike \$\d+/)
  assert.ok(yearQuery.params.includes('%2025%'))
})

test('Filter Integration: combines Global Search (OR) and Filters (AND) properly', () => {
  const query = dialect.sqlToQuery(itemFilters({
    q: 'คอมพิวเตอร์',
    type: 'asset',
    status: 'active',
    category_id: '00000000-0000-4000-8000-000000000001',
    location_id: '00000000-0000-4000-8000-000000000002',
    is_central: 'true',
  }))

  // Uses AND between filter groups
  assert.ok(query.sql.includes('i.deleted_at is null and ('))
  assert.match(query.sql, /and i\.item_type = \$\d+ and i\.status in \([^)]+\) and i\.category_id = \$\d+::uuid and i\.location_id = \$\d+::uuid and \(i\.item_type='material' OR i\.is_central = true OR i\.note ILIKE '%ส่วนกลาง%'\)/)
  assert.ok(query.params.includes('asset'))
  assert.ok(query.params.includes('active'))
  assert.ok(query.params.includes('00000000-0000-4000-8000-000000000001'))
  assert.ok(query.params.includes('00000000-0000-4000-8000-000000000002'))
})
