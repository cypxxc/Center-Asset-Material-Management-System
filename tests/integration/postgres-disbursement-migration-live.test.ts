import '../setup/dom'
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { parse } from 'dotenv'
import { Pool } from 'pg'
import { drizzle } from 'drizzle-orm/node-postgres'
import { migrate } from 'drizzle-orm/node-postgres/migrator'

test(
  'fresh database executes disbursement migration 0008, verifies RLS, grants, and immutability triggers idempotently',
  { skip: process.env.POSTGRES_ADMIN_LIVE_TEST !== '1' || !existsSync('.env.postgres.app'), timeout: 120_000 },
  async () => {
    const env = parse(readFileSync('.env.postgres.app'))
    const databaseName = `camms_disposable_${randomUUID().replaceAll('-', '')}`
    assert.match(databaseName, /^camms_disposable_[a-f0-9]{32}$/)

    const adminPool = new Pool({ connectionString: env.DATABASE_MIGRATION_URL, connectionTimeoutMillis: 5000 })
    const fixturePools: Pool[] = []
    let created = false

    function fixturePool(connection: string) {
      const url = new URL(connection)
      url.pathname = `/${databaseName}`
      const pool = new Pool({ connectionString: url.toString(), connectionTimeoutMillis: 5000 })
      fixturePools.push(pool)
      return pool
    }

    try {
      // 1. Create a completely isolated, disposable test database
      await adminPool.query(`CREATE DATABASE "${databaseName}"`)
      created = true

      const ownerPool = fixturePool(env.DATABASE_MIGRATION_URL)
      const owner = drizzle(ownerPool)

      // 2. Migrate from clean/empty state through 0008
      await migrate(owner, { migrationsFolder: './db/postgres/migrations' })
      const migrationRows = await ownerPool.query('SELECT * FROM drizzle.__drizzle_migrations ORDER BY id ASC')
      assert.equal(migrationRows.rows.length, 9, 'All 9 migrations (0000-0008) must be recorded')

      // 3. Verify idempotency: running migrate again causes no errors and creates no duplicate records
      await migrate(owner, { migrationsFolder: './db/postgres/migrations' })
      const countAfter = await ownerPool.query('SELECT count(*)::int as count FROM drizzle.__drizzle_migrations')
      assert.equal(countAfter.rows[0].count, 9)

      // 4. Verify all disbursement tables exist
      const tableRows = await ownerPool.query<{ tablename: string }>(
        "SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename IN ('disbursements', 'disbursement_items', 'disbursement_sequences', 'stock_movements', 'asset_custody_logs')"
      )
      const tableNames = tableRows.rows.map((r) => r.tablename).sort()
      assert.deepEqual(tableNames, [
        'asset_custody_logs',
        'disbursement_items',
        'disbursement_sequences',
        'disbursements',
        'stock_movements',
      ])

      // 5. Verify RLS is enabled on all disbursement tables
      const rlsRows = await ownerPool.query<{ relname: string; relrowsecurity: boolean }>(
        "SELECT relname, relrowsecurity FROM pg_class WHERE relname IN ('disbursements', 'disbursement_items', 'disbursement_sequences', 'stock_movements', 'asset_custody_logs')"
      )
      for (const row of rlsRows.rows) {
        assert.equal(row.relrowsecurity, true, `Table ${row.relname} must have RLS enabled`)
      }

      // 6. Verify policies exist and target camms_app
      const policyRows = await ownerPool.query<{ tablename: string; policyname: string; roles: string[] }>(
        "SELECT tablename, policyname, roles::text[] FROM pg_policies WHERE schemaname = 'public' AND tablename LIKE 'disbursement%'"
      )
      assert.ok(policyRows.rows.length >= 4, 'Must have read and write policies for disbursement tables')
      for (const policy of policyRows.rows) {
        assert.ok(policy.roles.includes('camms_app'), `Policy ${policy.policyname} must target camms_app`)
      }

      // 7. Verify triggers exist
      const triggerRows = await ownerPool.query<{ tgname: string }>(
        "SELECT tgname FROM pg_trigger WHERE tgname IN ('on_disbursement_header_protect', 'on_disbursement_item_protect', 'on_disbursement_item_validate', 'disbursements_stamp')"
      )
      const triggerNames = triggerRows.rows.map((r) => r.tgname).sort()
      assert.deepEqual(triggerNames, [
        'disbursements_stamp',
        'on_disbursement_header_protect',
        'on_disbursement_item_protect',
        'on_disbursement_item_validate',
      ])

      // 8. Test runtime access through camms_app role with mock identity
      const appPool = fixturePool(env.DATABASE_URL)
      const adminId = randomUUID()
      await ownerPool.query(
        "INSERT INTO public.profiles(id, full_name, email, role, is_active) VALUES ($1, 'Admin Fixture', 'fixture@example.com', 'admin', true)",
        [adminId]
      )

      // Test camms_app insert using with user identity session
      const client = await appPool.connect()
      try {
        await client.query('BEGIN')
        await client.query("SELECT set_config('app.user_id', $1, true)", [adminId])

        const insertRes = await client.query<{ id: string }>(
          "INSERT INTO public.disbursements (transaction_type, recipient_name, department_name, purpose, status) VALUES ('material_issue', 'ผู้รับทดสอบ', 'ฝ่ายทดสอบ', 'เพื่อการทดสอบ', 'draft') RETURNING id"
        )
        const docId = insertRes.rows[0].id
        assert.ok(docId)

        // Verify select via camms_app
        const selectRes = await client.query<{ status: string }>('SELECT status FROM public.disbursements WHERE id = $1', [docId])
        assert.equal(selectRes.rows[0].status, 'draft')

        // Test immutability trigger: confirmed documents cannot be deleted
        await client.query("UPDATE public.disbursements SET status = 'confirmed', confirmed_at = now() WHERE id = $1", [docId])
        await assert.rejects(
          client.query('DELETE FROM public.disbursements WHERE id = $1', [docId]),
          /Cannot delete non-draft disbursement document/
        )

        await client.query('ROLLBACK')
      } finally {
        client.release()
      }
    } finally {
      // 9. Clean up all pools and DROP the disposable test database
      await Promise.all(fixturePools.map((pool) => pool.end()))
      if (created) {
        assert.match(databaseName, /^camms_disposable_[a-f0-9]{32}$/)
        assert.notEqual(databaseName, new URL(env.DATABASE_MIGRATION_URL).pathname.slice(1))
        await adminPool.query(`DROP DATABASE "${databaseName}"`)
      }
      await adminPool.end()
    }
  }
)
