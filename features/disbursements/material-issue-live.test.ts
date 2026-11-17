import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { parse } from 'dotenv'
import { sql } from 'drizzle-orm'
import type { PostgresTransaction } from '@/lib/postgres/db'

test('material quantity reservations, cancellation, approval and reversal round-trip with rollback', { skip: process.env.POSTGRES_QUERY_INTEGRATION !== '1' }, async () => {
  Object.assign(process.env, parse(readFileSync('.env.postgres.app')))
  let activeTx: PostgresTransaction
  let userId: string
  const mocks: Record<string, unknown> = {
    'server-only': {}, 'next/cache': { unstable_cache: <T>(callback: T) => callback },
    '../../lib/postgres/request': { withUserDatabase: (callback: (tx: PostgresTransaction) => Promise<unknown>) => activeTx.transaction(callback) },
    '../auth/queries': { getCurrentProfile: async () => ({ id: userId, is_active: true, role: 'admin', full_name: 'ทดสอบ', department: 'QA' }) },
  }
  for (const [name, exports] of Object.entries(mocks)) {
    const filename = require.resolve(name)
    require.cache[filename] = { id: filename, filename, loaded: true, exports } as NodeJS.Module
  }
  const { getAuthDatabase, withIdentity } = await import('../../lib/postgres/db')
  const rollback = new Error('rollback material issue fixtures')
  try {
    const admins = await getAuthDatabase().execute<{ id: string }>(sql`select id from public.profiles where role='admin' and is_active limit 1`)
    userId = admins.rows[0]?.id
    assert.ok(userId)
    await assert.rejects(withIdentity(userId, async tx => {
      activeTx = tx
      const actions = await import('./postgres-actions')
      const queries = await import('./postgres-queries')
      const id = randomUUID(), other = randomUUID(), asset = randomUUID()
      await tx.execute(sql`insert into public.materials(id,item_name,item_type,quantity,status,is_central,unit_price) values
        (${id},'กระดาษทดสอบ','material',10,'active',false,null), (${other},'วัสดุหมด','material',0,'active',false,null)`)
      await tx.execute(sql`insert into public.items(id,item_name,item_type,quantity,status,is_central) values (${asset},'ครุภัณฑ์ทดสอบ','asset',1,'active',false)`)
      const request = (qty: number) => actions.submitPostgresBorrowRequest({ item_ids: [id], quantities: { [id]: qty }, request_type: 'issue', purpose: 'ทดสอบ' })
      const available = async () => (await queries.getPostgresCentralAvailableItems()).find(row => row.id === id)!
      assert.equal((await available()).quantity, 10)
      const requestKey = randomUUID()
      const retryInput = { request_key: requestKey, item_ids: [id], quantities: { [id]: 2 }, request_type: 'issue', purpose: 'idempotent cart' }
      const once = await actions.submitPostgresBorrowRequest(retryInput)
      const twice = await actions.submitPostgresBorrowRequest(retryInput)
      assert.deepEqual(twice.ids, once.ids, 'a transport retry returns the original documents')
      assert.equal((await available()).stock_quantity, 8, 'retry does not deduct twice')
      await assert.rejects(actions.submitPostgresBorrowRequest({ ...retryInput, quantities: { [id]: 3 } }), /คำขอเดิม|ซ้ำ/)
      await actions.cancelPostgresDisbursementDraft({ id: once.id })
      assert.deepEqual((await actions.submitPostgresBorrowRequest(retryInput)).ids, once.ids, 'retry after cancellation does not create a fresh request')
      const a = await request(3)
      assert.equal((await available()).stock_quantity, 7, 'sending a request immediately deducts physical stock')
      const b = await request(2)
      const fullyReserved = await request(5)
      const independentDraft = await actions.createPostgresDisbursementDraft({ transaction_type: 'material_issue', recipient_name: 'QA', department_name: 'QA', purpose: 'draft', items: [{ item_id: id, requested_qty: 20 }] })
      assert.equal(await available(), undefined, 'fully reserved stock is hidden; an independent draft can still be saved')
      await actions.cancelPostgresDisbursementDraft({ id: independentDraft.id })
      await actions.cancelPostgresDisbursementDraft({ id: fullyReserved.id })
      assert.equal((await available()).quantity, 5)
      assert.equal((await available()).reserved_quantity, 0)
      const { assertMaterialAvailable } = await import('./reservations')
      await assertMaterialAvailable(tx, { id, item_name: 'กระดาษ', quantity: 5 }, 5, a.id)
      await assert.rejects(assertMaterialAvailable(tx, { id, quantity: 5 }, 6, a.id), /พร้อมจ่าย 5/)
      await assert.rejects(request(6), /พร้อมจ่าย 5.*6/)
      const draft = await actions.createPostgresDisbursementDraft({ transaction_type: 'material_issue', recipient_name: 'QA', department_name: 'QA', purpose: 'ทดสอบ', items: [{ item_id: id, requested_qty: 1 }] })
      assert.equal((await available()).quantity, 5, 'drafts do not reserve')
      await actions.cancelPostgresDisbursementDraft({ id: a.id })
      assert.equal((await available()).quantity, 8)
      await actions.confirmPostgresDisbursement(b.id)
      const tracking = await import('./tracking-postgres')
      const beforeReceipt = (await available()).stock_quantity
      const received = await tracking.markPostgresDisbursementHandover(b.id)
      const receivedAgain = await tracking.markPostgresDisbursementHandover(b.id)
      assert.equal(receivedAgain.handed_over_at, received.handed_over_at)
      assert.equal((await available()).stock_quantity, beforeReceipt, 'actual receipt timestamp does not change stock')
      const receiptAudits = await tx.execute<{ count: number }>(sql`select count(*)::int as count from public.audit_logs where target_id=${b.id} and action='RECORD_ACTUAL_HANDOVER'`)
      assert.equal(receiptAudits.rows[0].count, 1)
      assert.equal((await available()).stock_quantity, 8)
      assert.equal((await available()).reserved_quantity, 0)
      await assert.rejects(actions.confirmPostgresDisbursement(b.id))
      const snapshot = await tx.execute<{ price: string | null }>(sql`select unit_price_snapshot as price from public.disbursement_items where disbursement_id=${b.id}`)
      assert.equal(snapshot.rows[0].price, null)
      const rejected = await request(8)
      await actions.rejectPostgresDisbursement(rejected.id, 'ทดสอบ')
      assert.equal((await available()).quantity, 8)
      await assert.rejects(actions.rejectPostgresDisbursement(rejected.id, 'ปฏิเสธซ้ำ'))
      assert.equal((await available()).quantity, 8, 'rejection restores stock once only')
      const prepaid = await request(8)
      assert.equal(await available(), undefined, 'request exhausts physical stock')
      await actions.confirmPostgresDisbursement(prepaid.id)
      assert.equal(await available(), undefined, 'approval does not deduct a second time')
      await actions.reversePostgresDisbursement({ disbursement_id: prepaid.id, reason: 'คืนยอดทดสอบ' })
      await actions.reversePostgresDisbursement({ disbursement_id: b.id, reason: 'ทดสอบคืนยอด' })
      assert.equal((await available()).stock_quantity, 10)
      await assert.rejects(actions.reversePostgresDisbursement({ disbursement_id: b.id, reason: 'ซ้ำ' }))
      assert.equal((await available()).stock_quantity, 10)
      await actions.cancelPostgresDisbursementDraft({ id: draft.id })
      await assert.rejects(actions.cancelPostgresDisbursementDraft({ id: draft.id }))
      assert.equal((await available()).stock_quantity, 10, 'draft cancellation never credits stock')
      const legacyPending = await actions.createPostgresDisbursementDraft({ transaction_type: 'material_issue', recipient_name: 'QA', department_name: 'QA', purpose: 'legacy pending', items: [{ item_id: id, requested_qty: 2 }] })
      await tx.execute(sql`update public.disbursements set status='pending_approval' where id=${legacyPending.id}`)
      assert.equal((await available()).stock_quantity, 10, 'legacy pending request has no prior debit')
      await actions.confirmPostgresDisbursement(legacyPending.id)
      assert.equal((await available()).stock_quantity, 8, 'legacy pending deducts once at approval')
      await actions.reversePostgresDisbursement({ disbursement_id: legacyPending.id, reason: 'legacy test restore' })
      assert.equal((await available()).stock_quantity, 10)
      await assert.rejects(actions.submitPostgresBorrowRequest({ item_ids: [other], request_type: 'issue', purpose: 'หมด' }))
      assert.equal((await queries.getPostgresCentralAvailableItems()).find(row => row.id === other), undefined, 'zero-stock materials are hidden')
      await assert.rejects(actions.submitPostgresBorrowRequest({ item_ids: [asset], request_type: 'borrow', due_date: '2026-12-01', purpose: 'ทดสอบ' }), /ส่วนกลาง/)
      await tx.execute(sql`update public.items set is_central=true,asset_no=${`ASSET-${asset}`} where id=${asset}`)
      const borrow = await actions.submitPostgresBorrowRequest({ item_ids: [asset], request_type: 'borrow', due_date: '2026-12-01', purpose: 'ทดสอบ' })
      await assert.rejects(actions.submitPostgresBorrowRequest({ item_ids: [asset], request_type: 'borrow', due_date: '2026-12-01', purpose: 'ซ้ำ' }), /คำขอรออนุมัติ|กำลังยืม/)
      await actions.cancelPostgresDisbursementDraft({ id: borrow.id })
      const mixed = await actions.submitPostgresBorrowRequest({ item_ids: [id, asset], quantities: { [id]: 2, [asset]: 1 }, request_type: 'borrow', due_date: '2026-12-01', purpose: 'ตะกร้ารวม' })
      assert.equal(mixed.ids.length, 2)
      const mixedDocs = await tx.execute<{ transaction_type: string; due_date: string | null }>(sql`select transaction_type,due_date::text from public.disbursements where id in (${sql.join(mixed.ids.map(docId => sql`${docId}::uuid`), sql`, `)})`)
      assert.deepEqual(mixedDocs.rows.map(doc => doc.transaction_type).sort(), ['asset_borrow', 'material_issue'])
      assert.equal(mixedDocs.rows.find(doc => doc.transaction_type === 'material_issue')?.due_date, null)
      for (const docId of mixed.ids) await actions.cancelPostgresDisbursementDraft({ id: docId })
      const handedAsset = randomUUID()
      await tx.execute(sql`insert into public.items(id,item_name,item_type,quantity,status,is_central,asset_no) values (${handedAsset},'ครุภัณฑ์ส่งมอบ','asset',1,'active',true,${`ASSET-${handedAsset}`})`)
      const threeWayInput = { item_ids: [id, asset, handedAsset], quantities: { [id]: 2 }, request_type: 'issue',
        item_actions: { [id]: 'issue', [asset]: 'borrow', [handedAsset]: 'issue' }, purpose: 'ยืมและเบิกแยกรายการ' }
      await assert.rejects(actions.submitPostgresBorrowRequest(threeWayInput), /กำหนดส่งคืน/)
      const threeWay = await actions.submitPostgresBorrowRequest({ ...threeWayInput, due_date: '2026-12-01' })
      assert.equal(threeWay.ids.length, 3)
      const threeDocs = await tx.execute<{ transaction_type: string; due_date: string | null }>(sql`select transaction_type,due_date::text from public.disbursements where id in (${sql.join(threeWay.ids.map(docId => sql`${docId}::uuid`), sql`, `)})`)
      assert.deepEqual(threeDocs.rows.map(doc => doc.transaction_type).sort(), ['asset_borrow', 'asset_handover', 'material_issue'])
      assert.equal(threeDocs.rows.find(doc => doc.transaction_type === 'asset_borrow')?.due_date, '2026-12-01')
      assert.ok(threeDocs.rows.filter(doc => doc.transaction_type !== 'asset_borrow').every(doc => doc.due_date === null))
      for (const docId of threeWay.ids) await actions.cancelPostgresDisbursementDraft({ id: docId })
      const partialIssues = await actions.submitPostgresBorrowRequest({ item_ids: [id, asset], item_actions: { [asset]: 'issue' }, purpose: 'partial map ไม่มีการยืม' })
      const partialDocs = await tx.execute<{ transaction_type: string; due_date: string | null }>(sql`select transaction_type,due_date::text from public.disbursements where id in (${sql.join(partialIssues.ids.map(docId => sql`${docId}::uuid`), sql`, `)})`)
      assert.deepEqual(partialDocs.rows.map(doc => doc.transaction_type).sort(), ['asset_handover', 'material_issue'])
      assert.ok(partialDocs.rows.every(doc => doc.due_date === null))
      for (const docId of partialIssues.ids) await actions.cancelPostgresDisbursementDraft({ id: docId })
      await assert.rejects(actions.submitPostgresBorrowRequest({ item_ids: [id, asset], item_actions: { [id]: 'issue' }, purpose: 'partial map ยืมต้องมีวันคืน' }), /กำหนดส่งคืน/)
      await assert.rejects(actions.submitPostgresBorrowRequest({ item_ids: [id], item_actions: { [id]: 'borrow' }, request_type: 'issue', due_date: '2026-12-01', purpose: 'ห้ามยืมวัสดุ' }), /ไม่สามารถยืม/)
      const beforeMixedFailure = await tx.execute<{ count: number }>(sql`select count(*)::int as count from public.disbursements`)
      const batchesBeforeFailure = await tx.execute<{ count: number }>(sql`select count(*)::int as count from public.request_batches`)
      await assert.rejects(actions.submitPostgresBorrowRequest({ item_ids: [asset, id], quantities: { [id]: 11 }, request_type: 'borrow', due_date: '2026-12-01', purpose: 'ตะกร้าผิด' }))
      const afterMixedFailure = await tx.execute<{ count: number }>(sql`select count(*)::int as count from public.disbursements`)
      assert.equal(afterMixedFailure.rows[0].count, beforeMixedFailure.rows[0].count, 'invalid mixed cart creates no partial document')
      const atomicMaterial = `00000000-0000-4000-8000-${randomUUID().slice(-12)}`
      const atomicAsset = `ffffffff-ffff-4fff-8fff-${randomUUID().slice(-12)}`
      await tx.execute(sql`insert into public.materials(id,item_name,item_type,quantity,status) values (${atomicMaterial},'วัสดุทดสอบ atomic','material',5,'active')`)
      // Missing asset_no is rejected by the DB line trigger after material doc insertion.
      await tx.execute(sql`insert into public.items(id,item_name,item_type,quantity,status,is_central) values (${atomicAsset},'ครุภัณฑ์ทดสอบ atomic','asset',1,'active',true)`)
      await assert.rejects(actions.submitPostgresBorrowRequest({ item_ids: [atomicMaterial, atomicAsset], request_type: 'borrow', due_date: '2026-12-01', purpose: 'rollback second document' }))
      const afterInsertFailure = await tx.execute<{ count: number }>(sql`select count(*)::int as count from public.disbursements`)
      assert.equal(afterInsertFailure.rows[0].count, beforeMixedFailure.rows[0].count, 'second document failure rolls back the first document and lines')
      assert.equal((await queries.getPostgresCentralAvailableItems()).find(row => row.id === atomicMaterial)?.reserved_quantity, 0)
      assert.equal((await queries.getPostgresCentralAvailableItems()).find(row => row.id === atomicMaterial)?.stock_quantity, 5, 'failed mixed cart restores immediate deductions through transaction rollback')
      const failedMovements = await tx.execute<{ count: number }>(sql`select count(*)::int as count from public.stock_movements where item_id=${atomicMaterial}`)
      assert.equal(failedMovements.rows[0].count, 0)
      const batchesAfterFailure = await tx.execute<{ count: number }>(sql`select count(*)::int as count from public.request_batches`)
      assert.equal(batchesAfterFailure.rows[0].count, batchesBeforeFailure.rows[0].count, 'a failed cart leaves no orphan request batch')
      await tx.execute(sql`update public.materials set status='damaged' where id=${id}`)
      await assert.rejects(request(1), /พร้อมใช้งาน/)
      await tx.execute(sql`update public.materials set status='spare' where id=${id}`)
      const spare = await request(1)
      await actions.cancelPostgresDisbursementDraft({ id: spare.id })
      await tx.execute(sql`update public.materials set status='active' where id=${id}`)
      const atomic = await actions.createPostgresDisbursementDraft({ transaction_type: 'material_issue', recipient_name: 'QA', department_name: 'QA', purpose: 'atomic', items: [{ item_id: id, requested_qty: 1 }] })
      // Add another valid line, then make it unavailable before approval.
      await tx.execute(sql`update public.materials set quantity=1 where id=${other}`)
      await actions.updatePostgresDisbursementDraft({ id: atomic.id, transaction_type: 'material_issue', recipient_name: 'QA', department_name: 'QA', purpose: 'atomic', items: [{ item_id: id, requested_qty: 1 }, { item_id: other, requested_qty: 1 }] })
      await tx.execute(sql`update public.materials set quantity=0 where id=${other}`)
      await assert.rejects(actions.confirmPostgresDisbursement(atomic.id))
      assert.equal((await available()).stock_quantity, 10, 'all line deductions roll back')
      const earlyAsset = randomUUID(), staleBorrow = randomUUID()
      await tx.execute(sql`insert into public.items(id,item_name,item_type,quantity,status,is_central,asset_no) values (${earlyAsset},'ทดสอบคืนก่อนกำหนด','asset',1,'active',true,${`EARLY-${earlyAsset}`})`)
      await tx.execute(sql`insert into public.disbursements(id,transaction_type,recipient_name,department_name,purpose,status,due_date,created_by) values (${staleBorrow},'asset_borrow','QA','QA','historical pending','pending_approval','2000-01-01',${userId})`)
      await tx.execute(sql`insert into public.disbursement_items(disbursement_id,item_id,requested_qty,status) values (${staleBorrow},${earlyAsset},1,'pending')`)
      await assert.rejects(actions.confirmPostgresDisbursement(staleBorrow), /กำหนดส่งคืนเดิม/)
      await actions.confirmPostgresDisbursement(staleBorrow, '2099-12-31')
      await actions.returnPostgresDisbursement(staleBorrow)
      const earlyReturn = await tx.execute<{ status: string; due_date: string }>(sql`select status,due_date::text from public.disbursements where id=${staleBorrow}`)
      assert.equal(earlyReturn.rows[0].status, 'returned', 'asset can be returned before its future due date')
      assert.equal(earlyReturn.rows[0].due_date, '2099-12-31')
      throw rollback
    }), error => error === rollback)

    // Two database connections contend on the exact canonical inventory lock.
    const { lockDisbursementItems } = await import('./reservations')
    const lockId = randomUUID()
    let release!: () => void, held!: () => void
    const gate = new Promise<void>(resolve => { release = resolve })
    const locked = new Promise<void>(resolve => { held = resolve })
    const first = withIdentity(userId, async tx => { await lockDisbursementItems(tx, [lockId]); held(); await gate })
    await locked
    try {
      await withIdentity(userId, async tx => {
        const result = await tx.execute<{ acquired: boolean }>(sql`select pg_try_advisory_xact_lock(hashtextextended(${`camms-disbursement:${lockId}`},0)) as acquired`)
        assert.equal(result.rows[0].acquired, false, 'another connection cannot enter the stock check while the lock is held')
      })
    } finally { release(); await first }
  } finally {
    const pools = globalThis as typeof globalThis & { cammsPg?: { end(): Promise<void> }; cammsAuthPg?: { end(): Promise<void> } }
    await Promise.all([pools.cammsPg?.end(), pools.cammsAuthPg?.end()])
  }
})
