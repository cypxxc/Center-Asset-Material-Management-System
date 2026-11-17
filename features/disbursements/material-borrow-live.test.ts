import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { parse } from 'dotenv'
import { sql } from 'drizzle-orm'
import type { PostgresTransaction } from '@/lib/postgres/db'

test('material borrowing debits once, returns partially, reverses and restores rejected requests', { skip: process.env.MATERIAL_BORROW_INTEGRATION !== '1' }, async () => {
  Object.assign(process.env, parse(readFileSync('.env.postgres.app')))
  process.env.DATA_BACKEND = 'postgres'
  for (const name of ['server-only', 'next/cache']) {
    const filename = require.resolve(name)
    require.cache[filename] = { id: filename, filename, loaded: true, exports: {} } as NodeJS.Module
  }
  let activeTx: PostgresTransaction
  for (const [name, exports] of [
    ['../../lib/postgres/request', { withUserDatabase: (callback: (tx: PostgresTransaction) => Promise<unknown>) => activeTx.transaction(callback) }],
    ['../auth/queries', { getCurrentProfile: async () => ({ id: userId, role: 'admin', is_active: true, full_name: 'Borrow test', department: 'Test' }) }],
  ] as const) {
    const filename = require.resolve(name)
    require.cache[filename] = { id: filename, filename, loaded: true, exports } as NodeJS.Module
  }
  const db = await import('../../lib/postgres/db')
  const admin = await db.getAuthDatabase().execute<{ id: string }>(sql`select id from public.profiles where role='admin' and is_active limit 1`)
  const userId = admin.rows[0].id
  const rollback = new Error('rollback fixtures')
  try {
    await assert.rejects(db.withIdentity(userId, async tx => {
      activeTx = tx
      const actions = await import('./postgres-actions')
      const id = randomUUID()
      await tx.execute(sql`insert into public.materials(id,item_name,item_type,quantity,is_central,created_by,updated_by) values(${id},'Material borrow fixture','material',3,false,${userId},${userId})`)
      const stock = async () => (await tx.execute<{ quantity: number; is_central: boolean }>(sql`select quantity,is_central from public.materials where id=${id}`)).rows[0]
      assert.equal((await stock()).is_central,true)
      const due = new Date(Date.now()+7*86400000).toISOString().slice(0,10)
      const request = () => actions.submitPostgresBorrowRequest({ request_key: randomUUID(), item_ids:[id], item_actions:{[id]:'borrow'}, quantities:{[id]:2}, request_type:'borrow',due_date:due,purpose:'Test material borrowing' })
      const first = await request()
      assert.equal((await stock()).quantity,1)
      await assert.rejects(request())
      await actions.confirmPostgresDisbursement(first.id)
      assert.equal((await stock()).quantity,1)
      const line = (await tx.execute<{ id: string }>(sql`select id from public.disbursement_items where disbursement_id=${first.id}`)).rows[0]
      await actions.returnPostgresDisbursementItem({line_id:line.id,return_qty:1,condition:'normal'})
      assert.equal((await stock()).quantity,2)
      await assert.rejects(actions.returnPostgresDisbursementItem({line_id:line.id,return_qty:2,condition:'normal'}))
      await actions.returnPostgresDisbursement(first.id)
      assert.equal((await stock()).quantity,3)
      await assert.rejects(actions.returnPostgresDisbursement(first.id))
      const second = await request()
      await actions.confirmPostgresDisbursement(second.id)
      await actions.reversePostgresDisbursement({disbursement_id:second.id,reason:'Test reversal'})
      assert.equal((await stock()).quantity,3)
      const third = await request()
      await actions.rejectPostgresDisbursement(third.id,'Test rejection')
      assert.equal((await stock()).quantity,3)
      throw rollback
    }), error => error === rollback)
  } finally { await db.closePostgresPools() }
})
