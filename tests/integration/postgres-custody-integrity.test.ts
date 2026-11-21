import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { parse } from 'dotenv'
import { Pool, type PoolClient } from 'pg'

test('PostgreSQL private.apply_asset_custody_event invariants, triggers and RLS boundaries', {
  skip: !existsSync('.env.postgres.app'),
  timeout: 60_000,
}, async () => {
  const env = parse(readFileSync('.env.postgres.app'))
  const fixtureDbName = `camms_regress_custody_${randomUUID().replaceAll('-', '')}`
  const management = new Pool({ connectionString: env.DATABASE_MIGRATION_URL, connectionTimeoutMillis: 5000 })

  function dbUrl(name: string) {
    const u = new URL(env.DATABASE_MIGRATION_URL)
    u.pathname = `/${name}`
    return u.toString()
  }

  await management.query(`CREATE DATABASE "${fixtureDbName}"`)
  const testDb = new Pool({ connectionString: dbUrl(fixtureDbName), connectionTimeoutMillis: 5000 })

  try {
    const migrationFiles = readdirSync('db/postgres/migrations')
      .filter(f => /^\d{4}_.+\.sql$/.test(f))
      .sort()

    for (const f of migrationFiles) {
      const sql = readFileSync(join('db/postgres/migrations', f), 'utf8')
      await testDb.query(sql)
    }

    const adminId = randomUUID()
    const userId = randomUUID()
    const otherUserId = randomUUID()

    await testDb.query(`
      INSERT INTO public.profiles (id, full_name, email, role, is_active)
      VALUES 
        ($1, 'Test Admin', 'admin@uat.test', 'admin', true),
        ($2, 'Test User', 'user@uat.test', 'user', true),
        ($3, 'Other User', 'other@uat.test', 'user', true)
    `, [adminId, userId, otherUserId])

    const catId = randomUUID()
    const locId = randomUUID()
    const unitId = randomUUID()

    await testDb.query(`INSERT INTO public.categories (id, name, item_type) VALUES ($1, 'IT Equipment', 'asset')`, [catId])
    await testDb.query(`INSERT INTO public.locations (id, name) VALUES ($1, 'Warehouse A')`, [locId])
    await testDb.query(`INSERT INTO public.units (id, name) VALUES ($1, 'เครื่อง')`, [unitId])

    const centralAssetId = randomUUID()
    const nonCentralAssetId = randomUUID()

    await testDb.query(`
      INSERT INTO public.items (id, item_name, item_type, category_id, location_id, unit_id, quantity, is_central, status, asset_no, note)
      VALUES 
        ($1, 'ThinkPad Laptop Central', 'asset', $3, $4, $5, 1, true, 'active', 'NB-001', 'ของส่วนกลาง'),
        ($2, 'Personal Desktop Non-Central', 'asset', $3, $4, $5, 1, false, 'active', 'PC-001', 'ประจำตัว')
    `, [centralAssetId, nonCentralAssetId, catId, locId, unitId])

    async function runInTx(asUserId: string | null, fn: (client: PoolClient) => Promise<void>) {
      const client = await testDb.connect()
      try {
        await client.query('BEGIN')
        if (asUserId) {
          await client.query(`SELECT set_config('app.user_id', $1, true)`, [asUserId])
        } else {
          await client.query(`SELECT set_config('app.user_id', '', true)`)
        }
        await fn(client)
        await client.query('COMMIT')
      } catch (e) {
        await client.query('ROLLBACK')
        throw e
      } finally {
        client.release()
      }
    }

    type DbError = { code?: string; message: string }

    // 1. Role check: User rejected with 42501
    await assert.rejects(
      runInTx(userId, async (client) => {
        await client.query(`SELECT private.apply_asset_custody_event($1, NULL, 'borrow', 1, 'normal', NULL, NULL)`, [centralAssetId])
      }),
      (err: DbError) => err.code === '42501' && err.message.includes('Admin required')
    )

    // 2. Role check: Anonymous rejected with 42501
    await assert.rejects(
      runInTx(null, async (client) => {
        await client.query(`SELECT private.apply_asset_custody_event($1, NULL, 'borrow', 1, 'normal', NULL, NULL)`, [centralAssetId])
      }),
      (err: DbError) => err.code === '42501' && err.message.includes('Admin required')
    )

    // 3. Validation: quantity <= 0 rejected with P0001
    await assert.rejects(
      runInTx(adminId, async (client) => {
        await client.query(`SELECT private.apply_asset_custody_event($1, NULL, 'borrow', 0, 'normal', NULL, NULL)`, [centralAssetId])
      }),
      (err: DbError) => err.message.includes('Invalid custody event parameters')
    )

    // 4. Non-existent line_id fails with P0002
    await assert.rejects(
      runInTx(adminId, async (client) => {
        await client.query(`SELECT private.apply_asset_custody_event($1, $2, 'borrow', 1, 'normal', NULL, NULL)`, [randomUUID(), randomUUID()])
      }),
      (err: DbError) => err.code === 'P0002'
    )

    // 5. Non-central asset rejected for borrow
    const docId1 = randomUUID()
    const lineId1 = randomUUID()
    await testDb.query(`
      INSERT INTO public.disbursements (id, transaction_type, recipient_name, department_name, purpose, status, due_date, created_by)
      VALUES ($1, 'asset_borrow', 'Recipient A', 'Dept A', 'Borrow test', 'pending_approval', '2026-12-31', $2)
    `, [docId1, userId])
    await testDb.query(`
      INSERT INTO public.disbursement_items (id, disbursement_id, item_id, requested_qty, status)
      VALUES ($1, $2, $3, 1, 'pending')
    `, [lineId1, docId1, nonCentralAssetId])

    await assert.rejects(
      runInTx(adminId, async (client) => {
        await client.query(`SELECT private.apply_asset_custody_event($1, $2, 'borrow', 1, 'normal', NULL, NULL)`, [nonCentralAssetId, lineId1])
      }),
      (err: DbError) => err.message.includes('Asset is not available for assignment')
    )

    // 6. Deferred constraint trigger catches missing line transition
    const docId2 = randomUUID()
    const lineId2 = randomUUID()
    await testDb.query(`
      INSERT INTO public.disbursements (id, transaction_type, recipient_name, department_name, purpose, status, due_date, created_by)
      VALUES ($1, 'asset_borrow', 'Recipient B', 'Dept B', 'Borrow Laptop', 'pending_approval', '2026-12-31', $2)
    `, [docId2, userId])
    await testDb.query(`
      INSERT INTO public.disbursement_items (id, disbursement_id, item_id, requested_qty, status)
      VALUES ($1, $2, $3, 1, 'pending')
    `, [lineId2, docId2, centralAssetId])

    await assert.rejects(
      runInTx(adminId, async (client) => {
        await client.query(`SELECT private.apply_asset_custody_event($1, $2, 'borrow', 1, 'normal', NULL, 'Note')`, [centralAssetId, lineId2])
      }),
      (err: DbError) => err.message.includes('Custody event requires the corresponding document transition')
    )

    // 7. Happy path borrow lifecycle & custody verification
    await runInTx(adminId, async (client) => {
      await client.query(`SELECT private.apply_asset_custody_event($1, $2, 'borrow', 1, 'normal', NULL, 'Assigned to Recipient B')`, [centralAssetId, lineId2])
      await client.query(`UPDATE public.disbursement_items SET status = 'issued', issued_qty = 1 WHERE id = $1`, [lineId2])
      await client.query(`UPDATE public.disbursements SET status = 'active_borrow', document_no = 'BR-2570-0001', fiscal_year = 2570, confirmed_at = now(), confirmed_by = $2 WHERE id = $1`, [docId2, adminId])
    })

    const afterBorrowAsset = (await testDb.query(`SELECT * FROM public.items WHERE id = $1`, [centralAssetId])).rows[0]
    assert.equal(afterBorrowAsset.is_central, false)
    assert.equal(afterBorrowAsset.responsible_person, 'Recipient B')
    assert.equal(afterBorrowAsset.custody_revision, '1')

    // 8. Return lifecycle (Full return to central pool)
    await runInTx(adminId, async (client) => {
      await client.query(`SELECT private.apply_asset_custody_event($1, $2, 'return', 1, 'normal', 'Returned in good condition', 'Returned to central', $3)`, [centralAssetId, lineId2, locId])
      await client.query(`UPDATE public.disbursement_items SET status = 'returned', returned_qty = 1 WHERE id = $1`, [lineId2])
      await client.query(`UPDATE public.disbursements SET status = 'returned' WHERE id = $1`, [docId2])
    })

    const afterReturnAsset = (await testDb.query(`SELECT * FROM public.items WHERE id = $1`, [centralAssetId])).rows[0]
    assert.equal(afterReturnAsset.is_central, true)
    assert.equal(afterReturnAsset.responsible_person, null)
    assert.equal(afterReturnAsset.custody_revision, '2')
  } finally {
    await testDb.end()
    await management.query(`DROP DATABASE IF EXISTS "${fixtureDbName}"`)
    await management.end()
  }
})
