import assert from 'node:assert/strict'
import { AsyncLocalStorage } from 'node:async_hooks'
import { createHash, randomBytes, randomUUID } from 'node:crypto'
import { sql } from 'drizzle-orm'
import { Pool } from 'pg'

const credentials = JSON.parse(process.env.CAMMS_UAT_SESSIONS ?? '{}') as Record<string, string>
const databaseName = process.env.CAMMS_UAT_DATABASE
const connectionKeys = ['DATABASE_URL', 'DATABASE_AUTH_URL', 'DATABASE_MIGRATION_URL'] as const
assert.match(databaseName ?? '', /^camms_uat_[a-f0-9]{32}$/)
for (const key of connectionKeys) {
  const url = new URL(process.env[key] ?? '')
  assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))
  assert.equal(url.pathname, `/${databaseName}`)
}

// Supply a request cookie while exercising the real session query and server
// authorization against the restricted app and auth pools.
const request = new AsyncLocalStorage<string | undefined>()
const headers = require.resolve('next/headers')
require.cache[headers] = {
  id: headers, filename: headers, loaded: true,
  exports: { cookies: async () => ({ get: (name: string) => name === 'camms_session' ? { value: request.getStore() } : undefined }) },
} as NodeJS.Module

async function main() {
  const { profileForToken } = await import('../../lib/postgres/session')
  const { closePostgresPools, withIdentity } = await import('../../lib/postgres/db')
  const actions = await import('../../features/disbursements/postgres-actions')
  const queries = await import('../../features/disbursements/postgres-queries')
  const owner = new Pool({ connectionString: process.env.DATABASE_MIGRATION_URL, connectionTimeoutMillis: 5000 })
  const as = <T>(role: string, action: () => Promise<T>) => request.run(credentials[role], action)
  const results: { id: string; title: string; status: 'PASS' | 'FAIL'; details: string }[] = []
  async function check(id: string, title: string, callback: () => Promise<string>) {
    try { results.push({ id, title, status: 'PASS', details: await callback() }) }
    catch (error) { results.push({ id, title, status: 'FAIL', details: String(error) }) }
  }
  try {
    assert.equal((await owner.query('SELECT current_database() AS name')).rows[0].name, databaseName)
    const admin = await profileForToken(credentials.admin)
    const user = await profileForToken(credentials.user)
    const other = await profileForToken(credentials.other)
    assert.equal(admin?.role, 'admin')
    assert.equal(user?.role, 'user')
    assert.equal(other?.role, 'user')
    assert.ok(admin && user && other)

    async function material() {
      const id = randomUUID()
      await owner.query("INSERT INTO materials(id,item_name,item_type,quantity,is_central) VALUES($1,$2,'material',10,true)", [id, `Closure ${id}`])
      return id
    }
    const balance = async (id: string) => (await owner.query('SELECT quantity FROM materials WHERE id=$1', [id])).rows[0].quantity
    const issue = (id: string, quantity: number) => ({
      item_ids: [id], quantities: { [id]: quantity }, purpose: 'UAT closure', request_type: 'issue' as const, request_key: randomUUID(),
    })

    await check('C01', 'Concurrent same-key requests and replay are idempotent', async () => {
      const id = await material()
      const payload = issue(id, 2)
      const submit = () => as('user', () => actions.submitPostgresBorrowRequest(payload))
      const [first, second] = await Promise.all([submit(), submit()])
      assert.deepEqual(second, first)
      assert.deepEqual(await submit(), first)
      await assert.rejects(as('user', () => actions.submitPostgresBorrowRequest({ ...payload, quantities: { [id]: 3 } })), /คำขอเดิม|ซ้ำ/)
      assert.equal(await balance(id), 8)
      const documents = await owner.query('SELECT id FROM disbursements WHERE request_batch_id=$1', [first.batch_id])
      assert.deepEqual(documents.rows, [{ id: first.id }])
      const ledger = await owner.query('SELECT delta,balance_after,created_by FROM stock_movements WHERE item_id=$1', [id])
      assert.deepEqual(ledger.rows, [{ delta: -2, balance_after: 8, created_by: user.id }])
      const audit = await owner.query("SELECT user_id FROM audit_logs WHERE target_id=$1 AND action='REQUEST_ISSUE'", [first.id])
      assert.deepEqual(audit.rows, [{ user_id: user.id }])
      return 'Two independent database transactions, one batch, one document, one stock debit, one requester audit. Changed payload rejected.'
    })

    await check('C02', 'Independent concurrent requests cannot overspend stock', async () => {
      const id = await material()
      const requests = await Promise.allSettled(['user', 'other'].map(role =>
        as(role, () => actions.submitPostgresBorrowRequest(issue(id, 7))),
      ))
      const winners = requests.flatMap(result => result.status === 'fulfilled' ? [result.value] : [])
      assert.equal(winners.length, 1)
      const rejected = requests.find(result => result.status === 'rejected')
      assert.match(String(rejected?.reason), /จำนวน|พร้อมจ่าย/)
      assert.equal(await balance(id), 3)
      const ledgers = await owner.query('SELECT delta,balance_after FROM stock_movements WHERE item_id=$1', [id])
      assert.deepEqual(ledgers.rows, [{ delta: -7, balance_after: 3 }])
      const [winner] = winners
      const author = (await owner.query('SELECT created_by FROM disbursements WHERE id=$1', [winner.id])).rows[0].created_by
      assert.equal((await owner.query('SELECT count(*)::int AS n FROM disbursement_items WHERE item_id=$1', [id])).rows[0].n, 1)
      const cancel = () => as(author === user.id ? 'user' : 'other', () => actions.cancelPostgresDisbursementDraft({ id: winner.id }))
      await cancel()
      await assert.rejects(cancel())
      assert.equal(await balance(id), 10)
      const refunded = await owner.query("SELECT delta,balance_after FROM stock_movements WHERE item_id=$1 AND movement_type='reversal'", [id])
      assert.deepEqual(refunded.rows, [{ delta: 7, balance_after: 10 }])
      return 'One 7-unit requisition, one rejected contender, one 7-unit refund, duplicate cancellation rejected.'
    })

    await check('C03', 'Server authorization validates real sessions and ownership', async () => {
      const id = await material()
      const payload = issue(id, 2)
      await assert.rejects(as('anonymous', () => actions.submitPostgresBorrowRequest(payload)), /กรุณาเข้าสู่ระบบก่อนทำรายการ/)
      const disabledUser = randomUUID()
      credentials.disabled = randomBytes(32).toString('hex')
      credentials.expired = randomBytes(32).toString('hex')
      await owner.query("INSERT INTO profiles(id,full_name,role,is_active) VALUES($1,'Disabled UAT','user',false)", [disabledUser])
      const hash = (value: string) => createHash('sha256').update(value).digest('hex')
      await owner.query("INSERT INTO private_auth.sessions(token_hash,user_id,expires_at) VALUES($1,$2,now()+interval '1 hour'),($3,$4,now()-interval '1 hour')",
        [hash(credentials.disabled), disabledUser, hash(credentials.expired), user.id])
      for (const invalid of ['disabled', 'expired']) {
        await assert.rejects(as(invalid, () => actions.submitPostgresBorrowRequest(payload)), /กรุณาเข้าสู่ระบบก่อนทำรายการ/)
      }
      assert.equal(await balance(id), 10)
      const doc = await as('user', () => actions.submitPostgresBorrowRequest(payload))
      await assert.rejects(as('user', () => actions.confirmPostgresDisbursement(doc.id)), /ผู้ดูแลระบบ/)
      await assert.rejects(as('other', () => actions.cancelPostgresDisbursementDraft({ id: doc.id })))
      assert.equal(await as('other', () => queries.getPostgresDisbursementById(doc.id)), null)
      const inaccessible = await withIdentity(other.id, tx => tx.execute(sql`UPDATE public.disbursements SET status='cancelled' WHERE id=${doc.id} RETURNING id`))
      assert.equal(inaccessible.rows.length, 0)
      assert.equal(await balance(id), 8)
      await as('admin', () => actions.confirmPostgresDisbursement(doc.id))
      assert.equal(await balance(id), 8)
      assert.equal((await owner.query('SELECT status FROM disbursements WHERE id=$1', [doc.id])).rows[0].status, 'confirmed')
      const confirmation = await owner.query("SELECT user_id FROM audit_logs WHERE target_id=$1 AND action='CONFIRM_DISBURSEMENT'", [doc.id])
      assert.deepEqual(confirmation.rows, [{ user_id: admin.id }])
      return 'Anonymous, disabled and expired sessions denied. Other user cannot see or cancel. Admin confirms once, with no second debit.'
    })

    await check('C04', 'Database permits only the two supported account roles', async () => {
      for (const role of ['staff', 'viewer']) {
        await assert.rejects(owner.query('INSERT INTO profiles(id,full_name,role) VALUES($1,$2,$3)', [randomUUID(), 'Unsupported UAT role', role]),
          { code: '23514', constraint: 'profiles_role_check' })
      }
      return 'The current schema accepts admin and user in fixtures and rejects staff/viewer at profiles_role_check.'
    })
    await check('C05', 'A late audit failure rolls back an entire requisition', async () => {
      const id = await material()
      const payload = issue(id, 2)
      const before = await owner.query('SELECT count(*)::int AS n FROM disbursements')
      await owner.query(`
        CREATE FUNCTION public.uat_fail_request_audit() RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN RAISE EXCEPTION 'UAT audit failure'; END $$;
        CREATE TRIGGER uat_fail_request_audit BEFORE INSERT ON public.audit_logs
        FOR EACH ROW WHEN (NEW.action = 'REQUEST_ISSUE') EXECUTE FUNCTION public.uat_fail_request_audit()
      `)
      try {
        await assert.rejects(as('user', () => actions.submitPostgresBorrowRequest(payload)))
      } finally {
        await owner.query('DROP TRIGGER uat_fail_request_audit ON public.audit_logs; DROP FUNCTION public.uat_fail_request_audit()')
      }
      assert.equal(await balance(id), 10)
      assert.deepEqual((await owner.query('SELECT count(*)::int AS n FROM disbursements')).rows, before.rows)
      assert.equal((await owner.query('SELECT count(*)::int AS n FROM disbursement_items WHERE item_id=$1', [id])).rows[0].n, 0)
      assert.equal((await owner.query('SELECT count(*)::int AS n FROM stock_movements WHERE item_id=$1', [id])).rows[0].n, 0)
      assert.equal((await owner.query('SELECT count(*)::int AS n FROM request_batches WHERE request_key=$1', [payload.request_key])).rows[0].n, 0)
      assert.ok((await as('user', () => actions.submitPostgresBorrowRequest(payload))).id)
      assert.equal(await balance(id), 8)
      return 'Injected failure at the audit insert rolled back the batch, document, line and debit. Same key then succeeded exactly once.'
    })
    process.stdout.write(JSON.stringify(results))
  } finally {
    await Promise.all([owner.end(), closePostgresPools()])
  }
}

main().catch(error => { console.error(error instanceof Error ? error.message : 'Closure check failed'); process.exitCode = 1 })
