import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { parse } from 'dotenv'
import { sql } from 'drizzle-orm'
import type { PostgresTransaction } from '@/lib/postgres/db'

test('asset register create/edit/import and inventory projections round-trip in PostgreSQL', { skip: process.env.POSTGRES_QUERY_INTEGRATION !== '1' }, async () => {
  Object.assign(process.env, parse(readFileSync('.env.postgres.app')))
  let activeTx: PostgresTransaction
  let userId: string
  const mocks: Record<string, unknown> = {
    'server-only': {},
    'next/cache': { unstable_cache: <T>(callback: T) => callback },
    '../../lib/postgres/request': { withUserDatabase: (callback: (tx: PostgresTransaction) => Promise<unknown>) => activeTx.transaction(callback) },
    '../auth/queries': { getCurrentProfile: async () => ({ id: userId, is_active: true, role: 'admin' }) },
  }
  for (const [name, exports] of Object.entries(mocks)) {
    const filename = require.resolve(name)
    require.cache[filename] = { id: filename, filename, loaded: true, exports } as NodeJS.Module
  }
  const { getAuthDatabase, withIdentity } = await import('../../lib/postgres/db')
  const rollback = new Error('rollback asset register fixtures')
  try {
    const admins = await getAuthDatabase().execute<{ id: string }>(sql`select id from public.profiles where role='admin' and is_active limit 1`)
    userId = admins.rows[0]?.id
    assert.ok(userId)
    await assert.rejects(withIdentity(userId, async tx => {
      activeTx = tx
      const { insertPostgresItem, updatePostgresItem, importPostgresItems } = await import('./postgres-actions')
      const { getPostgresItems, getPostgresItemBatch, getPostgresItemById } = await import('./postgres-queries')
      const { normalizeItemListSearchParams } = await import('./cursor')
      const { itemFormSchema } = await import('./schema')
      const name = `register-test-${randomUUID()}`
      const input = itemFormSchema.parse({ item_name: name, item_type: 'asset', quantity: 1, status: 'active',
        register_sequence: '001', asset_prefix: 'สขส 7.', register_accumulated_depreciation: '-13,999', register_book_value: '0', register_as_of: '2026-10-31', responsible_person: 'กลุ่มงานทดสอบ' })
      const created = await insertPostgresItem(input)
      assert.equal(created.error, null)
      const id = created.data!.id
      const detail = await getPostgresItemById(id)
      assert.equal(detail?.register_sequence, '001')
      assert.equal(Number(detail?.register_accumulated_depreciation), -13999)
      assert.equal(Number(detail?.register_book_value), 0)
      assert.equal(detail?.register_as_of, '2026-10-31')
      assert.equal((await getPostgresItems({ q: name })).items[0].asset_prefix, 'สขส 7.')
      assert.equal((await getPostgresItemBatch(normalizeItemListSearchParams({ q: name }), null)).items[0].register_sequence, '001')
      assert.equal((await updatePostgresItem(id, { ...input, register_book_value: 1, register_sequence: null })).error, null)
      const edited = await getPostgresItemById(id)
      assert.equal(Number(edited?.register_book_value), 1)
      assert.equal(edited?.register_sequence, null)
      const imported = await importPostgresItems([{ ...input, item_name: name + ' imported', category_name: '', location_name: '', unit_name: '' }])
      assert.equal(imported.error, null)
      assert.equal((await getPostgresItems({ q: name + ' imported' })).items[0].asset_prefix, 'สขส 7.')
      // Materials share the view but do not require asset-only columns on their table.
      const material = await insertPostgresItem({ ...input, item_type: 'material', quantity: 0 })
      assert.equal(material.error, null)
      assert.equal((await getPostgresItemById(material.data!.id))?.register_book_value, null)
      throw rollback
    }), error => error === rollback)
  } finally {
    const pools = globalThis as typeof globalThis & { cammsPg?: { end(): Promise<void> }; cammsAuthPg?: { end(): Promise<void> } }
    await Promise.all([pools.cammsPg?.end(), pools.cammsAuthPg?.end()])
  }
})
