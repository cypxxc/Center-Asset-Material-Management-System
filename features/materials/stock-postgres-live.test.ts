import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { parse } from 'dotenv'
import { sql } from 'drizzle-orm'
import type { PostgresTransaction } from '@/lib/postgres/db'

test('material stock documents protect metadata, retries, counts, partial returns and reconciliation', { skip: process.env.POSTGRES_QUERY_INTEGRATION !== '1' }, async () => {
  Object.assign(process.env, parse(readFileSync('.env.postgres.app')))
  let activeTx: PostgresTransaction
  let userId: string
  const mocks: Record<string, unknown> = {
    'server-only': {}, 'next/cache': { unstable_cache: <T>(callback: T) => callback },
    '../../lib/postgres/request': { withUserDatabase: (callback: (tx: PostgresTransaction) => Promise<unknown>) => activeTx.transaction(callback) },
    '../auth/queries': { getCurrentProfile: async () => ({ id: userId, is_active: true, role: 'admin', full_name: 'stock test', department: 'QA' }) },
  }
  for (const [name, exports] of Object.entries(mocks)) {
    const filename = require.resolve(name)
    require.cache[filename] = { id: filename, filename, loaded: true, exports } as NodeJS.Module
  }
  const { getAuthDatabase, withIdentity } = await import('../../lib/postgres/db')
  const rollback = new Error('rollback material stock fixtures')
  try {
    const admins = await getAuthDatabase().execute<{ id: string }>(sql`select id from public.profiles where role='admin' and is_active limit 1`)
    userId = admins.rows[0]?.id
    assert.ok(userId)
    await assert.rejects(withIdentity(userId, async tx => {
      activeTx = tx
      const stock = await import('./stock-postgres')
      const issues = await import('../disbursements/postgres-actions')
      const items = await import('../items/postgres-actions')
      const { itemFormSchema } = await import('../items/schema')
      const id = randomUUID()
      await tx.execute(sql`insert into public.materials(id,item_name,item_type,quantity,status) values(${id},'stock fixture','material',10,'active')`)
      const snapshot = await tx.execute<{ metadata_version: string }>(sql`select metadata_version from public.materials where id=${id}`)
      const metadataVersion = Number(snapshot.rows[0].metadata_version)
      const draft = await issues.createPostgresDisbursementDraft({ transaction_type: 'material_issue', recipient_name: 'QA', department_name: 'QA', purpose: 'stock test', items: [{ item_id: id, requested_qty: 3 }] })
      await issues.confirmPostgresDisbursement(draft.id)
      const data = itemFormSchema.parse({ item_name: 'new metadata name', item_type: 'material', quantity: 10, status: 'active', unit_price: null, depreciation_enabled: false })
      const edited = await items.updatePostgresItem(id, data, undefined, metadataVersion)
      assert.equal(edited.error, null)
      assert.equal((await stock.getPostgresMaterialStockLedger(id)).quantity, 7, 'stale quantity in metadata form cannot overwrite issued stock')
      assert.ok((await items.updatePostgresItem(id, { ...data, item_name: 'stale edit' }, undefined, metadataVersion)).error, 'second metadata writer receives conflict')
      const receipt = { item_id: id, request_key: randomUUID(), kind: 'receipt', quantity: 2, reason: 'delivery', reference: 'RC-1' }
      const first = await stock.recordPostgresMaterialStock(receipt)
      assert.equal((await stock.recordPostgresMaterialStock(receipt)).id, first.id)
      assert.equal((await stock.recordPostgresMaterialStock({ ...receipt, expected_stock_version: 999 })).id, first.id, 'receipt retries ignore unrelated count cutoff version')
      assert.equal((await stock.getPostgresMaterialStockLedger(id)).quantity, 9, 'receipt retry adds stock only once')
      await assert.rejects(stock.recordPostgresMaterialStock({ ...receipt, quantity: 3 }), /ข้อมูลอื่น/)
      const current = await stock.getPostgresMaterialStockLedger(id)
      await assert.rejects(stock.recordPostgresMaterialStock({ item_id: id, request_key: randomUUID(), kind: 'count', quantity: 5, expected_stock_version: current.stock_version - 1, reason: 'count', reference: 'CT-1' }), /ตรวจนับใหม่/)
      await stock.recordPostgresMaterialStock({ item_id: id, request_key: randomUUID(), kind: 'count', quantity: 8, expected_stock_version: current.stock_version, reason: 'count', reference: 'CT-1' })
      assert.equal((await stock.getPostgresMaterialStockLedger(id)).quantity, 8)
      const line = await tx.execute<{ id: string }>(sql`select id from public.disbursement_items where disbursement_id=${draft.id}`)
      const returned = { line_id: line.rows[0].id, request_key: randomUUID(), quantity: 2, accepted_quantity: 1, reason: 'one usable; one damaged', reference: 'RT-1' }
      const returnedOnce = await stock.returnPostgresMaterialStock(returned)
      assert.equal((await stock.returnPostgresMaterialStock(returned)).id, returnedOnce.id)
      assert.equal((await stock.getPostgresMaterialStockLedger(id)).quantity, 9, 'only usable accepted quantity returns to stock')
      await assert.rejects(stock.returnPostgresMaterialStock({ ...returned, request_key: randomUUID(), quantity: 2, accepted_quantity: 2 }), /จำนวนรับคืนสะสม/)
      await assert.rejects(issues.reversePostgresDisbursement({ disbursement_id: draft.id, reason: 'cannot reverse after partial return' }))
      await stock.returnPostgresMaterialStock({ ...returned, request_key: randomUUID(), quantity: 1, accepted_quantity: 0 })
      const original = await tx.execute<{ issued_qty: number; requested_qty: number; returned_qty: number }>(sql`select issued_qty,requested_qty,returned_qty from public.disbursement_items where id=${line.rows[0].id}`)
      assert.deepEqual(original.rows[0], { issued_qty: 3, requested_qty: 3, returned_qty: 3 })
      const reconciled = await stock.getPostgresMaterialStockLedger(id)
      assert.equal(reconciled.reconciliation?.balanced, true)
      assert.equal(reconciled.reconciliation?.expected, 9)
      await tx.execute(sql`update public.materials set quantity=quantity+1 where id=${id}`)
      assert.equal((await stock.getPostgresMaterialStockLedger(id)).reconciliation?.difference, 1, 'ledger mismatch is reported, never silently repaired')
      throw rollback
    }), error => error === rollback)
  } finally {
    const pools = globalThis as typeof globalThis & { cammsPg?: { end(): Promise<void> }; cammsAuthPg?: { end(): Promise<void> } }
    await Promise.all([pools.cammsPg?.end(), pools.cammsAuthPg?.end()])
  }
})
