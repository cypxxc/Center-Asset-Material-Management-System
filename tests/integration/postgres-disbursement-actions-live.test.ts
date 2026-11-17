import { AsyncLocalStorage } from 'node:async_hooks'
import { drizzle } from 'drizzle-orm/node-postgres'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { sql } from 'drizzle-orm'
import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { parse } from 'dotenv'
import { Pool } from 'pg'
import { verifyDisbursementBackend } from '../../scripts/verify-disbursement-backends'

test('actual PostgreSQL actions preserve request, approval, return and concurrency invariants', {
  skip: process.env.POSTGRES_ADMIN_LIVE_TEST !== '1' || !existsSync('.env.postgres.app'), timeout: 120_000,
}, async () => {
  const env = parse(readFileSync('.env.postgres.app'))
  const name = `camms_disposable_${randomUUID().replaceAll('-', '')}`
  const management = new Pool({ connectionString: env.DATABASE_MIGRATION_URL, connectionTimeoutMillis: 5000 })
  const pools: Pool[] = []
  let created = false
  const poolFor = (connection: string) => {
    const url = new URL(connection); url.pathname = `/${name}`
    const pool = new Pool({ connectionString: url.toString(), connectionTimeoutMillis: 5000 })
    pools.push(pool); return pool
  }
  try {
    assert.match(name, /^camms_disposable_[a-f0-9]{32}$/)
    await management.query(`CREATE DATABASE "${name}"`); created = true
    const owner = poolFor(env.DATABASE_MIGRATION_URL)
    const folder = 'db/postgres/migrations'
    await migrate(drizzle(owner), { migrationsFolder: folder })
    const identities = new AsyncLocalStorage<{ id: string; role: string; is_active: boolean; full_name: string; department: string }>()
    const app = poolFor(env.DATABASE_URL)
    const fixtureUrl = new URL(env.DATABASE_URL); fixtureUrl.pathname = `/${name}`
    assert.deepEqual(await verifyDisbursementBackend(fixtureUrl.toString()), { compatible: true, missing: [] })
    const database = drizzle(app)
    function stub(path: string, exports: unknown) {
      const filename = require.resolve(path)
      require.cache[filename] = { id: filename, filename, loaded: true, exports } as NodeJS.Module
    }
    stub('server-only', {})
    stub('../../features/auth/queries', { getCurrentProfile: async () => identities.getStore() })
    stub('../../lib/postgres/request', { withUserDatabase: async (callback: (tx: unknown) => Promise<unknown>) => database.transaction(async tx => {
      await tx.execute(sql`SELECT set_config('app.user_id', ${identities.getStore()!.id}, true)`)
      return callback(tx)
    }) })
    // Only identity/session plumbing is replaced; SQL, schemas, locks and actions are real.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const actions = require('../../features/disbursements/postgres-actions') as typeof import('../../features/disbursements/postgres-actions')
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const queries = require('../../features/disbursements/postgres-queries') as typeof import('../../features/disbursements/postgres-queries')
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { assignPostgresCustody } = require('../../features/disbursements/custody-postgres') as typeof import('../../features/disbursements/custody-postgres')
    const user = randomUUID(), other = randomUUID(), admin = randomUUID()
    for (const [id,role] of [[user,'user'],[other,'user'],[admin,'admin']]) {
      await owner.query('INSERT INTO profiles(id,full_name,email,role) VALUES($1,$2,$3,$4)', [id,role,`${id}@fixture.invalid`,role])
    }
    const asUser = <T>(id: string, role: string, operation: () => Promise<T>) => identities.run({ id,role,is_active:true,full_name:'Fixture recipient',department:'Fixture department' }, operation)
    const material = randomUUID(), asset = randomUUID(), handed = randomUUID(), cancellable = randomUUID()
    await owner.query("INSERT INTO materials(id,item_name,item_type,quantity,is_central) VALUES($1,$2,'material',10,true)", [material, material])
    for (const [id,type] of [[asset,'asset'],[handed,'asset'],[cancellable,'asset']]) {
      await owner.query("INSERT INTO items(id,item_name,item_type,quantity,is_central,asset_no) VALUES($1,$2,$3,1,true,$4)", [id,id,type,id])
    }
    const request = (id: string, request_type: 'issue' | 'borrow') => actions.submitPostgresBorrowRequest({ item_ids:[id],request_type,due_date:request_type === 'borrow' ? '2099-01-01' : undefined,purpose:'Fixture purpose' })
    // Grouped borrowing: one parent, three children, independently returned assets.
    const groupedAssets = [randomUUID(), randomUUID(), randomUUID()]
    for (const id of groupedAssets) await owner.query("INSERT INTO items(id,item_name,item_type,quantity,is_central,asset_no) VALUES($1,$2,'asset',1,true,$2)", [id, id])
    const grouped = await asUser(user,'user',() => actions.submitPostgresBorrowRequest({item_ids:groupedAssets, request_type:'borrow', due_date:'2099-01-01', purpose:'Grouped fixture'}))
    assert.equal((await owner.query('SELECT count(*)::int n FROM disbursements WHERE id=$1', [grouped.id])).rows[0].n, 1)
    const groupedLines = (await owner.query('SELECT * FROM disbursement_items WHERE disbursement_id=$1 ORDER BY item_id', [grouped.id])).rows
    assert.equal(groupedLines.length, 3)
    const pendingDetail = await asUser(user,'user',() => queries.getPostgresDisbursementById(grouped.id))
    assert.equal(pendingDetail?.items.length, 3)
    for (const line of pendingDetail!.items) {
      assert.equal(line.item_name_snapshot, line.item_id, 'pending detail must display the current item name')
      assert.equal(line.asset_no_snapshot, line.item_id, 'pending detail must display the current asset number')
    }
    // The baseline must reject duplicate item lines without rewriting history.
    await assert.rejects(owner.query('INSERT INTO disbursement_items(disbursement_id,item_id,requested_qty) VALUES($1,$2,1)', [grouped.id, groupedLines[0].item_id]), /unique|duplicate/)
    await asUser(admin,'admin',() => actions.confirmPostgresDisbursement(grouped.id))
    await owner.query("UPDATE items SET item_name='Renamed after approval',asset_no='RENAMED-AFTER-APPROVAL' WHERE id=$1", [groupedLines[0].item_id])
    const approvedDetail = await asUser(user,'user',() => queries.getPostgresDisbursementById(grouped.id))
    const approvedLine = approvedDetail!.items.find(line => line.item_id === groupedLines[0].item_id)!
    assert.equal(approvedLine.item_name_snapshot, groupedLines[0].item_id, 'approved history must retain the saved name')
    assert.equal(approvedLine.asset_no_snapshot, groupedLines[0].item_id, 'approved history must retain the saved asset number')
    assert.equal(approvedLine.unit_name_snapshot, null, 'missing historical fields must stay missing, not inherit later data')
    const listedGroup = (await asUser(admin,'admin',() => queries.getPostgresDisbursements({request_id:grouped.id}))).items[0]
    assert.equal(listedGroup.requested_items?.length, 3)
    assert.ok(listedGroup.requested_items?.every(line => line.line_id && line.issued_qty === 1 && line.returned_qty === 0 && line.status === 'issued'))
    await asUser(admin,'admin',() => actions.returnPostgresDisbursementItem({line_id:groupedLines[0].id, return_qty:1, condition:'normal'}))
    assert.equal((await owner.query('SELECT status FROM disbursements WHERE id=$1', [grouped.id])).rows[0].status, 'partially_returned')
    const groupedAvailable = await asUser(user,'user',() => queries.getPostgresCentralAvailableItems())
    assert.ok(groupedAvailable.some(item => item.id === groupedLines[0].item_id))
    assert.ok(groupedLines.slice(1).every(line => !groupedAvailable.some(item => item.id === line.item_id)))
    await assert.rejects(asUser(admin,'admin',() => actions.returnPostgresDisbursementItem({line_id:groupedLines[0].id, return_qty:1, condition:'normal'})))
    for (const line of groupedLines.slice(1)) await asUser(admin,'admin',() => actions.returnPostgresDisbursementItem({line_id:line.id, return_qty:1, condition:'normal'}))
    assert.equal((await owner.query('SELECT status FROM disbursements WHERE id=$1', [grouped.id])).rows[0].status, 'returned')
    const concurrent = await Promise.allSettled([asUser(user,'user',() => request(asset,'borrow')),asUser(other,'user',() => request(asset.toUpperCase(),'borrow'))])
    assert.equal(concurrent.filter(r => r.status === 'fulfilled').length,1)
    const borrow = concurrent.find(r => r.status === 'fulfilled') as PromiseFulfilledResult<{id:string}>
    await assert.rejects(asUser(admin,'admin',() => assignPostgresCustody({item_ids:[asset],recipient_id:user})), /รออนุมัติ|ยืม/)
    const requestRows = await asUser(admin,'admin',() => queries.getPostgresDisbursements({status:'pending_approval'}))
    assert.equal(requestRows.items.find(row => row.id === borrow.value.id)?.requested_items?.[0].item_id, asset)
    assert.equal(requestRows.items.find(row => row.id === borrow.value.id)?.requested_items?.[0].requested_qty, 1)
    const available = await asUser(user,'user',() => queries.getPostgresCentralAvailableItems())
    assert.equal(available.some(item => item.id === asset),false)
    const issue = await asUser(user,'user',() => request(material,'issue'))
    const handover = await asUser(user,'user',() => request(handed,'issue'))
    await assert.rejects(asUser(user,'user',() => actions.confirmPostgresDisbursement(issue.id)))
    const approvals = await Promise.allSettled([asUser(admin,'admin',() => actions.confirmPostgresDisbursement(issue.id)),asUser(admin,'admin',() => actions.confirmPostgresDisbursement(issue.id))])
    assert.equal(approvals.filter(r => r.status === 'fulfilled').length,1)
    assert.equal((await owner.query('SELECT quantity FROM materials WHERE id=$1',[material])).rows[0].quantity,9)
    assert.equal((await owner.query('SELECT count(*)::int AS n FROM stock_movements WHERE item_id=$1',[material])).rows[0].n,1)
    await asUser(admin,'admin',() => actions.confirmPostgresDisbursement(borrow.value.id))
    await asUser(admin,'admin',() => actions.confirmPostgresDisbursement(handover.id))
    const line = (await owner.query('SELECT id FROM disbursement_items WHERE disbursement_id=$1',[borrow.value.id])).rows[0].id as string
    await assert.rejects(asUser(user,'user',() => actions.returnPostgresDisbursementItem({line_id:line,return_qty:1,condition:'normal'})))
    await asUser(admin,'admin',() => actions.returnPostgresDisbursementItem({line_id:line,return_qty:1,condition:'normal'}))
    await assert.rejects(asUser(admin,'admin',() => actions.returnPostgresDisbursementItem({line_id:line,return_qty:1,condition:'normal'})))
    assert.equal((await owner.query('SELECT is_central FROM items WHERE id=$1',[asset])).rows[0].is_central,true)
    assert.equal((await owner.query("SELECT count(*)::int AS n FROM asset_custody_logs WHERE item_id=$1 AND action='return'",[asset])).rows[0].n,1)
    const cancel = await asUser(user,'user',() => request(cancellable,'borrow'))
    await assert.rejects(asUser(other,'user',() => actions.cancelPostgresDisbursementDraft({id:cancel.id})))
    await asUser(user,'user',() => actions.cancelPostgresDisbursementDraft({id:cancel.id}))
    const retry = await asUser(user,'user',() => request(cancellable,'borrow'))
    await asUser(admin,'admin',() => actions.rejectPostgresDisbursement(retry.id,'Fixture rejection'))
    const assigned = await asUser(admin,'admin',() => assignPostgresCustody({item_ids:[cancellable],recipient_id:user}))
    assert.equal(assigned.assigned,1)
    assert.equal((await owner.query('SELECT is_central FROM items WHERE id=$1',[cancellable])).rows[0].is_central,false)
    // Force failure at the final audit write, after approval has touched inventory,
    // lines, header and movement ledger; every effect must roll back.
    const rollback = await asUser(user,'user',() => request(material,'issue'))
    await owner.query("CREATE FUNCTION public.fixture_fail_approval() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action='CONFIRM_DISBURSEMENT' THEN RAISE EXCEPTION 'fixture final audit failure'; END IF; RETURN NEW; END $$; CREATE TRIGGER fixture_fail_approval BEFORE INSERT ON audit_logs FOR EACH ROW EXECUTE FUNCTION public.fixture_fail_approval()")
    await assert.rejects(asUser(admin,'admin',() => actions.confirmPostgresDisbursement(rollback.id)),(error: Error) => error.cause instanceof Error && error.cause.message.includes('fixture final audit failure'))
    assert.equal((await owner.query('SELECT quantity FROM materials WHERE id=$1',[material])).rows[0].quantity,8)
    assert.equal((await owner.query('SELECT status FROM disbursements WHERE id=$1',[rollback.id])).rows[0].status,'pending_approval')
    assert.equal((await owner.query('SELECT issued_qty FROM disbursement_items WHERE disbursement_id=$1',[rollback.id])).rows[0].issued_qty,0)
    assert.equal((await owner.query('SELECT count(*)::int AS n FROM stock_movements WHERE item_id=$1',[material])).rows[0].n,2)
    await owner.query('DROP TRIGGER fixture_fail_approval ON audit_logs; DROP FUNCTION public.fixture_fail_approval()')
    await asUser(user,'user',() => actions.cancelPostgresDisbursementDraft({id:rollback.id}))
    assert.equal((await owner.query('SELECT quantity FROM materials WHERE id=$1',[material])).rows[0].quantity,9)
    await asUser(admin,'admin',() => actions.reversePostgresDisbursement({disbursement_id:issue.id,reason:'Fixture reversal'}))
    assert.equal((await owner.query('SELECT quantity FROM materials WHERE id=$1',[material])).rows[0].quantity,10)
  } finally {
    await Promise.all(pools.map(pool => pool.end()))
    if (created) {
      assert.match(name, /^camms_disposable_[a-f0-9]{32}$/)
      assert.notEqual(name, new URL(env.DATABASE_MIGRATION_URL).pathname.slice(1))
      await management.query(`DROP DATABASE "${name}"`)
    }
    await management.end()
  }
})
