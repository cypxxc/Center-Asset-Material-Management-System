import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { parse } from 'dotenv'
import { sql } from 'drizzle-orm'
import type { PostgresTransaction } from '@/lib/postgres/db'

// Opt-in local database check: all fixtures are rolled back, including failures.
test('PostgreSQL query feature surface executes against real restricted-role SQL', { skip: process.env.POSTGRES_QUERY_INTEGRATION !== '1' }, async () => {
  Object.assign(process.env, parse(readFileSync('.env.postgres.app')))
  process.env.DATA_BACKEND = 'postgres'
  for (const name of ['server-only', 'next/cache']) {
    const filename = require.resolve(name)
    require.cache[filename] = { id: filename, filename, loaded: true, exports: name === 'next/cache' ? { unstable_cache: <T>(callback: T) => callback } : {} } as NodeJS.Module
  }
  let activeTx: PostgresTransaction
  const requestFilename = require.resolve('../../lib/postgres/request')
  require.cache[requestFilename] = { id: requestFilename, filename: requestFilename, loaded: true, exports: {
    withUserDatabase: async (callback: (tx: PostgresTransaction) => Promise<unknown>) => activeTx.transaction(callback),
  } } as NodeJS.Module
  const authFilename = require.resolve('../auth/queries')
  require.cache[authFilename] = { id: authFilename, filename: authFilename, loaded: true, exports: {
    getCurrentProfile: async () => ({ id: userId, is_active: true, role: 'admin' }),
  } } as NodeJS.Module

  const { getAuthDatabase, withIdentity } = await import('../../lib/postgres/db')
  const authDb = getAuthDatabase()
  const admin = await authDb.execute<{ id: string }>(sql`select id from public.profiles where role = 'admin' and is_active limit 1`)
  const userId = admin.rows[0]?.id
  assert.ok(userId, 'A local administrator must be initialized first')
  const rollback = new Error('Rollback successful query fixtures')
  const fixture = randomUUID()
  const categoryId = randomUUID(), locationId = randomUUID(), unitId = randomUUID()
  const assetId = randomUUID(), materialId = randomUUID(), deletedId = randomUUID()
  const imageUrl = `/api/files/item-images/${userId}/${randomUUID()}.png`

  try {
    await assert.rejects(withIdentity(userId, async tx => {
      activeTx = tx
      const items = await import('./postgres-queries')
      const settings = await import('../settings/postgres-queries')
      const reports = await import('../reports/postgres-queries')
      const depreciation = await import('../depreciation/postgres-queries')
      const mutations = await import('./postgres-actions')
      const { itemFormSchema } = await import('./schema')
      const before = await reports.getPostgresReportStats()
      await tx.execute(sql`insert into public.categories (id, name, is_active) values (${categoryId}::uuid, ${fixture}, true)`)
      await tx.execute(sql`insert into public.locations (id, name, is_active) values (${locationId}::uuid, ${fixture}, true)`)
      await tx.execute(sql`insert into public.units (id, name, is_active) values (${unitId}::uuid, ${fixture}, true)`)
      await tx.execute(sql`insert into public.items (id, item_name, item_type, quantity, unit_price, category_id, location_id, unit_id,
        depreciation_enabled, depreciation_method, depreciation_cost, depreciation_useful_life_years, depreciation_start_basis, depreciation_start_date, depreciation_residual_value, image_url, created_by, updated_by)
        values (${assetId}::uuid, ${fixture + ' asset'}, 'asset', 2, 125.50, ${categoryId}::uuid, ${locationId}::uuid, ${unitId}::uuid,
        true, 'straight_line', 1000, 5, 'manual', '2000-01-01', 1, ${imageUrl}, ${userId}::uuid, ${userId}::uuid)`)
      await tx.execute(sql`insert into public.items (id, item_name, item_type, quantity, unit_price, category_id, location_id, unit_id, created_by, updated_by)
        values (${materialId}::uuid, ${fixture + ' material'}, 'material', 3, 2.25, ${categoryId}::uuid, ${locationId}::uuid, ${unitId}::uuid, ${userId}::uuid, ${userId}::uuid)`)
      await tx.execute(sql`insert into public.items (id, item_name, item_type, quantity, category_id, deleted_at, created_by, updated_by)
        values (${deletedId}::uuid, ${fixture + ' deleted'}, 'asset', 99, ${categoryId}::uuid, now(), ${userId}::uuid, ${userId}::uuid)`)

      const list = await items.getPostgresItems({ q: fixture, sort_by: 'item_name' })
      assert.equal(list.total, 2)
      assert.equal(list.items[0].id, assetId)
      assert.equal(list.items[0].unit_price, 125.5)
      assert.equal(typeof list.items[0].updated_at, 'string')
      assert.deepEqual(list.items[0].category, { id: categoryId, name: fixture })
      assert.equal(list.items[0].image_url, imageUrl)
      assert.equal((await items.getPostgresItems({ q: fixture, type: 'material' })).total, 1)
      assert.equal((await items.getPostgresItems({ q: "'); drop table public.items; --" })).total, 0)
      assert.equal((await items.getPostgresItemById(assetId))?.depreciation_start_date, '2000-01-01')
      assert.equal(await items.getPostgresItemById(deletedId), null)
      assert.ok((await items.getPostgresItemAuditLogs(assetId)).length >= 1)
      assert.ok((await items.getPostgresLowStockItems(10000)).some(item => item.id === materialId))
      const references = await items.getPostgresItemReferences()
      assert.ok(references.units.some(unit => unit.id === unitId))
      const sidebar = await items.getPostgresSidebarData()
      assert.equal(sidebar.categories.find(category => category.id === categoryId)?.count, 1)
      assert.equal(sidebar.locations.find(location => location.id === locationId)?.count, 2)
      const stats = await reports.getPostgresReportStats()
      assert.equal(stats.totalItems, before.totalItems + 2)
      assert.equal(stats.totalQuantity, before.totalQuantity + 5)
      assert.deepEqual(stats.categoryCounts[fixture], { count: 2, qty: 5 })

      for (const sort_by of ['item_name', 'category', 'quantity', 'unit_price', 'total_price', 'status', 'updated_at', 'created_at', '__proto__']) {
        const report = await reports.getPostgresReportItemsList({ category_id: categoryId, sort_by, sort_dir: 'asc' })
        assert.equal(report.items.length, 2)
        assert.equal(report.totalCount, 2)
        assert.equal(report.totalQuantity, 5)
        assert.equal(report.totalValue, 257.75)
      }
      const emptyPage = await reports.getPostgresReportItemsList({ category_id: categoryId, page: '2' })
      assert.equal(emptyPage.items.length, 0)
      assert.equal(emptyPage.totalValue, 257.75)
      assert.equal((await reports.getPostgresExportReportItems({ category_id: categoryId })).items.length, 2)
      assert.ok((await settings.getPostgresSettingsData('locations')).locations.some(location => location.id === locationId))
      const overview = await settings.getPostgresLocationsOverview()
      assert.equal(overview.items.find(item => item.id === assetId)?.locationId, locationId)
      const depreciated = (await depreciation.getPostgresDepreciationReport()).items.find(item => item.id === assetId)
      assert.equal(depreciated?.netBookValue, 1)
      assert.equal(depreciated?.accumulatedDepreciation, 999)

      const input = itemFormSchema.parse({ item_name: fixture + ' created', item_type: 'asset', quantity: 1,
        unit_price: '1,234.50', status: 'active', category_id: categoryId, location_id: locationId, unit_id: unitId,
        depreciation_enabled: true, depreciation_cost: '5,000', depreciation_useful_life_years: '5',
        depreciation_start_basis: 'manual', depreciation_start_date: '2020-01-01' })
      const created = await mutations.insertPostgresItem(input)
      assert.equal(created.error, null)
      assert.ok(created.data?.id)
      assert.equal((await items.getPostgresItemById(created.data.id))?.unit_price, 1234.5)
      assert.deepEqual(await mutations.updatePostgresItem(created.data.id, { ...input, quantity: 4 }), { error: null })
      assert.equal((await items.getPostgresItemById(created.data.id))?.quantity, 4)
      const audit = await items.getPostgresItemAuditLogs(created.data.id)
      assert.equal(audit.length, 2, 'Database triggers produce exactly one audit per mutation')
      const invalid = await mutations.insertPostgresItem({ ...input, quantity: -1 })
      assert.equal(invalid.error?.message, 'ไม่สามารถบันทึกข้อมูลได้ กรุณาตรวจสอบข้อมูลอีกครั้ง')
      const numbered = { ...input, asset_no: fixture }
      assert.equal((await mutations.insertPostgresItem(numbered)).error, null)
      assert.equal((await mutations.insertPostgresItem(numbered)).error?.message, 'เลขครุภัณฑ์นี้มีอยู่ในระบบแล้ว')
      const imported = await mutations.importPostgresItems([{ item_name: fixture + ' imported', item_type: 'material',
        quantity: 7, unit_price: 20, status: 'active', category_name: fixture, location_name: fixture, unit_name: fixture,
        asset_no: null, serial_no: null, brand: null, model: null, responsible_person: null, note: null }])
      assert.equal(imported.error, null)
      assert.equal(imported.data?.count, 1)
      assert.equal((await items.getPostgresItems({ q: fixture + ' imported' })).total, 1)
      const generalBefore = (await reports.getPostgresReportStats()).categoryCounts['ทั่วไป'] ?? { count: 0, qty: 0 }
      const general = await tx.execute<{ id: string }>(sql`insert into public.categories (name, is_active) values ('ทั่วไป', true)
        on conflict (name) do update set name=excluded.name returning id`)
      await tx.execute(sql`insert into public.items (item_name, item_type, quantity, category_id, created_by, updated_by)
        values (${fixture + ' general'}, 'material', 1, ${general.rows[0].id}::uuid, ${userId}::uuid, ${userId}::uuid),
          (${fixture + ' uncategorized'}, 'material', 1, null, ${userId}::uuid, ${userId}::uuid)`)
      assert.deepEqual((await reports.getPostgresReportStats()).categoryCounts['ทั่วไป'], {
        count: generalBefore.count + 2, qty: generalBefore.qty + 2,
      }, 'Uncategorized and explicitly general items share the displayed report bucket')
      throw rollback
    }), error => error === rollback)
  } finally {
    const pools = globalThis as typeof globalThis & { cammsPg?: { end(): Promise<void> }; cammsAuthPg?: { end(): Promise<void> } }
    await Promise.all([pools.cammsPg?.end(), pools.cammsAuthPg?.end()])
  }
})
