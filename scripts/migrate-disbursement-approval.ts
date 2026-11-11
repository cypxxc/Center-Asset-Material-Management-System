import { Pool } from 'pg'
import { parse } from 'dotenv'
import { readFileSync } from 'fs'

async function run() {
  const env = parse(readFileSync('.env.postgres.app'))
  const pool = new Pool({ connectionString: env.DATABASE_MIGRATION_URL || env.DATABASE_URL })
  try {
    await pool.query('ALTER TABLE disbursements DROP CONSTRAINT IF EXISTS disbursements_status_check;')
    await pool.query(
      "ALTER TABLE disbursements ADD CONSTRAINT disbursements_status_check CHECK (status in ('draft','pending_approval','confirmed','active_borrow','partially_returned','returned','reversed','cancelled','rejected'));"
    )
    console.log('Successfully updated disbursements_status_check constraint')
  } finally {
    await pool.end()
  }
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
