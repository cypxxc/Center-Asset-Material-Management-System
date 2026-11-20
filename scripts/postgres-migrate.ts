import type { Pool } from 'pg'
import { drizzle } from 'drizzle-orm/node-postgres'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { readMigrationFiles } from 'drizzle-orm/migrator'

const migrationsFolder = './db/postgres/migrations'
const transitionRequired = 'CAMMS database requires a migration transition. The final baseline was not applied. See README.md.'

export async function migratePostgres(pool: Pool) {
  const expected = readMigrationFiles({ migrationsFolder })
  if (!expected.length) throw new Error('CAMMS migration files are missing')

  const client = await pool.connect()
  try {
    await client.query("SELECT pg_catalog.pg_advisory_lock(pg_catalog.hashtext('camms-schema-migrations'))")
    const { rows: [catalog] } = await client.query<{ has_journal: boolean; has_schema: boolean }>(`
      SELECT pg_catalog.to_regclass('drizzle.__drizzle_migrations') IS NOT NULL AS has_journal,
        EXISTS (
          SELECT 1 FROM pg_catalog.pg_namespace
          WHERE nspname NOT IN ('public', 'information_schema') AND nspname !~ '^pg_'
          UNION ALL
          SELECT 1 FROM pg_catalog.pg_depend d
          JOIN pg_catalog.pg_namespace n ON n.oid = d.refobjid
          WHERE d.refclassid = 'pg_catalog.pg_namespace'::regclass AND n.nspname = 'public'
        ) AS has_schema
    `)
    if (catalog.has_journal) {
      const { rows } = await client.query<{ hash: string; stamp: string }>(
        'SELECT hash, created_at::text AS stamp FROM drizzle.__drizzle_migrations ORDER BY created_at, id'
      )
      if (!rows.length || rows.some((row, index) => {
        const migration = expected[index]
        return !migration || row.hash !== migration.hash || row.stamp !== String(migration.folderMillis)
      })) throw new Error(transitionRequired)
    } else if (catalog.has_schema) {
      throw new Error(transitionRequired)
    }

    await migrate(drizzle(client), { migrationsFolder })
  } finally {
    // Destroy the dedicated session to release its migration lock even on failure.
    client.release(true)
  }
}
