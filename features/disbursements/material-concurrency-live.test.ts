import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { AsyncLocalStorage } from 'node:async_hooks'
import { readFileSync } from 'node:fs'
import { parse } from 'dotenv'
import { Pool } from 'pg'

// Opt-in: UUID-scoped temporary fixtures are committed so independent connections
// can see them, then removed in finally. Never updates existing inventory/users.
test('two ordinary users cannot deduct 4 + 4 from stock 5 concurrently', { skip: process.env.POSTGRES_QUERY_INTEGRATION !== '1' }, async () => {
  Object.assign(process.env, parse(readFileSync('.env.postgres.app')))
  const owner = new Pool({ connectionString: process.env.DATABASE_MIGRATION_URL, max: 1 })
  const users = [randomUUID(), randomUUID()]
  const itemId = randomUUID()
  const identity = new AsyncLocalStorage<{ id: string; role: string }>()
  for (const name of ['server-only', 'next/cache']) {
    const filename = require.resolve(name)
    require.cache[filename] = { id: filename, filename, loaded: true, exports: name === 'next/cache' ? { unstable_cache: <T>(callback: T) => callback } : {} } as NodeJS.Module
  }
  const { withIdentity } = await import('../../lib/postgres/db')
  const auth = require.resolve('../auth/queries')
  require.cache[auth] = { id: auth, filename: auth, loaded: true, exports: {
    getCurrentProfile: async () => ({ ...identity.getStore(), is_active: true, full_name: 'Concurrency fixture', department: 'QA' }),
  } } as NodeJS.Module
  const request = require.resolve('../../lib/postgres/request')
  require.cache[request] = { id: request, filename: request, loaded: true, exports: {
    withUserDatabase: <T>(callback: Parameters<typeof withIdentity<T>>[1]) => withIdentity(identity.getStore()!.id, callback),
  } } as NodeJS.Module
  const asUser = <T>(id: string, callback: () => Promise<T>) => identity.run({ id, role: 'user' }, callback)
  try {
    // Owner connection is used exclusively for isolated fixture setup/cleanup.
    for (const id of users) await owner.query('insert into public.profiles(id,full_name,role,is_active) values ($1,$2,$3,true)', [id, `material-test-${id}`, 'user'])
    await owner.query('insert into public.materials(id,item_name,item_type,quantity,status,is_central) values ($1,$2,$3,5,$4,false)', [itemId, `material-test-${itemId}`, 'material', 'active'])
    const actions = await import('./postgres-actions')
    const query = await import('./postgres-queries')
    const submit = (id: string, qty: number) => asUser(id, () => actions.submitPostgresBorrowRequest({ item_ids: [itemId], quantities: { [itemId]: qty }, request_type: 'issue', purpose: 'Concurrent fixture' }))
    const results = await Promise.allSettled(users.map(id => submit(id, 4)))
    assert.equal(results.filter(result => result.status === 'fulfilled').length, 1)
    const failure = results.find(result => result.status === 'rejected') as PromiseRejectedResult
    assert.match(String(failure.reason), /พร้อมจ่าย 1.*4/)
    const view = await asUser(users[0], () => query.getPostgresCentralAvailableItems())
    const material = view.find(row => row.id === itemId)!
    assert.equal(material.stock_quantity, 1)
    assert.equal(material.reserved_quantity, 0)
    assert.equal(material.quantity, 1)
    const retryKey = randomUUID()
    const retry = () => asUser(users[1], () => actions.submitPostgresBorrowRequest({ request_key: retryKey, item_ids: [itemId], quantities: { [itemId]: 1 }, request_type: 'issue', purpose: 'Concurrent retry' }))
    const [last, repeated] = await Promise.all([retry(), retry()])
    assert.deepEqual(repeated.ids, last.ids, 'concurrent retries share a single batch and physical deduction')
    const { recoverRequestBatch, getRequestBatch } = await import('./request-batch-queries')
    const recovered = await asUser(users[1], () => recoverRequestBatch(retryKey))
    assert.equal(recovered?.id, last.batch_id)
    assert.equal(await asUser(users[0], () => recoverRequestBatch(retryKey)), null, 'a different user cannot recover someone else’s key')
    assert.equal(await asUser(users[0], () => getRequestBatch(last.batch_id)), null, 'batch details remain owner scoped')
    await assert.rejects(submit(users[0], 1), /พร้อมจ่าย 0|ไม่มีจำนวนพร้อมใช้งาน/)
    const after = await asUser(users[0], () => query.getPostgresCentralAvailableItems())
    assert.equal(after.find(row => row.id === itemId), undefined, 'fully reserved materials are hidden from the catalog')
    await asUser(users[1], () => actions.cancelPostgresDisbursementDraft({ id: last.id }))
    const restored = await asUser(users[1], () => query.getPostgresCentralAvailableItems())
    assert.equal(restored.find(row => row.id === itemId)?.stock_quantity, 1, 'ordinary user cancellation restores their deducted stock')
    await assert.rejects(asUser(users[1], () => actions.cancelPostgresDisbursementDraft({ id: last.id })))
    const winningIndex = results.findIndex(result => result.status === 'fulfilled')
    const winning = results[winningIndex] as PromiseFulfilledResult<{ id: string }>
    await assert.rejects(asUser(users[1 - winningIndex], () => actions.cancelPostgresDisbursementDraft({ id: winning.value.id })), /สิทธิ์|ไม่พบเอกสาร/)
  } finally {
    try {
    // Every predicate is scoped to random fixture identifiers, including on failure.
    const cleanup = await owner.connect()
    try {
      await cleanup.query('begin')
      // Owner-only local cleanup of generated UUID fixtures: processed/pending
      // headers are immutable even for owner DELETE. No application rows match.
      await cleanup.query('set local session_replication_role=replica')
      await cleanup.query('delete from public.stock_movements where item_id=$1', [itemId])
      await cleanup.query('delete from public.audit_logs where target_id in (select id from public.disbursements where created_by=any($1::uuid[])) or user_id=any($1::uuid[])', [users])
      await cleanup.query('delete from public.disbursement_items where item_id=$1', [itemId])
      await cleanup.query('delete from public.disbursements where created_by=any($1::uuid[])', [users])
      await cleanup.query('delete from public.request_batches where created_by=any($1::uuid[])', [users])
      await cleanup.query('delete from public.material_stock_documents where item_id=$1', [itemId])
      await cleanup.query('delete from public.materials where id=$1 and item_name=$2', [itemId, `material-test-${itemId}`])
      await cleanup.query('delete from public.inventory_registry where id=$1', [itemId])
      await cleanup.query('delete from public.profiles where id=any($1::uuid[]) and full_name=\'material-test-\'||id::text', [users])
      await cleanup.query('commit')
    } catch (error) { await cleanup.query('rollback'); throw error }
    finally { cleanup.release() }
    } finally {
    await owner.end()
    const pools = globalThis as typeof globalThis & { cammsPg?: { end(): Promise<void> }; cammsAuthPg?: { end(): Promise<void> } }
    await Promise.all([pools.cammsPg?.end(), pools.cammsAuthPg?.end()])
    }
  }
})
