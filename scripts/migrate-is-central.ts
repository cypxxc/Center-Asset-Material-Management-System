import { Pool } from 'pg'
import { parse } from 'dotenv'
import { readFileSync } from 'fs'

async function run() {
  const env = parse(readFileSync('.env.postgres.app'))
  const pool = new Pool({ connectionString: env.DATABASE_MIGRATION_URL })
  try {
    await pool.query('ALTER TABLE "items" ADD COLUMN IF NOT EXISTS "is_central" boolean NOT NULL DEFAULT false;')
    await pool.query('CREATE INDEX IF NOT EXISTS "items_is_central_index" ON "items" ("is_central") WHERE "deleted_at" IS NULL;')
    const res = await pool.query("UPDATE \"items\" SET \"is_central\" = true WHERE \"note\" ILIKE '%ส่วนกลาง%' AND \"item_type\" = 'asset' RETURNING id, item_name, is_central;")
    console.log('Migrated items count:', res.rowCount)
  } finally {
    await pool.end()
  }
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
