import { Pool } from 'pg'
import { parse } from 'dotenv'
import { readFileSync, readdirSync } from 'fs'
import { join } from 'path'
import { randomUUID } from 'crypto'
import assert from 'node:assert/strict'

const env = parse(readFileSync('.env.postgres.app'))
const fixtureDbName = `camms_uat_dbtest_${randomUUID().replaceAll('-', '')}`
const management = new Pool({ connectionString: env.DATABASE_MIGRATION_URL })

function dbUrl(name: string) {
  const u = new URL(env.DATABASE_MIGRATION_URL)
  u.pathname = `/${name}`
  return u.toString()
}

async function run() {
  console.log(`[Phase 5 DB Testing] Creating isolated test database: ${fixtureDbName}`)
  await management.query(`CREATE DATABASE "${fixtureDbName}"`)

  const testDb = new Pool({ connectionString: dbUrl(fixtureDbName) })

  try {
    // 1. Apply migrations in order
    const migrationFiles = readdirSync('db/postgres/migrations')
      .filter(f => /^\d{4}_.+\.sql$/.test(f))
      .sort()

    for (const f of migrationFiles) {
      const sql = readFileSync(join('db/postgres/migrations', f), 'utf8')
      await testDb.query(sql)
    }
    console.log(`[Phase 5 DB Testing] Applied ${migrationFiles.length} migration files successfully.`)

    // 2. Setup roles and profiles
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

    // Setup Category & Location & Unit
    const catId = randomUUID()
    const locId = randomUUID()
    const unitId = randomUUID()

    await testDb.query(`INSERT INTO public.categories (id, name, item_type) VALUES ($1, 'IT Equipment', 'asset')`, [catId])
    await testDb.query(`INSERT INTO public.locations (id, name) VALUES ($1, 'Warehouse A')`, [locId])
    await testDb.query(`INSERT INTO public.units (id, name) VALUES ($1, 'เครื่อง')`, [unitId])

    // Setup Assets
    const centralAssetId = randomUUID()
    const nonCentralAssetId = randomUUID()
    const multiQtyAssetId = randomUUID()

    await testDb.query(`
      INSERT INTO public.items (id, item_name, item_type, category_id, location_id, unit_id, quantity, is_central, status, asset_no, note)
      VALUES 
        ($1, 'ThinkPad Laptop Central', 'asset', $4, $5, $6, 1, true, 'active', 'NB-001', 'ของส่วนกลาง'),
        ($2, 'Personal Desktop Non-Central', 'asset', $4, $5, $6, 1, false, 'active', 'PC-001', 'ประจำตัว'),
        ($3, 'Projector Multi-unit', 'asset', $4, $5, $6, 5, true, 'active', 'PJ-001', 'ส่วนกลางโปรเจคเตอร์')
    `, [centralAssetId, nonCentralAssetId, multiQtyAssetId, catId, locId, unitId])

    console.log(`[Phase 5 DB Testing] Test fixtures seeded successfully.`)

    const testResults: { name: string; pass: boolean; details: string; errCode?: string }[] = []

    // Helper to run in transaction as a specific user
    async function runInTx(asUserId: string | null, fn: (client: import('pg').PoolClient) => Promise<void>) {
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

    // TEST 1: Admin Authorization Check (Anonymous or User role must fail with 42501)
    try {
      await runInTx(userId, async (client) => {
        await client.query(`
          SELECT private.apply_asset_custody_event($1, NULL, 'borrow', 1, 'normal', NULL, NULL)
        `, [centralAssetId])
      })
      testResults.push({ name: 'Role check (user rejected)', pass: false, details: 'Did not throw error' })
    } catch (err: unknown) {
      const dbErr = err as DbError
      const pass = dbErr.code === '42501' && dbErr.message.includes('Admin required')
      testResults.push({
        name: 'Role check (user rejected with 42501)',
        pass,
        details: `code=${dbErr.code}, msg=${dbErr.message}`,
        errCode: dbErr.code
      })
    }

    // TEST 2: Anonymous call rejected with 42501
    try {
      await runInTx(null, async (client) => {
        await client.query(`
          SELECT private.apply_asset_custody_event($1, NULL, 'borrow', 1, 'normal', NULL, NULL)
        `, [centralAssetId])
      })
      testResults.push({ name: 'Role check (anonymous rejected)', pass: false, details: 'Did not throw error' })
    } catch (err: unknown) {
      const dbErr = err as DbError
      const pass = dbErr.code === '42501' && dbErr.message.includes('Admin required')
      testResults.push({
        name: 'Role check (anonymous rejected with 42501)',
        pass,
        details: `code=${dbErr.code}, msg=${dbErr.message}`,
        errCode: dbErr.code
      })
    }

    // TEST 3: Invalid parameters (zero quantity, invalid condition)
    try {
      await runInTx(adminId, async (client) => {
        await client.query(`
          SELECT private.apply_asset_custody_event($1, NULL, 'borrow', 0, 'normal', NULL, NULL)
        `, [centralAssetId])
      })
      testResults.push({ name: 'Validation: quantity <= 0 rejected', pass: false, details: 'Did not throw' })
    } catch (err: unknown) {
      const dbErr = err as DbError
      const pass = dbErr.message.includes('Invalid custody event parameters')
      testResults.push({
        name: 'Validation: quantity <= 0 rejected',
        pass,
        details: `code=${dbErr.code}, msg=${dbErr.message}`,
        errCode: dbErr.code
      })
    }

    // TEST 4: Non-existent item_id or line_id (P0002 query returned no rows)
    const fakeItemId = randomUUID()
    const fakeLineId = randomUUID()
    try {
      await runInTx(adminId, async (client) => {
        await client.query(`
          SELECT private.apply_asset_custody_event($1, $2, 'borrow', 1, 'normal', NULL, NULL)
        `, [fakeItemId, fakeLineId])
      })
      testResults.push({ name: 'Non-existent line_id fails with P0002', pass: false, details: 'Did not throw' })
    } catch (err: unknown) {
      const dbErr = err as DbError
      const pass = dbErr.code === 'P0002' // query returned no rows from INTO STRICT
      testResults.push({
        name: 'Non-existent line_id fails with P0002 (query returned no rows)',
        pass,
        details: `code=${dbErr.code}, msg=${dbErr.message}`,
        errCode: dbErr.code
      })
    }

    // TEST 5: Non-central asset cannot be borrowed/assigned ('Asset is not available for assignment')
    // First create a document with non-central asset
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

    try {
      await runInTx(adminId, async (client) => {
        await client.query(`
          SELECT private.apply_asset_custody_event($1, $2, 'borrow', 1, 'normal', NULL, NULL)
        `, [nonCentralAssetId, lineId1])
      })
      testResults.push({ name: 'Non-central asset rejected for borrow', pass: false, details: 'Did not throw' })
    } catch (err: unknown) {
      const dbErr = err as DbError
      const pass = dbErr.message.includes('Asset is not available for assignment')
      testResults.push({
        name: 'Non-central asset rejected for borrow',
        pass,
        details: `code=${dbErr.code}, msg=${dbErr.message}`,
        errCode: dbErr.code
      })
    }

    // TEST 6: Complete Happy Path Borrow & Constraint Trigger Check
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

    // If we call apply_asset_custody_event WITHOUT updating line & document, does deferred constraint trigger fail?
    try {
      await runInTx(adminId, async (client) => {
        await client.query(`
          SELECT private.apply_asset_custody_event($1, $2, 'borrow', 1, 'normal', NULL, 'Note')
        `, [centralAssetId, lineId2])
        // deliberately DO NOT update disbursement_items.status='issued' or document.status
      })
      testResults.push({ name: 'Deferred constraint trigger catches missing line transition', pass: false, details: 'Trigger did not fire' })
    } catch (err: unknown) {
      const dbErr = err as DbError
      const pass = dbErr.message.includes('Custody event requires the corresponding document transition')
      testResults.push({
        name: 'Deferred constraint trigger catches missing line transition',
        pass,
        details: `code=${dbErr.code}, msg=${dbErr.message}`,
        errCode: dbErr.code
      })
    }

    // TEST 7: Successful Borrow Transaction with line & document update
    await runInTx(adminId, async (client) => {
      // 1. Custody event
      await client.query(`
        SELECT private.apply_asset_custody_event($1, $2, 'borrow', 1, 'normal', NULL, 'Assigned to Recipient B')
      `, [centralAssetId, lineId2])

      // 2. Line update
      await client.query(`
        UPDATE public.disbursement_items 
        SET status = 'issued', issued_qty = 1 
        WHERE id = $1
      `, [lineId2])

      // 3. Document update with required approval metadata (document_no, fiscal_year, confirmed_at, confirmed_by)
      await client.query(`
        UPDATE public.disbursements 
        SET status = 'active_borrow', document_no = 'BR-2570-0001', fiscal_year = 2570, confirmed_at = now(), confirmed_by = $2 
        WHERE id = $1
      `, [docId2, adminId])
    })

    // Verify Asset State after Borrow
    const afterBorrowAsset = (await testDb.query(`SELECT * FROM public.items WHERE id = $1`, [centralAssetId])).rows[0]
    const borrowCustodyLog = (await testDb.query(`SELECT * FROM public.asset_custody_logs WHERE disbursement_item_id = $1`, [lineId2])).rows[0]

    assert.equal(afterBorrowAsset.is_central, false, 'Asset is_central should be false after borrow')
    assert.equal(afterBorrowAsset.responsible_person, 'Recipient B', 'Responsible person should be Recipient B')
    assert.equal(afterBorrowAsset.custody_revision, '1', 'Custody revision should advance to 1')
    assert.equal(afterBorrowAsset.latest_custody_event_id, borrowCustodyLog.id, 'Latest custody event id should match log')
    assert.equal(borrowCustodyLog.action, 'borrow')
    assert.equal(borrowCustodyLog.from_responsible, null)
    assert.equal(borrowCustodyLog.to_responsible, 'Recipient B')
    assert.equal(borrowCustodyLog.custody_origin_verified, true)

    testResults.push({
      name: 'Happy path borrow lifecycle & custody verification',
      pass: true,
      details: `Asset updated: is_central=false, responsible_person=Recipient B, revision=1, log_id=${borrowCustodyLog.id}`
    })

    // TEST 8: Return Lifecycle (Full return to central pool)
    await runInTx(adminId, async (client) => {
      // 1. Custody event return
      await client.query(`
        SELECT private.apply_asset_custody_event($1, $2, 'return', 1, 'normal', 'Returned in good condition', 'Returned to central', $3)
      `, [centralAssetId, lineId2, locId])

      // 2. Line update
      await client.query(`
        UPDATE public.disbursement_items 
        SET status = 'returned', returned_qty = 1 
        WHERE id = $1
      `, [lineId2])

      // 3. Document update
      await client.query(`
        UPDATE public.disbursements 
        SET status = 'returned', updated_at = now() 
        WHERE id = $1
      `, [docId2])
    })

    const afterReturnAsset = (await testDb.query(`SELECT * FROM public.items WHERE id = $1`, [centralAssetId])).rows[0]
    const returnCustodyLog = (await testDb.query(`SELECT * FROM public.asset_custody_logs WHERE disbursement_item_id = $1 AND action = 'return'`, [lineId2])).rows[0]

    assert.equal(afterReturnAsset.is_central, true, 'Asset is_central should be true after full return')
    assert.equal(afterReturnAsset.responsible_person, null, 'Responsible person should be null after return')
    assert.equal(afterReturnAsset.custody_revision, '2', 'Custody revision should advance to 2')
    assert.equal(returnCustodyLog.action, 'return')
    assert.equal(returnCustodyLog.custody_returned_qty_after, 1)

    testResults.push({
      name: 'Happy path return lifecycle & central pool restoration',
      pass: true,
      details: `Asset restored to central pool: is_central=true, responsible_person=null, revision=2`
    })

    // TEST 9: Direct Assignment (action='assignment')
    const assignAssetId = randomUUID()
    await testDb.query(`
      INSERT INTO public.items (id, item_name, item_type, category_id, location_id, unit_id, quantity, is_central, status, asset_no, note)
      VALUES ($1, 'Office Chair Central', 'asset', $2, $3, $4, 1, true, 'active', 'CH-001', 'เก้าอี้ส่วนกลาง')
    `, [assignAssetId, catId, locId, unitId])

    await runInTx(adminId, async (client) => {
      await client.query(`
        SELECT private.apply_asset_custody_event($1, NULL, 'assignment', 1, 'normal', 'Direct assignment to Test User', 'Assigned', NULL, $2)
      `, [assignAssetId, userId])
    })

    const afterAssignAsset = (await testDb.query(`SELECT * FROM public.items WHERE id = $1`, [assignAssetId])).rows[0]
    assert.equal(afterAssignAsset.is_central, false)
    assert.equal(afterAssignAsset.responsible_person, 'Test User')
    assert.equal(afterAssignAsset.custody_revision, '1')

    testResults.push({
      name: 'Direct assignment (action=assignment) verification',
      pass: true,
      details: `Assigned to Test User: is_central=false, responsible_person=Test User`
    })

    // TEST 10: Direct Custody Return (action='custody_return')
    await runInTx(adminId, async (client) => {
      await client.query(`
        SELECT private.apply_asset_custody_event($1, NULL, 'custody_return', 1, 'normal', 'Returned by user', 'Returned to central', $2)
      `, [assignAssetId, locId])
    })

    const afterCustodyReturnAsset = (await testDb.query(`SELECT * FROM public.items WHERE id = $1`, [assignAssetId])).rows[0]
    assert.equal(afterCustodyReturnAsset.is_central, true)
    assert.equal(afterCustodyReturnAsset.responsible_person, null)
    assert.equal(afterCustodyReturnAsset.custody_revision, '2')

    testResults.push({
      name: 'Direct custody return (action=custody_return) verification',
      pass: true,
      details: `Returned from custody: is_central=true, responsible_person=null`
    })

    // Print summary
    console.log('\n=========================================')
    console.log('PHASE 5 DATABASE CUSTODY INTEGRITY RESULTS')
    console.log('=========================================')
    let passCount = 0
    for (const r of testResults) {
      const mark = r.pass ? '✅ PASS' : '❌ FAIL'
      if (r.pass) passCount++
      console.log(`${mark}: ${r.name} -> ${r.details}`)
    }
    console.log(`\nTotal: ${testResults.length}, PASS: ${passCount}, FAIL: ${testResults.length - passCount}`)

  } finally {
    await testDb.end()
    console.log(`[Phase 5 DB Testing] Dropping isolated test database: ${fixtureDbName}`)
    await management.query(`DROP DATABASE "${fixtureDbName}"`)
    await management.end()
  }
}

run().catch(err => {
  console.error('[Phase 5 DB Testing Error]', err)
  process.exit(1)
})
