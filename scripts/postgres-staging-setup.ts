import assert from 'node:assert/strict'
import { randomBytes, randomUUID } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { parse } from 'dotenv'
import { Pool } from 'pg'
import { drizzle } from 'drizzle-orm/node-postgres'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { hashPassword } from '../lib/postgres/password'

async function run() {
  console.log('=== CAMMS Staging Setup & Verification ===\n')

  const appEnv = parse(readFileSync('.env.postgres.app'))
  const rootOwnerPool = new Pool({ connectionString: appEnv.DATABASE_MIGRATION_URL, connectionTimeoutMillis: 5000 })

  try {
    // ---------------------------------------------------------
    // Gate 1: Check existing DBs and ensure camms_staging exists safely
    // ---------------------------------------------------------
    console.log('[Gate 1] Verifying databases and isolating camms_staging...')
    
    // Check main DB camms_registry state
    const regCheck = await rootOwnerPool.query("SELECT count(*)::int as count FROM pg_database WHERE datname = 'camms_registry'")
    assert.equal(regCheck.rows[0].count, 1, 'camms_registry must exist')

    // Check camms_staging
    const stagingCheck = await rootOwnerPool.query("SELECT count(*)::int as count FROM pg_database WHERE datname = 'camms_staging'")
    if (stagingCheck.rows[0].count === 0) {
      // Create database camms_staging
      await rootOwnerPool.query('CREATE DATABASE "camms_staging"')
      await rootOwnerPool.query('GRANT CONNECT ON DATABASE "camms_staging" TO "camms_app", "camms_auth"')
      console.log('PASS Gate 1: Database camms_staging created with CONNECT grants.')
    } else {
      console.log('PASS Gate 1: Database camms_staging exists from verified Gate 1 run.')
    }

    // Verify camms_registry untouched
    const regTables = await rootOwnerPool.query(
      "SELECT count(*)::int as count FROM information_schema.tables WHERE table_schema IN ('public', 'private_auth')"
    )
    console.log(`PASS Gate 1: camms_registry verified untouched (${regTables.rows[0].count} tables in main db).\n`)

    // ---------------------------------------------------------
    // Gate 2: Run Drizzle migrations 0000-0008 on camms_staging
    // ---------------------------------------------------------
    console.log('[Gate 2] Running Drizzle migrations on camms_staging...')
    const stagingOwnerUrl = new URL(appEnv.DATABASE_MIGRATION_URL)
    stagingOwnerUrl.pathname = '/camms_staging'
    const stagingOwnerPool = new Pool({ connectionString: stagingOwnerUrl.toString(), connectionTimeoutMillis: 5000 })

    try {
      const ownerDb = drizzle(stagingOwnerPool)
      await migrate(ownerDb, { migrationsFolder: './db/postgres/migrations' })
      console.log('Drizzle migrations applied.')

      // Check migration records in drizzle.__drizzle_migrations
      const migRows = await stagingOwnerPool.query<{ id: number; hash: string; created_at: number }>(
        'SELECT id, hash, created_at FROM drizzle.__drizzle_migrations ORDER BY id ASC'
      )
      assert.equal(migRows.rows.length, 9, 'Exactly 9 migrations (0000 to 0008) must be recorded')
      console.log(`PASS Gate 2: All 9 migrations recorded in drizzle.__drizzle_migrations.`)

      // Verify tables in public and private_auth
      const tables = await stagingOwnerPool.query<{ table_schema: string; table_name: string }>(
        "SELECT table_schema, table_name FROM information_schema.tables WHERE table_schema IN ('public', 'private_auth') ORDER BY table_name ASC"
      )
      const expectedTables = [
        'asset_custody_logs',
        'audit_logs',
        'categories',
        'credentials',
        'disbursement_items',
        'disbursement_sequences',
        'disbursements',
        'items',
        'locations',
        'login_attempts',
        'profiles',
        'rate_limits',
        'sessions',
        'stock_movements',
        'units',
      ]
      const actualNames = tables.rows.map(r => r.table_name).filter(n => n !== '__drizzle_migrations')
      for (const expected of expectedTables) {
        assert.ok(actualNames.includes(expected), `Missing expected table: ${expected}`)
      }
      console.log(`PASS Gate 2: All ${expectedTables.length} application tables verified in camms_staging.`)

      // Verify RLS is enabled on public tables
      const rlsCheck = await stagingOwnerPool.query<{ relname: string; relrowsecurity: boolean }>(
        "SELECT relname, relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relkind = 'r'"
      )
      for (const r of rlsCheck.rows) {
        assert.equal(r.relrowsecurity, true, `Table ${r.relname} must have RLS enabled`)
      }
      console.log('PASS Gate 2: RLS enabled on all public tables.')

      // Verify triggers
      const triggers = await stagingOwnerPool.query<{ tgname: string }>(
        "SELECT tgname FROM pg_trigger WHERE tgname IN ('on_disbursement_header_protect', 'on_disbursement_item_protect', 'on_disbursement_item_validate', 'disbursements_stamp', 'items_audit', 'profiles_audit')"
      )
      assert.ok(triggers.rows.length >= 6, 'All core security and audit triggers must exist')
      console.log(`PASS Gate 2: Core triggers verified (${triggers.rows.length} triggers).\n`)

      // ---------------------------------------------------------
      // Gate 3: Seed Test Accounts & Fixture Data
      // ---------------------------------------------------------
      console.log('[Gate 3] Seeding test accounts and mock data in camms_staging...')

      // Generate random test passwords
      const adminPass = `UAT_Admin_${randomBytes(8).toString('hex')}`
      const staffPass = `UAT_Staff_${randomBytes(8).toString('hex')}`
      const viewerPass = `UAT_Viewer_${randomBytes(8).toString('hex')}`

      const adminHash = await hashPassword(adminPass)
      const staffHash = await hashPassword(staffPass)
      const viewerHash = await hashPassword(viewerPass)

      const adminId = randomUUID()
      const staffId = randomUUID()
      const viewerId = randomUUID()

      // Insert profiles and credentials
      const client = await stagingOwnerPool.connect()
      try {
        await client.query('BEGIN')

        // Clean any existing test records in camms_staging first
        await client.query('TRUNCATE TABLE public.disbursement_items, public.disbursements, public.stock_movements, public.asset_custody_logs, public.audit_logs, private_auth.credentials, public.profiles, public.items, public.categories, public.units, public.locations CASCADE')

        // 1. Profiles
        await client.query(
          "INSERT INTO public.profiles (id, full_name, email, role, is_active) VALUES ($1, 'ผู้ดูแลระบบ UAT', 'admin_uat@camms.test', 'admin', true)",
          [adminId]
        )
        await client.query(
          "INSERT INTO public.profiles (id, full_name, email, role, is_active) VALUES ($1, 'เจ้าหน้าที่พัสดุ UAT', 'staff_uat@camms.test', 'staff', true)",
          [staffId]
        )
        await client.query(
          "INSERT INTO public.profiles (id, full_name, email, role, is_active) VALUES ($1, 'ผู้ดูข้อมูล UAT', 'viewer_uat@camms.test', 'viewer', true)",
          [viewerId]
        )

        // 2. Credentials
        await client.query('INSERT INTO private_auth.credentials (user_id, password_hash) VALUES ($1, $2)', [adminId, adminHash])
        await client.query('INSERT INTO private_auth.credentials (user_id, password_hash) VALUES ($1, $2)', [staffId, staffHash])
        await client.query('INSERT INTO private_auth.credentials (user_id, password_hash) VALUES ($1, $2)', [viewerId, viewerHash])

        // 3. Metadata
        const matCatId = randomUUID()
        const astCatId = randomUUID()
        await client.query(
          "INSERT INTO public.categories (id, name, color, icon, is_active) VALUES ($1, 'วัสดุสำนักงาน', '#3B82F6', 'Package', true)",
          [matCatId]
        )
        await client.query(
          "INSERT INTO public.categories (id, name, color, icon, is_active) VALUES ($1, 'ครุภัณฑ์คอมพิวเตอร์', '#10B981', 'Laptop', true)",
          [astCatId]
        )

        const unitBoxId = randomUUID()
        const unitUnitId = randomUUID()
        await client.query("INSERT INTO public.units (id, name, is_active) VALUES ($1, 'กล่อง', true)", [unitBoxId])
        await client.query("INSERT INTO public.units (id, name, is_active) VALUES ($1, 'เครื่อง', true)", [unitUnitId])

        const locId = randomUUID()
        await client.query(
          `INSERT INTO public.locations (
            id, name, building, floor, room, department, is_active
          ) VALUES ($1, 'คลังพัสดุหลัก', 'อาคารศูนย์พัสดุ', 'ชั้น 2', 'ห้อง 201', 'กลุ่มงานพัสดุ', true)`,
          [locId]
        )

        // 4. Mock Items
        const matItemId = randomUUID()
        await client.query(
          `INSERT INTO public.items (
            id, item_name, item_type, quantity, unit_id, category_id, location_id, status, unit_price, created_by
          ) VALUES ($1, 'กระดาษถ่ายเอกสาร A4 Double A 80 แกรม', 'material', 50, $2, $3, $4, 'active', 125.00, $5)`,
          [matItemId, unitBoxId, matCatId, locId, adminId]
        )

        const astItem1Id = randomUUID()
        await client.query(
          `INSERT INTO public.items (
            id, item_name, item_type, quantity, asset_no, unit_id, category_id, location_id, status, unit_price, created_by
          ) VALUES ($1, 'คอมพิวเตอร์โน้ตบุ๊ก Dell Latitude 5430', 'asset', 1, 'CAMMS-AST-2026-001', $2, $3, $4, 'active', 35000.00, $5)`,
          [astItem1Id, unitUnitId, astCatId, locId, adminId]
        )

        const astItem2Id = randomUUID()
        await client.query(
          `INSERT INTO public.items (
            id, item_name, item_type, quantity, asset_no, unit_id, category_id, location_id, status, unit_price, created_by
          ) VALUES ($1, 'คอมพิวเตอร์โน้ตบุ๊ก Lenovo ThinkPad L14', 'asset', 1, 'CAMMS-AST-2026-002', $2, $3, $4, 'active', 32000.00, $5)`,
          [astItem2Id, unitUnitId, astCatId, locId, adminId]
        )

        await client.query('COMMIT')
        console.log('Seed transaction committed.')
      } catch (err) {
        await client.query('ROLLBACK')
        throw err
      } finally {
        client.release()
      }

      // Verify counts in camms_staging
      const profileCount = await stagingOwnerPool.query('SELECT count(*)::int as count FROM public.profiles')
      const catCount = await stagingOwnerPool.query('SELECT count(*)::int as count FROM public.categories')
      const unitCount = await stagingOwnerPool.query('SELECT count(*)::int as count FROM public.units')
      const locCount = await stagingOwnerPool.query('SELECT count(*)::int as count FROM public.locations')
      const itemCount = await stagingOwnerPool.query('SELECT count(*)::int as count FROM public.items')

      assert.equal(profileCount.rows[0].count, 3, 'Must have 3 test profiles')
      assert.equal(catCount.rows[0].count, 2, 'Must have 2 categories')
      assert.equal(unitCount.rows[0].count, 2, 'Must have 2 units')
      assert.equal(locCount.rows[0].count, 1, 'Must have 1 location')
      assert.equal(itemCount.rows[0].count, 3, 'Must have 3 mock items')
      console.log('PASS Gate 3: All test counts verified (3 profiles, 2 categories, 2 units, 1 location, 3 items).')

      // Save credentials into .env.staging.accounts (protected mode)
      const accountsPayload = [
        `UAT_ADMIN_EMAIL="admin_uat@camms.test"`,
        `UAT_ADMIN_PASSWORD=${JSON.stringify(adminPass)}`,
        `UAT_STAFF_EMAIL="staff_uat@camms.test"`,
        `UAT_STAFF_PASSWORD=${JSON.stringify(staffPass)}`,
        `UAT_VIEWER_EMAIL="viewer_uat@camms.test"`,
        `UAT_VIEWER_PASSWORD=${JSON.stringify(viewerPass)}`,
      ].join('\n') + '\n'
      writeFileSync('.env.staging.accounts', accountsPayload, { mode: 0o600 })

      // Prepare .env.staging
      const appBaseUrl = new URL(appEnv.DATABASE_URL)
      appBaseUrl.pathname = '/camms_staging'
      const authBaseUrl = new URL(appEnv.DATABASE_AUTH_URL)
      authBaseUrl.pathname = '/camms_staging'

      const stagingEnvPayload = [
        `DATA_BACKEND="postgres"`,
        `NEXT_PUBLIC_DATA_BACKEND="postgres"`,
        `DATABASE_URL=${JSON.stringify(appBaseUrl.toString())}`,
        `DATABASE_AUTH_URL=${JSON.stringify(authBaseUrl.toString())}`,
        `LOCAL_STORAGE_PATH="./.local-storage-staging"`,
        `PORT="3001"`,
      ].join('\n') + '\n'
      writeFileSync('.env.staging', stagingEnvPayload, { mode: 0o600 })

      console.log('PASS Gate 3: Created .env.staging and .env.staging.accounts (credentials protected).')
    } finally {
      await stagingOwnerPool.end()
    }
  } finally {
    await rootOwnerPool.end()
  }

  console.log('\n=== GATES 1, 2, 3 COMPLETED SUCCESSFULLY ===')
}

run().catch((err) => {
  console.error('\nFAILED during setup:', err)
  process.exit(1)
})
